import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ENV, validateEnvironmentConfig } from './config/env.js';
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

// Đảm bảo thư mục upload tồn tại
const uploadFullPath = path.resolve(ENV.UPLOAD_DIR);
if (!fs.existsSync(uploadFullPath)) {
  fs.mkdirSync(uploadFullPath, { recursive: true });
}

// Cấu hình Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Cho phép gọi không có origin (curl, mobile app, postman) hoặc nằm trong danh sách trắng
    if (!origin || ENV.ALLOWED_ORIGINS.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    return callback(new Error('Chặn bởi cấu hình CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ tĩnh ảnh upload và thư mục public (cho frontend NV4)
app.use('/uploads', express.static(uploadFullPath));
app.use(express.static(path.resolve('public')));

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

// Khởi chạy background job quét hết hạn tự động (Chỉ chạy ngoài môi trường test)
if (process.env.NODE_ENV !== 'test') {
  const expireIntervalMs = (RULES.EXPIRE_JOB_INTERVAL_MINUTES || 5) * 60 * 1000;
  setInterval(() => {
    try {
      const res = runExpireOnce(new Date());
      if (res.expiredCount > 0) {
        console.log(`⏱️ [Expire Job] Đã tự động hết hạn ${res.expiredCount} điểm ngập:`, res.expiredPointIds);
      }
    } catch (err) {
      console.error('Lỗi khi chạy background job quét hết hạn điểm ngập:', err.message);
    }
  }, expireIntervalMs);
}

// Khởi chạy server nếu được gọi trực tiếp
if (process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server'))) {
  app.listen(ENV.PORT, () => {
    console.log(`🚀 [NV4 Server] Đang chạy tại ${ENV.PUBLIC_BASE_URL} (Cổng ${ENV.PORT})`);
    console.log(`   - Chế độ AI: ${ENV.AI_MODE}`);
    console.log(`   - Chế độ dữ liệu: ${ENV.DATA_MODE}`);
  });
}

export default app;
