import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/server.js';
import { getDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';

describe('Bảo mật & Độ bền - Nhóm 2 (Mục 7 - 10)', () => {
  beforeAll(() => {
    const db = getDb();
    runMigrations(db);
  });

  describe('7. SQL Injection & Parameterization', () => {
    it('7.1. Chống SQL injection trong các tham số lọc của GET /api/flood-points', async () => {
      const payloads = [
        "' OR '1'='1",
        "'; DROP TABLE reports; --",
        "1; SELECT * FROM flood_points;",
        "admin'--",
      ];

      for (const payload of payloads) {
        // Test tham số status
        const resStatus = await request(app).get(`/api/flood-points?status=${encodeURIComponent(payload)}`);
        expect([200, 400, 422]).toContain(resStatus.status);
        if (resStatus.status === 200) {
          expect(resStatus.body.data).toBeDefined();
        }

        // Test tham số wardId
        const resWard = await request(app).get(`/api/flood-points?wardId=${encodeURIComponent(payload)}`);
        expect([200, 400]).toContain(resWard.status);
        if (resWard.status === 200) {
          expect(resWard.body.data.length).toBe(0);
        }

        // Test tham số severity
        const resSeverity = await request(app).get(`/api/flood-points?severity=${encodeURIComponent(payload)}`);
        expect([200, 400]).toContain(resSeverity.status);
        if (resSeverity.status === 200) {
          expect(resSeverity.body.data.length).toBe(0);
        }

        // Test tham số limit
        const resLimit = await request(app).get(`/api/flood-points?limit=${encodeURIComponent(payload)}`);
        expect([200, 400]).toContain(resLimit.status);

        // Test tham số bbox
        const resBbox = await request(app).get(`/api/flood-points?bbox=${encodeURIComponent(payload)}`);
        expect([200, 400, 422]).toContain(resBbox.status);
      }

      // Xác nhận bảng reports và flood_points vẫn an toàn và tồn tại trong DB
      const db = getDb();
      const checkReports = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='reports'").get();
      expect(checkReports.count).toBe(1);

      const checkPoints = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='flood_points'").get();
      expect(checkPoints.count).toBe(1);
    });

    it('7.2. Chống SQL injection trong payload POST /api/reports (note, deviceId)', async () => {
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

      const sqlPayload = "dev_'; DROP TABLE confirmations; --";
      const res = await request(app)
        .post('/api/reports')
        .field('lat', 10.9574)
        .field('lng', 106.8427)
        .field('accuracyM', 10)
        .field('capturedAt', new Date().toISOString())
        .field('deviceId', sqlPayload)
        .field('note', "note_'; DROP TABLE flood_events; --")
        .attach('image', validJpeg, 'test_sql.jpg');

      expect([200, 201]).toContain(res.status);

      // Xác nhận không bị drop bảng
      const db = getDb();
      const checkConf = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='confirmations'").get();
      expect(checkConf.count).toBe(1);
    });
  });

  describe('8. XSS Static Code Analysis (public/nv4 & integration)', () => {
    it('8.1. Kiểm tra tĩnh: không có gán dữ liệu vào innerHTML/outerHTML/insertAdjacentHTML/document.write ngoài việc xóa rỗng', () => {
      const scanDirs = [
        path.resolve('public/nv4'),
        path.resolve('integration'),
      ];

      const dangerousPatterns = [
        /\.outerHTML\s*=/i,
        /\.insertAdjacentHTML\s*\(/i,
        /document\.write\s*\(/i,
      ];

      const violations = [];

      for (const dir of scanDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (!file.endsWith('.js') && !file.endsWith('.html')) continue;
          const fullPath = path.join(dir, file);
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((lineText, idx) => {
            for (const pattern of dangerousPatterns) {
              if (pattern.test(lineText)) {
                violations.push({
                  file,
                  line: idx + 1,
                  text: lineText.trim(),
                });
              }
            }

            // Kiểm tra innerHTML: chỉ cho phép gán chuỗi rỗng '' hoặc "" để dọn sạch
            if (/\.innerHTML\s*=/.test(lineText)) {
              const isOnlyClearing = /\.innerHTML\s*=\s*['"]['"]\s*;?(\s*\/\/.*)?$/.test(lineText.trim());
              if (!isOnlyClearing) {
                violations.push({
                  file,
                  line: idx + 1,
                  text: lineText.trim(),
                });
              }
            }
          });
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('9. Header bảo mật cơ bản', () => {
    it('9.1. GET /api/health trả đủ các header bảo mật: X-Content-Type-Options, Referrer-Policy, X-Frame-Options', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('10. Xử lý lỗi tập trung & 404 JSON', () => {
    it('10.1. Đường dẫn không tồn tại trả về mã lỗi 404 chuẩn JSON { ok: false, error }', async () => {
      const res = await request(app).get('/api/non-existent-endpoint-xyz');
      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(typeof res.body.error.message).toBe('string');
    });

    it('10.2. Lỗi 500 giả lập không lộ stack trace, đường dẫn máy chủ hay chi tiết SQL', async () => {
      const uniqueJpeg = Buffer.from([
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
        0x00, 0xbf, 0x00, 0xff, 0xd9, 0x00, 0x01 // Thêm 2 byte làm thay đổi mã băm SHA-256
      ]);

      const res = await request(app)
        .post('/api/reports')
        .set('x-simulate-db-error', 'true')
        .field('lat', 10.9574)
        .field('lng', 106.8427)
        .field('accuracyM', 10)
        .field('capturedAt', new Date().toISOString())
        .field('deviceId', 'dev_sim_500_unique')
        .attach('image', uniqueJpeg, 'test_500_unique.jpg');

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBeDefined();

      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toMatch(/stack/i);
      expect(rawBody).not.toMatch(/[C-Z]:\\|\/Users\/|\/home\//);
      expect(rawBody).not.toMatch(/SELECT|INSERT|UPDATE|DELETE/i);
    });
  });
});
