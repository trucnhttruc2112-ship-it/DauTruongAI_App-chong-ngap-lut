import { describe, it, expect } from 'vitest';
import { validateReportContext } from '../../src/domain/reportValidator.js';
import RULES from '../../src/config/rules.js';

describe('Domain: reportValidator.js', () => {
  const BASE_NOW = new Date('2026-11-08T10:00:00.000Z');

  it('1. Báo cáo hợp lệ chuẩn mực trong Đồng Nai, chụp bằng camera, accuracy tốt', () => {
    const res = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 15,
      capturedAt: '2026-11-08T09:58:00.000Z', // 2 phút trước
      now: BASE_NOW,
      source: 'camera',
    });

    expect(res.ok).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.flags).toHaveLength(0);
  });

  it('2. Bắt buộc nhận tham số now, không gọi ngầm Date.now()', () => {
    expect(() => {
      validateReportContext({
        lat: 10.9447,
        lng: 106.8243,
        accuracyM: 20,
        capturedAt: '2026-11-08T09:58:00.000Z',
        // thiếu now
      });
    }).toThrow('Tham số now là bắt buộc');

    expect(() => {
      validateReportContext({
        lat: 10.9447,
        lng: 106.8243,
        accuracyM: 20,
        capturedAt: '2026-11-08T09:58:00.000Z',
        now: 'thời_gian_không_hợp_lệ',
      });
    }).toThrow('không phải là mốc thời gian hợp lệ');
  });

  it('3. Ca biên GPS accuracy: đúng 100m được chấp nhận, 101m bị từ chối', () => {
    // 100m: hợp lệ (đạt ngưỡng tối đa cho phép)
    const res100 = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 100,
      capturedAt: '2026-11-08T09:59:00.000Z',
      now: BASE_NOW,
    });
    expect(res100.ok).toBe(true);
    expect(res100.errors).toHaveLength(0);
    expect(res100.flags).toContain('LOW_GPS_ACCURACY'); // vì > 50m

    // 101m: bị từ chối
    const res101 = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 101,
      capturedAt: '2026-11-08T09:59:00.000Z',
      now: BASE_NOW,
    });
    expect(res101.ok).toBe(false);
    expect(res101.errors.some((e) => e.code === 'GPS_TOO_INACCURATE')).toBe(true);
  });

  it('4. Cảnh báo độ chính xác thấp (cờ LOW_GPS_ACCURACY): 50m không gắn cờ, 51m có gắn cờ', () => {
    const res50 = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 50,
      capturedAt: '2026-11-08T09:59:00.000Z',
      now: BASE_NOW,
    });
    expect(res50.ok).toBe(true);
    expect(res50.flags).not.toContain('LOW_GPS_ACCURACY');

    const res51 = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 51,
      capturedAt: '2026-11-08T09:59:00.000Z',
      now: BASE_NOW,
    });
    expect(res51.ok).toBe(true);
    expect(res51.flags).toContain('LOW_GPS_ACCURACY');
  });

  it('5. Ca biên thời gian chụp: capturedAt ở tương lai', () => {
    // Tương lai 30 giây: chấp nhận được do dung sai lệch đồng hồ (<= 1 phút)
    const res30sFuture = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 20,
      capturedAt: new Date(BASE_NOW.getTime() + 30 * 1000).toISOString(),
      now: BASE_NOW,
    });
    expect(res30sFuture.ok).toBe(true);

    // Tương lai đúng 60 giây (1 phút dung sai): vẫn hợp lệ
    const res60sFuture = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 20,
      capturedAt: new Date(BASE_NOW.getTime() + 60 * 1000).toISOString(),
      now: BASE_NOW,
    });
    expect(res60sFuture.ok).toBe(true);

    // Tương lai 61 giây (> 1 phút): bị từ chối với lỗi REPORT_IN_FUTURE
    const resFutureFail = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 20,
      capturedAt: new Date(BASE_NOW.getTime() + 61 * 1000).toISOString(),
      now: BASE_NOW,
    });
    expect(resFutureFail.ok).toBe(false);
    expect(resFutureFail.errors.some((e) => e.code === 'REPORT_IN_FUTURE')).toBe(true);
  });

  it('6. Ca biên thời gian chụp: ảnh quá cũ (vượt quá 5 phút)', () => {
    // Đúng 5 phút trước (300 giây): vẫn được chấp nhận
    const res5Min = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 20,
      capturedAt: new Date(BASE_NOW.getTime() - 5 * 60 * 1000).toISOString(),
      now: BASE_NOW,
    });
    expect(res5Min.ok).toBe(true);

    // 5 phút 1 giây trước: bị từ chối với lỗi REPORT_TOO_OLD
    const resOld = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 20,
      capturedAt: new Date(BASE_NOW.getTime() - (5 * 60 + 1) * 1000).toISOString(),
      now: BASE_NOW,
    });
    expect(resOld.ok).toBe(false);
    expect(resOld.errors.some((e) => e.code === 'REPORT_TOO_OLD')).toBe(true);
  });

  it('7. Từ chối khi tọa độ nằm ngoài phạm vi tỉnh Đồng Nai', () => {
    // Tọa độ tại Quận 1 TP.HCM
    const resOut = validateReportContext({
      lat: 10.7769,
      lng: 106.7009,
      accuracyM: 10,
      capturedAt: '2026-11-08T09:59:00.000Z',
      now: BASE_NOW,
    });
    expect(resOut.ok).toBe(false);
    expect(resOut.errors.some((e) => e.code === 'OUT_OF_AREA')).toBe(true);
  });

  it('8. Nguồn ảnh từ gallery hoặc manual-pin được gắn cờ LOW_TRUST_SOURCE', () => {
    const resGallery = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 20,
      capturedAt: '2026-11-08T09:59:00.000Z',
      now: BASE_NOW,
      source: 'gallery',
    });
    expect(resGallery.ok).toBe(true);
    expect(resGallery.flags).toContain('LOW_TRUST_SOURCE');

    const resPin = validateReportContext({
      lat: 10.9447,
      lng: 106.8243,
      accuracyM: 20,
      capturedAt: '2026-11-08T09:59:00.000Z',
      now: BASE_NOW,
      source: 'manual-pin',
    });
    expect(resPin.ok).toBe(true);
    expect(resPin.flags).toContain('LOW_TRUST_SOURCE');
  });
});
