import fs from 'fs';
import path from 'path';
import { getDb } from '../src/db/connection.js';
import reportRepo from '../src/repositories/reportRepo.js';
import confirmationRepo from '../src/repositories/confirmationRepo.js';
import eventRepo from '../src/repositories/eventRepo.js';
import floodPointRepo from '../src/repositories/floodPointRepo.js';

export function runSeedClear(dbInstance = null) {
  const db = dbInstance || getDb();

  try {
    // 1. Tìm các file ảnh của báo cáo demo để dọn dẹp
    const demoImages = reportRepo.getDemoImagePaths();
    let deletedFiles = 0;
    for (const relPath of demoImages) {
      if (!relPath) continue;
      try {
        const fullPath = path.resolve(relPath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedFiles++;
        }
      } catch (err) {
        console.warn(`Không thể xóa ảnh demo: ${relPath}`, err.message);
      }
    }

    // 2. Xóa các dòng có is_demo = 1 trong các bảng
    let cleared = {};
    const clearTx = db.transaction(() => {
      cleared.confirmations = confirmationRepo.deleteDemo();
      cleared.reports = reportRepo.deleteDemo();
      cleared.events = eventRepo.deleteDemo();
      cleared.points = floodPointRepo.deleteDemo();
    });

    clearTx();

    return { cleared, deletedFiles };
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      const customErr = new Error('DB chưa được khởi tạo. Chạy npm run migrate trước.');
      customErr.code = 'DB_NOT_INITIALIZED';
      throw customErr;
    }
    throw err;
  }
}

export function handleSeedClearCli(dbInstance = null) {
  try {
    const { cleared, deletedFiles } = runSeedClear(dbInstance);
    console.log(`🧹 Đã xóa toàn bộ dữ liệu demo (is_demo = 1):`);
    console.log(`   - Điểm ngập: ${cleared.points}`);
    console.log(`   - Lượt báo cáo: ${cleared.reports}`);
    console.log(`   - Lượt xác nhận: ${cleared.confirmations}`);
    console.log(`   - Sự kiện ngập: ${cleared.events}`);
    console.log(`   - File ảnh demo đã dọn: ${deletedFiles}`);
    console.log(`✅ Dữ liệu thật (is_demo = 0) được giữ nguyên hoàn toàn.`);
    return 0;
  } catch (err) {
    if (err.code === 'DB_NOT_INITIALIZED' || (err.message && err.message.includes('no such table'))) {
      console.error('DB chưa được khởi tạo. Chạy npm run migrate trước.');
      return 1;
    }
    console.error('❌ Lỗi khi dọn dẹp dữ liệu demo:', err.message || err);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('seedClear.js')) {
  const exitCode = handleSeedClearCli();
  process.exit(exitCode);
}
