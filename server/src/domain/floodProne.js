import RULES from '../config/rules.js';

/**
 * Chuẩn hóa chuỗi văn bản tiếng Việt: bỏ dấu, viết thường, loại bỏ khoảng trắng thừa.
 * 
 * @param {string} str
 * @returns {string}
 */
export function normalizeVietnamese(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Tạo khóa gom cụm (cluster key) cho điểm ngập:
 * - Nếu có tên đường (street): chuẩn hóa tên đường (bỏ dấu, lowercase) → `street:<tên_chuẩn_hóa>`
 * - Nếu không có tên đường: chia lưới tọa độ ~100m (~0.001 độ) → `grid:<lat_grid>,<lng_grid>`
 * 
 * @param {object} point Điểm ngập
 * @returns {string}
 */
export function clusterKey(point) {
  if (!point) return 'grid:0.000,0.000';

  const rawStreet = point.street || point.street_name;
  if (rawStreet && typeof rawStreet === 'string' && rawStreet.trim().length > 0) {
    const cleanStreet = normalizeVietnamese(rawStreet);
    return `street:${cleanStreet}`;
  }

  // Lưới ~100m (~0.001 độ vĩ/kinh)
  const lat = typeof point.lat === 'number' ? point.lat : 0;
  const lng = typeof point.lng === 'number' ? point.lng : 0;
  const latKey = (Math.round(lat * 1000) / 1000).toFixed(3);
  const lngKey = (Math.round(lng * 1000) / 1000).toFixed(3);

  return `grid:${latKey},${lngKey}`;
}

/**
 * Đánh giá một điểm/tuyến đường có thuộc diện "hay ngập" (flood-prone) hay không.
 * 
 * QUY TẮC BẮT BUỘC (theo AGENTS.md và Prompt 2):
 * - "Số lần ngập" = số SỰ KIỆN ngập (mỗi sự kiện là một vòng đời active -> resolved/expired).
 * - Một đợt ngập có 20 lượt báo cáo chỉ tạo ra ĐÚNG 1 sự kiện ngập, do đó chỉ tính là 1 lần ngập.
 * - Tiêu chuẩn hay ngập: tổng số sự kiện trong RULES.FLOOD_PRONE_WINDOW_DAYS (365 ngày)
 *   cộng với historicalEventCount >= RULES.FLOOD_PRONE_MIN_EVENTS (3 sự kiện).
 * 
 * HÀM THUẦN (pure function): nhận `now` làm tham số, không gọi Date.now().
 * 
 * @param {Array<object>} events Danh sách các sự kiện ngập (flood_events)
 * @param {string | Date} now Mốc thời gian hiện tại
 * @param {object} [options]
 * @param {number} [options.historicalEventCount=0] Số sự kiện lịch sử ghi nhận thêm
 * @returns {{ isFloodProne: boolean, eventCountInWindow: number }}
 */
export function computeFloodProne(events = [], now, { historicalEventCount = 0 } = {}) {
  if (now === undefined || now === null) {
    throw new Error('Tham số now là bắt buộc đối với hàm thuần computeFloodProne');
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) {
    throw new Error('Tham số now không phải là mốc thời gian hợp lệ');
  }

  const windowMs = RULES.FLOOD_PRONE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let validEventsInWindow = 0;

  for (const event of events) {
    // Sự kiện ngập phải có mốc bắt đầu
    const startedStr = event.startedAt || event.started_at || event.firstReportedAt;
    if (!startedStr) continue;

    const startedDate = new Date(startedStr);
    if (Number.isNaN(startedDate.getTime())) continue;

    const ageMs = nowDate.getTime() - startedDate.getTime();
    // ageMs phải không âm và nằm trong cửa sổ 365 ngày
    if (ageMs >= 0 && ageMs <= windowMs) {
      validEventsInWindow += 1;
    }
  }

  const totalEvents = validEventsInWindow + (Math.max(0, historicalEventCount) || 0);
  const isFloodProne = totalEvents >= RULES.FLOOD_PRONE_MIN_EVENTS;

  return {
    isFloodProne,
    eventCountInWindow: totalEvents,
  };
}

export default {
  clusterKey,
  computeFloodProne,
  normalizeVietnamese,
};
