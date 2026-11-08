import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import RULES from '../config/rules.js';

/**
 * Kiểm tra magic bytes của buffer ảnh (không tin mimetype do client gửi lên).
 * Chấp nhận định dạng: JPEG, PNG, WebP.
 *
 * @param {Buffer} buffer
 * @returns {{ valid: boolean, format: string | null }}
 */
export function validateImageMagicBytes(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return { valid: false, format: null };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, format: 'jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, format: 'png' };
  }

  // WebP: 'RIFF'....'WEBP'
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { valid: true, format: 'webp' };
  }

  return { valid: false, format: null };
}

/**
 * Nén và lưu ảnh bằng Sharp:
 * - Tự động xoay theo thông tin EXIF
 * - Xóa sạch siêu dữ liệu EXIF/GPS vì lý do quyền riêng tư (Rule 18)
 * - Thu nhỏ cạnh dài tối đa 1280px
 * - Nén chất lượng JPEG q80
 * - Lưu theo cấu trúc: <baseUploadDir>/YYYY/MM/<uuid>.jpg
 *
 * @param {Buffer} buffer Dữ liệu ảnh thô
 * @param {string} baseUploadDir Thư mục gốc upload
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ fullPath: string, relativeUrl: string, fileSizeBytes: number }>}
 */
export async function compressAndSaveImage(buffer, baseUploadDir, now = new Date()) {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const targetDir = path.resolve(baseUploadDir, year, month);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filename = `${crypto.randomUUID()}.jpg`;
  const fullPath = path.join(targetDir, filename);

  // Xoay theo EXIF, xóa metadata (mặc định sharp không thêm lại EXIF), resize max 1280, nén jpeg q80
  const processedBuffer = await sharp(buffer)
    .rotate()
    .resize(RULES.IMAGE_MAX_DIMENSION, RULES.IMAGE_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: RULES.IMAGE_JPEG_QUALITY })
    .toBuffer();

  await fs.promises.writeFile(fullPath, processedBuffer);

  const relativeUrl = `/uploads/${year}/${month}/${filename}`;

  return {
    fullPath,
    relativeUrl,
    fileSizeBytes: processedBuffer.length,
  };
}

export default {
  validateImageMagicBytes,
  compressAndSaveImage,
};
