import RULES from '../config/rules.js';
import { getDb } from '../db/connection.js';
import floodPointRepo from '../repositories/floodPointRepo.js';
import eventRepo from '../repositories/eventRepo.js';
import { shouldExpire } from '../domain/lifecycle.js';
import { computeFloodProne } from '../domain/floodProne.js';

/**
 * Quét và tự động chuyển các điểm ngập không còn hoạt động sang trạng thái 'expired'.
 *
 * QUY TẮC NGHIỆP VỤ (Prompt 4):
 * - Điểm ngập đang 'active' hoặc 'pending'.
 * - Quá EXPIRE_AFTER_HOURS (6 giờ) không có báo cáo hoặc xác nhận mới kể từ mốc hoạt động gần nhất.
 * - Khi hết hạn:
 *   + Đóng flood_event đang mở với lý do 'expired'.
 *   + Tăng floodEventCount lên 1 (hoàn tất 1 chu kỳ sự kiện).
 *   + Đánh giá lại cờ isFloodProne.
 *
 * Hàm được tách riêng để phục vụ kiểm thử đơn vị và tích hợp với mốc `now` giả lập.
 *
 * @param {string | Date} [now=new Date()]
 * @returns {{ expiredCount: number, expiredPointIds: string[] }}
 */
export function runExpireOnce(now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const candidates = floodPointRepo.list({ status: ['active', 'pending'] });

  const expiredPointIds = [];
  const db = getDb();

  for (const point of candidates) {
    if (shouldExpire(point, nowDate)) {
      db.transaction(() => {
        // Đóng sự kiện ngập mở nếu có
        const openEvent = eventRepo.findOpenEvent(point.id);
        if (openEvent) {
          eventRepo.closeEvent(openEvent.id, nowDate.toISOString(), 'expired');
        }

        const newFloodEventCount = (point.floodEventCount || 0) + 1;
        const allEvents = eventRepo.listByFloodPointId(point.id);
        const proneRes = computeFloodProne(allEvents, nowDate, {
          historicalEventCount: point.historicalEventCount || 0,
        });

        floodPointRepo.update(point.id, {
          status: 'expired',
          floodEventCount: newFloodEventCount,
          isFloodProne: proneRes.isFloodProne,
          lastUpdatedAt: nowDate.toISOString(),
        });

        expiredPointIds.push(point.id);
      })();
    }
  }

  return {
    expiredCount: expiredPointIds.length,
    expiredPointIds,
  };
}

export default { runExpireOnce };
