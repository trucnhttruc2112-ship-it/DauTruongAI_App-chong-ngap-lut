import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';

export async function runBenchmark() {
  // Đóng kết nối DB hiện tại (nếu có) và sử dụng DB tạm riêng biệt, không đụng tới DB dev
  closeDb();
  const tmpDbPath = path.resolve('./data/benchmark_temp.sqlite');
  if (fs.existsSync(tmpDbPath)) {
    try { fs.unlinkSync(tmpDbPath); } catch {}
  }

  const db = getDb(tmpDbPath);
  runMigrations(db);

  console.log('⚡ [Benchmark] Đang nạp tạm thời 1.000 điểm ngập mẫu vào CSDL tạm riêng...');
  const insertStmt = db.prepare(`
    INSERT INTO flood_points (
      id, lat, lng, address, street, ward_id, status, severity,
      estimated_depth_cm, trust_score, confirm_still, confirm_ended,
      report_count, is_flood_prone, flood_event_count, first_reported_at,
      last_updated_at, last_confirmed_at, historical_event_count, is_demo
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, 1
    )
  `);

  const wards = ['long-binh', 'trang-dai', 'ho-nai', 'tan-phong', 'tam-hiep', 'an-binh'];
  const streets = ['Xa lộ Hà Nội', 'Đồng Khởi', 'Nguyễn Ái Quốc', 'Bùi Trọng Nghĩa', 'Quốc lộ 1K'];
  const severities = ['low', 'medium', 'high'];

  const insertMany = db.transaction(() => {
    for (let i = 1; i <= 1000; i++) {
      const lat = 10.90 + (i % 100) * 0.001;
      const lng = 106.80 + (i % 100) * 0.001;
      const ward = wards[i % wards.length];
      const street = streets[i % streets.length];
      const severity = severities[i % severities.length];
      const isProne = i % 3 === 0 ? 1 : 0;
      const eventCount = (i % 5) + 1;
      const nowIso = new Date().toISOString();

      insertStmt.run(
        `fp_bench_${i}`,
        lat,
        lng,
        `Điểm ngập thử nghiệm ${i}, ${street}`,
        street,
        ward,
        'active',
        severity,
        25 + (i % 30),
        75,
        i % 4,
        0,
        1 + (i % 5),
        isProne,
        eventCount,
        nowIso,
        nowIso,
        nowIso,
        2
      );
    }
  });

  insertMany();
  console.log('✅ Đã nạp thành công 1.000 điểm ngập!');

  // 1. Đo hiệu năng GET /api/flood-points.geojson (với 1.000 điểm)
  const t1 = performance.now();
  const resGeoJson = await request(app).get('/api/flood-points.geojson?status=active');
  const durationGeoJson = performance.now() - t1;

  console.log(`⏱️ GET /api/flood-points.geojson (1.000 điểm): ${durationGeoJson.toFixed(2)} ms (Status: ${resGeoJson.status}, Features: ${resGeoJson.body.features?.length})`);

  // Kiểm tra ETag và 304 Not Modified
  const etag = resGeoJson.headers['etag'];
  const res304 = await request(app)
    .get('/api/flood-points.geojson?status=active')
    .set('If-None-Match', etag);
  console.log(`🔄 Kiểm tra ETag 304: Status: ${res304.status} (Khớp ETag: ${etag})`);

  // 2. Đo hiệu năng GET /api/flood-prone
  const t2 = performance.now();
  const resProne = await request(app).get('/api/flood-prone');
  const durationProne = performance.now() - t2;

  console.log(`⏱️ GET /api/flood-prone (Gom cụm trên 1.000 điểm): ${durationProne.toFixed(2)} ms (Status: ${resProne.status}, Clusters: ${resProne.body.data?.length})`);

  // Dọn dẹp và xóa CSDL benchmark tạm
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${tmpDbPath}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch {}
    }
  }
  console.log('🧹 Đã dọn dẹp sạch sẽ CSDL benchmark tạm (hoàn toàn không đụng DB dev)!');

  return {
    durationGeoJson: parseFloat(durationGeoJson.toFixed(2)),
    durationProne: parseFloat(durationProne.toFixed(2)),
    etag304Passed: res304.status === 304,
  };
}

if (process.argv[1] && process.argv[1].endsWith('benchmark.js')) {
  runBenchmark()
    .then((results) => {
      console.log('\n📊 TỔNG KẾT BENCHMARK:');
      console.log(`- GeoJSON response time: ${results.durationGeoJson} ms (Mục tiêu < 200 ms: ${results.durationGeoJson < 200 ? 'ĐẠT' : 'CHƯA ĐẠT'})`);
      console.log(`- Flood-prone response time: ${results.durationProne} ms (Mục tiêu < 200 ms: ${results.durationProne < 200 ? 'ĐẠT' : 'CHƯA ĐẠT'})`);
      console.log(`- ETag 304 Not Modified: ${results.etag304Passed ? 'HOẠT ĐỘNG TỐT' : 'LỖI'}`);
      closeDb();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Lỗi benchmark:', err);
      closeDb();
      process.exit(1);
    });
}
