import { z } from 'zod';
import RULES from '../config/rules.js';

// Schema xác thực dữ liệu đầu ra từ dịch vụ AI NV3
const Nv3ResponseSchema = z.object({
  isFlooded: z.boolean().nullable().optional(),
  status: z.enum(['flooded', 'not_flooded', 'uncertain']),
  severity: z.enum(['none', 'low', 'medium', 'high', 'unknown']),
  evidence: z.array(z.string()).optional().nullable(),
  summary: z.string().optional().nullable(),
  needsVerification: z.boolean().optional().nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
});

/**
 * Làm sạch chuỗi ký tự điều khiển (ASCII control characters)
 * @param {string} text
 * @returns {string}
 */
function cleanControlChars(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Cắt gọn đối tượng phản hồi gốc để lưu trữ an toàn vào ai_json
 * @param {object} raw
 * @returns {object}
 */
export function truncateRawResponse(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const copy = { ...raw };
  if (typeof copy.summary === 'string') {
    copy.summary = cleanControlChars(copy.summary).slice(0, 500);
  }
  if (Array.isArray(copy.evidence)) {
    copy.evidence = copy.evidence.slice(0, 10).map((e) => cleanControlChars(String(e)).slice(0, 200));
  }
  return copy;
}

/**
 * Ánh xạ dữ liệu phản hồi từ máy chủ AI của NV3 sang hợp đồng dữ liệu nội bộ NV4 (Contract a).
 * HÀM THUẦN (pure function): không phụ thuộc môi trường ngoài, có thể test độc lập.
 *
 * @param {unknown} raw Dữ liệu thô nhận từ NV3
 * @returns {{
 *   isFlood: boolean | null,
 *   confidence: number,
 *   severity: 'low' | 'medium' | 'high',
 *   estimatedDepthCm: null,
 *   description: string,
 *   reason: string,
 *   error: string | null,
 *   flags: string[],
 *   rawTruncated: object | null
 * }}
 */
export function mapNv3Response(raw) {
  const flags = [];

  // 1. Kiểm tra cấu trúc dữ liệu bằng Zod
  const parseResult = Nv3ResponseSchema.safeParse(raw);
  if (!parseResult.success) {
    return {
      isFlood: null,
      confidence: 0,
      severity: 'low',
      estimatedDepthCm: null,
      description: '',
      reason: 'Phản hồi từ AI không đúng định dạng hợp đồng',
      error: 'AI_INVALID_RESPONSE',
      flags: ['AI_INVALID_RESPONSE'],
      rawTruncated: null,
    };
  }

  const data = parseResult.data;
  let isFlood = null;
  let status = data.status;

  // 2. status là nguồn chính quyết định ngập
  if (status === 'flooded') {
    isFlood = true;
  } else if (status === 'not_flooded') {
    isFlood = false;
  } else {
    isFlood = null;
  }

  // 3. Kiểm tra mâu thuẫn giữa isFlooded và status
  const hasConflict =
    (status === 'flooded' && data.isFlooded === false) ||
    (status === 'not_flooded' && data.isFlooded === true);

  if (hasConflict) {
    isFlood = null;
    status = 'uncertain';
    flags.push('AI_INCONSISTENT');
  }

  // 4. Chuẩn hóa severity
  let severity = 'low';
  if (['low', 'medium', 'high'].includes(data.severity)) {
    severity = data.severity;
  } else if (data.severity === 'unknown' && status === 'flooded') {
    severity = 'low';
    flags.push('AI_SEVERITY_UNKNOWN');
  } else {
    severity = 'low';
  }

  // 5. Tính toán confidence
  let confidence = 0;
  if (typeof data.confidence === 'number' && data.confidence >= 0 && data.confidence <= 1) {
    confidence = data.confidence;
  } else {
    const estimated = RULES.AI_ESTIMATED_CONFIDENCE || {
      flooded: 0.75,
      not_flooded: 0.75,
      uncertain: 0.3,
    };
    confidence = estimated[status] ?? 0.3;
    flags.push('AI_CONFIDENCE_ESTIMATED');
  }

  // 6. Chuẩn hóa description từ summary (tối đa 300 ký tự)
  const description = cleanControlChars(data.summary || '').slice(0, 300);

  // 7. Chuẩn hóa reason từ evidence (tối đa 5 mục, mỗi mục <= 200 ký tự, loại control chars)
  let reason = '';
  if (Array.isArray(data.evidence)) {
    const cleanEvidence = data.evidence
      .slice(0, 5)
      .map((item) => cleanControlChars(String(item)).slice(0, 200))
      .filter(Boolean);
    reason = cleanEvidence.join('; ');
  }

  // 8. Cờ needsVerification
  if (data.needsVerification === true) {
    flags.push('AI_NEEDS_VERIFICATION');
  }

  return {
    isFlood,
    confidence,
    severity,
    estimatedDepthCm: null,
    description,
    reason,
    error: null,
    flags,
    rawTruncated: truncateRawResponse(raw),
  };
}

export default {
  mapNv3Response,
  truncateRawResponse,
};
