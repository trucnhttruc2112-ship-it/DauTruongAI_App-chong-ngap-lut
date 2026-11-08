import rateLimit from 'express-rate-limit';
import RULES from '../config/rules.js';

/**
 * Giới hạn tần suất chung theo địa chỉ IP (20 request / phút).
 */
export const ipLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: RULES.RATE_LIMIT_REQUESTS_PER_MINUTE, // 20
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-ip-rate-limit'] !== 'true',
  handler: (req, res) => {
    return res.status(429).json({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.',
      },
    });
  },
});

/**
 * Giới hạn tần suất gửi báo cáo ngập theo thiết bị (5 báo cáo / giờ / deviceId).
 */
export const deviceReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: RULES.RATE_LIMIT_REPORTS_PER_HOUR, // 5
  keyGenerator: (req) => {
    return req.body?.deviceId || req.headers['x-device-id'] || req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Thiết bị của bạn đã gửi quá giới hạn 5 báo cáo trong 1 giờ. Vui lòng thử lại sau.',
      },
    });
  },
});

export default {
  ipLimiter,
  deviceReportLimiter,
};
