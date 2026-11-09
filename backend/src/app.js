import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { readConfig } from './config.js';
import { createFloodAnalyzer } from './gemini.js';
import { ApiError, MAX_IMAGE_BYTES, prepareImage, normalizeAnalysis } from './utils.js';

export function createApp({ config = readConfig(), analyzer = createFloodAnalyzer(config), logger = console } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(cors((req, callback) => {
    const origin = req.get('origin');
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin && origin !== ownOrigin && !config.allowedOrigins.includes(origin)) {
      return callback(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origin chưa được cho phép trong ALLOWED_ORIGINS.'));
    }
    callback(null, { origin: origin || false, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] });
  }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'floodlens-nv3',
      mode: config.mock ? 'mock' : 'gemini',
      gemini: {
        configured: Boolean(config.apiKey),
        model: config.model,
        connectivity: 'not_checked',
      },
      analysisReady: config.mock || Boolean(config.apiKey),
    });
  });
  app.get('/test', (_req, res) => {
    res.sendFile(fileURLToPath(new URL('../public/test.html', import.meta.url)));
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES + 1, files: 1, fields: 0, parts: 2, fieldNameSize: 100 },
  }).single('image');

  app.post('/api/analyze-flood', (req, res, next) => {
    if (!req.is('multipart/form-data')) {
      return next(new ApiError(415, 'MULTIPART_REQUIRED', 'Gửi ảnh bằng multipart/form-data với trường image.'));
    }
    upload(req, res, error => {
      if (!error) return next();
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(413, 'IMAGE_TOO_LARGE', 'Ảnh không được vượt quá 5 MB (5.242.880 byte).'));
      }
      next(new ApiError(400, 'INVALID_UPLOAD', 'Multipart không hợp lệ. Chỉ gửi một file trong trường image, không kèm trường khác.'));
    });
  }, async (req, res) => {
    const image = await prepareImage(req.file);
    const prediction = await analyzer(image);
    const result = normalizeAnalysis(prediction, {
      model: config.mock ? 'mock' : config.model,
      mode: config.mock ? 'mock' : 'gemini',
    });
    res.json(result);
  });

  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Endpoint không tồn tại.')));
  app.use((error, _req, res, _next) => {
    const known = error instanceof ApiError;
    if (!known) logger.error('Lỗi nội bộ khi xử lý yêu cầu NV3.');
    // Never return/log provider messages, image bytes, stack traces or API keys.
    const status = known ? error.status : 500;
    res.status(status).json({
      error: {
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'Backend gặp lỗi không xác định. Vui lòng thử lại sau.',
      },
    });
  });
  return app;
}
