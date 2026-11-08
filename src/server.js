import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ENV } from './config/env.js';
import floodPointRepo from './repositories/floodPointRepo.js';
import reportRoutes from './routes/reportRoutes.js';
import { ipLimiter } from './middleware/rateLimiter.js';

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

// Phục vụ tĩnh ảnh upload
app.use('/uploads', express.static(uploadFullPath));

// Áp dụng giới hạn tần suất chung IP
app.use('/api', ipLimiter);

// Đăng ký các Route API
app.use('/api/reports', reportRoutes);

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

// Khởi chạy server nếu được gọi trực tiếp
if (process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server'))) {
  app.listen(ENV.PORT, () => {
    console.log(`🚀 [NV4 Server] Đang chạy tại ${ENV.PUBLIC_BASE_URL} (Cổng ${ENV.PORT})`);
    console.log(`   - Chế độ AI: ${ENV.AI_MODE}`);
    console.log(`   - Chế độ dữ liệu: ${ENV.DATA_MODE}`);
  });
}

export default app;
