import { describe, it, expect } from 'vitest';
import {
  decideInitialStatus,
  applyConfirmation,
  shouldExpire,
  promotePendingToActive,
} from '../../src/domain/lifecycle.js';
import RULES from '../../src/config/rules.js';

describe('Domain: lifecycle.js', () => {
  const BASE_NOW = new Date('2026-11-08T15:00:00.000Z');

  describe('1. decideInitialStatus (quyết định trạng thái khởi tạo theo AI)', () => {
    it('AI xác nhận isFlood=false luôn trả về rejected', () => {
      expect(decideInitialStatus({ isFlood: false, confidence: 0.99 })).toBe('rejected');
    });

    it('Ca biên AI isFlood=null (AI lỗi/timeout) luôn trả về pending', () => {
      expect(decideInitialStatus({ isFlood: null, error: 'AI Timeout' })).toBe('pending');
      expect(decideInitialStatus(null)).toBe('rejected');
      expect(decideInitialStatus({ isFlood: undefined })).toBe('pending');
    });

    it('Ca biên độ tin cậy AI: 0.59 trả pending, 0.60 trả active', () => {
      expect(decideInitialStatus({ isFlood: true, confidence: 0.59 })).toBe('pending');
      expect(decideInitialStatus({ isFlood: true, confidence: 0.60 })).toBe('active');
      expect(decideInitialStatus({ isFlood: true, confidence: 0.85 })).toBe('active');
    });
  });

  describe('2. applyConfirmation (xác nhận vẫn ngập/hết ngập)', () => {
    const activePoint = {
      id: 'fp_active',
      status: 'active',
      confirmStill: 0,
      confirmEnded: 0,
      lastConfirmedAt: null,
    };

    it('Xác nhận still làm mới lastConfirmedAt thành mốc now', () => {
      const res = applyConfirmation(
        activePoint,
        [],
        { deviceId: 'dev_user_1', type: 'still' },
        BASE_NOW
      );

      expect(res.status).toBe('active');
      expect(res.confirmStill).toBe(1);
      expect(res.confirmEnded).toBe(0);
      expect(res.resolved).toBe(false);
      expect(res.lastConfirmedAt).toBe(BASE_NOW.toISOString());
    });

    it('Ca biên quan trọng: 1 thiết bị báo ended 2 lần chỉ tính 1, KHÔNG chuyển thành resolved', () => {
      const existing = [
        { deviceId: 'device_A', type: 'ended', createdAt: '2026-11-08T14:30:00Z' },
      ];

      // Cùng device_A gửi tiếp một xác nhận 'ended' thứ 2
      const res = applyConfirmation(
        activePoint,
        existing,
        { deviceId: 'device_A', type: 'ended' },
        BASE_NOW
      );

      // confirmEnded vẫn là 1 vì trùng deviceId
      expect(res.confirmEnded).toBe(1);
      // Chưa đủ 2 thiết bị khác nhau nên chưa chuyển sang resolved
      expect(res.status).toBe('active');
      expect(res.resolved).toBe(false);
    });

    it('Khi đủ 2 thiết bị KHÁC NHAU báo ended, điểm ngập chuyển sang resolved', () => {
      const existing = [
        { deviceId: 'device_A', type: 'ended', createdAt: '2026-11-08T14:30:00Z' },
      ];

      // Thiết bị khác: device_B gửi xác nhận 'ended'
      const res = applyConfirmation(
        activePoint,
        existing,
        { deviceId: 'device_B', type: 'ended' },
        BASE_NOW
      );

      expect(res.confirmEnded).toBe(2);
      expect(res.status).toBe('resolved');
      expect(res.resolved).toBe(true);
    });
  });

  describe('3. shouldExpire (tự động hết hạn)', () => {
    it('Bắt buộc nhận tham số now, không gọi ngầm Date.now()', () => {
      const pt = { status: 'active', lastUpdatedAt: '2026-11-08T08:00:00Z' };
      expect(() => shouldExpire(pt, undefined)).toThrow('Tham số now là bắt buộc');
    });

    it('Ca biên đúng 6 giờ: đúng 6 giờ chưa hết hạn, quá 6 giờ thì hết hạn', () => {
      const exact6hAgo = new Date(BASE_NOW.getTime() - 6 * 60 * 60 * 1000).toISOString();
      const ptExact = { status: 'active', lastUpdatedAt: exact6hAgo };
      expect(shouldExpire(ptExact, BASE_NOW)).toBe(false);

      const over6hAgo = new Date(BASE_NOW.getTime() - (6 * 3600 + 1) * 1000).toISOString();
      const ptOver = { status: 'active', lastUpdatedAt: over6hAgo };
      expect(shouldExpire(ptOver, BASE_NOW)).toBe(true);
    });

    it('Điểm đã resolved hoặc expired không được kích hoạt hết hạn nữa', () => {
      const longAgo = new Date(BASE_NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
      expect(shouldExpire({ status: 'resolved', lastUpdatedAt: longAgo }, BASE_NOW)).toBe(false);
      expect(shouldExpire({ status: 'expired', lastUpdatedAt: longAgo }, BASE_NOW)).toBe(false);
    });
  });

  describe('4. promotePendingToActive (nâng pending lên active)', () => {
    it('2 báo cáo từ cùng 1 thiết bị vẫn giữ trạng thái pending', () => {
      const point = { id: 'fp_pend', status: 'pending' };
      const reports = [
        { deviceId: 'dev_single' },
        { deviceId: 'dev_single' },
      ];

      const status = promotePendingToActive(point, reports);
      expect(status).toBe('pending');
    });

    it('2 báo cáo từ 2 thiết bị khác nhau nâng điểm từ pending lên active', () => {
      const point = { id: 'fp_pend', status: 'pending' };
      const reports = [
        { deviceId: 'dev_user_1' },
        { deviceId: 'dev_user_2' },
      ];

      const status = promotePendingToActive(point, reports);
      expect(status).toBe('active');
    });

    it('Điểm không ở trạng thái pending được giữ nguyên trạng thái', () => {
      const point = { id: 'fp_res', status: 'resolved' };
      expect(promotePendingToActive(point, [{ deviceId: 'dev_1' }, { deviceId: 'dev_2' }])).toBe('resolved');
    });
  });
});
