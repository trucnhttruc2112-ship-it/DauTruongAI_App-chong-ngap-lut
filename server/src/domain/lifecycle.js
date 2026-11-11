import RULES from '../config/rules.js';

/**
 * Quyết định trạng thái ban đầu của điểm ngập dựa trên kết quả phân tích AI.
 * 
 * - 'rejected': AI khẳng định không ngập (isFlood === false).
 * - 'pending': AI lỗi (isFlood === null/undefined) hoặc độ tin cậy < 0.6.
 * - 'active': AI xác nhận ngập (isFlood === true) và độ tin cậy >= 0.6.
 * 
 * @param {object | null} aiResult Kết quả trả về từ NV3/aiAnalyzer
 * @returns {'active' | 'pending' | 'rejected'}
 */
export function decideInitialStatus(aiResult) {
  if (!aiResult || aiResult.isFlood === false) {
    return 'rejected';
  }

  if (aiResult.isFlood === null || aiResult.isFlood === undefined) {
    return 'pending';
  }

  const confidence = typeof aiResult.confidence === 'number' ? aiResult.confidence : 0;
  if (confidence < RULES.AI_MIN_CONFIDENCE_ACTIVE) {
    return 'pending';
  }

  return 'active';
}

/**
 * Xử lý xác nhận mới từ người dùng ('still' hoặc 'ended') và cập nhật trạng thái điểm ngập.
 * HÀM THUẦN (pure function): nhận `now` làm tham số, không gọi Date.now().
 * 
 * Luật nghiệp vụ quan trọng:
 * - 1 thiết bị chỉ được tính 1 lần cho mỗi loại xác nhận (1 thiết bị báo 'ended' 2 lần chỉ tính 1).
 * - Cần đủ RULES.ENDED_CONFIRMATIONS_TO_RESOLVE (2) thiết bị KHÁC NHAU báo 'ended' để chuyển sang 'resolved'.
 * - Xác nhận 'still' sẽ làm mới mốc last_confirmed_at thành `now`.
 * 
 * @param {object} point Điểm ngập hiện tại
 * @param {Array<object>} existingConfirmations Danh sách các xác nhận đã có
 * @param {object} newConfirmation Xác nhận mới gửi lên { deviceId, type }
 * @param {string | Date} now Mốc thời gian hiện tại
 * @returns {{ status: string, confirmStill: number, confirmEnded: number, resolved: boolean, lastConfirmedAt: string | null }}
 */
export function applyConfirmation(point, existingConfirmations = [], newConfirmation, now) {
  if (now === undefined || now === null) {
    throw new Error('Tham số now là bắt buộc đối với hàm thuần applyConfirmation');
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) {
    throw new Error('Tham số now không phải là mốc thời gian hợp lệ');
  }

  // Tập hợp các thiết bị đã xác nhận 'still' và 'ended' (chống trùng lặp theo deviceId)
  const stillDevices = new Set();
  const endedDevices = new Set();

  for (const c of existingConfirmations) {
    const devId = c.deviceId || c.device_id;
    if (!devId) continue;
    if (c.type === 'still') stillDevices.add(devId);
    if (c.type === 'ended') endedDevices.add(devId);
  }

  // Thêm xác nhận mới vào tập hợp
  const newDevId = newConfirmation?.deviceId || newConfirmation?.device_id;
  if (newDevId && newConfirmation?.type === 'still') {
    stillDevices.add(newDevId);
  } else if (newDevId && newConfirmation?.type === 'ended') {
    endedDevices.add(newDevId);
  }

  const confirmStillCount = stillDevices.size;
  const confirmEndedCount = endedDevices.size;

  let nextStatus = point.status;
  let isResolved = false;

  // Nếu đủ số thiết bị khác nhau báo 'ended' -> chuyển sang 'resolved'
  if (confirmEndedCount >= RULES.ENDED_CONFIRMATIONS_TO_RESOLVE) {
    nextStatus = 'resolved';
    isResolved = true;
  }

  // Cập nhật mốc thời gian xác nhận gần nhất
  let lastConfirmedAt = point.lastConfirmedAt || point.last_confirmed_at || null;
  if (newConfirmation?.type === 'still') {
    lastConfirmedAt = nowDate.toISOString();
  }

  return {
    status: nextStatus,
    confirmStill: confirmStillCount,
    confirmEnded: confirmEndedCount,
    resolved: isResolved,
    lastConfirmedAt,
  };
}

/**
 * Kiểm tra điểm ngập có nên tự động hết hạn (chuyển sang 'expired') hay không.
 * HÀM THUẦN (pure function): nhận `now` làm tham số, không gọi Date.now().
 * 
 * Tiêu chí:
 * - Điểm đang ở trạng thái 'active' hoặc 'pending'.
 * - Thời gian không hoạt động kể từ mốc gần nhất (lastConfirmedAt || lastUpdatedAt || firstReportedAt)
 *   vượt quá RULES.EXPIRE_AFTER_HOURS (6 giờ).
 * 
 * @param {object} point
 * @param {string | Date} now
 * @returns {boolean}
 */
export function shouldExpire(point, now) {
  if (now === undefined || now === null) {
    throw new Error('Tham số now là bắt buộc đối với hàm thuần shouldExpire');
  }

  if (!point || !['active', 'pending'].includes(point.status)) {
    return false;
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) {
    throw new Error('Tham số now không phải là mốc thời gian hợp lệ');
  }

  const lastActivityStr =
    point.lastConfirmedAt ||
    point.last_confirmed_at ||
    point.lastUpdatedAt ||
    point.last_updated_at ||
    point.firstReportedAt ||
    point.first_reported_at;

  if (!lastActivityStr) return false;

  const lastActivityDate = new Date(lastActivityStr);
  if (Number.isNaN(lastActivityDate.getTime())) return false;

  const ageMs = nowDate.getTime() - lastActivityDate.getTime();
  const maxExpireMs = RULES.EXPIRE_AFTER_HOURS * 60 * 60 * 1000;

  // Lớn hơn đúng 6 giờ thì hết hạn
  return ageMs > maxExpireMs;
}

/**
 * Nâng trạng thái từ 'pending' lên 'active' khi có đủ số thiết bị khác nhau báo cùng điểm ngập.
 * 
 * @param {object} point
 * @param {Array<object>} reports Danh sách các báo cáo gửi tới điểm này
 * @returns {'active' | 'pending'}
 */
export function promotePendingToActive(point, reports = []) {
  if (!point || point.status !== 'pending') {
    return point?.status || 'pending';
  }

  const distinctDevices = new Set();
  for (const r of reports) {
    const devId = r.deviceId || r.device_id;
    if (devId) distinctDevices.add(devId);
  }

  if (distinctDevices.size >= RULES.PENDING_REPORTS_TO_PROMOTE) {
    return 'active';
  }

  return 'pending';
}

export default {
  decideInitialStatus,
  applyConfirmation,
  shouldExpire,
  promotePendingToActive,
};
