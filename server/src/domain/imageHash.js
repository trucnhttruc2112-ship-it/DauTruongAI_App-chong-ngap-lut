import crypto from 'crypto';
import sharp from 'sharp';

/**
 * Tính mã băm SHA-256 dạng chuỗi thập lục phân (hex) từ Buffer hoặc chuỗi.
 * Dùng để phát hiện trùng lặp ảnh gửi lên từ client.
 * 
 * @param {Buffer | string} buffer Dữ liệu nhị phân hoặc chuỗi của ảnh
 * @returns {string} Chuỗi băm SHA-256 (64 ký tự hex)
 */
export function sha256Hex(buffer) {
  if (!buffer) {
    throw new Error('Dữ liệu đệm (buffer) không được để trống khi tính SHA-256');
  }

  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Tính mã băm tri giác dHash (difference hash) 64-bit sử dụng sharp.
 * Quy trình: Chuyển grayscale -> Resize 9x8 -> So sánh pixel kề nhau theo hàng (9 pixel cho 8 so sánh x 8 hàng = 64 bit).
 * 
 * @param {Buffer} buffer Buffer dữ liệu ảnh
 * @returns {Promise<string>} Chuỗi hex 64-bit (16 ký tự hex)
 */
export async function computeDHash(buffer) {
  if (!buffer) {
    throw new Error('Dữ liệu đệm (buffer) không được để trống khi tính dHash');
  }

  const raw = await sharp(buffer)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();

  let min = 255;
  let max = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] < min) min = raw[i];
    if (raw[i] > max) max = raw[i];
  }

  // Xử lý ảnh đơn sắc hoàn toàn (không có gradient phân biệt giữa các pixel)
  if (min === max) {
    return raw[0].toString(16).padStart(2, '0').repeat(8);
  }

  let hex = '';
  for (let y = 0; y < 8; y++) {
    let rowByte = 0;
    for (let x = 0; x < 8; x++) {
      const left = raw[y * 9 + x];
      const right = raw[y * 9 + x + 1];
      if (left > right) {
        rowByte |= (1 << (7 - x));
      }
    }
    hex += rowByte.toString(16).padStart(2, '0');
  }

  return hex;
}

/**
 * Tính khoảng cách Hamming (số lượng bit khác biệt) giữa 2 chuỗi hex.
 * 
 * @param {string} hash1 Chuỗi hex thứ nhất
 * @param {string} hash2 Chuỗi hex thứ hai
 * @returns {number} Số bit khác biệt (0 đến 64)
 */
export function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2) {
    return 64;
  }

  const s1 = String(hash1).toLowerCase();
  const s2 = String(hash2).toLowerCase();
  const maxLen = Math.max(s1.length, s2.length);
  const pad1 = s1.padStart(maxLen, '0');
  const pad2 = s2.padStart(maxLen, '0');

  let distance = 0;
  for (let i = 0; i < maxLen; i += 2) {
    const b1 = parseInt(pad1.slice(i, i + 2), 16) || 0;
    const b2 = parseInt(pad2.slice(i, i + 2), 16) || 0;
    let xor = b1 ^ b2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

export default { sha256Hex, computeDHash, hammingDistance };
