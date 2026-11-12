import RULES from '../config/rules.js';
import { haversineMeters, isValidCoordinate } from './geo.js';

/**
 * Tìm điểm ngập hiện có để gộp báo cáo trùng lặp.
 * HÀM THUẦN (pure function): nhận `now` làm tham số, không gọi Date.now().
 * 
 * Tiêu chí gộp:
 * 1. Trạng thái ứng viên phải là 'pending' hoặc 'active'.
 * 2. Khoảng cách địa lý <= RULES.DUPLICATE_RADIUS_M (50 mét).
 * 3. Thời gian cập nhật gần nhất còn trong RULES.DUPLICATE_WINDOW_HOURS (6 giờ).
 * 4. Nếu có nhiều điểm thỏa mãn, chọn điểm có khoảng cách gần nhất.
 * 
 * @param {{ lat: number, lng: number }} newPoint Tọa độ báo cáo mới
 * @param {Array<object>} candidates Danh sách điểm ngập ứng viên
 * @param {string | Date} now Mốc thời gian hiện tại
 * @returns {object | null} Điểm ngập phù hợp nhất để gộp, hoặc null nếu không có
 */
export function findMergeTarget(newPoint, candidates = [], now) {
  if (now === undefined || now === null) {
    throw new Error('Tham số now là bắt buộc đối với hàm thuần findMergeTarget');
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) {
    throw new Error('Tham số now không phải là mốc thời gian hợp lệ');
  }

  if (!newPoint || !isValidCoordinate(newPoint.lat, newPoint.lng)) {
    return null;
  }

  const eligibleCandidates = [];
  const maxWindowMs = RULES.DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000;

  for (const candidate of candidates) {
    // 1. Chỉ gộp vào điểm đang active hoặc pending
    if (!['pending', 'active'].includes(candidate.status)) {
      continue;
    }

    // 2. Kiểm tra cửa sổ thời gian
    const candidateTimeStr =
      candidate.lastUpdatedAt ||
      candidate.last_updated_at ||
      candidate.firstReportedAt ||
      candidate.first_reported_at;

    if (!candidateTimeStr) continue;

    const candDate = new Date(candidateTimeStr);
    if (Number.isNaN(candDate.getTime())) continue;

    const ageMs = nowDate.getTime() - candDate.getTime();
    // ageMs phải không âm và nằm trong cửa sổ cho phép (<= 6 giờ)
    if (ageMs < 0 || ageMs > maxWindowMs) {
      continue;
    }

    // 3. Kiểm tra khoảng cách
    const candLat = candidate.lat;
    const candLng = candidate.lng;
    if (!isValidCoordinate(candLat, candLng)) continue;

    const distanceM = haversineMeters(newPoint, { lat: candLat, lng: candLng });
    if (distanceM <= RULES.DUPLICATE_RADIUS_M) {
      eligibleCandidates.push({
        candidate,
        distanceM,
        lastUpdatedMs: candDate.getTime(),
      });
    }
  }

  if (eligibleCandidates.length === 0) {
    return null;
  }

  // 4. Chọn ứng viên gần nhất; nếu khoảng cách bằng nhau thì ưu tiên điểm mới cập nhật hơn
  eligibleCandidates.sort((a, b) => {
    if (Math.abs(a.distanceM - b.distanceM) > 0.001) {
      return a.distanceM - b.distanceM;
    }
    return b.lastUpdatedMs - a.lastUpdatedMs;
  });

  return eligibleCandidates[0].candidate;
}

export default { findMergeTarget };
