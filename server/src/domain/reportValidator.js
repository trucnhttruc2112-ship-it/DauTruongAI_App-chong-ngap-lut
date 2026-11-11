import RULES from '../config/rules.js';
import { isInsideDongNai, isValidCoordinate } from './geo.js';

/**
 * Kiểm tra tính hợp lệ về ngữ cảnh không gian và thời gian của một báo cáo ngập.
 * HÀM THUẦN (pure function): bắt buộc nhận `now` làm tham số, không gọi Date.now().
 *
 * @param {object} context
 * @param {number} context.lat Vĩ độ người gửi
 * @param {number} context.lng Kinh độ người gửi
 * @param {number} context.accuracyM Sai số GPS (mét)
 * @param {string | Date} context.capturedAt Thời điểm chụp ảnh
 * @param {string | Date} context.now Mốc thời gian hiện tại của hệ thống
 * @param {'camera' | 'gallery' | 'manual-pin'} [context.source='camera'] Nguồn ảnh/tọa độ
 * @returns {{ ok: boolean, errors: Array<{ code: string, message: string }>, flags: string[] }}
 */
export function validateReportContext({
  lat,
  lng,
  accuracyM,
  capturedAt,
  now,
  source = 'camera',
}) {
  if (now === undefined || now === null) {
    throw new Error('Tham số now là bắt buộc đối với hàm thuần validateReportContext');
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) {
    throw new Error('Tham số now không phải là mốc thời gian hợp lệ');
  }

  const errors = [];
  const flags = [];

  // 1. Kiểm tra tọa độ GPS
  if (!isValidCoordinate(lat, lng)) {
    errors.push({
      code: 'INVALID_COORDINATES',
      message: 'Tọa độ GPS không hợp lệ',
    });
  } else if (!isInsideDongNai(lat, lng)) {
    errors.push({
      code: 'OUT_OF_AREA',
      message: 'Vị trí báo cáo nằm ngoài phạm vi địa lý thành phố Đồng Nai',
    });
  }

  // 2. Kiểm tra độ chính xác GPS (sai số mét)
  if (
    typeof accuracyM !== 'number' ||
    Number.isNaN(accuracyM) ||
    accuracyM < 0 ||
    accuracyM > RULES.GPS_MAX_ACCURACY_M
  ) {
    errors.push({
      code: 'GPS_TOO_INACCURATE',
      message: `Độ chính xác GPS quá thấp (${accuracyM}m > ${RULES.GPS_MAX_ACCURACY_M}m cho phép)`,
    });
  } else if (accuracyM > RULES.GPS_WARNING_ACCURACY_M) {
    // Cảnh báo GPS sai số hơi cao (50m < accuracy <= 100m)
    flags.push('LOW_GPS_ACCURACY');
  }

  // 3. Kiểm tra thời điểm chụp ảnh
  if (!capturedAt) {
    errors.push({
      code: 'INVALID_CAPTURED_AT',
      message: 'Thiếu thông tin thời điểm chụp ảnh',
    });
  } else {
    const capturedDate = capturedAt instanceof Date ? capturedAt : new Date(capturedAt);
    if (Number.isNaN(capturedDate.getTime())) {
      errors.push({
        code: 'INVALID_CAPTURED_AT',
        message: 'Thời điểm chụp ảnh không phải là định dạng thời gian hợp lệ',
      });
    } else {
      const diffMs = nowDate.getTime() - capturedDate.getTime();
      const futureToleranceMs = RULES.REPORT_FUTURE_TOLERANCE_MINUTES * 60 * 1000;
      const maxAgeMs = RULES.REPORT_MAX_AGE_MINUTES * 60 * 1000;

      // Không cho phép chụp ở tương lai (cho phép lệch đồng hồ tối đa 1 phút)
      if (diffMs < -futureToleranceMs) {
        errors.push({
          code: 'REPORT_IN_FUTURE',
          message: 'Thời điểm chụp ảnh nằm ở tương lai (vượt quá 1 phút sai số đồng hồ)',
        });
      }

      // Không cho phép ảnh chụp quá cũ (vượt quá 5 phút)
      if (diffMs > maxAgeMs) {
        errors.push({
          code: 'REPORT_TOO_OLD',
          message: `Ảnh chụp đã quá cũ (vượt quá ${RULES.REPORT_MAX_AGE_MINUTES} phút)`,
        });
      }
    }
  }

  // 4. Kiểm tra nguồn ảnh (gắn cờ cảnh báo, không từ chối)
  if (source === 'gallery' || source === 'manual-pin') {
    flags.push('LOW_TRUST_SOURCE');
  }

  return {
    ok: errors.length === 0,
    errors,
    flags,
  };
}

export default { validateReportContext };
