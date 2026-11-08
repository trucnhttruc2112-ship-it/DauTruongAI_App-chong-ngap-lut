import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';
import { ENV } from '../src/config/env.js';
import floodPointRepo from '../src/repositories/floodPointRepo.js';
import reportRepo from '../src/repositories/reportRepo.js';
import eventRepo from '../src/repositories/eventRepo.js';

describe('Prompt 3: API Tiếp nhận Báo cáo Ngập (POST /api/reports)', () => {
  let db;
  let validJpgBuffer1;
  let validJpgBuffer2;
  let validPngBuffer;
  const testUploadDir = path.resolve(ENV.UPLOAD_DIR);

  beforeAll(async () => {
    db = getDb();
    runMigrations(db);

    // Tạo các buffer ảnh hợp lệ dùng cho bài test
    validJpgBuffer1 = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 30, g: 144, b: 255 }, // xanh nước
      },
    })
      .jpeg()
      .toBuffer();

    validJpgBuffer2 = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 255, g: 140, b: 0 }, // cam
      },
    })
      .jpeg()
      .toBuffer();

    validPngBuffer = await sharp({
      create: {
        width: 150,
        height: 150,
        channels: 4,
        background: { r: 0, g: 128, b: 0, alpha: 1 }, // xanh lá
      },
    })
      .png()
      .toBuffer();
  });

  afterAll(() => {
    closeDb();
    // Dọn sạch thư mục upload tạm sau test, đảm bảo không rò rỉ file
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  it('1. Báo cáo mới thành công: tạo điểm ngập active, flood_event và lưu report', async () => {
    const res = await request(app)
      .post('/api/reports')
      .field('lat', 10.9447)
      .field('lng', 106.8243)
      .field('accuracyM', 15)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_p3_new_01')
      .field('source', 'camera')
      .field('note', 'Ngập trước cổng khu công nghiệp Amata')
      .attach('image', validJpgBuffer1, 'flood_new.jpg');

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.merged).toBe(false);
    expect(res.body.data.floodPoint).not.toBeNull();
    expect(res.body.data.floodPoint.status).toBe('active');
    expect(res.body.data.floodPoint.severity).toBe('medium');
    expect(res.body.data.report.id).toMatch(/^rep_/);
    expect(res.body.data.message).toContain('Cảm ơn bạn');

    // Kiểm tra trong DB
    const pointInDb = floodPointRepo.findById(res.body.data.floodPoint.id);
    expect(pointInDb).not.toBeNull();
    expect(pointInDb.reportCount).toBe(1);

    const reportInDb = reportRepo.findById(res.body.data.report.id);
    expect(reportInDb).not.toBeNull();
    expect(reportInDb.floodPointId).toBe(pointInDb.id);

    const openEvent = eventRepo.findOpenEvent(pointInDb.id);
    expect(openEvent).not.toBeNull();
    expect(openEvent.endedAt).toBeNull();
  });

  it('2. Báo trùng trong bán kính 50 m: gộp vào điểm ngập hiện có, tăng reportCount, không tạo điểm mới', async () => {
    const initialPointCount = floodPointRepo.countAll();

    // Tọa độ lệch ~20 mét so với điểm ở test 1 (vĩ độ dịch chuyển 0.00018 độ ≈ 20m)
    const res = await request(app)
      .post('/api/reports')
      .field('lat', 10.9447 + 0.00018)
      .field('lng', 106.8243)
      .field('accuracyM', 20)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_p3_dupe_02')
      .field('source', 'camera')
      .field('note', 'Báo thêm người thứ 2 tại cùng điểm')
      .attach('image', validPngBuffer, 'flood_second.png');

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.merged).toBe(true);
    expect(res.body.data.message).toContain('gộp vào điểm ngập gần đó');

    // Tổng số flood_points trong DB không được tăng thêm
    expect(floodPointRepo.countAll()).toBe(initialPointCount);

    // Điểm ngập đã được tăng reportCount thành 2
    const updatedPoint = floodPointRepo.findById(res.body.data.floodPoint.id);
    expect(updatedPoint.reportCount).toBe(2);
  });

  it('3. Trùng ảnh (SHA-256): từ chối với mã lỗi 409 DUPLICATE_IMAGE', async () => {
    // Gửi lại chính xác buffer validJpgBuffer1 đã gửi ở test 1
    const res = await request(app)
      .post('/api/reports')
      .field('lat', 10.9500)
      .field('lng', 106.8300)
      .field('accuracyM', 10)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_p3_sha_test')
      .attach('image', validJpgBuffer1, 'reused_image.jpg');

    expect(res.status).toBe(409);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_IMAGE');
    expect(res.body.error.message).toContain('Ảnh này đã được gửi trước đó');
  });

  it('4. Tọa độ ngoài tỉnh Đồng Nai: từ chối với mã lỗi 422 OUT_OF_AREA', async () => {
    // Tọa độ tại Hà Nội (lat: 21.0285, lng: 105.8542)
    const res = await request(app)
      .post('/api/reports')
      .field('lat', 21.0285)
      .field('lng', 105.8542)
      .field('accuracyM', 10)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_hanoi')
      .attach('image', validJpgBuffer2, 'hanoi.jpg');

    expect(res.status).toBe(422);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('OUT_OF_AREA');
    expect(res.body.error.message).toContain('ngoài phạm vi địa lý tỉnh Đồng Nai');
  });

  it('5. Ảnh quá cũ (> 5 phút): từ chối với mã lỗi 422 REPORT_TOO_OLD', async () => {
    // Thời điểm chụp cách đây 10 phút
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/reports')
      .field('lat', 10.9447)
      .field('lng', 106.8243)
      .field('accuracyM', 10)
      .field('capturedAt', tenMinutesAgo)
      .field('deviceId', 'device_old_report')
      .attach('image', validJpgBuffer2, 'old.jpg');

    expect(res.status).toBe(422);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('REPORT_TOO_OLD');
    expect(res.body.error.message).toContain('Ảnh chụp đã quá cũ');
  });

  it('6. AI lỗi/timeout (isFlood: null): điểm ngập khởi tạo ở trạng thái pending', async () => {
    // Tạo buffer ảnh mới khác biệt để không trùng SHA
    const aierrorBuffer = await sharp({
      create: { width: 120, height: 120, channels: 3, background: { r: 50, g: 50, b: 50 } },
    }).jpeg().toBuffer();

    const res = await request(app)
      .post('/api/reports?simulate=error')
      .field('lat', 10.8000)
      .field('lng', 106.9000)
      .field('accuracyM', 15)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_ai_error')
      .field('note', 'aierror simulation')
      .attach('image', aierrorBuffer, 'aierror.jpg');

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.aiResult.isFlood).toBeNull();
    expect(res.body.data.floodPoint.status).toBe('pending');

    // Điểm pending không tạo flood_event mở
    const openEvent = eventRepo.findOpenEvent(res.body.data.floodPoint.id);
    expect(openEvent).toBeNull();
  });

  it('7. AI khẳng định không ngập (isFlood: false): lưu report để hậu kiểm nhưng KHÔNG tạo điểm ngập trên bản đồ', async () => {
    const countBefore = floodPointRepo.countAll();
    const nofloodBuffer = await sharp({
      create: { width: 130, height: 130, channels: 3, background: { r: 200, g: 200, b: 200 } },
    }).jpeg().toBuffer();

    const res = await request(app)
      .post('/api/reports?simulate=noflood')
      .field('lat', 10.8200)
      .field('lng', 106.9200)
      .field('accuracyM', 20)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_noflood')
      .field('note', 'noflood test')
      .attach('image', nofloodBuffer, 'dry_street.jpg');

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.aiResult.isFlood).toBe(false);
    expect(res.body.data.floodPoint).toBeNull(); // Không tạo điểm ngập
    expect(res.body.data.message).toContain('không phát hiện tình trạng ngập nước');

    // Số điểm ngập trong DB giữ nguyên
    expect(floodPointRepo.countAll()).toBe(countBefore);

    // Báo cáo vẫn được lưu trong CSDL (với flood_point_id = null)
    const reportInDb = reportRepo.findById(res.body.data.report.id);
    expect(reportInDb).not.toBeNull();
    expect(reportInDb.floodPointId).toBeNull();
  });

  it('8. File giả ảnh (đuôi .jpg nhưng nội dung văn bản giả mạo): từ chối với mã lỗi 400 INVALID_IMAGE_FILE', async () => {
    const fakeImageBuffer = Buffer.from('day la file van ban gia mao khong phai anh jpeg');

    const res = await request(app)
      .post('/api/reports')
      .field('lat', 10.9447)
      .field('lng', 106.8243)
      .field('accuracyM', 15)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_fake_attacker')
      .attach('image', fakeImageBuffer, 'fake_photo.jpg');

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('INVALID_IMAGE_FILE');
    expect(res.body.error.message).toContain('không phải là định dạng ảnh hợp lệ');
  });

  it('9. Vượt giới hạn tần suất gửi báo cáo (Rate Limiting 5 báo cáo / giờ / deviceId): trả 429 RATE_LIMITED', async () => {
    const spamDeviceId = 'device_rate_limit_victim';

    // Gửi liên tiếp 5 báo cáo hợp lệ từ cùng 1 deviceId
    for (let i = 0; i < 5; i++) {
      const buf = await sharp({
        create: { width: 50 + i, height: 50 + i, channels: 3, background: { r: i * 20, g: 50, b: 100 } },
      }).jpeg().toBuffer();

      const r = await request(app)
        .post('/api/reports')
        .field('lat', 10.9447)
        .field('lng', 106.8243)
        .field('accuracyM', 15)
        .field('capturedAt', new Date().toISOString())
        .field('deviceId', spamDeviceId)
        .attach('image', buf, `spam_${i}.jpg`);

      expect(r.status).toBe(201);
    }

    // Báo cáo thứ 6 trong cùng 1 giờ từ thiết bị này phải bị chặn 429
    const buf6 = await sharp({
      create: { width: 60, height: 60, channels: 3, background: { r: 120, g: 50, b: 100 } },
    }).jpeg().toBuffer();

    const blockedRes = await request(app)
      .post('/api/reports')
      .field('lat', 10.9447)
      .field('lng', 106.8243)
      .field('accuracyM', 15)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', spamDeviceId)
      .attach('image', buf6, 'spam_blocked.jpg');

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.ok).toBe(false);
    expect(blockedRes.body.error.code).toBe('RATE_LIMITED');
    expect(blockedRes.body.error.message).toContain('quá giới hạn 5 báo cáo');
  });

  it('10. Ghi nhận cả 2 cờ LOW_TRUST_SOURCE và LOW_GPS_ACCURACY vào trust_flags của report', async () => {
    const flagImageBuffer = await sharp({
      create: { width: 140, height: 140, channels: 3, background: { r: 110, g: 220, b: 70 } },
    }).jpeg().toBuffer();

    // accuracyM = 75 (> 50m -> gắn LOW_GPS_ACCURACY)
    // source = 'gallery' (chọn từ thư viện -> gắn LOW_TRUST_SOURCE)
    const res = await request(app)
      .post('/api/reports')
      .field('lat', 10.9300)
      .field('lng', 106.8100)
      .field('accuracyM', 75)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_flag_demo')
      .field('source', 'gallery')
      .attach('image', flagImageBuffer, 'gallery_upload.jpg');

    expect(res.status).toBe(201);
    const reportInDb = reportRepo.findById(res.body.data.report.id);
    expect(reportInDb).not.toBeNull();

    // Kiểm tra trường trustFlags
    expect(Array.isArray(reportInDb.trustFlags)).toBe(true);
    expect(reportInDb.trustFlags).toContain('LOW_TRUST_SOURCE');
    expect(reportInDb.trustFlags).toContain('LOW_GPS_ACCURACY');
  });

  it('11. Tính toàn vẹn giao dịch: Lỗi giữa chừng thì rollback DB và XÓA file ảnh đã ghi', async () => {
    const rollbackBuffer = await sharp({
      create: { width: 160, height: 160, channels: 3, background: { r: 255, g: 0, b: 128 } },
    }).jpeg().toBuffer();

    const reportsCountBefore = db.prepare('SELECT COUNT(*) as count FROM reports').get().count;

    // Gửi request kèm header x-simulate-db-error để kích hoạt lỗi cố ý sau khi đã lưu file ảnh
    const res = await request(app)
      .post('/api/reports')
      .set('x-simulate-db-error', 'true')
      .field('lat', 10.9400)
      .field('lng', 106.8200)
      .field('accuracyM', 15)
      .field('capturedAt', new Date().toISOString())
      .field('deviceId', 'device_rollback_test')
      .attach('image', rollbackBuffer, 'rollback.jpg');

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.message).toContain('Mô phỏng lỗi ngoại lệ');

    // 1. Kiểm tra CSDL đã rollback hoàn toàn (số bản ghi reports không tăng)
    const reportsCountAfter = db.prepare('SELECT COUNT(*) as count FROM reports').get().count;
    expect(reportsCountAfter).toBe(reportsCountBefore);

    // 2. Kiểm tra không có file ảnh nào bị mồ côi (tính năng dọn dẹp file khi rollback)
    // Đảm bảo không có file nào chứa buffer rollback tồn tại trong testUploadDir
    if (fs.existsSync(testUploadDir)) {
      const files = [];
      const scanDir = (dir) => {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, item.name);
          if (item.isDirectory()) scanDir(full);
          else files.push(full);
        }
      };
      scanDir(testUploadDir);

      // Mọi file còn lại trong thư mục test không được phép có nội dung bằng rollbackBuffer
      for (const file of files) {
        const content = fs.readFileSync(file);
        expect(content.equals(rollbackBuffer)).toBe(false);
      }
    }
  });
});
