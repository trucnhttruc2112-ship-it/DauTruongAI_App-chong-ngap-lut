import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';
import { runSeed } from '../scripts/seed.js';

import { generateUuid, getDeviceId } from '../public/nv4/deviceId.js';
import { getFriendlyErrorMessage } from '../public/nv4/errorMessages.js';
import { formatGeoError } from '../public/nv4/geo.js';
import { calculateScaledDimensions, checkSecureContext } from '../public/nv4/camera.js';

describe('Prompt 6 - Frontend Pure Logic & Static Server Serving', () => {
  let db;

  beforeAll(() => {
    db = getDb();
    runMigrations(db);
    runSeed(db);
  });

  afterAll(() => {
    closeDb();
  });
  describe('1. deviceId.js', () => {
    it('sinh UUID v4 đúng định dạng chuẩn', () => {
      const uuid = generateUuid();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('lấy ID hiện có trong storage hoặc lưu mới nếu chưa có', () => {
      const mockStorage = {
        data: {},
        getItem(key) {
          return this.data[key] || null;
        },
        setItem(key, val) {
          this.data[key] = val;
        },
      };

      const id1 = getDeviceId(mockStorage);
      expect(id1).toBeTruthy();
      expect(mockStorage.data.nv4_device_id).toBe(id1);

      // Lần gọi thứ 2 phải trả về đúng id1
      const id2 = getDeviceId(mockStorage);
      expect(id2).toBe(id1);
    });

    it('fallback an toàn khi localStorage bị chặn hoặc ném lỗi', () => {
      const throwingStorage = {
        getItem() {
          throw new Error('Access denied in private mode');
        },
        setItem() {
          throw new Error('Access denied in private mode');
        },
      };

      const fallbackId = getDeviceId(throwingStorage);
      expect(fallbackId).toBeTruthy();
      expect(typeof fallbackId).toBe('string');
    });
  });

  describe('2. errorMessages.js', () => {
    it('chuyển đổi chính xác các mã lỗi API sang tiếng Việt thân thiện', () => {
      expect(getFriendlyErrorMessage('OUT_OF_AREA')).toContain('Đồng Nai');
      expect(getFriendlyErrorMessage('GPS_TOO_INACCURATE')).toContain('> 100m');
      expect(getFriendlyErrorMessage('REPORT_TOO_OLD')).toContain('30 phút');
      expect(getFriendlyErrorMessage('DUPLICATE_IMAGE')).toContain('trùng lặp');
      expect(getFriendlyErrorMessage({ code: 'RATE_LIMITED', retryAfterMinutes: 5 })).toContain('5 phút');
      expect(getFriendlyErrorMessage('409')).toContain('trùng');
      expect(getFriendlyErrorMessage('422')).toContain('hợp lệ');
      expect(getFriendlyErrorMessage('NETWORK_ERROR')).toContain('kết nối mạng');
      expect(getFriendlyErrorMessage('SECURE_CONTEXT_REQUIRED')).toContain('HTTPS');
    });

    it('xử lý an toàn khi đầu vào rỗng hoặc không xác định', () => {
      expect(getFriendlyErrorMessage(null)).toContain('Đã xảy ra lỗi không xác định');
      expect(getFriendlyErrorMessage('UNKNOWN_CODE_XYZ')).toContain('Đã xảy ra lỗi');
    });
  });

  describe('3. geo.js formatGeoError', () => {
    it('hướng dẫn bật quyền GPS tiếng Việt cho Android và iOS khi code = 1', () => {
      const res = formatGeoError({ code: 1 });
      expect(res.code).toBe('GEO_PERMISSION_DENIED');
      expect(res.detail).toContain('Android');
      expect(res.detail).toContain('iPhone');
    });

    it('thông báo lỗi tín hiệu yếu khi code = 2', () => {
      const res = formatGeoError({ code: 2 });
      expect(res.code).toBe('GEO_POSITION_UNAVAILABLE');
      expect(res.message).toContain('GPS không khả dụng');
    });

    it('thông báo quá thời gian chờ khi code = 3', () => {
      const res = formatGeoError({ code: 3 });
      expect(res.code).toBe('GEO_TIMEOUT');
      expect(res.message).toContain('Quá thời gian');
    });
  });

  describe('4. camera.js pure logic', () => {
    it('tính toán kích thước ảnh thu nhỏ giữ đúng tỷ lệ và <= 1600px', () => {
      // Chiều ngang lớn
      const r1 = calculateScaledDimensions(3200, 1600, 1600);
      expect(r1.width).toBe(1600);
      expect(r1.height).toBe(800);
      expect(r1.scaled).toBe(true);

      // Chiều dọc lớn
      const r2 = calculateScaledDimensions(1000, 2000, 1600);
      expect(r2.width).toBe(800);
      expect(r2.height).toBe(1600);
      expect(r2.scaled).toBe(true);

      // Ảnh nhỏ sẵn không bị phóng to
      const r3 = calculateScaledDimensions(800, 600, 1600);
      expect(r3.width).toBe(800);
      expect(r3.height).toBe(600);
      expect(r3.scaled).toBe(false);

      // Kích thước không hợp lệ
      const r4 = calculateScaledDimensions(0, 0, 1600);
      expect(r4.scaled).toBe(false);
      expect(r4.width).toBe(0);
    });

    it('kiểm tra môi trường an toàn (HTTPS/localhost)', () => {
      expect(checkSecureContext({ isSecureContext: true })).toBe(true);
      expect(checkSecureContext({ isSecureContext: false, location: { hostname: 'example.com', protocol: 'http:' } })).toBe(false);
      expect(checkSecureContext({ isSecureContext: false, location: { hostname: 'localhost', protocol: 'http:' } })).toBe(true);
      expect(checkSecureContext({ isSecureContext: false, location: { hostname: '127.0.0.1', protocol: 'http:' } })).toBe(true);
    });
  });

  describe('5. Tích hợp máy chủ Static Serving', () => {
    it('phục vụ tĩnh /nv4/demo.html thành công', async () => {
      const res = await request(app).get('/nv4/demo.html');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('ReportFlow');
      expect(res.text).toContain('ConfirmWidget');
    });

    it('phục vụ tĩnh các tệp module js và css của nv4', async () => {
      const cssRes = await request(app).get('/nv4/nv4.css');
      expect(cssRes.status).toBe(200);
      expect(cssRes.text).toContain('.nv4-');

      const jsRes = await request(app).get('/nv4/deviceId.js');
      expect(jsRes.status).toBe(200);
      expect(jsRes.text).toContain('generateUuid');
    });

    it('không ảnh hưởng đến các tuyến /api hiện có', async () => {
      const apiRes = await request(app).get('/api/health');
      expect(apiRes.status).toBe(200);
      expect(apiRes.body.ok).toBe(true);
    });
  });
});
