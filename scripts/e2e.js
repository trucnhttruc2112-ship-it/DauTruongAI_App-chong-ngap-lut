/**
 * Kịch bản kiểm thử End-to-End (E2E) tự động cho NV4.
 * Chạy trên CSDL tạm (:memory:), tuyệt đối không đụng vào CSDL phát triển (dev).
 *
 * KỊCH BẢN:
 * 1. Khởi tạo DB tạm & chạy Migrations + Seed
 * 2. Gửi 3 báo cáo (Báo cáo 1: Điểm mới; Báo cáo 2: Trùng vị trí < 50m; Báo cáo 3: Điểm khác)
 * 3. Gửi xác nhận tình trạng ('still' và 'ended')
 * 4. Lấy GeoJSON (/api/flood-points.geojson) và kiểm tra phân lớp Layer ('current' / 'prone')
 * 5. In kết quả PASS / FAIL ngắn gọn
 */

import request from 'supertest';
import sharp from 'sharp';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from './migrate.js';
import { runSeed } from './seed.js';

async function runE2EScenario() {
  console.log('🚀 [E2E] Bắt đầu kịch bản kiểm thử End-to-End NV4...');
  let hasFailure = false;

  const logStep = (name, passed, detail = '') => {
    if (passed) {
      console.log(`  ✓ ${name}: PASS ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(`  ✗ ${name}: FAIL ${detail ? `(${detail})` : ''}`);
      hasFailure = true;
    }
  };

  // 1. Khởi tạo DB tạm :memory:
  closeDb(); // Đảm bảo đóng kết nối cũ nếu có
  const db = getDb(':memory:');
  runMigrations(db);
  runSeed(db);
  logStep('1. Khởi tạo CSDL tạm & Seed', true, 'SQLite :memory:');

  try {
    // Chuẩn bị 3 ảnh JPEG hợp lệ với nội dung khác biệt
    const img1 = await sharp(Buffer.from('<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>')).jpeg().toBuffer();
    const img2 = await sharp(Buffer.from('<svg width="100" height="100"><rect width="80" height="80" fill="blue"/></svg>')).jpeg().toBuffer();
    const img3 = await sharp(Buffer.from('<svg width="100" height="100"><polygon points="50,10 90,90 10,90" fill="green"/></svg>')).jpeg().toBuffer();

    const nowIso = new Date().toISOString();

    // 2. Gửi Báo cáo 1 (Điểm mới tại Biên Hòa)
    const res1 = await request(app)
      .post('/api/reports')
      .field('lat', 10.9580)
      .field('lng', 106.8400)
      .field('accuracyM', 10)
      .field('capturedAt', nowIso)
      .field('deviceId', 'device_e2e_user_1')
      .field('source', 'camera')
      .attach('image', img1, 'img1.jpg');

    const point1Id = res1.body?.data?.floodPoint?.id;
    const isNew = !res1.body?.data?.merged && point1Id;
    logStep('2. Gửi Báo cáo 1 (Điểm mới)', res1.status === 201 && isNew, `ID: ${point1Id}`);

    // 3. Gửi Báo cáo 2 (Trùng vị trí với Báo cáo 1, cách ~15 mét)
    const res2 = await request(app)
      .post('/api/reports')
      .field('lat', 10.9581)
      .field('lng', 106.8401)
      .field('accuracyM', 12)
      .field('capturedAt', nowIso)
      .field('deviceId', 'device_e2e_user_2')
      .field('source', 'camera')
      .attach('image', img2, 'img2.jpg');

    const merged = res2.body?.data?.merged === true && res2.body?.data?.floodPoint?.id === point1Id;
    const reportCount = res2.body?.data?.floodPoint?.reportCount;
    logStep('3. Gửi Báo cáo 2 (Gộp trùng < 50m)', res2.status === 201 && merged, `Gộp vào ${point1Id}, reportCount=${reportCount}`);

    // 4. Gửi Báo cáo 3 (Vị trí khác hẳn tại Đồng Nai)
    const res3 = await request(app)
      .post('/api/reports')
      .field('lat', 10.9400)
      .field('lng', 106.8200)
      .field('accuracyM', 8)
      .field('capturedAt', nowIso)
      .field('deviceId', 'device_e2e_user_3')
      .field('source', 'gallery')
      .attach('image', img3, 'img3.jpg');

    const point3Id = res3.body?.data?.floodPoint?.id;
    const isDifferent = res3.body?.data?.merged === false && point3Id !== point1Id;
    logStep('4. Gửi Báo cáo 3 (Vị trí độc lập)', res3.status === 201 && isDifferent, `ID: ${point3Id}`);

    // 5. Gửi Xác nhận tình trạng cho Điểm 1
    // Người A xác nhận vẫn ngập (still)
    const resStill = await request(app)
      .post(`/api/flood-points/${point1Id}/confirm`)
      .send({
        type: 'still',
        lat: 10.9580,
        lng: 106.8400,
        deviceId: 'device_confirm_still',
      });

    // 2 người khác nhau xác nhận đã hết ngập (ended) để chuyển sang resolved
    const resEnd1 = await request(app)
      .post(`/api/flood-points/${point1Id}/confirm`)
      .send({
        type: 'ended',
        lat: 10.9580,
        lng: 106.8400,
        deviceId: 'device_confirm_ended_1',
      });

    const resEnd2 = await request(app)
      .post(`/api/flood-points/${point1Id}/confirm`)
      .send({
        type: 'ended',
        lat: 10.9580,
        lng: 106.8400,
        deviceId: 'device_confirm_ended_2',
      });

    const isResolved = resEnd2.body?.data?.floodPoint?.status === 'resolved';
    logStep('5. Xác nhận Vẫn ngập & Hết ngập', resStill.status === 200 && resEnd2.status === 200 && isResolved, `Trạng thái: ${resEnd2.body?.data?.floodPoint?.status}`);

    // 6. Lấy GeoJSON và kiểm tra phân lớp Layer
    const resGeoJson = await request(app).get('/api/flood-points.geojson');
    const features = resGeoJson.body?.features || [];

    const fPoint3 = features.find((f) => f.properties?.id === point3Id);
    const fProne = features.find((f) => f.properties?.layer === 'prone');

    const layerCorrect = resGeoJson.status === 200 && fPoint3?.properties?.layer === 'current';
    logStep('6. Kiểm tra GeoJSON & Phân lớp Layer', layerCorrect, `Tổng số Feature: ${features.length}, Điểm mới (${point3Id}) nằm trong layer='${fPoint3?.properties?.layer}'`);

    console.log('\n-----------------------------------------------------');
    if (!hasFailure) {
      console.log('🎉 KẾT QUẢ E2E: TẤT CẢ CÁC BƯỚC ĐẠT (PASS)');
      console.log('-----------------------------------------------------\n');
      process.exitCode = 0;
    } else {
      console.error('❌ KẾT QUẢ E2E: CÓ BƯỚC THẤT BẠI (FAIL)');
      console.log('-----------------------------------------------------\n');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('💥 [E2E] Ngoại lệ ngoài ý muốn:', err);
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}

// Chạy trực tiếp
runE2EScenario();
