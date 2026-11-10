import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ENV } from '../src/config/env.js';
import { getDb } from '../src/db/connection.js';
import { runSeedClear } from './seedClear.js';
import floodPointRepo from '../src/repositories/floodPointRepo.js';
import reportRepo from '../src/repositories/reportRepo.js';
import confirmationRepo from '../src/repositories/confirmationRepo.js';
import eventRepo from '../src/repositories/eventRepo.js';

/**
 * Danh sách 12 điểm ngập chuẩn cho kịch bản Demo:
 * - 6 điểm 'active' (2 low, 2 medium, 2 high)
 * - 3 điểm 'pending' (chờ xác minh)
 * - 3 điểm 'resolved' (đã hết ngập)
 * - 4 điểm 'isFloodProne = 1' (floodEventCount >= 3)
 * - Phân bố đều qua các phường tại TP. Biên Hòa, Đồng Nai
 */
const DEMO_POINTS_TEMPLATE = [
  // --- 6 ĐIỂM ACTIVE ---
  {
    id: 'fp_demo_act_1',
    address: 'Ngã tư Amata, P. Long Bình, TP. Biên Hòa',
    street: 'Xa lộ Hà Nội',
    wardId: 'long-binh',
    lat: 10.9447,
    lng: 106.8243,
    status: 'active',
    severity: 'medium',
    estimatedDepthCm: 35,
    trustScore: 85,
    confirmStill: 4,
    confirmEnded: 0,
    reportCount: 3,
    isFloodProne: 1,
    floodEventCount: 5,
    minsAgoReported: 70,
    minsAgoUpdated: 20,
  },
  {
    id: 'fp_demo_act_2',
    address: 'Cầu Đồng Nai đoạn ngã ba Vũng Tàu, P. An Bình',
    street: 'Quốc lộ 1A',
    wardId: 'an-binh',
    lat: 10.9525,
    lng: 106.8421,
    status: 'active',
    severity: 'high',
    estimatedDepthCm: 50,
    trustScore: 90,
    confirmStill: 6,
    confirmEnded: 0,
    reportCount: 4,
    isFloodProne: 1,
    floodEventCount: 6,
    minsAgoReported: 85,
    minsAgoUpdated: 15,
  },
  {
    id: 'fp_demo_act_3',
    address: 'Đường Đồng Khởi, đoạn Cầu Đồng Khởi, P. Trảng Dài',
    street: 'Đồng Khởi',
    wardId: 'trang-dai',
    lat: 10.9712,
    lng: 106.8322,
    status: 'active',
    severity: 'high',
    estimatedDepthCm: 45,
    trustScore: 88,
    confirmStill: 5,
    confirmEnded: 0,
    reportCount: 3,
    isFloodProne: 1,
    floodEventCount: 4,
    minsAgoReported: 60,
    minsAgoUpdated: 25,
  },
  {
    id: 'fp_demo_act_4',
    address: 'Vòng xoay Tam Hiệp, P. Tam Hiệp',
    street: 'Quốc lộ 1A',
    wardId: 'tam-hiep',
    lat: 10.9389,
    lng: 106.8155,
    status: 'active',
    severity: 'medium',
    estimatedDepthCm: 30,
    trustScore: 80,
    confirmStill: 3,
    confirmEnded: 0,
    reportCount: 2,
    isFloodProne: 1,
    floodEventCount: 3,
    minsAgoReported: 50,
    minsAgoUpdated: 10,
  },
  {
    id: 'fp_demo_act_5',
    address: 'Đường Nguyễn Ái Quốc đoạn Công viên 30/4, P. Hố Nai',
    street: 'Nguyễn Ái Quốc',
    wardId: 'ho-nai',
    lat: 10.9611,
    lng: 106.8533,
    status: 'active',
    severity: 'low',
    estimatedDepthCm: 15,
    trustScore: 70,
    confirmStill: 2,
    confirmEnded: 0,
    reportCount: 2,
    isFloodProne: 0,
    floodEventCount: 1,
    minsAgoReported: 40,
    minsAgoUpdated: 30,
  },
  {
    id: 'fp_demo_act_6',
    address: 'Chợ Tân Phong, P. Tân Phong',
    street: 'Đồng Khởi',
    wardId: 'tan-phong',
    lat: 10.9688,
    lng: 106.8211,
    status: 'active',
    severity: 'low',
    estimatedDepthCm: 20,
    trustScore: 75,
    confirmStill: 1,
    confirmEnded: 0,
    reportCount: 1,
    isFloodProne: 0,
    floodEventCount: 2,
    minsAgoReported: 45,
    minsAgoUpdated: 35,
  },

  // --- 3 ĐIỂM PENDING (Chờ xác minh) ---
  {
    id: 'fp_demo_pnd_1',
    address: 'Hẻm 42 đường Cách Mạng Tháng 8, P. Quyết Thắng',
    street: 'Cách Mạng Tháng 8',
    wardId: 'quyet-thang',
    lat: 10.9491,
    lng: 106.8182,
    status: 'pending',
    severity: 'low',
    estimatedDepthCm: 15,
    trustScore: 40,
    confirmStill: 0,
    confirmEnded: 0,
    reportCount: 1,
    isFloodProne: 0,
    floodEventCount: 0,
    minsAgoReported: 25,
    minsAgoUpdated: 25,
  },
  {
    id: 'fp_demo_pnd_2',
    address: 'Đoạn trũng đường Huỳnh Văn Nghệ, P. Quang Vinh',
    street: 'Huỳnh Văn Nghệ',
    wardId: 'quang-vinh',
    lat: 10.9572,
    lng: 106.8124,
    status: 'pending',
    severity: 'medium',
    estimatedDepthCm: 25,
    trustScore: 45,
    confirmStill: 0,
    confirmEnded: 0,
    reportCount: 1,
    isFloodProne: 0,
    floodEventCount: 1,
    minsAgoReported: 30,
    minsAgoUpdated: 30,
  },
  {
    id: 'fp_demo_pnd_3',
    address: 'Khu dân cư Bùi Trọng Nghĩa, P. Trảng Dài',
    street: 'Bùi Trọng Nghĩa',
    wardId: 'trang-dai',
    lat: 10.9785,
    lng: 106.8394,
    status: 'pending',
    severity: 'low',
    estimatedDepthCm: 18,
    trustScore: 40,
    confirmStill: 0,
    confirmEnded: 0,
    reportCount: 1,
    isFloodProne: 0,
    floodEventCount: 0,
    minsAgoReported: 20,
    minsAgoUpdated: 20,
  },

  // --- 3 ĐIỂM RESOLVED (Đã hết ngập) ---
  {
    id: 'fp_demo_res_1',
    address: 'Cổng KCN Biên Hòa 2, P. Long Bình Tân',
    street: 'Quốc lộ 51',
    wardId: 'long-binh-tan',
    lat: 10.9234,
    lng: 106.8621,
    status: 'resolved',
    severity: 'medium',
    estimatedDepthCm: 0,
    trustScore: 85,
    confirmStill: 1,
    confirmEnded: 2,
    reportCount: 2,
    isFloodProne: 0,
    floodEventCount: 1,
    minsAgoReported: 90,
    minsAgoUpdated: 15,
  },
  {
    id: 'fp_demo_res_2',
    address: 'Đường Phạm Văn Thuận gần Tam Hiệp, P. Tam Hiệp',
    street: 'Phạm Văn Thuận',
    wardId: 'tam-hiep',
    lat: 10.9412,
    lng: 106.8288,
    status: 'resolved',
    severity: 'low',
    estimatedDepthCm: 0,
    trustScore: 80,
    confirmStill: 2,
    confirmEnded: 2,
    reportCount: 2,
    isFloodProne: 0,
    floodEventCount: 1,
    minsAgoReported: 80,
    minsAgoUpdated: 20,
  },
  {
    id: 'fp_demo_res_3',
    address: 'Khu vực Suối Săn Máu, P. Hố Nai',
    street: 'Nguyễn Ái Quốc',
    wardId: 'ho-nai',
    lat: 10.9635,
    lng: 106.8488,
    status: 'resolved',
    severity: 'high',
    estimatedDepthCm: 0,
    trustScore: 90,
    confirmStill: 3,
    confirmEnded: 2,
    reportCount: 3,
    isFloodProne: 0,
    floodEventCount: 2,
    minsAgoReported: 85,
    minsAgoUpdated: 25,
  },
];

export function runDemoReset(dbInstance = null, options = {}) {
  const currentDataMode = options.dataMode || process.env.DATA_MODE || ENV.DATA_MODE;
  if (currentDataMode === 'real') {
    const msg = 'Lỗi từ chối: DATA_MODE=real (chế độ dữ liệu thật cấm chạy demo:reset)';
    const err = new Error(msg);
    err.code = 'DATA_MODE_REAL_REJECTED';
    throw err;
  }

  const db = dbInstance || getDb();

  // Kiểm tra bảng đã tồn tại chưa
  try {
    const tableCheck = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='flood_points'").get();
    if (!tableCheck || tableCheck.count === 0) {
      const err = new Error('DB chưa được khởi tạo. Chạy npm run migrate trước.');
      err.code = 'DB_NOT_INITIALIZED';
      throw err;
    }
  } catch (checkErr) {
    if (checkErr.code === 'DB_NOT_INITIALIZED') throw checkErr;
    const err = new Error('DB chưa được khởi tạo. Chạy npm run migrate trước.');
    err.code = 'DB_NOT_INITIALIZED';
    throw err;
  }

  // 1. Xóa sạch toàn bộ dữ liệu demo cũ (dùng lại logic của seedClear)
  runSeedClear(db);

  // 2. Nạp dữ liệu mới với mốc thời gian TƯƠNG ĐỐI so với thời điểm chạy (10 - 90 phút trước)
  const now = options.now instanceof Date ? options.now : (options.now ? new Date(options.now) : new Date());

  const summary = {
    total: 0,
    active: 0,
    pending: 0,
    resolved: 0,
    floodProne: 0,
    bySeverity: { low: 0, medium: 0, high: 0 },
    reportsCreated: 0,
    confirmationsCreated: 0,
  };

  const resetTx = db.transaction(() => {
    for (const p of DEMO_POINTS_TEMPLATE) {
      const firstReportedDate = new Date(now.getTime() - p.minsAgoReported * 60 * 1000);
      const lastUpdatedDate = new Date(now.getTime() - p.minsAgoUpdated * 60 * 1000);
      const lastConfirmedDate = p.confirmStill > 0 ? lastUpdatedDate : null;

      // Insert flood_point
      floodPointRepo.insert({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        address: p.address,
        street: p.street,
        wardId: p.wardId,
        status: p.status,
        severity: p.severity,
        estimatedDepthCm: p.estimatedDepthCm,
        trustScore: p.trustScore,
        confirmStill: p.confirmStill,
        confirmEnded: p.confirmEnded,
        reportCount: p.reportCount,
        isFloodProne: p.isFloodProne,
        floodEventCount: p.floodEventCount,
        historicalEventCount: Math.max(0, p.floodEventCount - 1),
        firstReportedAt: firstReportedDate.toISOString(),
        lastUpdatedAt: lastUpdatedDate.toISOString(),
        lastConfirmedAt: lastConfirmedDate ? lastConfirmedDate.toISOString() : null,
        isDemo: 1,
      });

      // Tạo sự kiện flood_events
      if (p.status === 'active') {
        eventRepo.insert({
          id: `ev_${p.id}_open`,
          floodPointId: p.id,
          startedAt: firstReportedDate.toISOString(),
          endedAt: null,
          endReason: null,
          isDemo: 1,
        });
      } else if (p.status === 'resolved') {
        eventRepo.insert({
          id: `ev_${p.id}_ended`,
          floodPointId: p.id,
          startedAt: firstReportedDate.toISOString(),
          endedAt: lastUpdatedDate.toISOString(),
          endReason: 'confirmed_ended',
          isDemo: 1,
        });
      }

      // Tạo các báo cáo mô phỏng (reports)
      for (let r = 1; r <= p.reportCount; r++) {
        const repTime = new Date(firstReportedDate.getTime() + (r - 1) * 5 * 60 * 1000);
        reportRepo.insert({
          id: `rep_${p.id}_${r}`,
          floodPointId: p.id,
          lat: p.lat + (r - 1) * 0.0001,
          lng: p.lng + (r - 1) * 0.0001,
          accuracyM: 8,
          capturedAt: repTime.toISOString(),
          deviceId: `dev_demo_${p.id}_${r}`,
          source: 'camera',
          imagePath: `/uploads/demo/${p.id}_${r}.jpg`,
          imageSha256: crypto.createHash('sha256').update(`${p.id}_${r}`).digest('hex'),
          imageDhash: 'a1b2c3d4e5f60000',
          aiSeverity: p.severity,
          aiConfidence: 0.85,
          createdAt: repTime.toISOString(),
          isDemo: 1,
        });
        summary.reportsCreated++;
      }

      // Tạo xác nhận mô phỏng (confirmations)
      if (p.confirmStill > 0) {
        for (let c = 1; c <= p.confirmStill; c++) {
          confirmationRepo.insert({
            id: `conf_still_${p.id}_${c}`,
            floodPointId: p.id,
            deviceId: `dev_conf_still_${p.id}_${c}`,
            type: 'still',
            lat: p.lat,
            lng: p.lng,
            createdAt: lastUpdatedDate.toISOString(),
            isDemo: 1,
          });
          summary.confirmationsCreated++;
        }
      }

      if (p.confirmEnded > 0) {
        for (let c = 1; c <= p.confirmEnded; c++) {
          confirmationRepo.insert({
            id: `conf_ended_${p.id}_${c}`,
            floodPointId: p.id,
            deviceId: `dev_conf_ended_${p.id}_${c}`,
            type: 'ended',
            lat: p.lat,
            lng: p.lng,
            createdAt: lastUpdatedDate.toISOString(),
            isDemo: 1,
          });
          summary.confirmationsCreated++;
        }
      }

      // Cập nhật bộ đếm summary
      summary.total++;
      if (p.status === 'active') summary.active++;
      if (p.status === 'pending') summary.pending++;
      if (p.status === 'resolved') summary.resolved++;
      if (p.isFloodProne) summary.floodProne++;
      summary.bySeverity[p.severity] = (summary.bySeverity[p.severity] || 0) + 1;
    }
  });

  resetTx();

  return summary;
}

export function handleDemoResetCli() {
  try {
    const summary = runDemoReset();
    console.log('🎉 [demo:reset] Thiết lập lại dữ liệu Demo thành công!\n');
    console.table([
      { 'Trạng thái / Tiêu chí': 'Đang ngập (active)', 'Số lượng': summary.active, 'Mô tả': 'Đủ mức: nhẹ (low), vừa (medium), nặng (high)' },
      { 'Trạng thái / Tiêu chí': 'Chờ xác minh (pending)', 'Số lượng': summary.pending, 'Mô tả': 'Chờ thêm xác nhận hoặc báo cáo thứ 2' },
      { 'Trạng thái / Tiêu chí': 'Đã hết ngập (resolved)', 'Số lượng': summary.resolved, 'Mô tả': 'Đã có 2 thiết bị khác nhau xác nhận hết ngập' },
      { 'Trạng thái / Tiêu chí': 'Tuyến đường hay ngập (prone)', 'Số lượng': summary.floodProne, 'Mô tả': 'floodEventCount >= 3 trong vòng 1 năm' },
      { 'Trạng thái / Tiêu chí': 'Tổng số điểm ngập demo', 'Số lượng': summary.total, 'Mô tả': 'Phân bố ở các phường: Long Bình, Trảng Dài, Hố Nai...' },
      { 'Trạng thái / Tiêu chí': 'Báo cáo mô phỏng (reports)', 'Số lượng': summary.reportsCreated, 'Mô tả': 'is_demo = 1' },
      { 'Trạng thái / Tiêu chí': 'Lượt xác nhận (confirmations)', 'Số lượng': summary.confirmationsCreated, 'Mô tả': 'is_demo = 1' },
    ]);
    console.log('⏱️ Thời gian cập nhật: Tương đối (10 - 90 phút trước thời điểm hiện tại). Job hết hạn tự động (6h) sẽ không đóng điểm ngay.');
    return 0;
  } catch (err) {
    if (err.code === 'DATA_MODE_REAL_REJECTED') {
      console.error(`⚠️ ${err.message}`);
      return 1;
    }
    if (err.code === 'DB_NOT_INITIALIZED') {
      console.error('❌ DB chưa được khởi tạo. Chạy npm run migrate trước.');
      return 1;
    }
    console.error('❌ Lỗi khi chạy demo:reset:', err.message);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('demo-reset.js')) {
  const code = handleDemoResetCli();
  process.exit(code);
}
