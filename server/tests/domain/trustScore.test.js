import { describe, it, expect } from 'vitest';
import { computeTrustScore } from '../../src/domain/trustScore.js';

describe('Domain: trustScore.js', () => {
  it('1. Điểm tuyệt đối (AI 100%, GPS <= 10m, chụp camera, 3 confirmStill, 3 reportCount)', () => {
    const score = computeTrustScore({
      aiConfidence: 1.0,    // 40 điểm
      gpsAccuracyM: 5,      // 20 điểm
      source: 'camera',     // 15 điểm
      confirmStill: 3,      // 20 điểm (3 * 7 = 21 -> max 20)
      confirmEnded: 0,
      reportCount: 3,       // 5 điểm (2 * 2.5 = 5)
    });

    expect(score).toBe(100);
  });

  it('2. Điểm tối thiểu (AI 0, GPS > 100m, nguồn manual, bị báo ended nhiều)', () => {
    const score = computeTrustScore({
      aiConfidence: 0,
      gpsAccuracyM: 150,
      source: 'manual-pin',
      confirmStill: 0,
      confirmEnded: 5,
      reportCount: 1,
    });

    expect(score).toBe(0);
  });

  it('3. AI confidence chiếm đúng tỷ trọng 40%', () => {
    const score0 = computeTrustScore({ aiConfidence: 0, gpsAccuracyM: 150, source: 'manual-pin' });
    const score50 = computeTrustScore({ aiConfidence: 0.5, gpsAccuracyM: 150, source: 'manual-pin' });
    const score100 = computeTrustScore({ aiConfidence: 1.0, gpsAccuracyM: 150, source: 'manual-pin' });

    expect(score0).toBe(0);
    expect(score50).toBe(20);
    expect(score100).toBe(40);
  });

  it('4. GPS accuracy tính điểm tuyến tính từ 10m (20đ) đến 100m (0đ)', () => {
    const score10 = computeTrustScore({ aiConfidence: 0, gpsAccuracyM: 10, source: 'manual-pin' });
    const score55 = computeTrustScore({ aiConfidence: 0, gpsAccuracyM: 55, source: 'manual-pin' });
    const score100 = computeTrustScore({ aiConfidence: 0, gpsAccuracyM: 100, source: 'manual-pin' });
    const score105 = computeTrustScore({ aiConfidence: 0, gpsAccuracyM: 105, source: 'manual-pin' });

    expect(score10).toBe(20);
    expect(score55).toBe(10); // nửa chặng
    expect(score100).toBe(0);
    expect(score105).toBe(0);
  });

  it('5. Phân biệt nguồn ảnh: camera (15đ) vs gallery (5đ) vs manual-pin (0đ)', () => {
    const scoreCam = computeTrustScore({ aiConfidence: 0, gpsAccuracyM: 150, source: 'camera' });
    const scoreGal = computeTrustScore({ aiConfidence: 0, gpsAccuracyM: 150, source: 'gallery' });
    const scorePin = computeTrustScore({ aiConfidence: 0, gpsAccuracyM: 150, source: 'manual-pin' });

    expect(scoreCam).toBe(15);
    expect(scoreGal).toBe(5);
    expect(scorePin).toBe(0);
  });

  it('6. Điểm xác nhận ended trừ điểm phạt thích đáng', () => {
    const scoreWithoutEnded = computeTrustScore({
      aiConfidence: 0.8, // 32
      gpsAccuracyM: 10,   // 20
      source: 'camera',  // 15
      confirmStill: 2,   // 14
      confirmEnded: 0,   // 0
    }); // 32 + 20 + 15 + 14 = 81

    const scoreWithEnded = computeTrustScore({
      aiConfidence: 0.8,
      gpsAccuracyM: 10,
      source: 'camera',
      confirmStill: 2,
      confirmEnded: 2, // phạt -30
    }); // 81 - 30 = 51

    expect(scoreWithoutEnded).toBe(81);
    expect(scoreWithEnded).toBe(51);
  });
});
