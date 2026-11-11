import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ENV } from '../src/config/env.js';
import { getDb } from '../src/db/connection.js';
import { runMigrations } from './migrate.js';
import floodPointRepo from '../src/repositories/floodPointRepo.js';
import eventRepo from '../src/repositories/eventRepo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runSeed(dbInstance = null, { real = false } = {}) {
  if (ENV.DATA_MODE === 'real' && !real) {
    console.log('⚠️ [DATA_MODE=real] Hệ thống đang ở chế độ dữ liệu thật, bỏ qua nạp dữ liệu demo.');
    return { skipped: true, reason: 'DATA_MODE is real' };
  }

  const db = dbInstance || getDb();
  runMigrations(db);

  // --real: nap du lieu diem ngap cua NV6 (data/real), khong danh dau la demo
  const seedFilePath = real
    ? path.resolve(__dirname, '../data/real/seed-flood-points.real.json')
    : path.resolve(__dirname, '../data/demo/seed-flood-points.json');
  if (!fs.existsSync(seedFilePath)) {
    throw new Error(`Không tìm thấy file seed mẫu tại: ${seedFilePath}`);
  }

  const raw = fs.readFileSync(seedFilePath, 'utf8');
  const data = JSON.parse(raw);
  const points = data.points || [];

  let insertedCount = 0;

  // Dùng transaction để nạp toàn bộ an toàn
  const seedTransaction = db.transaction(() => {
    for (const p of points) {
      // Đảm bảo cờ is_demo = 1 (dữ liệu thật của NV6 thì is_demo = 0)
      p.isDemo = real ? 0 : 1;

      // Xóa trước nếu đã tồn tại để tránh xung đột id khi seed lại
      db.prepare(`DELETE FROM flood_events WHERE flood_point_id = ?`).run(p.id);
      db.prepare(`DELETE FROM flood_points WHERE id = ?`).run(p.id);

      floodPointRepo.insert(p);
      insertedCount++;

      // Nếu điểm đang active, tạo luôn 1 sự kiện mở tương ứng
      if (p.status === 'active') {
        eventRepo.insert({
          id: `ev_${p.id}_initial`,
          floodPointId: p.id,
          startedAt: p.firstReportedAt || new Date().toISOString(),
          endedAt: null,
          endReason: null,
          isDemo: p.isDemo,
        });
      }
    }
  });

  seedTransaction();

  return { insertedCount };
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  try {
    const real = process.argv.includes('--real');
    const result = runSeed(null, { real });
    if (result.skipped) {
      console.log(result.reason);
    } else if (real) {
      console.log(`✅ Nạp thành công ${result.insertedCount} điểm ngập từ data/real/seed-flood-points.real.json (dữ liệu NV6)`);
    } else {
      console.log(`✅ Nạp thành công ${result.insertedCount} điểm ngập demo từ data/demo/seed-flood-points.json (DỮ LIỆU GIẢ LẬP)`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi chạy seed:', err);
    process.exit(1);
  }
}
