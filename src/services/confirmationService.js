import crypto from 'crypto';
import RULES from '../config/rules.js';
import { getDb } from '../db/connection.js';
import floodPointRepo from '../repositories/floodPointRepo.js';
import confirmationRepo from '../repositories/confirmationRepo.js';
import eventRepo from '../repositories/eventRepo.js';
import { haversineMeters, isValidCoordinate } from '../domain/geo.js';
import { applyConfirmation } from '../domain/lifecycle.js';
import { computeFloodProne } from '../domain/floodProne.js';
import { computeTrustScore } from '../domain/trustScore.js';
import { formatContractB } from './floodPointQueryService.js';

export class ConfirmationService {
  /**
   * Xử lý gửi xác nhận 'still' (vẫn ngập) hoặc 'ended' (hết ngập) cho 1 điểm ngập.
   *
   * Quy tắc nghiệp vụ (Prompt 4):
   * 1. Điểm ngập phải tồn tại và đang ở trạng thái 'active' hoặc 'pending'.
   * 2. Người xác nhận phải ở trong bán kính CONFIRM_MAX_DISTANCE_M (300 mét).
   * 3. Mỗi deviceId chỉ được xác nhận 1 lần cho mỗi loại (still/ended) trên 1 điểm ngập (409 nếu trùng).
   * 4. Giao dịch CSDL an toàn (Transaction) để xử lý đồng thời không làm sai lệch bộ đếm.
   * 5. Khi đủ 2 thiết bị khác nhau báo 'ended', điểm ngập chuyển sang 'resolved':
   *    - Đóng flood_event với lý do 'confirmed_ended'.
   *    - Tăng floodEventCount lên 1.
   *    - Tính lại cờ isFloodProne.
   */
  async confirmPoint({ floodPointId, deviceId, type, lat, lng, now = new Date() }) {
    const nowDate = now instanceof Date ? now : new Date(now);

    // 1. Kiểm tra điểm ngập tồn tại
    const point = floodPointRepo.findById(floodPointId);
    if (!point) {
      const err = new Error('Không tìm thấy điểm ngập với mã định danh đã cung cấp');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    // 2. Điểm ngập phải đang active hoặc pending
    if (!['active', 'pending'].includes(point.status)) {
      const err = new Error(`Điểm ngập đang ở trạng thái '${point.status}', không thể gửi xác nhận`);
      err.code = 'POINT_NOT_ACTIVE';
      err.status = 422;
      throw err;
    }

    // 3. Kiểm tra tọa độ và khoảng cách của người gửi xác nhận
    if (!isValidCoordinate(lat, lng)) {
      const err = new Error('Tọa độ người xác nhận không hợp lệ');
      err.code = 'INVALID_COORDINATES';
      err.status = 400;
      throw err;
    }

    const distM = haversineMeters({ lat, lng }, { lat: point.lat, lng: point.lng });
    if (distM > RULES.CONFIRM_MAX_DISTANCE_M) {
      const err = new Error(
        `Vị trí của bạn quá xa điểm ngập (${Math.round(distM)}m > ${RULES.CONFIRM_MAX_DISTANCE_M}m cho phép). Vui lòng đến gần hiện trường hơn để xác nhận.`
      );
      err.code = 'CONFIRM_TOO_FAR';
      err.status = 422;
      throw err;
    }

    // 4. Kiểm tra trùng lặp xác nhận theo (pointId, deviceId, type)
    const existing = confirmationRepo.findByPointAndDevice(floodPointId, deviceId, type);
    if (existing) {
      const err = new Error('Thiết bị của bạn đã gửi xác nhận loại này cho điểm ngập trước đó');
      err.code = 'DUPLICATE_CONFIRMATION';
      err.status = 409;
      throw err;
    }

    // 5. Giao dịch CSDL xử lý đồng thời an toàn
    const db = getDb();
    let updatedPoint = null;
    let isResolved = false;

    const executeTransaction = db.transaction(() => {
      // Lưu bản ghi xác nhận mới
      confirmationRepo.insert({
        id: `conf_${crypto.randomUUID()}`,
        floodPointId,
        deviceId,
        type,
        lat,
        lng,
        createdAt: nowDate.toISOString(),
        isDemo: 0,
      });

      // Lấy toàn bộ danh sách xác nhận hiện có để tính toán chuyển trạng thái
      const allConfirmations = confirmationRepo.listByFloodPointId(floodPointId);
      const lifecycleRes = applyConfirmation(point, allConfirmations, { deviceId, type }, nowDate);

      isResolved = lifecycleRes.resolved;

      // Tính lại độ tin cậy trustScore
      const updatedTrustScore = computeTrustScore({
        aiConfidence: 0.8,
        gpsAccuracyM: 20,
        source: 'camera',
        confirmStill: lifecycleRes.confirmStill,
        confirmEnded: lifecycleRes.confirmEnded,
        reportCount: point.reportCount || 1,
      });

      const newConfirmStill = type === 'still' ? (point.confirmStill || 0) + 1 : (point.confirmStill || 0);
      const newConfirmEnded = Math.max(point.confirmEnded || 0, lifecycleRes.confirmEnded);

      if (isResolved) {
        // Đủ 2 thiết bị khác nhau báo 'ended' -> Chuyển sang resolved
        const openEvent = eventRepo.findOpenEvent(floodPointId);
        if (openEvent) {
          eventRepo.closeEvent(openEvent.id, nowDate.toISOString(), 'confirmed_ended');
        }

        const newFloodEventCount = (point.floodEventCount || 0) + 1;
        const allEvents = eventRepo.listByFloodPointId(floodPointId);
        const proneRes = computeFloodProne(allEvents, nowDate, {
          historicalEventCount: point.historicalEventCount || 0,
        });

        floodPointRepo.update(floodPointId, {
          status: 'resolved',
          confirmStill: newConfirmStill,
          confirmEnded: newConfirmEnded,
          lastConfirmedAt: lifecycleRes.lastConfirmedAt || point.lastConfirmedAt,
          lastUpdatedAt: nowDate.toISOString(),
          floodEventCount: newFloodEventCount,
          isFloodProne: proneRes.isFloodProne,
          trustScore: updatedTrustScore,
        });
      } else {
        // Chưa đủ điều kiện resolved -> Cập nhật số đếm và mốc thời gian
        floodPointRepo.update(floodPointId, {
          confirmStill: newConfirmStill,
          confirmEnded: newConfirmEnded,
          lastConfirmedAt: lifecycleRes.lastConfirmedAt || point.lastConfirmedAt,
          lastUpdatedAt: nowDate.toISOString(),
          trustScore: updatedTrustScore,
        });
      }

      updatedPoint = floodPointRepo.findById(floodPointId);
    });

    executeTransaction();

    const message = isResolved
      ? 'Điểm ngập đã được xác nhận hết ngập từ nhiều người dân và chuyển sang trạng thái đã xử lý.'
      : type === 'still'
        ? 'Cảm ơn bạn! Đã ghi nhận điểm ngập vẫn còn ngập.'
        : 'Cảm ơn bạn! Đã ghi nhận báo cáo hết ngập của bạn.';

    return {
      ok: true,
      data: {
        floodPoint: formatContractB(updatedPoint),
        resolved: isResolved,
        message,
      },
    };
  }
}

export const confirmationService = new ConfirmationService();
export default confirmationService;
