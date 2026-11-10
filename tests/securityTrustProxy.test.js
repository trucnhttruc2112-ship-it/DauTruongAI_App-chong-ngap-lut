import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { parseTrustProxy, ENV } from '../src/config/env.js';
import { app } from '../src/server.js';
import { getDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';

describe('Bảo mật & Độ bền - Nâng cấp TRUST_PROXY & CORS (P9 Mục 5)', () => {
  beforeAll(() => {
    const db = getDb();
    runMigrations(db);
  });
  describe('(c) Kiểm tra hàm phân tích cấu hình parseTrustProxy', () => {
    it('1. NODE_ENV=production khi không đặt TRUST_PROXY -> mặc định false', () => {
      expect(parseTrustProxy(undefined, 'production')).toBe(false);
      expect(parseTrustProxy('', 'production')).toBe(false);
    });

    it('2. NODE_ENV khác production (development/test) khi không đặt -> mặc định "loopback"', () => {
      expect(parseTrustProxy(undefined, 'development')).toBe('loopback');
      expect(parseTrustProxy('', 'test')).toBe('loopback');
    });

    it('3. Khi đặt tường minh số hop (ví dụ TRUST_PROXY=1) -> parse thành số nguyên 1', () => {
      expect(parseTrustProxy('1', 'production')).toBe(1);
      expect(parseTrustProxy('2', 'development')).toBe(2);
    });

    it('4. Khi đặt giá trị rác / không hợp lệ -> ném lỗi cấu hình rõ ràng', () => {
      expect(() => parseTrustProxy('invalid_proxy_xyz', 'production')).toThrow(
        /Giá trị TRUST_PROXY không hợp lệ/
      );
      expect(() => parseTrustProxy('banana', 'development')).toThrow(
        /Giá trị TRUST_PROXY không hợp lệ/
      );
    });

    it('5. Chấp nhận danh sách IP / CIDR hợp lệ', () => {
      expect(parseTrustProxy('127.0.0.1, 10.0.0.0/8', 'production')).toEqual([
        '127.0.0.1',
        '10.0.0.0/8',
      ]);
    });
  });

  describe('(a) Khi TRUST_PROXY=false (Mô phỏng Production không đứng sau proxy)', () => {
    let testApp;

    beforeEach(() => {
      testApp = express();
      testApp.set('trust proxy', false);

      const limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 2,
        keyGenerator: (req) => req.ip,
        handler: (req, res) => res.status(429).json({ ok: false, error: 'RATE_LIMITED' }),
      });

      testApp.get('/test-ip', limiter, (req, res) => {
        res.json({ ip: req.ip, hostname: req.hostname });
      });
    });

    it('1. Gửi X-Forwarded-For giả không thể đổi được req.ip (req.ip giữ nguyên địa chỉ socket thực)', async () => {
      const res = await request(testApp)
        .get('/test-ip')
        .set('X-Forwarded-For', '203.0.113.195');

      expect(res.status).toBe(200);
      expect(res.body.ip).not.toBe('203.0.113.195');
    });

    it('2. Không thể qua mặt rate limit bằng cách xoay tua header X-Forwarded-For giả mạo', async () => {
      // Lần 1
      await request(testApp).get('/test-ip').set('X-Forwarded-For', '1.1.1.1');
      // Lần 2
      await request(testApp).get('/test-ip').set('X-Forwarded-For', '2.2.2.2');
      // Lần 3: phải bị 429 vì trust proxy=false nên cả 3 requests đều tính chung IP socket cục bộ
      const res3 = await request(testApp).get('/test-ip').set('X-Forwarded-For', '3.3.3.3');

      expect(res3.status).toBe(429);
      expect(res3.body.error).toBe('RATE_LIMITED');
    });
  });

  describe('(b) Mặc định ngoài production ("loopback"): Truy cập qua Tunnel', () => {
    it('1. Yêu cầu từ loopback với X-Forwarded-Host và Origin trùng host -> được phép CORS', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('X-Forwarded-Host', 'tunnel-secure.dongnai.gov.vn')
        .set('Origin', 'https://tunnel-secure.dongnai.gov.vn');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://tunnel-secure.dongnai.gov.vn');
    });

    it('2. Yêu cầu từ loopback với Origin khác host yêu cầu -> 403 CORS_BLOCKED', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('X-Forwarded-Host', 'tunnel-secure.dongnai.gov.vn')
        .set('Origin', 'https://malicious-attacker.com');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CORS_BLOCKED');
    });
  });

  describe('(d) Phân biệt IP người dùng qua Tunnel với cấu hình "loopback"', () => {
    it('Hai yêu cầu từ loopback với hai X-Forwarded-For khác nhau được tính là hai IP riêng biệt', async () => {
      const tunnelApp = express();
      tunnelApp.set('trust proxy', 'loopback');

      const limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 1, // Mỗi IP chỉ được 1 request
        keyGenerator: (req) => req.ip,
        handler: (req, res) => res.status(429).json({ ok: false, error: 'RATE_LIMITED' }),
      });

      tunnelApp.get('/api/test-limit', limiter, (req, res) => {
        res.json({ ok: true, ip: req.ip });
      });

      // Người dùng A qua tunnel (IP 198.51.100.1)
      const resUserA = await request(tunnelApp)
        .get('/api/test-limit')
        .set('X-Forwarded-For', '198.51.100.1');

      expect(resUserA.status).toBe(200);
      expect(resUserA.body.ip).toBe('198.51.100.1');

      // Người dùng B qua tunnel (IP 198.51.100.2) gửi ngay sau đó không bị chặn bởi A
      const resUserB = await request(tunnelApp)
        .get('/api/test-limit')
        .set('X-Forwarded-For', '198.51.100.2');

      expect(resUserB.status).toBe(200);
      expect(resUserB.body.ip).toBe('198.51.100.2');

      // Người dùng A gửi tiếp lần 2 -> bị chặn 429
      const resUserA2 = await request(tunnelApp)
        .get('/api/test-limit')
        .set('X-Forwarded-For', '198.51.100.1');

      expect(resUserA2.status).toBe(429);
    });
  });
});
