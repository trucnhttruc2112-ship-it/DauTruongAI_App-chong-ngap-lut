import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ENV } from '../config/env.js';

let dbInstance = null;

/**
 * Lấy đối tượng kết nối cơ sở dữ liệu SQLite duy nhất (Singleton).
 * Tự động tạo thư mục chứa nếu chưa tồn tại.
 * Bật khóa ngoại và chế độ WAL để tăng tốc độ ghi đồng thời.
 */
export function getDb(customPath = null) {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = customPath || ENV.DB_PATH;
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('foreign_keys = ON');
  if (dbPath !== ':memory:') {
    dbInstance.pragma('journal_mode = WAL');
  }

  return dbInstance;
}

/**
 * Đóng kết nối DB khi tắt ứng dụng hoặc chạy xong test.
 */
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export default { getDb, closeDb };
