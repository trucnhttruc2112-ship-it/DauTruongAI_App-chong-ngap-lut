import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runDemoReset } from '../scripts/demo-reset.js';
import { runMigrations } from '../scripts/migrate.js';
import { getDb } from '../src/db/connection.js';
import { shouldExpire } from '../src/domain/lifecycle.js';
import floodPointRepo from '../src/repositories/floodPointRepo.js';

describe('Kiểm thử tập lệnh demo:reset (scripts/demo-reset.js)', () => {
  let db;

  beforeEach(() => {
    db = getDb();
    runMigrations(db);
  });

  it('1. Từ chối thực thi khi DATA_MODE=real', () => {
    expect(() => {
      runDemoReset(db, { dataMode: 'real' });
    }).toThrow(/DATA_MODE=real/);
  });

  it('2. Báo lỗi rõ ràng khi CSDL chưa được khởi tạo (no such table)', () => {
    const uninitializedDb = new Database(':memory:');
    expect(() => {
      runDemoReset(uninitializedDb, { dataMode: 'demo' });
    }).toThrowError(/DB chưa được khởi tạo/);
    uninitializedDb.close();
  });

  it('3. Thiết lập chính xác số lượng điểm ngập và phân bổ trạng thái theo yêu cầu', () => {
    const now = new Date();
    const summary = runDemoReset(db, { dataMode: 'demo', now });

    expect(summary.total).toBe(12);
    expect(summary.active).toBe(6);
    expect(summary.pending).toBe(3);
    expect(summary.resolved).toBe(3);
    expect(summary.floodProne).toBeGreaterThanOrEqual(4);

    // Đủ 3 mức độ ngập cho các điểm active
    expect(summary.bySeverity.low).toBeGreaterThanOrEqual(2);
    expect(summary.bySeverity.medium).toBeGreaterThanOrEqual(2);
    expect(summary.bySeverity.high).toBeGreaterThanOrEqual(2);

    expect(summary.reportsCreated).toBeGreaterThan(0);
    expect(summary.confirmationsCreated).toBeGreaterThan(0);
  });

  it('4. Thời gian của dữ liệu là tương đối (10 - 90 phút trước), job hết hạn không đóng điểm ngay', () => {
    const now = new Date();
    runDemoReset(db, { dataMode: 'demo', now });

    const activePoints = floodPointRepo.list({ status: 'active' });
    expect(activePoints.length).toBe(6);

    for (const point of activePoints) {
      const diffMs = now.getTime() - new Date(point.lastUpdatedAt).getTime();
      const diffMins = diffMs / (60 * 1000);

      // Nằm trong khoảng 10 đến 90 phút trước
      expect(diffMins).toBeGreaterThanOrEqual(10);
      expect(diffMins).toBeLessThanOrEqual(90);

      // Quy tắc hết hạn (6 giờ) không kích hoạt
      expect(shouldExpire(point, now)).toBe(false);
    }
  });

  it('5. Tính lũy kế idempotency: chạy lại 2 lần không làm nhân đôi dữ liệu', () => {
    const now = new Date();
    const firstRun = runDemoReset(db, { dataMode: 'demo', now });
    const secondRun = runDemoReset(db, { dataMode: 'demo', now });

    expect(secondRun.total).toBe(firstRun.total);
    expect(secondRun.active).toBe(firstRun.active);
    expect(secondRun.pending).toBe(firstRun.pending);
    expect(secondRun.resolved).toBe(firstRun.resolved);

    const allPoints = floodPointRepo.list();
    expect(allPoints.length).toBe(12);
  });
});
