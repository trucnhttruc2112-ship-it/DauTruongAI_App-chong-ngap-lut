import express from 'express';
import multer from 'multer';
import RULES from '../config/rules.js';
import { reportController } from '../controllers/reportController.js';
import { deviceReportLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Cấu hình Multer lưu tạm trong bộ nhớ (Memory Storage) để xử lý Sharp và tính mã băm
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: RULES.MAX_UPLOAD_FILE_SIZE_BYTES, // 8MB
  },
});

// Middleware xử lý lỗi Multer (file quá lớn, lỗi upload)
function handleMulterUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Kích thước file ảnh vượt quá giới hạn cho phép (${RULES.MAX_UPLOAD_FILE_SIZE_BYTES / (1024 * 1024)}MB)`,
          },
        });
      }
      return res.status(400).json({
        ok: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: `Lỗi tải lên tệp: ${err.message}`,
        },
      });
    }
    next();
  });
}

// POST /api/reports
router.post('/', handleMulterUpload, deviceReportLimiter, (req, res) => {
  return reportController.createReport(req, res);
});

export default router;
