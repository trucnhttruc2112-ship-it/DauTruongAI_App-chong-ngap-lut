import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';
import { runSeed } from '../scripts/seed.js';
import { runSeedClear } from '../scripts/seedClear.js';
import floodPointRepo from '../src/repositories/floodPointRepo.js';
import reportRepo from '../src/repositories/reportRepo.js';
import confirmationRepo from '../src/repositories/confirmationRepo.js';
import eventRepo from '../src/repositories/eventRepo.js';
import RULES from '../src/config/rules.js';

describe('Prompt 1: Khởi tạo module, DB SQLite, Repository, Seed và Health API', () => {
  let db;

  beforeAll(() => {
    db = getDb();
    runMigrations(db);
  });

  afterAll(() => {
    closeDb();
  });

  it('1. Cấu hình RULES phải được Object.freeze và chứa các hằng số quy định', () => {
    expect(Object.isFrozen(RULES)).toBe(true);
    expect(RULES.DUPLICATE_RADIUS_M).toBe(50);
    expect(RULES.DUPLICATE_WINDOW_HOURS).toBe(6);
    expect(RULES.GPS_MAX_ACCURACY_M).toBe(100);
    expect(RULES.DONG_NAI_BBOX.minLat).toBe(10.35);
    expect(RULES.DONG_NAI_BBOX.maxLat).toBe(11.60);
    expect(RULES.ENDED_CONFIRMATIONS_TO_RESOLVE).toBe(2);
  });

  it('2. Chạy migrate tạo đúng các bảng và cột bao gồm is_demo', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    expect(tables).toContain('flood_points');
    expect(tables).toContain('reports');
    expect(tables).toContain('confirmations');
    expect(tables).toContain('flood_events');

    // Kiểm tra cột is_demo trong flood_points
    const columns = db.prepare("PRAGMA table_info(flood_points)").all().map(c => c.name);
    expect(columns).toContain('is_demo');
    expect(columns).toContain('historical_event_count');
    expect(columns).toContain('is_flood_prone');
  });

  it('3. Nạp dữ liệu seed thành công 20 điểm mẫu có is_demo = 1', () => {
    const seedResult = runSeed(db);
    expect(seedResult.insertedCount).toBe(20);

    const totalCount = floodPointRepo.countAll();
    expect(totalCount).toBe(20);

    const demoPoint = floodPointRepo.findById('fp_demo_01');
    expect(demoPoint).not.toBeNull();
    expect(demoPoint.street).toBe('Xa lộ Hà Nội');
    expect(demoPoint.isDemo).toBe(true);
    expect(demoPoint.isFloodProne).toBe(true);

    // Điểm active phải có flood_event mở
    const openEvent = eventRepo.findOpenEvent('fp_demo_01');
    expect(openEvent).not.toBeNull();
    expect(openEvent.endedAt).toBeNull();
  });

  it('4. Tầng Repository CRUD hoạt động chuẩn xác', () => {
    // Thêm 1 báo cáo thử nghiệm
    const rep = reportRepo.insert({
      id: 'test_rep_01',
      floodPointId: 'fp_demo_01',
      deviceId: 'dev_unit_test',
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 15,
      capturedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      imagePath: '/uploads/test.jpg',
      imageSha256: 'sha256_mock_hash_123',
      aiJson: { isFlood: true, confidence: 0.9 },
      trustFlags: ['MOCK_TEST'],
      isDemo: 1,
    });
    expect(rep.id).toBe('test_rep_01');
    expect(rep.isDemo).toBe(true);

    const foundBySha = reportRepo.findBySha256('sha256_mock_hash_123');
    expect(foundBySha).not.toBeNull();
    expect(foundBySha.deviceId).toBe('dev_unit_test');

    // Thêm 1 xác nhận thử nghiệm
    const conf = confirmationRepo.insert({
      id: 'test_conf_01',
      floodPointId: 'fp_demo_01',
      deviceId: 'dev_unit_test_2',
      type: 'still',
      lat: 10.9448,
      lng: 106.8244,
      isDemo: 1,
    });
    expect(conf.type).toBe('still');

    const foundConf = confirmationRepo.findByPointAndDevice('fp_demo_01', 'dev_unit_test_2', 'still');
    expect(foundConf).not.toBeNull();
  });

  it('5. Endpoint GET /api/health trả chuẩn JSON { ok: true, data: { status: "up", pointsCount: 20 } }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('up');
    expect(res.body.data.pointsCount).toBe(20);
    expect(res.body.data.aiMode).toBe('mock');
  });

  it('6. Lệnh seed:clear chỉ xóa dữ liệu có is_demo = 1, giữ nguyên dữ liệu thật', () => {
    // Tạo 1 bản ghi thật (is_demo = 0)
    floodPointRepo.insert({
      id: 'fp_real_test_01',
      lat: 10.95,
      lng: 106.82,
      address: 'Điểm thật không phải demo',
      status: 'active',
      severity: 'medium',
      firstReportedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      isDemo: 0,
    });

    const beforeClear = floodPointRepo.countAll();
    expect(beforeClear).toBe(21); // 20 demo + 1 real

    // Chạy dọn dẹp seed demo
    const clearResult = runSeedClear(db);
    expect(clearResult.cleared.points).toBe(20);

    // Bản ghi thật vẫn còn
    const remaining = floodPointRepo.countAll();
    expect(remaining).toBe(1);

    const realPoint = floodPointRepo.findById('fp_real_test_01');
    expect(realPoint).not.toBeNull();
    expect(realPoint.isDemo).toBe(false);

    // Dọn dẹp bản ghi thật sau test
    db.prepare(`DELETE FROM flood_points WHERE id = 'fp_real_test_01'`).run();

    // Re-seed lại 20 điểm demo để dữ liệu sẵn sàng cho các bước sau
    runSeed(db);
    expect(floodPointRepo.countAll()).toBe(20);
  });
});
