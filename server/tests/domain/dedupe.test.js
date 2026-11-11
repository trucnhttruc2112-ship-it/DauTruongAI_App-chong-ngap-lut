import { describe, it, expect } from 'vitest';
import { findMergeTarget } from '../../src/domain/dedupe.js';
import RULES from '../../src/config/rules.js';

describe('Domain: dedupe.js', () => {
  const BASE_NOW = new Date('2026-11-08T12:00:00.000Z');
  const latOrigin = 10.9447;
  const lngOrigin = 106.8243;
  const newPoint = { lat: latOrigin, lng: lngOrigin };

  // Tính độ lệch vĩ độ ứng với 50 mét và 50.1 mét
  const deg50m = 50 / (6371000 * (Math.PI / 180));
  const deg50_1m = 50.1 / (6371000 * (Math.PI / 180));

  it('1. Bắt buộc nhận tham số now, không gọi ngầm Date.now()', () => {
    expect(() => findMergeTarget(newPoint, [], undefined)).toThrow('Tham số now là bắt buộc');
  });

  it('2. Ca biên khoảng cách: đúng 50.0m được gộp, 50.1m không được gộp', () => {
    // Ứng viên 1: cách đúng ~50m, cập nhật 1 giờ trước
    const candidate50m = {
      id: 'fp_50m',
      lat: latOrigin + deg50m,
      lng: lngOrigin,
      status: 'active',
      lastUpdatedAt: new Date(BASE_NOW.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    };

    const merged50 = findMergeTarget(newPoint, [candidate50m], BASE_NOW);
    expect(merged50).not.toBeNull();
    expect(merged50.id).toBe('fp_50m');

    // Ứng viên 2: cách ~50.1m, cập nhật 1 giờ trước
    const candidate50_1m = {
      id: 'fp_50_1m',
      lat: latOrigin + deg50_1m,
      lng: lngOrigin,
      status: 'active',
      lastUpdatedAt: new Date(BASE_NOW.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    };

    const merged50_1 = findMergeTarget(newPoint, [candidate50_1m], BASE_NOW);
    expect(merged50_1).toBeNull();
  });

  it('3. Ca biên thời gian: đúng 6 giờ được gộp, quá 6 giờ không được gộp', () => {
    // Ứng viên cách 10m, cập nhật đúng 6 giờ trước (6 * 60 * 60 * 1000 ms)
    const deg10m = 10 / (6371000 * (Math.PI / 180));
    const candidateExact6h = {
      id: 'fp_6h_exact',
      lat: latOrigin + deg10m,
      lng: lngOrigin,
      status: 'active',
      lastUpdatedAt: new Date(BASE_NOW.getTime() - 6 * 60 * 60 * 1000).toISOString(),
    };

    const mergedExact = findMergeTarget(newPoint, [candidateExact6h], BASE_NOW);
    expect(mergedExact).not.toBeNull();
    expect(mergedExact.id).toBe('fp_6h_exact');

    // Ứng viên cách 10m, cập nhật 6 giờ 1 giây trước
    const candidateOver6h = {
      id: 'fp_over_6h',
      lat: latOrigin + deg10m,
      lng: lngOrigin,
      status: 'active',
      lastUpdatedAt: new Date(BASE_NOW.getTime() - (6 * 3600 + 1) * 1000).toISOString(),
    };

    const mergedOver = findMergeTarget(newPoint, [candidateOver6h], BASE_NOW);
    expect(mergedOver).toBeNull();
  });

  it('4. Không gộp vào các điểm đã resolved, expired hoặc rejected', () => {
    const deg10m = 10 / (6371000 * (Math.PI / 180));
    const candidates = [
      {
        id: 'fp_resolved',
        lat: latOrigin + deg10m,
        lng: lngOrigin,
        status: 'resolved',
        lastUpdatedAt: new Date(BASE_NOW.getTime() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: 'fp_expired',
        lat: latOrigin + deg10m,
        lng: lngOrigin,
        status: 'expired',
        lastUpdatedAt: new Date(BASE_NOW.getTime() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: 'fp_rejected',
        lat: latOrigin + deg10m,
        lng: lngOrigin,
        status: 'rejected',
        lastUpdatedAt: new Date(BASE_NOW.getTime() - 30 * 60 * 1000).toISOString(),
      },
    ];

    const result = findMergeTarget(newPoint, candidates, BASE_NOW);
    expect(result).toBeNull();
  });

  it('5. Gộp vào điểm có trạng thái pending hoặc active', () => {
    const deg10m = 10 / (6371000 * (Math.PI / 180));
    const candidatePending = {
      id: 'fp_pending',
      lat: latOrigin + deg10m,
      lng: lngOrigin,
      status: 'pending',
      lastUpdatedAt: new Date(BASE_NOW.getTime() - 30 * 60 * 1000).toISOString(),
    };

    const result = findMergeTarget(newPoint, [candidatePending], BASE_NOW);
    expect(result).not.toBeNull();
    expect(result.id).toBe('fp_pending');
  });

  it('6. Khi có nhiều ứng viên thỏa mãn, luôn chọn điểm có khoảng cách gần nhất', () => {
    const deg5m = 5 / (6371000 * (Math.PI / 180));
    const deg25m = 25 / (6371000 * (Math.PI / 180));
    const deg45m = 45 / (6371000 * (Math.PI / 180));

    const candidates = [
      {
        id: 'fp_45m',
        lat: latOrigin + deg45m,
        lng: lngOrigin,
        status: 'active',
        lastUpdatedAt: new Date(BASE_NOW.getTime() - 10 * 60 * 1000).toISOString(),
      },
      {
        id: 'fp_5m', // Điểm gần nhất
        lat: latOrigin + deg5m,
        lng: lngOrigin,
        status: 'active',
        lastUpdatedAt: new Date(BASE_NOW.getTime() - 50 * 60 * 1000).toISOString(),
      },
      {
        id: 'fp_25m',
        lat: latOrigin + deg25m,
        lng: lngOrigin,
        status: 'active',
        lastUpdatedAt: new Date(BASE_NOW.getTime() - 20 * 60 * 1000).toISOString(),
      },
    ];

    const target = findMergeTarget(newPoint, candidates, BASE_NOW);
    expect(target).not.toBeNull();
    expect(target.id).toBe('fp_5m');
  });
});
