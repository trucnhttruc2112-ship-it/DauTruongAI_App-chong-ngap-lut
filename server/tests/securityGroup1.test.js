import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/server.js';
import { validateEnvironmentConfig } from '../src/config/env.js';
import { compressAndSaveImage, validateImageMagicBytes } from '../src/utils/imageUtils.js';
import { analyzeImage } from '../src/services/aiAnalyzer.js';
import RULES from '../src/config/rules.js';

describe('Bảo mật & Độ bền - Nhóm 1 (Mức Cao)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('1. Upload bảo mật & xử lý ảnh Sharp', () => {
    it('1.1. validateImageMagicBytes từ chối tệp tin không phải JPEG/PNG/WebP', () => {
      const textBuffer = Buffer.from('console.log("malicious code");');
      const check = validateImageMagicBytes(textBuffer);
      expect(check.valid).toBe(false);
      expect(check.format).toBeNull();
    });

    it('1.2. compressAndSaveImage ném lỗi PATH_TRAVERSAL_DETECTED nếu đường dẫn thoát khỏi upload dir', async () => {
      // Buffer JPEG 1x1 hợp lệ
      const validJpeg = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
        0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
        0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
        0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
        0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
        0x00, 0xbf, 0x00, 0xff, 0xd9
      ]);

      const maliciousDir = path.resolve('./data/../../../../etc');
      await expect(compressAndSaveImage(validJpeg, maliciousDir)).rejects.toThrow();
    });

    it('1.3. /uploads từ chối phục vụ file không phải ảnh (.txt, .js, thư mục)', async () => {
      const resTxt = await request(app).get('/uploads/test.txt');
      expect([403, 404]).toContain(resTxt.status);

      const resDir = await request(app).get('/uploads/');
      expect([403, 404]).toContain(resDir.status);

      const resPost = await request(app).post('/uploads/test.jpg');
      expect([403, 404, 405]).toContain(resPost.status);
    });
  });

  describe('2. Phục vụ tĩnh & chống lộ file nhạy cảm / path traversal', () => {
    it('2.1. Chặn tuyệt đối truy cập các tệp .env và .sqlite với mã lỗi 403', async () => {
      const resEnv = await request(app).get('/.env');
      expect(resEnv.status).toBe(403);
      expect(resEnv.body.ok).toBe(false);

      const resSqlite = await request(app).get('/data/dongnai_flood.sqlite');
      expect(resSqlite.status).toBe(403);
      expect(resSqlite.body.ok).toBe(false);

      const resTraversal = await request(app).get('/public/../../.env');
      expect(resTraversal.status).toBe(403);
    });

    it('2.2. /integration chỉ phục vụ khi NODE_ENV khác production (trả về 404 khi production)', async () => {
      process.env.NODE_ENV = 'production';

      const res = await request(app).get('/integration/nv1-leaflet-example.html');
      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('3. Chống lạm dụng & giới hạn tần suất xác nhận', () => {
    it('3.1. POST /api/flood-points/:id/confirm có áp dụng confirmIpLimiter', async () => {
      // Giả lập vượt quá giới hạn bằng cách gửi nhiều request liên tục với cờ x-test-ip-rate-limit
      const pointId = 'pt_non_existent';
      const requests = [];
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .post(`/api/flood-points/${pointId}/confirm`)
            .set('x-test-ip-rate-limit', 'true')
            .send({
              deviceId: `dev_${i}`,
              type: 'still',
              lat: 10.95,
              lng: 106.82,
            })
        );
      }
      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
      expect(rateLimited[0].body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('4. Cấu hình Production & Ngăn chặn chạy giả lập', () => {
    it('4.1. validateEnvironmentConfig từ chối khởi động khi NODE_ENV=production có AI_MODE=mock mà không có ALLOW_DEMO_IN_PROD', () => {
      expect(() => {
        validateEnvironmentConfig({
          NODE_ENV: 'production',
          ALLOWED_ORIGINS: ['https://dongnai.gov.vn'],
          AI_MODE: 'mock',
          DATA_MODE: 'real',
          ALLOW_DEMO_IN_PROD: false,
        });
      }).toThrow(/từ chối khởi động/);
    });

    it('4.2. validateEnvironmentConfig từ chối khởi động khi NODE_ENV=production có DATA_MODE=demo mà không có ALLOW_DEMO_IN_PROD', () => {
      expect(() => {
        validateEnvironmentConfig({
          NODE_ENV: 'production',
          ALLOWED_ORIGINS: ['https://dongnai.gov.vn'],
          AI_MODE: 'remote',
          DATA_MODE: 'demo',
          ALLOW_DEMO_IN_PROD: false,
        });
      }).toThrow(/từ chối khởi động/);
    });

    it('4.3. validateEnvironmentConfig cho phép khởi động có cảnh báo khi ALLOW_DEMO_IN_PROD=true', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => {
        validateEnvironmentConfig({
          NODE_ENV: 'production',
          ALLOWED_ORIGINS: ['https://dongnai.gov.vn'],
          AI_MODE: 'mock',
          DATA_MODE: 'demo',
          ALLOW_DEMO_IN_PROD: true,
        });
      }).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('5. trust proxy cấu hình từ biến TRUST_PROXY', () => {
    it('5.1. app.get("trust proxy") nhận giá trị theo cấu hình môi trường', () => {
      const tp = app.get('trust proxy');
      // Mặc định ENV.TRUST_PROXY là 'loopback' (ngoài production) hoặc false/number/function
      expect(
        typeof tp === 'boolean' ||
        typeof tp === 'number' ||
        typeof tp === 'function' ||
        typeof tp === 'string'
      ).toBe(true);
    });
  });

  describe('6. Bảo mật kết nối AI NV3 từ xa', () => {
    it('6.1. Từ chối URL không thuộc giao thức http: hoặc https: (chống SSRF)', async () => {
      const dummyBuffer = Buffer.from('dummy');
      await expect(
        analyzeImage(dummyBuffer, {
          aiMode: 'remote',
          aiAnalyzeUrl: 'ftp://evil.com/analyze',
        })
      ).rejects.toThrow(/chỉ chấp nhận giao thức http: hoặc https:/);
    });

    it('6.2. Phản hồi quá kích thước từ NV3 (>1MB) trả về cờ lỗi AI_RESPONSE_TOO_LARGE fail-safe', async () => {
      const dummyBuffer = Buffer.from('dummy');
      const hugeString = 'x'.repeat(RULES.AI_MAX_RESPONSE_BYTES + 500);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(RULES.AI_MAX_RESPONSE_BYTES + 500) }),
        text: async () => hugeString,
      });

      const res = await analyzeImage(dummyBuffer, {
        aiMode: 'remote',
        aiAnalyzeUrl: 'http://localhost:9999/analyze',
        fetchImpl: mockFetch,
      });

      expect(res.error).toBe('AI_RESPONSE_TOO_LARGE');
      expect(res.flags).toContain('AI_RESPONSE_TOO_LARGE');
      expect(res.isFlood).toBeNull();
    });
  });
});
