import { ENV } from '../config/env.js';

/**
 * Phân tích hình ảnh báo cáo ngập theo hợp đồng dữ liệu chuẩn với NV3.
 *
 * HỢP ĐỒNG DỮ LIỆU ĐẦU RA (Contract a):
 * {
 *   isFlood: boolean | null,
 *   confidence: number (0..1),
 *   severity: "low" | "medium" | "high",
 *   estimatedDepthCm: number | null,
 *   description: string,
 *   reason: string,
 *   error: string | null
 * }
 *
 * @param {Buffer} imageBuffer Dữ liệu nhị phân của ảnh
 * @param {object} [context] Thông tin ngữ cảnh bổ sung
 * @param {string} [context.filename]
 * @param {string} [context.note]
 * @param {string} [context.simulate] Cờ ép kết quả test ('noflood', 'error', 'lowconf', 'high')
 * @param {string} [mode] Chế độ chạy: 'mock' | 'local' | 'remote'
 * @returns {Promise<{ isFlood: boolean | null, confidence: number, severity: 'low' | 'medium' | 'high', estimatedDepthCm: number | null, description: string, reason: string, error: string | null }>}
 */
export async function analyzeImage(imageBuffer, context = {}, mode = ENV.AI_MODE) {
  const activeMode = mode || 'mock';

  if (activeMode === 'mock') {
    return runMockAnalyzer(context);
  }

  if (activeMode === 'local') {
    console.warn('⚠️ [AI Analyzer] Chế độ AI local chưa được cài đặt!');
    const err = new Error('Chế độ AI local chưa được cài đặt trên hệ thống');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  if (activeMode === 'remote') {
    console.warn('⚠️ [AI Analyzer] Chế độ AI remote chưa được cài đặt (chờ dịch vụ từ NV3)!');
    const err = new Error('Chế độ AI remote chưa được cài đặt (chờ NV3)');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const err = new Error(`Chế độ AI không hợp lệ: ${activeMode}`);
  err.code = 'AI_NOT_CONFIGURED';
  throw err;
}

/**
 * Mô phỏng phân tích AI (Mock) phục vụ kiểm thử song song trước khi NV3 bàn giao.
 * Có thể điều khiển kết quả thông qua cờ simulate hoặc chuỗi trong filename/note.
 */
function runMockAnalyzer(context = {}) {
  const textHint = `${context.filename || ''} ${context.note || ''} ${context.simulate || ''}`.toLowerCase();

  // Ca 1: Giả lập AI phát hiện KHÔNG NGẬP
  if (textHint.includes('noflood') || textHint.includes('not-flood') || textHint.includes('khong-ngap')) {
    return {
      isFlood: false,
      confidence: 0.95,
      severity: 'low',
      estimatedDepthCm: 0,
      description: 'Mặt đường khô ráo, phương tiện di chuyển bình thường',
      reason: 'Không phát hiện bề mặt ngập nước',
      error: null,
    };
  }

  // Ca 2: Giả lập AI BỊ LỖI / TIMEOUT / TRẢ FORMAT SAI
  if (textHint.includes('aierror') || textHint.includes('error') || textHint.includes('timeout')) {
    return {
      isFlood: null,
      confidence: 0,
      severity: 'low',
      estimatedDepthCm: null,
      description: '',
      reason: 'AI Timeout hoặc phản hồi không đúng cú pháp quy định',
      error: 'AI_TIMEOUT_OR_PARSE_ERROR',
    };
  }

  // Ca 3: Giả lập độ tin cậy AI THẤP (< 0.6)
  if (textHint.includes('lowconf') || textHint.includes('low-confidence')) {
    return {
      isFlood: true,
      confidence: 0.45,
      severity: 'low',
      estimatedDepthCm: 15,
      description: 'Nghi ngờ có vũng nước nhỏ phản chiếu',
      reason: 'Hình ảnh bị mờ hoặc góc chụp không bao quát được mặt đường',
      error: null,
    };
  }

  // Ca 4: Giả lập ngập NẶNG
  if (textHint.includes('high') || textHint.includes('nang')) {
    return {
      isFlood: true,
      confidence: 0.92,
      severity: 'high',
      estimatedDepthCm: 50,
      description: 'Đường ngập sâu, nước ngập lút bánh xe, chết máy hàng loạt',
      reason: 'Mặt nước dâng cao ngập quá nửa thân xe máy',
      error: null,
    };
  }

  // Mặc định: Giả lập ngập VỪA (medium), độ tin cậy 0.88
  return {
    isFlood: true,
    confidence: 0.88,
    severity: 'medium',
    estimatedDepthCm: 25,
    description: 'Đường ngập nước, xe máy lội nước ngang bánh',
    reason: 'Thấy mặt nước phủ mặt đường, phản chiếu',
    error: null,
  };
}

export default { analyzeImage };
