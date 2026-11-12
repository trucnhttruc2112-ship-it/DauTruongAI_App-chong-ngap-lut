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
import { determineReportSource, buildReportPayload, formatStatusVietnamese } from '../public/nv4/reportFlow.js';
import { ReportPayloadSchema } from '../src/services/reportService.js';
import { formatContractB } from '../src/services/floodPointQueryService.js';

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

  describe('6. Cấu hình CORS & Truy cập qua Tunnel', () => {
    it('(a) Origin cùng host với yêu cầu (Host / X-Forwarded-Host) -> được phép', async () => {
      // Test cùng Host thông thường
      const resHost = await request(app)
        .get('/api/health')
        .set('Host', 'demo-tunnel.trycloudflare.com')
        .set('Origin', 'https://demo-tunnel.trycloudflare.com');

      expect(resHost.status).toBe(200);
      expect(resHost.headers['access-control-allow-origin']).toBe('https://demo-tunnel.trycloudflare.com');

      // Test qua proxy với X-Forwarded-Host
      const resForwarded = await request(app)
        .get('/api/health')
        .set('X-Forwarded-Host', 'tunnel.myapp.net')
        .set('Origin', 'https://tunnel.myapp.net');

      expect(resForwarded.status).toBe(200);
      expect(resForwarded.headers['access-control-allow-origin']).toBe('https://tunnel.myapp.net');
    });

    it('(b) Origin lạ (khác nguồn và không nằm trong danh sách) -> 403 CORS_BLOCKED', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-site.example');

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('CORS_BLOCKED');
      expect(res.body.error.message).toContain('CORS');
    });

    it('(c) Yêu cầu không có Origin (curl, server-to-server) -> được phép', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('(d) File tĩnh /nv4/reportFlow.js với Origin cùng nguồn trả 200', async () => {
      const res = await request(app)
        .get('/nv4/reportFlow.js')
        .set('Host', 'tunnel-preview.trycloudflare.com')
        .set('Origin', 'https://tunnel-preview.trycloudflare.com');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://tunnel-preview.trycloudflare.com');
      expect(res.text).toContain('ReportFlow');
    });
  });

  describe('7. Hợp đồng nguồn dữ liệu ReportFlow & Xử lý lỗi tiếng Việt', () => {
    it('(a.1) Dữ liệu nguồn camera hợp lệ với ReportPayloadSchema', () => {
      const payload = buildReportPayload({
        coords: { lat: 10.9515, lng: 106.8245, accuracyM: 15, source: 'gps' },
        imageSource: 'camera',
        deviceId: 'dev_test_camera',
        capturedAt: new Date().toISOString(),
      });

      expect(payload.source).toBe('camera');
      const parseResult = ReportPayloadSchema.safeParse(payload);
      expect(parseResult.success).toBe(true);
    });

    it('(a.2) Dữ liệu nguồn gallery hợp lệ với ReportPayloadSchema', () => {
      const payload = buildReportPayload({
        coords: { lat: 10.9515, lng: 106.8245, accuracyM: 20, source: 'gps' },
        imageSource: 'gallery',
        deviceId: 'dev_test_gallery',
        capturedAt: new Date().toISOString(),
      });

      expect(payload.source).toBe('gallery');
      const parseResult = ReportPayloadSchema.safeParse(payload);
      expect(parseResult.success).toBe(true);
    });

    it('(a.3) Dữ liệu ghim thủ công (manual-pin) hợp lệ với ReportPayloadSchema', () => {
      const payload = buildReportPayload({
        coords: { lat: 10.9515, lng: 106.8245, source: 'manual-pin' },
        imageSource: 'camera',
        deviceId: 'dev_test_pin',
        capturedAt: new Date().toISOString(),
      });

      expect(payload.source).toBe('manual-pin');
      const parseResult = ReportPayloadSchema.safeParse(payload);
      expect(parseResult.success).toBe(true);
    });

    it("(a.4) Giá trị source='gps' bị ReportPayloadSchema từ chối", () => {
      const invalidPayload = {
        lat: 10.9515,
        lng: 106.8245,
        accuracyM: 15,
        capturedAt: new Date().toISOString(),
        deviceId: 'dev_test_gps_invalid',
        source: 'gps',
      };

      const parseResult = ReportPayloadSchema.safeParse(invalidPayload);
      expect(parseResult.success).toBe(false);
    });

    it('(b.1) Chuyển đổi lỗi mạng trình duyệt ("Load failed", "Failed to fetch", "NetworkError", TypeError) thành thông điệp tiếng Việt', () => {
      const expectedMsg = 'Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Gửi lại.';
      expect(getFriendlyErrorMessage('Load failed')).toBe(expectedMsg);
      expect(getFriendlyErrorMessage('Failed to fetch')).toBe(expectedMsg);
      expect(getFriendlyErrorMessage('NetworkError')).toBe(expectedMsg);
      expect(getFriendlyErrorMessage(new TypeError('Load failed'))).toBe(expectedMsg);
      expect(getFriendlyErrorMessage(new TypeError('Failed to fetch'))).toBe(expectedMsg);
    });

    it('(b.2) Chuyển đổi lỗi kiểm tra dữ liệu (400 INVALID_REQUEST hoặc thông báo Zod) thành tiếng Việt thân thiện', () => {
      const expectedMsg = 'Dữ liệu gửi đi chưa hợp lệ. Vui lòng thử lại; nếu lỗi lặp lại hãy báo cho quản trị viên.';
      expect(getFriendlyErrorMessage({ code: 'INVALID_REQUEST' })).toBe(expectedMsg);
      expect(getFriendlyErrorMessage({ code: '400', message: 'Invalid enum value' })).toBe(expectedMsg);
      expect(
        getFriendlyErrorMessage("Invalid enum value. Expected 'camera' | 'gallery' | 'manual-pin', received 'gps'")
      ).toBe(expectedMsg);
    });

    it('(b.3) Ẩn hoàn toàn thông báo lỗi tiếng Anh thô chưa nhận diện sang thông báo chung', () => {
      const res = getFriendlyErrorMessage('Unhandled internal error in dependency XYZ');
      expect(res).toBe('Đã xảy ra lỗi trong quá trình xử lý. Vui lòng thử lại sau.');
    });

    it('(c.1) formatStatusVietnamese: chuyển đổi chính xác các mã trạng thái sang nhãn tiếng Việt', () => {
      expect(formatStatusVietnamese('active')).toBe('Đang ngập');
      expect(formatStatusVietnamese('pending')).toBe('Chờ xác minh');
      expect(formatStatusVietnamese('rejected')).toBe('Không được chấp nhận');
      expect(formatStatusVietnamese('resolved')).toBe('Đã hết ngập');
      expect(formatStatusVietnamese('expired')).toBe('Đã hết hạn');
      expect(formatStatusVietnamese('other')).toBe('other');
    });

    it('(c.2) formatContractB: không làm lộ cột image_dhash ở API đọc công khai', () => {
      const mockDbPoint = {
        id: 'fp_public_test',
        lat: 10.95,
        lng: 106.82,
        status: 'active',
        severity: 'medium',
        image_dhash: '00ff00ff00ff00ff',
      };
      const mockReports = [
        {
          id: 'rep_1',
          imagePath: '/uploads/2026/11/test.jpg',
          imageSha256: 'sha256_secret_hash',
          imageDhash: 'dhash_secret_hash',
        },
      ];

      const publicOutput = formatContractB(mockDbPoint, mockReports);
      expect(publicOutput.image_dhash).toBeUndefined();
      expect(publicOutput.imageDhash).toBeUndefined();
      expect(publicOutput.image_sha256).toBeUndefined();
      expect(publicOutput.imageSha256).toBeUndefined();
      expect(publicOutput.images).toEqual(['/uploads/2026/11/test.jpg']);
    });
  });
});
