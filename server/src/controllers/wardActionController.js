import { z } from 'zod';
import { applyWardAction, WARD_ACTIONS } from '../services/wardActionService.js';

const WardActionSchema = z.object({
  action: z.enum(WARD_ACTIONS),
  reason: z.string().trim().max(500).optional(),
  version: z.coerce.number().int().positive().optional(),
  closeOutcome: z.enum(['confirmed-clear', 'unchanged']).optional(),
  actor: z.string().trim().max(80).optional(),
});

const NEED_REASON = ['request-info', 'invalid', 'hide', 'note'];

export class WardActionController {
  // POST /api/flood-points/:id/ward-action
  async doAction(req, res) {
    const parsed = WardActionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_BODY', message: 'Dữ liệu không hợp lệ: ' + parsed.error.issues[0]?.message },
      });
    }
    if (NEED_REASON.includes(parsed.data.action) && !parsed.data.reason) {
      return res.status(400).json({
        ok: false,
        error: { code: 'REASON_REQUIRED', message: 'Thao tác này cần nhập lý do hoặc nội dung' },
      });
    }

    try {
      const result = applyWardAction(req.params.id, parsed.data);
      if (result.error === 'NOT_FOUND') {
        return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy điểm ngập' } });
      }
      if (result.error === 'VERSION_CONFLICT') {
        return res.status(409).json({
          ok: false,
          error: { code: 'VERSION_CONFLICT', message: 'Điểm ngập đã được cập nhật bởi người khác' },
          data: result.point,
        });
      }
      return res.status(200).json({ ok: true, data: result.point });
    } catch (err) {
      return res.status(500).json({ ok: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } });
    }
  }
}

export const wardActionController = new WardActionController();
