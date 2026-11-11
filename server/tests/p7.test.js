import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';
import { runSeed } from '../scripts/seed.js';
import { validateEnvironmentConfig } from '../src/config/env.js';
import { getFloodProneForForecast } from '../integration/nv5-flood-prone-adapter.js';

describe('Prompt 7: Gói tích hợp NV1, NV2, NV5 (tests/p7.test.js)', () => {
  let db;

  beforeAll(() => {
    db = getDb();
    runMigrations(db);
    runSeed(db);
  });

  afterAll(() => {
    closeDb();
  });

  describe('1. Kiểm tra cấu hình CORS & ALLOWED_ORIGINS', () => {
    it('1. validateEnvironmentConfig ném lỗi khi NODE_ENV=production mà ALLOWED_ORIGINS rỗng', () => {
      expect(() => {
        validateEnvironmentConfig({
          NODE_ENV: 'production',
          DATA_MODE: 'demo',
          AI_MODE: 'mock',
          ALLOWED_ORIGINS: [],
        });
      }).toThrow('Môi trường production (NODE_ENV=production) bắt buộc phải cấu hình ALLOWED_ORIGINS hợp lệ');
    });

    it('2. validateEnvironmentConfig chấp nhận khi NODE_ENV=production có ALLOWED_ORIGINS hợp lệ', () => {
      expect(() => {
        validateEnvironmentConfig({
          NODE_ENV: 'production',
          DATA_MODE: 'real',
          AI_MODE: 'remote',
          ALLOWED_ORIGINS: ['https://flood.dongnai.gov.vn', 'https://app.dongnai.gov.vn'],
        });
      }).not.toThrow();
    });

    it('3. Máy chủ chấp nhận Origin nằm trong ALLOWED_ORIGINS mặc định (http://localhost:3000)', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('4. Máy chủ chặn 403 CORS_BLOCKED với Origin lạ không thuộc danh sách trắng và khác nguồn', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://unknown-attacker-domain.org');

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('CORS_BLOCKED');
    });
  });

  describe('2. NV5 Adapter (getFloodProneForForecast)', () => {
    it('chuyển đổi đúng cấu trúc { id, lat, lng, street, wardId, eventCount, severityWeight }', async () => {
      const mockFetch = async (url) => {
        expect(url).toContain('/api/flood-prone');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: [
              {
                key: 'street:nguyen_ai_quoc',
                street: 'Nguyễn Ái Quốc',
                wardId: 'trang-dai',
                centerLat: 10.965,
                centerLng: 106.845,
                eventCount: 5,
                avgSeverity: 'high',
                pointIds: ['fp_01', 'fp_02'],
              },
              {
                key: 'street:dong_khoi',
                street: 'Đồng Khởi',
                wardId: 'tan-hiep',
                centerLat: 10.955,
                centerLng: 106.835,
                eventCount: 3,
                avgSeverity: 'low',
                pointIds: ['fp_03'],
              },
            ],
          }),
        };
      };

      const result = await getFloodProneForForecast({
        apiBase: 'http://localhost:3000',
        minEvents: 2,
        wardId: 'trang-dai',
        fetchImpl: mockFetch,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      // Điểm high -> weight 3
      expect(result[0]).toEqual({
        id: 'street:nguyen_ai_quoc',
        lat: 10.965,
        lng: 106.845,
        street: 'Nguyễn Ái Quốc',
        wardId: 'trang-dai',
        eventCount: 5,
        severityWeight: 3,
      });

      // Điểm low -> weight 1
      expect(result[1]).toEqual({
        id: 'street:dong_khoi',
        lat: 10.955,
        lng: 106.835,
        street: 'Đồng Khởi',
        wardId: 'tan-hiep',
        eventCount: 3,
        severityWeight: 1,
      });
    });
  });

  describe('3. Tĩnh phục vụ file ví dụ tích hợp (/integration)', () => {
    it('phục vụ tĩnh /integration/nv1-leaflet-example.html thành công', async () => {
      const res = await request(app).get('/integration/nv1-leaflet-example.html');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('NV1 Example');
      expect(res.text).toContain('ConfirmWidget');
    });
  });
});
