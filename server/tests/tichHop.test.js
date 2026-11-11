import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';
import { runSeed } from '../scripts/seed.js';

describe('Tích hợp với giao diện NV2: địa chỉ người dân nhập và kết quả AI gần nhất', () => {
  beforeAll(() => {
    runMigrations(getDb());
  });

  afterAll(() => {
    closeDb();
  });

  it('Điểm mới lấy mô tả vị trí người dân nhập làm địa chỉ, chi tiết có latestAi', async () => {
    const img = await sharp({
      create: { width: 200, height: 160, channels: 3, background: { r: 40, g: 90, b: 140 } },
    }).jpeg().toBuffer();

    const res = await request(app)
      .post('/api/reports')
      .field('lat', 10.9101)
      .field('lng', 106.9302)
      .field('accuracyM', 20)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_tich_hop_nv2')
      .field('address', 'Hẻm 12 đường thử nghiệm')
      .attach('image', img, 'tich_hop.jpg');

    expect(res.status).toBe(201);
    const id = res.body.data.floodPoint.id;

    const detail = await request(app).get(`/api/flood-points/${id}`);
    expect(detail.body.data.address).toBe('Hẻm 12 đường thử nghiệm');
    expect(detail.body.data.latestAi).toHaveProperty('isFlood');
    expect(detail.body.data.processingStatus).toBe('submitted');
    expect(detail.body.data.version).toBe(1);
    expect(detail.body.data.dataMode).toBe('real');
    // Không khai nguồn thì mặc định camera
    expect(detail.body.data.latestReport.source).toBe('camera');

    // Danh sách cũng có ảnh và nguồn để bản đồ hiện ảnh
    const list = await request(app).get('/api/flood-points?status=active,pending');
    const item = list.body.data.find((p) => p.id === id);
    expect(item.images.length).toBe(1);
    expect(item.latestReport.source).toBe('camera');
  });

  it('Lưu nguồn ảnh/vị trí người dân khai để trang phường xem', async () => {
    const img = await sharp({
      create: { width: 210, height: 150, channels: 3, background: { r: 120, g: 60, b: 30 } },
    }).jpeg().toBuffer();

    const res = await request(app)
      .post('/api/reports')
      .field('lat', 10.9301)
      .field('lng', 106.8702)
      .field('accuracyM', 35)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_tich_hop_nguon')
      .field('source', 'manual-pin')
      .field('photoSource', 'library')
      .attach('image', img, 'nguon.jpg');

    expect(res.status).toBe(201);
    const detail = await request(app).get(`/api/flood-points/${res.body.data.floodPoint.id}`);
    expect(detail.body.data.latestReport).toMatchObject({ source: 'manual-pin', photoSource: 'library', accuracyM: 35 });
  });

  it('seed:real: điểm đang ngập là mô phỏng, giờ gần lúc nạp; điểm cũ đã đóng', async () => {
    runSeed(getDb(), { real: true });

    const active = (await request(app).get('/api/flood-points/fp_real_001')).body.data;
    expect(active.status).toBe('active');
    expect(active.dataMode).toBe('demo');
    expect(active.processingStatus).toBe('received');
    expect(Date.now() - new Date(active.firstReportedAt).getTime()).toBeLessThan(2 * 3600 * 1000);

    const old = (await request(app).get('/api/flood-points/fp_real_004')).body.data;
    expect(old.status).toBe('resolved');
    expect(old.dataMode).toBe('real');
    expect(old.processingStatus).toBe('closed');
  });
});
