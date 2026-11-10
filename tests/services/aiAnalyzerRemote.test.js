import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import sharp from 'sharp';
import { analyzeImage } from '../../src/services/aiAnalyzer.js';
import { reportService } from '../../src/services/reportService.js';
import { getDb } from '../../src/db/connection.js';
import { runMigrations } from '../../scripts/migrate.js';

describe('aiAnalyzer & reportService - Remote NV3 integration', () => {
  let mockServer;
  let serverUrl;
  let requestLog = [];
  let handler = null;
  let validJpgBuffer;
  let db;

  beforeAll(async () => {
    db = getDb();
    runMigrations(db);

    validJpgBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 50, g: 120, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();

    mockServer = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bodyBuffer = Buffer.concat(chunks);
      requestLog.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        bodyBuffer,
      });

      if (handler) {
        handler(req, res, bodyBuffer);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          isFlooded: true,
          status: 'flooded',
          severity: 'medium',
          evidence: ['water visible'],
          summary: 'Đường ngập nước',
          needsVerification: false,
        }));
      }
    });

    await new Promise((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        const port = mockServer.address().port;
        serverUrl = `http://127.0.0.1:${port}/api/analyze-flood`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise((res) => mockServer.close(res));
    }
  });

  beforeEach(() => {
    requestLog = [];
    handler = null;
    db.prepare('DELETE FROM confirmations').run();
    db.prepare('DELETE FROM reports').run();
    db.prepare('DELETE FROM flood_events').run();
    db.prepare('DELETE FROM flood_points').run();
  });

  const sendTestReport = (deviceId, options = {}) => {
    return reportService.processReport({
      file: { buffer: validJpgBuffer },
      body: {
        lat: 10.9574,
        lng: 106.8427,
        accuracyM: 5,
        capturedAt: new Date().toISOString(),
        deviceId,
        source: 'camera',
      },
      options: {
        aiMode: 'remote',
        aiAnalyzeUrl: serverUrl,
        ...options,
      },
    });
  };

  it('a) Báo cáo flooded -> điểm active', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        isFlooded: true,
        status: 'flooded',
        severity: 'high',
        evidence: ['Ngập sâu'],
        summary: 'Khu vực ngập sâu',
        needsVerification: false,
      }));
    };

    const result = await sendTestReport('device-test-flooded');

    expect(result.ok).toBe(true);
    expect(result.data.floodPoint).toBeTruthy();
    expect(result.data.floodPoint.status).toBe('active');
    expect(result.data.floodPoint.severity).toBe('high');
  });

  it('b) not_flooded -> rejected, không tạo điểm', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        isFlooded: false,
        status: 'not_flooded',
        severity: 'none',
        evidence: ['Đường khô'],
        summary: 'Đường ráo, không có ngập',
        needsVerification: false,
      }));
    };

    const result = await sendTestReport('device-test-not-flooded');

    expect(result.ok).toBe(true);
    expect(result.data.floodPoint).toBe(null);
    expect(result.data.aiResult.isFlood).toBe(false);

    // Không có flood_points nào được ghi
    const count = db.prepare('SELECT count(*) as c FROM flood_points').get().c;
    expect(count).toBe(0);
  });

  it('c) uncertain -> pending', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        isFlooded: null,
        status: 'uncertain',
        severity: 'unknown',
        evidence: ['Ảnh mờ'],
        summary: 'Không rõ hiện trạng ngập',
        needsVerification: true,
      }));
    };

    const result = await sendTestReport('device-test-uncertain');

    expect(result.ok).toBe(true);
    expect(result.data.floodPoint).toBeTruthy();
    expect(result.data.floodPoint.status).toBe('pending');
  });

  it('d) NV3 trả 500 -> pending, server nhận được đúng 2 requests (gốc + retry 1 lần)', async () => {
    let callCount = 0;
    handler = (_req, res) => {
      callCount++;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Gemini server error' } }));
    };

    const result = await sendTestReport('device-test-500');

    expect(callCount).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.data.floodPoint).toBeTruthy();
    expect(result.data.floodPoint.status).toBe('pending');
  });

  it('e) NV3 trả 400 hoặc 429 -> không retry (chỉ nhận đúng 1 request)', async () => {
    let callCount = 0;
    handler = (_req, res) => {
      callCount++;
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'INVALID_FILE', message: 'Bad file format' } }));
    };

    const result = await sendTestReport('device-test-400');

    expect(callCount).toBe(1);
    expect(result.ok).toBe(true);
    expect(result.data.floodPoint.status).toBe('pending');
  });

  it('f) Timeout -> pending', async () => {
    let callCount = 0;
    handler = (_req, res) => {
      callCount++;
      // Để im không phản hồi để kích hoạt timeout
    };

    const result = await sendTestReport('device-test-timeout', {
      timeoutMs: 150,
    });

    expect(callCount).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.data.floodPoint.status).toBe('pending');
  });

  it('g) Request gửi sang NV3: Content-Type multipart/form-data, file tên image, không trường khác; có X-API-Key', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        isFlooded: true,
        status: 'flooded',
        severity: 'low',
        evidence: ['water'],
        summary: 'Có nước',
        needsVerification: false,
      }));
    };

    await analyzeImage(validJpgBuffer, {
      aiAnalyzeUrl: serverUrl,
      aiApiKey: 'secret-test-key-12345',
    }, 'remote');

    expect(requestLog.length).toBe(1);
    const recorded = requestLog[0];

    expect(recorded.headers['content-type']).toContain('multipart/form-data');
    expect(recorded.headers['x-api-key']).toBe('secret-test-key-12345');

    const bodyText = recorded.bodyBuffer.toString('utf-8');
    expect(bodyText).toContain('name="image"');
    expect(bodyText).not.toContain('name="latitude"');
    expect(bodyText).not.toContain('name="longitude"');
    expect(bodyText).not.toContain('name="deviceId"');
    expect(bodyText).not.toContain('name="notes"');
  });

  it('h) Khóa X-API-Key không bao giờ xuất hiện trong log hoặc response JSON của createReport', async () => {
    const testSecretKey = 'SUPER_SECRET_NV3_API_KEY_xyz987';
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        isFlooded: true,
        status: 'flooded',
        severity: 'low',
        evidence: ['water'],
        summary: 'Có ngập',
        needsVerification: false,
      }));
    };

    const result = await sendTestReport('device-test-secret', {
      aiApiKey: testSecretKey,
    });

    const jsonStr = JSON.stringify(result);
    expect(jsonStr).not.toContain(testSecretKey);

    const row = db.prepare('SELECT ai_json FROM reports WHERE id = ?').get(result.data.report.id);
    expect(row.ai_json).not.toContain(testSecretKey);
  });
});
