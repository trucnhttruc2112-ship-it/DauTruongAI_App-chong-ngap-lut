import { reportService } from '../services/reportService.js';

export class ReportController {
  async createReport(req, res) {
    try {
      const isTestEnv = process.env.NODE_ENV === 'test';
      const result = await reportService.processReport({
        file: req.file,
        body: req.body,
        options: {
          simulate: isTestEnv ? (req.query.simulate || req.headers['x-ai-simulate'] || req.body?.simulate) : undefined,
          simulateErrorMidway: isTestEnv ? (req.headers['x-simulate-db-error'] === 'true') : false,
          aiMode: isTestEnv ? (req.headers['x-ai-mode'] || req.query.aiMode) : undefined,
        },
      });

      return res.status(201).json(result);
    } catch (err) {
      const statusCode = err.status || 500;
      const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

      return res.status(statusCode).json({
        ok: false,
        error: {
          code: errorCode,
          message: err.message,
          ...(err.errors ? { errors: err.errors } : {}),
          ...(err.details ? { details: err.details } : {}),
        },
      });
    }
  }
}

export const reportController = new ReportController();
export default reportController;
