import { ENV } from '../config/env.js';
import RULES from '../config/rules.js';
import { mapNv3Response } from '../domain/aiContract.js';

/**
 * Gửi yêu cầu phân tích ảnh tới máy chủ AI từ xa của NV3.
 *
 * QUY TẮC BẢO MẬT & HIỆU NĂNG:
 * - Chỉ gửi trường `image` dạng JPEG buffer đã nén, không gửi GPS hay deviceId.
 * - Header `X-API-Key` nếu có cấu hình; không bao giờ log khóa API ra console/log.
 * - Timeout cấu hình qua AI_TIMEOUT_MS (mặc định 20000ms).
 * - Retry 1 lần DUY NHẤT khi gặp lỗi mạng, timeout hoặc HTTP 5xx.
 * - Không retry khi gặp lỗi client 4xx (kể cả 429).
 * - Mọi lỗi đều trả về { isFlood: null, error } để báo cáo chuyển về trạng thái pending.
 *
 * @param {Buffer} imageBuffer Buffer ảnh JPEG đã qua xử lý của Sharp
 * @param {object} [options]
 * @param {string} [options.aiAnalyzeUrl]
 * @param {string} [options.aiApiKey]
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<ReturnType<typeof mapNv3Response>>}
 */
async function callRemoteNv3(imageBuffer, options = {}) {
  const url = options.aiAnalyzeUrl || ENV.AI_ANALYZE_URL;
  if (!url) {
    console.warn('⚠️ [AI Analyzer] Chế độ AI remote chưa được cài đặt (thiếu AI_ANALYZE_URL)!');
    const err = new Error('Chế độ AI remote chưa được cài đặt (thiếu AI_ANALYZE_URL)');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  // Chống SSRF: kiểm tra URL hợp lệ và chỉ chấp nhận http/https
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    const err = new Error('AI_ANALYZE_URL không phải là URL hợp lệ');
    err.code = 'INVALID_AI_URL';
    throw err;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    const err = new Error('AI_ANALYZE_URL chỉ chấp nhận giao thức http: hoặc https:');
    err.code = 'INVALID_AI_URL_PROTOCOL';
    throw err;
  }

  const apiKey = options.aiApiKey !== undefined ? options.aiApiKey : ENV.AI_API_KEY;
  const timeoutMs = options.timeoutMs || ENV.AI_TIMEOUT_MS || RULES.AI_TIMEOUT_MS || 20000;
  const fetchFn = options.fetchImpl || globalThis.fetch;

  const performFetch = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
      formData.append('image', blob, 'report_image.jpg');

      const headers = {};
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const res = await fetchFn(url, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  let response = null;
  let lastError = null;

  // Lần thử 1
  try {
    response = await performFetch();
  } catch (err) {
    lastError = err;
  }

  // Quyết định Retry: chỉ retry 1 lần khi lỗi mạng/timeout hoặc response trả 5xx
  const is5xx = response && response.status >= 500 && response.status < 600;
  const shouldRetry = (!response && lastError) || is5xx;

  if (shouldRetry) {
    const retryReason = lastError ? (lastError.name === 'AbortError' ? 'Timeout' : 'Lỗi mạng') : `HTTP ${response.status}`;
    console.warn(`⚠️ [AI Analyzer] Gọi NV3 thất bại (${retryReason}). Đang thử lại lần 2...`);

    try {
      response = await performFetch();
      lastError = null;
    } catch (retryErr) {
      lastError = retryErr;
      response = null;
    }
  }

  // Nếu gặp lỗi mạng / timeout sau khi đã thử lại
  if (!response && lastError) {
    const isTimeout = lastError.name === 'AbortError' || lastError.message?.toLowerCase().includes('timeout');
    const errorCode = isTimeout ? 'AI_TIMEOUT' : 'AI_NETWORK_ERROR';
    console.warn(`⚠️ [AI Analyzer] Thất bại khi kết nối tới NV3: ${lastError.message}`);
    return {
      isFlood: null,
      confidence: 0,
      severity: 'low',
      estimatedDepthCm: null,
      description: '',
      reason: isTimeout ? 'Quá thời gian phản hồi từ dịch vụ AI NV3' : 'Không thể kết nối đến máy chủ AI NV3',
      error: errorCode,
      flags: [errorCode],
      rawTruncated: null,
    };
  }

  // Xử lý mã lỗi HTTP 4xx (không retry) hoặc 5xx (khi retry vẫn thất bại)
  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // Không parse được JSON lỗi thì bỏ qua
    }

    console.warn(`⚠️ [AI Analyzer] Máy chủ NV3 trả về mã lỗi HTTP ${response.status}: ${errorDetail}`);
    return {
      isFlood: null,
      confidence: 0,
      severity: 'low',
      estimatedDepthCm: null,
      description: '',
      reason: `Máy chủ AI trả về lỗi HTTP ${response.status}`,
      error: `AI_HTTP_${response.status}`,
      flags: [`AI_HTTP_${response.status}`],
      rawTruncated: null,
    };
  }

  // Giới hạn kích thước phản hồi từ NV3 chống DoS / tràn bộ nhớ
  const maxBytes = RULES.AI_MAX_RESPONSE_BYTES || (1024 * 1024);
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    console.warn(`⚠️ [AI Analyzer] Phản hồi từ NV3 vượt quá dung lượng cho phép (${contentLength} bytes)`);
    return {
      isFlood: null,
      confidence: 0,
      severity: 'low',
      estimatedDepthCm: null,
      description: '',
      reason: 'Phản hồi từ AI vượt quá kích thước cho phép',
      error: 'AI_RESPONSE_TOO_LARGE',
      flags: ['AI_RESPONSE_TOO_LARGE'],
      rawTruncated: null,
    };
  }

  // Đọc nội dung phản hồi dạng text để kiểm tra kích thước thực tế
  let rawText = '';
  try {
    rawText = await response.text();
    if (rawText.length > maxBytes) {
      console.warn('⚠️ [AI Analyzer] Kích thước nội dung phản hồi từ NV3 vượt quá giới hạn');
      return {
        isFlood: null,
        confidence: 0,
        severity: 'low',
        estimatedDepthCm: null,
        description: '',
        reason: 'Phản hồi từ AI vượt quá kích thước cho phép',
        error: 'AI_RESPONSE_TOO_LARGE',
        flags: ['AI_RESPONSE_TOO_LARGE'],
        rawTruncated: null,
      };
    }
  } catch (readErr) {
    console.warn(`⚠️ [AI Analyzer] Không thể đọc phản hồi từ NV3: ${readErr.message}`);
    return {
      isFlood: null,
      confidence: 0,
      severity: 'low',
      estimatedDepthCm: null,
      description: '',
      reason: 'Lỗi khi đọc phản hồi từ máy chủ AI',
      error: 'AI_READ_ERROR',
      flags: ['AI_READ_ERROR'],
      rawTruncated: null,
    };
  }

  // Phân tích kết quả JSON
  try {
    const rawJson = JSON.parse(rawText);
    return mapNv3Response(rawJson);
  } catch (jsonErr) {
    console.warn(`⚠️ [AI Analyzer] Phản hồi từ NV3 không phải JSON hợp lệ: ${jsonErr.message}`);
    return {
      isFlood: null,
      confidence: 0,
      severity: 'low',
      estimatedDepthCm: null,
      description: '',
      reason: 'Phản hồi từ AI không đúng cú pháp JSON',
      error: 'AI_INVALID_JSON',
      flags: ['AI_INVALID_JSON'],
      rawTruncated: null,
    };
  }
}

/**
 * Phân tích hình ảnh báo cáo ngập theo hợp đồng dữ liệu chuẩn với NV3.
 *
 * @param {Buffer} imageBuffer Dữ liệu nhị phân của ảnh
 * @param {object} [context] Thông tin ngữ cảnh bổ sung
 * @param {string} [context.filename]
 * @param {string} [context.note]
 * @param {string} [context.simulate] Cờ ép kết quả test ('noflood', 'error', 'lowconf', 'high')
 * @param {string} [context.aiAnalyzeUrl]
 * @param {string} [context.aiApiKey]
 * @param {number} [context.timeoutMs]
 * @param {typeof fetch} [context.fetchImpl]
 * @param {string} [mode] Chế độ chạy: 'mock' | 'local' | 'remote'
 * @returns {Promise<{
 *   isFlood: boolean | null,
 *   confidence: number,
 *   severity: 'low' | 'medium' | 'high',
 *   estimatedDepthCm: number | null,
 *   description: string,
 *   reason: string,
 *   error: string | null,
 *   flags?: string[],
 *   rawTruncated?: object | null
 * }>}
 */
export async function analyzeImage(imageBuffer, context = {}, mode = (context?.aiMode || ENV.AI_MODE)) {
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
    return callRemoteNv3(imageBuffer, context);
  }

  const err = new Error(`Chế độ AI không hợp lệ: ${activeMode}`);
  err.code = 'AI_NOT_CONFIGURED';
  throw err;
}

/**
 * Mô phỏng phân tích AI (Mock) phục vụ kiểm thử song song trước khi NV3 bàn giao.
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
      flags: [],
      rawTruncated: null,
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
      flags: ['AI_TIMEOUT_OR_PARSE_ERROR'],
      rawTruncated: null,
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
      flags: [],
      rawTruncated: null,
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
      flags: [],
      rawTruncated: null,
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
    flags: [],
    rawTruncated: null,
  };
}

export default { analyzeImage };
