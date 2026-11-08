import { z } from 'zod';
import { confirmationService } from '../services/confirmationService.js';

const ConfirmationBodySchema = z.object({
  type: z.enum(['still', 'ended'], {
    errorMap: () => ({ message: "Loại xác nhận (type) chỉ được là 'still' hoặc 'ended'" }),
  }),
  deviceId: z.string().min(1, 'Mã thiết bị (deviceId) không được để trống'),
  lat: z.coerce.number({ invalid_type_error: 'Vĩ độ (lat) phải là số' }),
  lng: z.coerce.number({ invalid_type_error: 'Kinh độ (lng) phải là số' }),
});

export class ConfirmationController {
  async confirmPoint(req, res) {
    const parseResult = ConfirmationBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: parseResult.error.issues[0]?.message || 'Dữ liệu xác nhận không hợp lệ',
          details: parseResult.error.issues,
        },
      });
    }

    try {
      const result = await confirmationService.confirmPoint({
        floodPointId: req.params.id,
        ...parseResult.data,
        now: req.headers['x-fake-now'] ? new Date(req.headers['x-fake-now']) : new Date(),
      });

      return res.status(200).json(result);
    } catch (err) {
      const statusCode = err.status || 500;
      const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

      return res.status(statusCode).json({
        ok: false,
        error: {
          code: errorCode,
          message: err.message,
        },
      });
    }
  }
}

export const confirmationController = new ConfirmationController();
export default confirmationController;
