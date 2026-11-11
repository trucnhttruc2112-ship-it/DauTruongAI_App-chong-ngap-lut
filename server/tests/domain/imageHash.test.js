import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { sha256Hex, computeDHash, hammingDistance } from '../../src/domain/imageHash.js';

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

  it('4. computeDHash & hammingDistance: ảnh giống nhau nhưng nén ở mức khác nhau (khác byte) có khoảng cách <= 5', async () => {
    const imgBase = sharp({
      create: {
        width: 120,
        height: 120,
        channels: 3,
        background: { r: 120, g: 60, b: 200 },
      },
    });

    const bufQ90 = await imgBase.jpeg({ quality: 90 }).toBuffer();
    const bufQ50 = await imgBase.jpeg({ quality: 50 }).toBuffer();

    // Hai buffer khác nhau (khác byte, khác sha256)
    expect(bufQ90.equals(bufQ50)).toBe(false);
    expect(sha256Hex(bufQ90)).not.toBe(sha256Hex(bufQ50));

    // dHash gần trùng với khoảng cách Hamming <= 5
    const hashQ90 = await computeDHash(bufQ90);
    const hashQ50 = await computeDHash(bufQ50);
    const dist = hammingDistance(hashQ90, hashQ50);

    expect(dist).toBeLessThanOrEqual(5);
  });

  it('5. computeDHash & hammingDistance: hai ảnh khác hẳn nhau có khoảng cách lớn (> 5)', async () => {
    const buf1 = await sharp(
      Buffer.from(
        `<svg width="100" height="100">
          <rect width="100" height="50" fill="white"/>
          <rect y="50" width="100" height="50" fill="black"/>
        </svg>`
      )
    ).jpeg().toBuffer();

    const buf2 = await sharp(
      Buffer.from(
        `<svg width="100" height="100">
          <rect width="50" height="100" fill="black"/>
          <rect x="50" width="50" height="100" fill="white"/>
        </svg>`
      )
    ).jpeg().toBuffer();

    const hash1 = await computeDHash(buf1);
    const hash2 = await computeDHash(buf2);
    const dist = hammingDistance(hash1, hash2);

    expect(dist).toBeGreaterThan(5);
  });
});
