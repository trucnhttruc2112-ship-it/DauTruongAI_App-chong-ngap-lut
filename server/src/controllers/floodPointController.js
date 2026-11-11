import crypto from 'crypto';
import { z } from 'zod';
import { floodPointQueryService } from '../services/floodPointQueryService.js';
import RULES from '../config/rules.js';

// Schema xác thực Query Params cho danh sách điểm ngập và GeoJSON
const FloodPointsQuerySchema = z.object({
  status: z.string().optional().default('active'),
  wardId: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  isFloodProne: z
    .enum(['true', 'false', '1', '0'])
    .transform((val) => val === 'true' || val === '1')
    .optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'bbox phải có định dạng minLng,minLat,maxLng,maxLat')
    .optional(),
});

// Schema xác thực Query Params cho danh sách điểm hay ngập
const FloodProneQuerySchema = z.object({
  minEvents: z.coerce.number().int().positive().default(RULES.FLOOD_PRONE_MIN_EVENTS).optional(),
  wardId: z.string().optional(),
});

export class FloodPointController {
  // GET /api/flood-points
  async listPoints(req, res) {
    const parseResult = FloodPointsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Tham số truy vấn không hợp lệ: ' + parseResult.error.issues[0]?.message,
          details: parseResult.error.issues,
        },
      });
    }

    try {
      const data = floodPointQueryService.listFloodPoints(parseResult.data);
      return res.status(200).json({
        ok: true,
        data,
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Lỗi khi tải danh sách điểm ngập: ' + err.message,
        },
      });
    }
  }

  // GET /api/flood-points.geojson
  async getGeoJson(req, res) {
    const parseResult = FloodPointsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Tham số truy vấn GeoJSON không hợp lệ: ' + parseResult.error.issues[0]?.message,
          details: parseResult.error.issues,
        },
      });
    }

    try {
      const geoJson = floodPointQueryService.getGeoJson(parseResult.data);
      const bodyStr = JSON.stringify(geoJson);
      const etag = `W/"${crypto.createHash('md5').update(bodyStr).digest('hex')}"`;

      res.set('ETag', etag);
      res.set('Cache-Control', 'public, max-age=10');

      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      return res.status(200).type('application/json').send(bodyStr);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Lỗi khi xuất GeoJSON: ' + err.message,
        },
      });
    }
  }

  // GET /api/flood-points/:id
  async getDetails(req, res) {
    const { id } = req.params;
    try {
      const point = floodPointQueryService.getFloodPointDetails(id);
      if (!point) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Không tìm thấy điểm ngập với mã định danh đã cung cấp',
          },
        });
      }

      return res.status(200).json({
        ok: true,
        data: point,
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Lỗi khi tải chi tiết điểm ngập: ' + err.message,
        },
      });
    }
  }

  // GET /api/flood-prone
  async getFloodProne(req, res) {
    const parseResult = FloodProneQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Tham số truy vấn điểm hay ngập không hợp lệ: ' + parseResult.error.issues[0]?.message,
          details: parseResult.error.issues,
        },
      });
    }

    try {
      const data = floodPointQueryService.getFloodProneSummary(parseResult.data);
      return res.status(200).json({
        ok: true,
        data,
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Lỗi khi lấy danh sách tuyến đường hay ngập: ' + err.message,
        },
      });
    }
  }

  // GET /api/wards/:wardId/flood-points
  async getWardPoints(req, res) {
    const { wardId } = req.params;
    if (!wardId) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_WARD_ID',
          message: 'Mã phường/xã (wardId) là bắt buộc',
        },
      });
    }

    try {
      const data = floodPointQueryService.getWardFloodPoints(wardId);
      return res.status(200).json({
        ok: true,
        data,
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Lỗi khi lấy dữ liệu điểm ngập theo phường: ' + err.message,
        },
      });
    }
  }
}

export const floodPointController = new FloodPointController();
export default floodPointController;
