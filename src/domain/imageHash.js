import crypto from 'crypto';

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

export default { sha256Hex };
