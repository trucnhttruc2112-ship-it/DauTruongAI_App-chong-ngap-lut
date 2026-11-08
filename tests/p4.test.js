import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { app } from '../src/server.js';
import { getDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../scripts/migrate.js';
import { runSeed } from '../scripts/seed.js';
import RULES from '../src/config/rules.js';
import floodPointRepo from '../src/repositories/floodPointRepo.js';
import eventRepo from '../src/repositories/eventRepo.js';
import confirmationRepo from '../src/repositories/confirmationRepo.js';
import { runExpireOnce } from '../src/services/expirationService.js';
import { confirmationService } from '../src/services/confirmationService.js';

describe('Prompt 4: Xác nhận vẫn ngập / hết ngập & Tự động hết hạn (P4)', () => {
  let db;
  let sampleImageBuffer;
  let sampleImageBuffer2;

  beforeAll(async () => {
    db = getDb();
    runMigrations(db);
    runSeed(db);

    // Chuẩn bị 2 buffer ảnh khác nhau (SHA-256 khác nhau) cho test tích hợp reportService
    sampleImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 50, g: 150, b: 250 },
      },
    })
      .jpeg()
      .toBuffer();

    sampleImageBuffer2 = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 250, g: 150, b: 50 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  afterAll(() => {
    closeDb();
  });

  // =========================================================================
  // 1. XÁC NHẬN 'STILL' (VẪN NGẬP)
  // =========================================================================
  describe('1. Xác nhận "still" (vẫn ngập)', () => {
    it('1.1. Xác nhận "still" thành công: tăng confirmStill, cập nhật lastConfirmedAt và tính lại trustScore', async () => {
      const targetPoint = floodPointRepo.findById('fp_demo_01');
      const initialStill = targetPoint.confirmStill;
      const deviceId = `dev_still_${crypto.randomUUID()}`;

      // Vị trí người xác nhận cách điểm ngập ~15m (< 300m)
      const res = await request(app)
        .post('/api/flood-points/fp_demo_01/confirm')
        .send({
          type: 'still',
          deviceId,
          lat: 10.9448,
          lng: 106.8244,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.resolved).toBe(false);
      expect(res.body.data.message).toContain('vẫn còn ngập');
      expect(res.body.data.floodPoint.confirmStill).toBe(initialStill + 1);

      // Kiểm tra DB cập nhật chính xác
      const updatedInDb = floodPointRepo.findById('fp_demo_01');
      expect(updatedInDb.confirmStill).toBe(initialStill + 1);
      expect(updatedInDb.lastConfirmedAt).toBeTruthy();
      expect(typeof updatedInDb.trustScore).toBe('number');
      expect(updatedInDb.trustScore).toBeGreaterThanOrEqual(0);
      expect(updatedInDb.trustScore).toBeLessThanOrEqual(100);

      // Bản ghi xác nhận được lưu trong DB
      const conf = confirmationRepo.findByPointAndDevice('fp_demo_01', deviceId, 'still');
      expect(conf).toBeTruthy();
      expect(conf.type).toBe('still');
    });

    it('1.2. Xác nhận "still" cho điểm ngập trạng thái "pending" thành công', async () => {
      const pendingPoint = floodPointRepo.findById('fp_demo_11');
      expect(pendingPoint.status).toBe('pending');
      const deviceId = `dev_pending_${crypto.randomUUID()}`;

      const res = await request(app)
        .post('/api/flood-points/fp_demo_11/confirm')
        .send({
          type: 'still',
          deviceId,
          lat: pendingPoint.lat + 0.0001,
          lng: pendingPoint.lng + 0.0001,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.floodPoint.confirmStill).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 2. XÁC NHẬN 'ENDED' (HẾT NGẬP) & CHUYỂN TRẠNG THÁI 'RESOLVED'
  // =========================================================================
  describe('2. Xác nhận "ended" & chuyển sang resolved', () => {
    it('2.1. Thiết bị thứ 1 báo "ended": confirmEnded tăng lên 1, điểm vẫn active, sự kiện chưa đóng', async () => {
      const dev1 = `dev_ended_1_${crypto.randomUUID()}`;

      const res = await request(app)
        .post('/api/flood-points/fp_demo_02/confirm')
        .send({
          type: 'ended',
          deviceId: dev1,
          lat: 10.9525,
          lng: 106.8421,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.resolved).toBe(false);
      expect(res.body.data.floodPoint.confirmEnded).toBe(1);
      expect(res.body.data.floodPoint.status).toBe('active');

      // Sự kiện flood_event vẫn đang mở
      const openEvent = eventRepo.findOpenEvent('fp_demo_02');
      expect(openEvent).toBeTruthy();
      expect(openEvent.endedAt).toBeNull();
    });

    it('2.2. Đủ 2 thiết bị khác nhau báo "ended": resolved, đóng flood_event (confirmed_ended), tăng floodEventCount', async () => {
      const dev2 = `dev_ended_2_${crypto.randomUUID()}`;
      const beforePoint = floodPointRepo.findById('fp_demo_02');
      const beforeEventCount = beforePoint.floodEventCount || 0;

      const res = await request(app)
        .post('/api/flood-points/fp_demo_02/confirm')
        .send({
          type: 'ended',
          deviceId: dev2,
          lat: 10.9526,
          lng: 106.8422,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.resolved).toBe(true);
      expect(res.body.data.message).toContain('đã được xác nhận hết ngập');
      expect(res.body.data.floodPoint.status).toBe('resolved');
      expect(res.body.data.floodPoint.confirmEnded).toBe(2);
      expect(res.body.data.floodPoint.floodEventCount).toBe(beforeEventCount + 1);

      // Kiểm tra DB: trạng thái điểm là resolved
      const updatedPoint = floodPointRepo.findById('fp_demo_02');
      expect(updatedPoint.status).toBe('resolved');
      expect(updatedPoint.floodEventCount).toBe(beforeEventCount + 1);

      // Kiểm tra DB: sự kiện ngập mở đã được đóng với end_reason = 'confirmed_ended'
      const openEvent = eventRepo.findOpenEvent('fp_demo_02');
      expect(openEvent).toBeNull();

      const events = eventRepo.listByFloodPointId('fp_demo_02');
      const closedEvent = events.find((e) => e.endReason === 'confirmed_ended');
      expect(closedEvent).toBeTruthy();
      expect(closedEvent.endedAt).toBeTruthy();
    });
  });

  // =========================================================================
  // 3. CÁC CA BIÊN & TỪ CHỐI VI PHẠM QUY TẮC
  // =========================================================================
  describe('3. Ràng buộc nghiệp vụ & Mã lỗi', () => {
    it('3.1. Cùng một thiết bị xác nhận cùng loại 2 lần trả 409 DUPLICATE_CONFIRMATION', async () => {
      const devId = `dev_dup_${crypto.randomUUID()}`;

      // Lần 1: thành công
      const res1 = await request(app)
        .post('/api/flood-points/fp_demo_01/confirm')
        .send({
          type: 'still',
          deviceId: devId,
          lat: 10.9447,
          lng: 106.8243,
        });
      expect(res1.status).toBe(200);

      // Lần 2: cùng thiết bị, cùng type 'still' -> 409
      const res2 = await request(app)
        .post('/api/flood-points/fp_demo_01/confirm')
        .send({
          type: 'still',
          deviceId: devId,
          lat: 10.9447,
          lng: 106.8243,
        });
      expect(res2.status).toBe(409);
      expect(res2.body.ok).toBe(false);
      expect(res2.body.error.code).toBe('DUPLICATE_CONFIRMATION');
      expect(res2.body.error.message).toContain('đã gửi xác nhận');
    });

    it('3.2. Cùng một thiết bị xác nhận loại KHÁC (still rồi ended) được chấp nhận', async () => {
      const devId = `dev_diff_type_${crypto.randomUUID()}`;

      const res1 = await request(app)
        .post('/api/flood-points/fp_demo_03/confirm')
        .send({
          type: 'still',
          deviceId: devId,
          lat: 10.9712,
          lng: 106.8322,
        });
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post('/api/flood-points/fp_demo_03/confirm')
        .send({
          type: 'ended',
          deviceId: devId,
          lat: 10.9712,
          lng: 106.8322,
        });
      expect(res2.status).toBe(200);
      expect(res2.body.ok).toBe(true);
    });

    it('3.3. Người xác nhận cách xa hơn 300m bị từ chối 422 CONFIRM_TOO_FAR', async () => {
      const devId = `dev_far_${crypto.randomUUID()}`;
      // fp_demo_01 tại (10.9447, 106.8243). Tọa độ (10.9500, 106.8300) cách ~850m
      const res = await request(app)
        .post('/api/flood-points/fp_demo_01/confirm')
        .send({
          type: 'still',
          deviceId: devId,
          lat: 10.9500,
          lng: 106.8300,
        });

      expect(res.status).toBe(422);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('CONFIRM_TOO_FAR');
      expect(res.body.error.message).toContain('quá xa');
    });

    it('3.4. Xác nhận điểm đã "resolved" bị từ chối 422 POINT_NOT_ACTIVE', async () => {
      const res = await request(app)
        .post('/api/flood-points/fp_demo_06/confirm')
        .send({
          type: 'still',
          deviceId: `dev_${crypto.randomUUID()}`,
          lat: 10.9491,
          lng: 106.8177,
        });

      expect(res.status).toBe(422);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('POINT_NOT_ACTIVE');
    });

    it('3.5. Xác nhận điểm đã "expired" bị từ chối 422 POINT_NOT_ACTIVE', async () => {
      const res = await request(app)
        .post('/api/flood-points/fp_demo_20/confirm')
        .send({
          type: 'still',
          deviceId: `dev_${crypto.randomUUID()}`,
          lat: 10.9488,
          lng: 106.8522,
        });

      expect(res.status).toBe(422);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('POINT_NOT_ACTIVE');
    });

    it('3.6. Xác nhận điểm không tồn tại trả 404 NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/flood-points/non_existent_point_999/confirm')
        .send({
          type: 'still',
          deviceId: `dev_${crypto.randomUUID()}`,
          lat: 10.9447,
          lng: 106.8243,
        });

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('3.7. Thiếu dữ liệu hoặc kiểu dữ liệu không hợp lệ trả 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .post('/api/flood-points/fp_demo_01/confirm')
        .send({
          type: 'invalid_type', // chỉ chấp nhận 'still' hoặc 'ended'
          deviceId: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('INVALID_INPUT');
    });
  });

  // =========================================================================
  // 4. XỬ LÝ ĐỒNG THỜI (TRANSACTIONS & CONCURRENCY)
  // =========================================================================
  describe('4. An toàn giao dịch CSDL khi xử lý đồng thời', () => {
    it('4.1. Hai xác nhận "still" đồng thời từ 2 thiết bị khác nhau không làm sai lệch bộ đếm', async () => {
      const ptBefore = floodPointRepo.findById('fp_demo_04');
      const initialStill = ptBefore.confirmStill || 0;

      const devA = `dev_concurrent_A_${crypto.randomUUID()}`;
      const devB = `dev_concurrent_B_${crypto.randomUUID()}`;

      // Gửi 2 request đồng thời
      const [resA, resB] = await Promise.all([
        request(app).post('/api/flood-points/fp_demo_04/confirm').send({
          type: 'still',
          deviceId: devA,
          lat: ptBefore.lat,
          lng: ptBefore.lng,
        }),
        request(app).post('/api/flood-points/fp_demo_04/confirm').send({
          type: 'still',
          deviceId: devB,
          lat: ptBefore.lat,
          lng: ptBefore.lng,
        }),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const ptAfter = floodPointRepo.findById('fp_demo_04');
      expect(ptAfter.confirmStill).toBe(initialStill + 2);
    });

    it('4.2. Hai xác nhận trùng lặp đồng thời từ CÙNG 1 thiết bị: chỉ đúng 1 request thành công, request kia 409', async () => {
      const pt = floodPointRepo.findById('fp_demo_07');
      const devSame = `dev_same_${crypto.randomUUID()}`;

      const [res1, res2] = await Promise.all([
        request(app).post('/api/flood-points/fp_demo_07/confirm').send({
          type: 'still',
          deviceId: devSame,
          lat: pt.lat,
          lng: pt.lng,
        }),
        request(app).post('/api/flood-points/fp_demo_07/confirm').send({
          type: 'still',
          deviceId: devSame,
          lat: pt.lat,
          lng: pt.lng,
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });
  });

  // =========================================================================
  // 5. TỰ ĐỘNG HẾT HẠN (EXPIRATION SERVICE & runExpireOnce)
  // =========================================================================
  describe('5. Tự động hết hạn (runExpireOnce)', () => {
    it('5.1. Đúng mốc 6 giờ kể từ lần cập nhật gần nhất: CHƯA hết hạn', () => {
      // Tạo điểm ngập tạm thời với mốc cập nhật xác định
      const tempId = `fp_test_expire_exact_${crypto.randomUUID()}`;
      const baseTime = new Date('2026-11-08T10:00:00.000Z');

      floodPointRepo.insert({
        id: tempId,
        lat: 10.94,
        lng: 106.82,
        status: 'active',
        severity: 'low',
        firstReportedAt: baseTime.toISOString(),
        lastUpdatedAt: baseTime.toISOString(),
        floodEventCount: 1,
        isDemo: 0,
      });

      // Mốc now đúng 6 giờ sau (16:00:00.000Z)
      const exactly6HoursLater = new Date(baseTime.getTime() + 6 * 3600 * 1000);
      const res = runExpireOnce(exactly6HoursLater);

      // Điểm tempId không nằm trong danh sách hết hạn
      expect(res.expiredPointIds).not.toContain(tempId);

      const checkPoint = floodPointRepo.findById(tempId);
      expect(checkPoint.status).toBe('active');
    });

    it('5.2. Quá 6 giờ (6h + 1s): chuyển sang expired, đóng flood_event (auto_expired), tăng floodEventCount', () => {
      const tempId = `fp_test_expire_over_${crypto.randomUUID()}`;
      const baseTime = new Date('2026-11-08T10:00:00.000Z');

      floodPointRepo.insert({
        id: tempId,
        lat: 10.941,
        lng: 106.821,
        status: 'active',
        severity: 'low',
        firstReportedAt: baseTime.toISOString(),
        lastUpdatedAt: baseTime.toISOString(),
        floodEventCount: 1,
        isDemo: 0,
      });

      // Mở 1 flood_event cho điểm này
      const eventId = `evt_temp_${crypto.randomUUID()}`;
      eventRepo.insert({
        id: eventId,
        floodPointId: tempId,
        startedAt: baseTime.toISOString(),
        endedAt: null,
        endReason: null,
        isDemo: 0,
      });

      // Mốc now quá 6 giờ 1 giây (16:00:01.000Z)
      const over6HoursLater = new Date(baseTime.getTime() + 6 * 3600 * 1000 + 1000);
      const res = runExpireOnce(over6HoursLater);

      expect(res.expiredPointIds).toContain(tempId);

      // Kiểm tra DB: trạng thái chuyển sang expired và floodEventCount tăng
      const expiredPoint = floodPointRepo.findById(tempId);
      expect(expiredPoint.status).toBe('expired');
      expect(expiredPoint.floodEventCount).toBe(2);

      // Kiểm tra flood_event đã được đóng với auto_expired
      const closedEvent = eventRepo.findById(eventId);
      expect(closedEvent.endedAt).toBeTruthy();
      expect(closedEvent.endReason).toBe('auto_expired');
    });
  });

  // =========================================================================
  // 6. TÍCH HỢP TRỌN VÒNG ĐỜI: RESOLVED -> BÁO CÁO MỚI TẠO SỰ KIỆN MỚI
  // =========================================================================
  describe('6. Tích hợp trọn vòng đời: Resolved -> Báo cáo mới tạo sự kiện MỚI', () => {
    it('6.1. Báo cáo mới tại cùng vị trí sau khi điểm cũ đã resolved phải tạo sự kiện MỚI và tăng đếm đúng', async () => {
      const testLat = 10.965;
      const testLng = 106.825;
      const devReport1 = `dev_rep1_${crypto.randomUUID()}`;

      // Bước 1: Gửi báo cáo ngập đợt 1 qua POST /api/reports
      const repRes1 = await request(app)
        .post('/api/reports')
        .field('lat', testLat.toString())
        .field('lng', testLng.toString())
        .field('accuracyM', '10')
        .field('capturedAt', new Date().toISOString())
        .field('deviceId', devReport1)
        .field('source', 'camera')
        .attach('image', sampleImageBuffer, 'flood1.jpg');

      expect(repRes1.status).toBe(201);
      expect(repRes1.body.ok).toBe(true);
      const point1Id = repRes1.body.data.floodPoint.id;
      expect(point1Id).toBeTruthy();

      // Điểm đợt 1 đang active, có 1 sự kiện mở
      const point1 = floodPointRepo.findById(point1Id);
      expect(point1.status).toBe('active');
      const openEvt1 = eventRepo.findOpenEvent(point1Id);
      expect(openEvt1).toBeTruthy();

      // Bước 2: 2 thiết bị khác nhau xác nhận 'ended' -> điểm 1 chuyển sang resolved
      const devEndA = `dev_enda_${crypto.randomUUID()}`;
      const devEndB = `dev_endb_${crypto.randomUUID()}`;

      await request(app)
        .post(`/api/flood-points/${point1Id}/confirm`)
        .send({ type: 'ended', deviceId: devEndA, lat: testLat, lng: testLng });

      const resResolve = await request(app)
        .post(`/api/flood-points/${point1Id}/confirm`)
        .send({ type: 'ended', deviceId: devEndB, lat: testLat, lng: testLng });

      expect(resResolve.status).toBe(200);
      expect(resResolve.body.data.resolved).toBe(true);

      const resolvedPoint1 = floodPointRepo.findById(point1Id);
      expect(resolvedPoint1.status).toBe('resolved');

      // Sự kiện đợt 1 đã kết thúc
      const closedEvt1 = eventRepo.findById(openEvt1.id);
      expect(closedEvt1.endedAt).toBeTruthy();
      expect(closedEvt1.endReason).toBe('confirmed_ended');

      // Bước 3: Đợt ngập mới xảy ra tại CÙNG TỌA ĐỘ -> Gửi báo cáo đợt 2 (ảnh khác, tránh 409 DUPLICATE_IMAGE)
      const devReport2 = `dev_rep2_${crypto.randomUUID()}`;
      const repRes2 = await request(app)
        .post('/api/reports')
        .field('lat', testLat.toString())
        .field('lng', testLng.toString())
        .field('accuracyM', '12')
        .field('capturedAt', new Date().toISOString())
        .field('deviceId', devReport2)
        .field('source', 'camera')
        .attach('image', sampleImageBuffer2, 'flood2_new.jpg');

      expect(repRes2.status).toBe(201);
      expect(repRes2.body.ok).toBe(true);

      // Điểm cũ đã resolved nên dedupe KHÔNG gộp vào điểm cũ -> tạo điểm/sự kiện mới
      expect(repRes2.body.data.merged).toBe(false);
      const point2Id = repRes2.body.data.floodPoint.id;
      expect(point2Id).not.toBe(point1Id);

      // Điểm mới có sự kiện MỚI đang mở
      const point2 = floodPointRepo.findById(point2Id);
      expect(point2.status).toBe('active');
      const openEvt2 = eventRepo.findOpenEvent(point2Id);
      expect(openEvt2).toBeTruthy();
      expect(openEvt2.id).not.toBe(openEvt1.id);
      expect(openEvt2.endedAt).toBeNull();
    });
  });

  // =========================================================================
  // 7. BẢO MẬT: HEADER x-fake-now CHỈ CÓ TÁC DỤNG KHI NODE_ENV=test
  // =========================================================================
  describe('7. Bảo mật header x-fake-now', () => {
    beforeAll(() => {
      // Nạp lại seed để khôi phục trạng thái active sau bài test hết hạn
      runSeed(db);
    });

    it('7.1. Khi NODE_ENV=test, header x-fake-now được tôn trọng', async () => {
      const fakeTime = '2026-11-08T06:00:00.000Z';
      const devId = `dev_fake_test_${crypto.randomUUID()}`;

      const res = await request(app)
        .post('/api/flood-points/fp_demo_08/confirm')
        .set('x-fake-now', fakeTime)
        .send({
          type: 'still',
          deviceId: devId,
          lat: 10.9022,
          lng: 106.8711,
        });

      expect(res.status).toBe(200);

      const pt = floodPointRepo.findById('fp_demo_08');
      expect(pt.lastConfirmedAt).toBe(fakeTime);
    });

    it('7.2. Khi NODE_ENV khác test (production), header x-fake-now bị bỏ qua hoàn toàn', async () => {
      const originalEnv = process.env.NODE_ENV;
      const fakeTime = '2020-01-01T00:00:00.000Z';
      const devId = `dev_fake_prod_${crypto.randomUUID()}`;

      try {
        process.env.NODE_ENV = 'production';

        const res = await request(app)
          .post('/api/flood-points/fp_demo_09/confirm')
          .set('x-fake-now', fakeTime)
          .send({
            type: 'still',
            deviceId: devId,
            lat: 10.7834,
            lng: 106.9621,
          });

        expect(res.status).toBe(200);

        const pt = floodPointRepo.findById('fp_demo_09');
        // lastConfirmedAt KHÔNG được là ngày giả lập năm 2020 mà phải là thời gian hiện tại
        expect(pt.lastConfirmedAt).not.toBe(fakeTime);
        const confirmedYear = new Date(pt.lastConfirmedAt).getFullYear();
        expect(confirmedYear).toBeGreaterThanOrEqual(2025);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
