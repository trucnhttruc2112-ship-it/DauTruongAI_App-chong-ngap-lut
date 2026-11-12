import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  isValidCoordinate,
  isInsideDongNai,
  toGeoJsonPoint,
  fromGeoJsonPoint,
} from '../../src/domain/geo.js';
import RULES from '../../src/config/rules.js';

describe('Domain: geo.js', () => {
  it('1. isValidCoordinate kiểm tra chính xác các giá trị hợp lệ và không hợp lệ', () => {
    expect(isValidCoordinate(10.9447, 106.8243)).toBe(true);
    expect(isValidCoordinate(-90, -180)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
    expect(isValidCoordinate(90.1, 100)).toBe(false);
    expect(isValidCoordinate(10, 180.1)).toBe(false);
    expect(isValidCoordinate(NaN, 106)).toBe(false);
    expect(isValidCoordinate(10, Infinity)).toBe(false);
    expect(isValidCoordinate('10.94', '106.82')).toBe(false);
  });

  it('2. haversineMeters tính khoảng cách 0m cho cùng 1 điểm và ném lỗi nếu tọa độ sai', () => {
    const p1 = { lat: 10.9447, lng: 106.8243 };
    const p2 = { lat: 10.9447, lng: 106.8243 };
    expect(haversineMeters(p1, p2)).toBeCloseTo(0, 5);

    expect(() => haversineMeters({ lat: 'invalid', lng: 100 }, p1)).toThrow();
  });

  it('3. Ca biên khoảng cách: tính toán chính xác điểm cách nhau 50.0m và 50.1m', () => {
    // 1 độ vĩ độ xấp xỉ 111,195 m.
    // 50 mét vĩ độ tương đương: 50 / 111194.9266... độ
    const latOrigin = 10.9447;
    const lngOrigin = 106.8243;
    const pOrigin = { lat: latOrigin, lng: lngOrigin };

    // Điểm dịch chuyển vĩ độ chính xác ~50m
    const degFor50m = 50 / (6371000 * (Math.PI / 180));
    const p50m = { lat: latOrigin + degFor50m, lng: lngOrigin };
    const dist50 = haversineMeters(pOrigin, p50m);
    expect(dist50).toBeCloseTo(50.0, 1);
    expect(dist50 <= RULES.DUPLICATE_RADIUS_M).toBe(true);

    // Điểm dịch chuyển thêm 0.1m thành 50.1m
    const degFor50_1m = 50.1 / (6371000 * (Math.PI / 180));
    const p50_1m = { lat: latOrigin + degFor50_1m, lng: lngOrigin };
    const dist50_1 = haversineMeters(pOrigin, p50_1m);
    expect(dist50_1).toBeGreaterThan(50.05);
    expect(dist50_1 > RULES.DUPLICATE_RADIUS_M).toBe(true);
  });

  it('4. isInsideDongNai xác định điểm trong tỉnh Đồng Nai và ngoài tỉnh (toạ độ ngoài tỉnh)', () => {
    // Trong TP Biên Hòa, Đồng Nai
    expect(isInsideDongNai(10.9447, 106.8243)).toBe(true);
    // Trong huyện Long Thành, Đồng Nai
    expect(isInsideDongNai(10.78, 106.95)).toBe(true);

    // Ngoài tỉnh: Hà Nội (lat 21.0, lng 105.8)
    expect(isInsideDongNai(21.0285, 105.8542)).toBe(false);
    // Ngoài tỉnh: Quận 1, TP.HCM (lat 10.77, lng 106.70 < minLng 106.75)
    expect(isInsideDongNai(10.7769, 106.7009)).toBe(false);
    // Tọa độ không hợp lệ
    expect(isInsideDongNai(null, undefined)).toBe(false);
  });

  it('5. toGeoJsonPoint chuyển đổi đúng chuẩn GeoJSON với thứ tự [lng, lat]', () => {
    const point = {
      id: 'fp_test_01',
      lat: 10.9447,
      lng: 106.8243,
      address: 'Ngã tư Amata, Biên Hòa',
      street: 'Xa lộ Hà Nội',
      wardId: 'long-binh',
      status: 'active',
      severity: 'high',
      estimatedDepthCm: 35,
      trustScore: 85,
      confirmStill: 2,
      confirmEnded: 0,
      reportCount: 3,
      isFloodProne: true,
      floodEventCount: 4,
      firstReportedAt: '2026-11-08T07:00:00Z',
      lastUpdatedAt: '2026-11-08T08:00:00Z',
      images: ['/uploads/sample.jpg'],
    };

    const geoJson = toGeoJsonPoint(point);

    expect(geoJson.type).toBe('Feature');
    expect(geoJson.geometry.type).toBe('Point');
    // QUAN TRỌNG: thứ tự tọa độ GeoJSON là [lng, lat]
    expect(geoJson.geometry.coordinates[0]).toBe(106.8243); // kinh độ (lng)
    expect(geoJson.geometry.coordinates[1]).toBe(10.9447);  // vĩ độ (lat)
    expect(geoJson.properties.id).toBe('fp_test_01');
    expect(geoJson.properties.street).toBe('Xa lộ Hà Nội');
    expect(geoJson.properties.isFloodProne).toBe(true);
  });

  it('6. fromGeoJsonPoint tái tạo lại object điểm ngập với (lat, lng) từ GeoJSON [lng, lat]', () => {
    const geoJson = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [106.8243, 10.9447], // [lng, lat]
      },
      properties: {
        id: 'fp_test_02',
        street: 'Đồng Khởi',
        status: 'pending',
      },
    };

    const restored = fromGeoJsonPoint(geoJson);
    expect(restored.lat).toBe(10.9447); // vĩ độ
    expect(restored.lng).toBe(106.8243); // kinh độ
    expect(restored.id).toBe('fp_test_02');
    expect(restored.street).toBe('Đồng Khởi');
  });

  it('7. toGeoJsonPoint và fromGeoJsonPoint ném lỗi khi dữ liệu đầu vào không hợp lệ', () => {
    expect(() => toGeoJsonPoint(null)).toThrow();
    expect(() => toGeoJsonPoint({ lat: 'sai', lng: 106 })).toThrow();
    expect(() => fromGeoJsonPoint({ type: 'Feature', geometry: null })).toThrow();
  });
});
