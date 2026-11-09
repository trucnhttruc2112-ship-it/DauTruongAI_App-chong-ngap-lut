import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;
export const STATUS_VALUES = ['flooded', 'not_flooded', 'uncertain'];
export const SEVERITY_VALUES = ['none', 'low', 'medium', 'high', 'unknown'];

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function invalidAiResponse() {
  return new ApiError(502, 'GEMINI_INVALID_RESPONSE', 'Gemini trả kết quả không hợp lệ. Vui lòng thử lại.');
}

export async function prepareImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new ApiError(400, 'IMAGE_REQUIRED', 'Vui lòng gửi một ảnh trong trường image.');
  }
  if (file.buffer.length > MAX_IMAGE_BYTES) {
    throw new ApiError(413, 'IMAGE_TOO_LARGE', 'Ảnh không được vượt quá 5 MB (5.242.880 byte).');
  }
  try {
    // Read the real format and decode pixels; filename and client MIME are untrusted.
    const image = sharp(file.buffer, { failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Chỉ hỗ trợ nội dung ảnh JPEG, PNG hoặc WebP.');
    }
    if ((metadata.pages ?? 1) > 1) {
      throw new ApiError(415, 'ANIMATED_IMAGE_UNSUPPORTED', 'Vui lòng dùng ảnh tĩnh JPEG, PNG hoặc WebP.');
    }
    // Re-encoding forces decoding, applies EXIF orientation and removes metadata.
    const buffer = await image.rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer();
    return { buffer, mimeType: 'image/jpeg' };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(415, 'INVALID_IMAGE', 'Ảnh bị hỏng, không hợp lệ hoặc vượt giới hạn 25 triệu pixel.');
  }
}

export function normalizeAnalysis(value, { model, mode, now = new Date() }) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !STATUS_VALUES.includes(value.status) || !SEVERITY_VALUES.includes(value.severity) ||
      !Array.isArray(value.evidence) || value.evidence.length > 8 ||
      value.evidence.some(item => typeof item !== 'string' || !item.trim() || item.length > 300) ||
      typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 600) {
    throw invalidAiResponse();
  }
  let status = value.status;
  let severity = value.severity;
  let evidence = [...new Set(value.evidence.map(item => item.trim()))];
  let summary = value.summary.trim();
  const inconsistent = (status === 'flooded' && !['low', 'medium', 'high', 'unknown'].includes(severity)) ||
    (status === 'not_flooded' && severity !== 'none');
  // Conservative backstop for common prohibited claims. The prompt also forbids
  // inferring capture location/time, exact depths and route safety from an image.
  const prohibitedClaim = /\d+(?:[.,]\d+)?\s*(?:cm|centim[eè]t|x[eă]ng[- ]?ti[- ]?m[eé]t)\b|(?:tuyến|con|đoạn) đường.{0,40}an toàn|an toàn để (?:đi|di chuyển|lưu thông)|(?:ảnh|hình) (?:này )?(?:được )?chụp (?:tại|ở|lúc|vào)/iu;
  if (inconsistent || (status !== 'uncertain' && evidence.length === 0) ||
      [summary, ...evidence].some(text => prohibitedClaim.test(text))) {
    status = 'uncertain';
    evidence = [];
    summary = 'Chưa đủ bằng chứng đáng tin cậy để kết luận tình trạng ngập đường; cần xác minh thực địa.';
  }
  if (status === 'not_flooded') severity = 'none';
  if (status === 'uncertain') severity = 'unknown';
  return {
    isFlooded: status === 'flooded' ? true : status === 'not_flooded' ? false : null,
    status,
    severity,
    evidence,
    summary,
    needsVerification: true,
    analyzedAt: now.toISOString(),
    model,
    mode,
  };
}
