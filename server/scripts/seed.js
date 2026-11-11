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

export function runSeed(dbInstance = null) {
  if (ENV.DATA_MODE === 'real') {
    console.log('⚠️ [DATA_MODE=real] Hệ thống đang ở chế độ dữ liệu thật, bỏ qua nạp dữ liệu demo.');
    return { skipped: true, reason: 'DATA_MODE is real' };
  }

  const db = dbInstance || getDb();
  runMigrations(db);

  const seedFilePath = path.resolve(__dirname, '../data/demo/seed-flood-points.json');
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
      // Đảm bảo cờ is_demo = 1
      p.isDemo = 1;

      // Xóa trước nếu đã tồn tại để tránh xung đột id khi seed lại
      db.prepare(`DELETE FROM flood_events WHERE flood_point_id = ? AND is_demo = 1`).run(p.id);
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
          isDemo: 1,
        });
      }
    }
  });

  seedTransaction();

  return { insertedCount };
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  try {
    const result = runSeed();
    if (result.skipped) {
      console.log(result.reason);
    } else {
      console.log(`✅ Nạp thành công ${result.insertedCount} điểm ngập demo từ data/demo/seed-flood-points.json (DỮ LIỆU GIẢ LẬP – CHỜ NV6)`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi chạy seed:', err);
    process.exit(1);
  }
}
