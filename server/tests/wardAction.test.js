import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';
import { runSeed } from '../scripts/seed.js';

describe('Trang phường: POST /api/flood-points/:id/ward-action', () => {
  let pointId;

  beforeAll(async () => {
    const db = getDb();
    runMigrations(db);
    runSeed(db);
    const res = await request(app).get('/api/flood-points?status=active');
    pointId = res.body.data[0].id;
  });

  afterAll(() => {
    closeDb();
  });

  it('Tiếp nhận: chuyển processingStatus sang received, tăng version, ghi lịch sử', async () => {
    const before = await request(app).get(`/api/flood-points/${pointId}`);
    const res = await request(app)
      .post(`/api/flood-points/${pointId}/ward-action`)
      .send({ action: 'receive', version: before.body.data.version, actor: 'Phường Long Bình' });

    expect(res.status).toBe(200);
    expect(res.body.data.processingStatus).toBe('received');
    expect(res.body.data.version).toBe(before.body.data.version + 1);
    expect(res.body.data.history[0].actor).toBe('Phường Long Bình');
  });

  it('Sai version thì trả 409 kèm dữ liệu mới nhất', async () => {
    const res = await request(app)
      .post(`/api/flood-points/${pointId}/ward-action`)
      .send({ action: 'in-progress', version: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERSION_CONFLICT');
    expect(res.body.data.id).toBe(pointId);
  });

  it('Yêu cầu bổ sung mà không có nội dung thì trả 400', async () => {
    const res = await request(app)
      .post(`/api/flood-points/${pointId}/ward-action`)
      .send({ action: 'request-info' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REASON_REQUIRED');
  });

  it('Thao tác không có trong danh sách thì trả 400', async () => {
    const res = await request(app)
      .post(`/api/flood-points/${pointId}/ward-action`)
      .send({ action: 'xoa-het' });

    expect(res.status).toBe(400);
  });

  it('Đóng báo cáo và xác nhận hết ngập: điểm chuyển resolved, tăng số đợt ngập', async () => {
    const before = await request(app).get(`/api/flood-points/${pointId}`);
    const res = await request(app)
      .post(`/api/flood-points/${pointId}/ward-action`)
      .send({ action: 'close', closeOutcome: 'confirmed-clear' });

    expect(res.status).toBe(200);
    expect(res.body.data.processingStatus).toBe('closed');
    expect(res.body.data.status).toBe('resolved');
    expect(res.body.data.floodEventCount).toBe(before.body.data.floodEventCount + 1);
  });

  it('Ẩn khỏi bản đồ: publication = hidden', async () => {
    const res = await request(app)
      .post(`/api/flood-points/${pointId}/ward-action`)
      .send({ action: 'hide', reason: 'Ảnh không đúng địa điểm' });

    expect(res.status).toBe(200);
    expect(res.body.data.publication).toBe('hidden');
  });

  it('Điểm không tồn tại thì trả 404', async () => {
    const res = await request(app)
      .post('/api/flood-points/khong_co/ward-action')
      .send({ action: 'receive' });

    expect(res.status).toBe(404);
  });
});
