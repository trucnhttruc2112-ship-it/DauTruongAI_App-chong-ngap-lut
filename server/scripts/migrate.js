import { getDb } from '../src/db/connection.js';

/**
 * Thực thi tạo bảng và chỉ mục (idempotent - an toàn khi chạy lại nhiều lần).
 */
export function runMigrations(dbInstance = null) {
  const db = dbInstance || getDb();

  db.exec(`
    -- Bảng 1: Điểm ngập (flood_points)
    CREATE TABLE IF NOT EXISTS flood_points (
      id TEXT PRIMARY KEY,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      address TEXT,
      street TEXT,
      ward_id TEXT,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      estimated_depth_cm INTEGER,
      trust_score INTEGER DEFAULT 0,
      confirm_still INTEGER DEFAULT 0,
      confirm_ended INTEGER DEFAULT 0,
      report_count INTEGER DEFAULT 1,
      is_flood_prone INTEGER DEFAULT 0,
      flood_event_count INTEGER DEFAULT 0,
      first_reported_at TEXT NOT NULL,
      last_updated_at TEXT NOT NULL,
      last_confirmed_at TEXT,
      historical_event_count INTEGER DEFAULT 0,
      is_demo INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_flood_points_status ON flood_points(status);
    CREATE INDEX IF NOT EXISTS idx_flood_points_ward ON flood_points(ward_id);
    CREATE INDEX IF NOT EXISTS idx_flood_points_geo ON flood_points(lat, lng);
    CREATE INDEX IF NOT EXISTS idx_flood_points_is_demo ON flood_points(is_demo);
    CREATE INDEX IF NOT EXISTS idx_flood_points_updated ON flood_points(last_updated_at);

    -- Bảng 2: Chi tiết các lượt báo cáo ngập (reports)
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      flood_point_id TEXT,
      device_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy_m REAL,
      captured_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      image_path TEXT,
      image_sha256 TEXT,
      image_dhash TEXT,
      ai_json TEXT,
      trust_flags TEXT,
      is_demo INTEGER DEFAULT 0,
      FOREIGN KEY (flood_point_id) REFERENCES flood_points(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reports_point ON reports(flood_point_id);
    CREATE INDEX IF NOT EXISTS idx_reports_sha256 ON reports(image_sha256);
    CREATE INDEX IF NOT EXISTS idx_reports_device_time ON reports(device_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_reports_is_demo ON reports(is_demo);

    -- Bảng 3: Xác nhận vẫn ngập hoặc đã hết ngập (confirmations)
    CREATE TABLE IF NOT EXISTS confirmations (
      id TEXT PRIMARY KEY,
      flood_point_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('still', 'ended')),
      lat REAL,
      lng REAL,
      created_at TEXT NOT NULL,
      is_demo INTEGER DEFAULT 0,
      UNIQUE(flood_point_id, device_id, type),
      FOREIGN KEY (flood_point_id) REFERENCES flood_points(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_confirmations_point ON confirmations(flood_point_id);
    CREATE INDEX IF NOT EXISTS idx_confirmations_is_demo ON confirmations(is_demo);

    -- Bảng 4: Sự kiện ngập tích lũy (flood_events)
    CREATE TABLE IF NOT EXISTS flood_events (
      id TEXT PRIMARY KEY,
      flood_point_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      end_reason TEXT,
      is_demo INTEGER DEFAULT 0,
      FOREIGN KEY (flood_point_id) REFERENCES flood_points(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_flood_events_point ON flood_events(flood_point_id);
    CREATE INDEX IF NOT EXISTS idx_flood_events_is_demo ON flood_events(is_demo);
  `);

  // Migration bổ sung cột image_dhash (idempotent - an toàn khi bảng đã tồn tại từ trước)
  const reportCols = db.pragma('table_info(reports)');
  const hasDhash = reportCols.some((col) => col.name === 'image_dhash');
  if (!hasDhash) {
    db.exec(`ALTER TABLE reports ADD COLUMN image_dhash TEXT;`);
  }

  return true;
}

// Chạy trực tiếp qua dòng lệnh
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  try {
    const db = getDb();
    runMigrations(db);
    console.log('✅ Khởi tạo cấu trúc Database SQLite thành công (Migrate Done).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khởi tạo cấu trúc DB:', err);
    process.exit(1);
  }
}
