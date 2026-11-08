import { reportService } from '../services/reportService.js';

export class ReportController {
  async createReport(req, res) {
    try {
      const result = await reportService.processReport({
        file: req.file,
        body: req.body,
        options: {
          simulate: req.query.simulate || req.headers['x-ai-simulate'] || req.body?.simulate,
          simulateErrorMidway: req.headers['x-simulate-db-error'] === 'true',
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
