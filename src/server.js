import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ENV, validateEnvironmentConfig } from './config/env.js';
import { closeDb } from './db/connection.js';
import floodPointRepo from './repositories/floodPointRepo.js';
import reportRoutes from './routes/reportRoutes.js';
import floodPointRoutes from './routes/floodPointRoutes.js';
import wardRoutes from './routes/wardRoutes.js';
import { floodPointController } from './controllers/floodPointController.js';
import { ipLimiter } from './middleware/rateLimiter.js';
import { runExpireOnce } from './services/expirationService.js';
import RULES from './config/rules.js';

// Kiểm tra tính hợp lệ của cấu hình hệ thống
validateEnvironmentConfig(ENV);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Thiết lập trust proxy: mặc định tắt (false) khi không đứng sau reverse proxy/load balancer
app.set('trust proxy', ENV.TRUST_PROXY);

// Đảm bảo thư mục upload tồn tại
const uploadFullPath = path.resolve(ENV.UPLOAD_DIR);
if (!fs.existsSync(uploadFullPath)) {
  fs.mkdirSync(uploadFullPath, { recursive: true });
}

// Cấu hình Middleware CORS
app.use(
  cors((req, callback) => {
    const origin = req.header('Origin');

    // (a) Không có header Origin (curl, mobile app, postman, direct browser navigation)
    if (!origin) {
      return callback(null, { origin: true, credentials: true });
    }

    // (b) Origin nằm trong danh sách trắng ALLOWED_ORIGINS hoặc localhost / 127.0.0.1
    if (
      ENV.ALLOWED_ORIGINS.includes(origin) ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, { origin: true, credentials: true });
    }

    // (c) Host của Origin trùng với host của yêu cầu (tôn trọng cấu hình trust proxy của Express qua req.hostname)
    try {
      const originUrl = new URL(origin);
      const originHost = (originUrl.host || '').replace(/:(80|443)$/, '');

      const reqHostname = (req.hostname || '').replace(/:(80|443)$/, '');
      const reqHostHeader = (req.get('host') || '').replace(/:(80|443)$/, '');

      if (originHost && (originHost === reqHostname || originHost === reqHostHeader || originUrl.hostname === req.hostname)) {
        return callback(null, { origin: true, credentials: true });
      }
    } catch {
      // URL origin không hợp lệ
    }

    // Origin khác nguồn và không nằm trong danh sách được phép
    const corsError = new Error('Chặn bởi cấu hình CORS');
    corsError.name = 'CorsError';
    corsError.status = 403;
    return callback(corsError);
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware thiết lập các Header bảo mật cơ bản (không dùng thêm thư viện ngoài)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Chặn truy cập các tệp nhạy cảm (.env, .sqlite, path traversal, file ẩn)
app.use((req, res, next) => {
  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(req.path).toLowerCase();
  } catch {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_URI', message: 'Đường dẫn không hợp lệ' },
    });
  }
  if (
    decodedPath.includes('.env') ||
    decodedPath.includes('.sqlite') ||
    decodedPath.includes('..') ||
    /(^|\/)\.[^\/\.]/.test(decodedPath)
  ) {
    return res.status(403).json({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Truy cập bị từ chối' },
    });
  }
  next();
});

// Phục vụ tĩnh ảnh upload: chỉ cho phép file ảnh hợp lệ, không liệt kê thư mục, không thực thi
app.use('/uploads', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Phương thức không được phép' },
    });
  }
  const ext = path.extname(req.path).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  if (!allowedExts.includes(ext)) {
    return res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Tệp không tồn tại hoặc không được hỗ trợ' },
    });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(uploadFullPath, {
  dotfiles: 'deny',
  index: false,
}));

// Phục vụ tĩnh thư mục public (frontend NV4)
app.use(express.static(path.resolve('public'), {
  dotfiles: 'deny',
  index: false,
}));

// Thư mục /integration chỉ được phục vụ khi NODE_ENV khác production
app.use('/integration', (req, res, next) => {
  if (process.env.NODE_ENV === 'production' || ENV.NODE_ENV === 'production') {
    return res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Tài nguyên tích hợp chỉ có sẵn ở môi trường phát triển / thử nghiệm' },
    });
  }
  next();
}, express.static(path.resolve('integration'), {
  dotfiles: 'deny',
  index: false,
}));

// Áp dụng giới hạn tần suất chung IP
app.use('/api', ipLimiter);

// Đăng ký các Route API
app.use('/api/reports', reportRoutes);

// Endpoint GeoJSON (phục vụ Leaflet NV1)
app.get('/api/flood-points.geojson', (req, res) => floodPointController.getGeoJson(req, res));

// Endpoint danh sách và chi tiết điểm ngập
app.use('/api/flood-points', floodPointRoutes);

// Endpoint danh sách các tuyến đường hay ngập (phục vụ NV1, NV5)
app.get('/api/flood-prone', (req, res) => floodPointController.getFloodProne(req, res));

// Endpoint dữ liệu điểm ngập theo phường (phục vụ NV2)
app.use('/api/wards', wardRoutes);

// Endpoint kiểm tra sức khỏe hệ thống (Health Check)
app.get('/api/health', (req, res) => {
  try {
    const pointsCount = floodPointRepo.countAll();
    return res.status(200).json({
      ok: true,
      data: {
        status: 'up',
        time: new Date().toISOString(),
        pointsCount,
        aiMode: ENV.AI_MODE,
        dataMode: ENV.DATA_MODE,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Lỗi kiểm tra trạng thái máy chủ: ' + err.message,
      },
    });
  }
});

// Middleware xử lý 404 cho các route không tồn tại (trả JSON chuẩn { ok: false, error })
app.use((req, res) => {
  return res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Tài nguyên hoặc đường dẫn không tồn tại trên máy chủ',
    },
  });
});

// Middleware xử lý lỗi tập trung
app.use((err, req, res, next) => {
  if (err.name === 'CorsError' || err.message?.includes('CORS') || err.status === 403) {
    return res.status(403).json({
      ok: false,
      error: {
        code: 'CORS_BLOCKED',
        message: err.message || 'Chặn bởi cấu hình CORS',
      },
    });
  }

  const statusCode = err.status || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'Lỗi máy chủ nội bộ';

  // Chống lộ stack trace, đường dẫn máy chủ hoặc chi tiết nội bộ khi gặp lỗi 500
  if (statusCode >= 500) {
    console.error('💥 [Internal Server Error]:', err);
    code = 'INTERNAL_SERVER_ERROR';
    message = 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.';
  }

  return res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message,
    },
  });
});

// Khởi chạy background job quét hết hạn tự động (Chỉ chạy ngoài môi trường test)
let expireJobTimer = null;
if (process.env.NODE_ENV !== 'test') {
  const expireIntervalMs = (RULES.EXPIRE_JOB_INTERVAL_MINUTES || 5) * 60 * 1000;
  expireJobTimer = setInterval(() => {
    try {
      const res = runExpireOnce(new Date());
      if (res.expiredCount > 0) {
        console.log(`⏱️ [Expire Job] Đã tự động hết hạn ${res.expiredCount} điểm ngập:`, res.expiredPointIds);
      }
    } catch (err) {
      console.error('Lỗi khi chạy background job quét hết hạn điểm ngập:', err.message);
    }
  }, expireIntervalMs);
  if (expireJobTimer.unref) {
    expireJobTimer.unref();
  }
}

export function shutdownServer(serverInstance = null) {
  if (expireJobTimer) {
    clearInterval(expireJobTimer);
    expireJobTimer = null;
  }
  closeDb();
  if (serverInstance && typeof serverInstance.close === 'function') {
    serverInstance.close();
  }
}

// Bắt tín hiệu dừng hệ thống SIGTERM & SIGINT
process.on('SIGTERM', () => {
  console.log('🛑 Nhận tín hiệu SIGTERM, đang dừng hệ thống an toàn...');
  shutdownServer();
});

process.on('SIGINT', () => {
  console.log('🛑 Nhận tín hiệu SIGINT, đang dừng hệ thống an toàn...');
  shutdownServer();
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 [Unhandled Rejection]:', reason);
});

// Khởi chạy server nếu được gọi trực tiếp
let serverInstance = null;
if (process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server'))) {
  serverInstance = app.listen(ENV.PORT, () => {
    console.log(`🚀 [NV4 Server] Đang chạy tại ${ENV.PUBLIC_BASE_URL} (Cổng ${ENV.PORT})`);
    console.log(`   - Chế độ AI: ${ENV.AI_MODE}`);
    console.log(`   - Chế độ dữ liệu: ${ENV.DATA_MODE}`);
  });
}

export default app;
