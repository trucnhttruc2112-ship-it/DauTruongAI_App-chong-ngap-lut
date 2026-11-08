import { describe, it, expect } from 'vitest';
import { sha256Hex } from '../../src/domain/imageHash.js';

describe('Domain: imageHash.js', () => {
  it('1. Tính mã băm SHA-256 hex chuẩn xác và có tính tất định', () => {
    const buffer1 = Buffer.from('dong-nai-flood-sample-image-bytes-1');
    const hash1 = sha256Hex(buffer1);

    expect(typeof hash1).toBe('string');
    expect(hash1).toHaveLength(64); // SHA-256 tạo ra chuỗi 64 ký tự hex

    // Tính lại lần nữa trên cùng buffer phải ra kết quả y hệt
    const hash2 = sha256Hex(buffer1);
    expect(hash1).toBe(hash2);
  });

  it('2. Hai buffer khác nhau tạo ra hai mã băm SHA-256 khác nhau', () => {
    const bufA = Buffer.from('image_content_A');
    const bufB = Buffer.from('image_content_B');

    expect(sha256Hex(bufA)).not.toBe(sha256Hex(bufB));
  });

  it('3. Ném lỗi nếu buffer rỗng hoặc null', () => {
    expect(() => sha256Hex(null)).toThrow('không được để trống');
    expect(() => sha256Hex('')).toThrow('không được để trống');
  });
});
