import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';

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
  });
});
