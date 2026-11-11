import fs from 'fs';
import path from 'path';
import { haversineMeters, isValidCoordinate } from '../domain/geo.js';

/**
 * Dịch vụ chuyển đổi tọa độ địa lý sang thông tin hành chính (Reverse Geocoding).
 * Khi chưa có dữ liệu polygon ranh giới chính xác từ NV6, dịch vụ này sẽ
 * ước lượng gán wardId theo phường gần nhất dựa trên khoảng cách Haversine.
 */
class GeocodeService {
  constructor() {
    this._wards = null;
  }

  _loadDemoWards() {
    if (this._wards) return this._wards;
    try {
      const wardsPath = path.resolve('data/demo/wards.demo.json');
      if (fs.existsSync(wardsPath)) {
        const raw = fs.readFileSync(wardsPath, 'utf8');
        const parsed = JSON.parse(raw);
        this._wards = parsed.wards || [];
      } else {
        this._wards = [];
      }
    } catch {
      this._wards = [];
    }
    return this._wards;
  }

  /**
   * Ước lượng phường/xã gần nhất từ tọa độ theo khoảng cách Haversine.
   * Ghi chú: "TẠM THỜI – CHỜ RANH GIỚI THẬT TỪ NV6".
   *
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<{ address: string | null, street: string | null, wardId: string | null, isWardEstimated: boolean, wardEstimateNote: string | null, distanceToWardCenterM: number | null }>}
   */
  async reverse(lat, lng) {
    if (!isValidCoordinate(lat, lng)) {
      return {
        address: null,
        street: null,
        wardId: null,
        isWardEstimated: false,
        wardEstimateNote: null,
        distanceToWardCenterM: null,
      };
    }

    const wards = this._loadDemoWards();
    if (!wards || wards.length === 0) {
      return {
        address: null,
        street: null,
        wardId: null,
        isWardEstimated: false,
        wardEstimateNote: null,
        distanceToWardCenterM: null,
      };
    }

    let nearestWard = null;
    let minDistance = Infinity;

    for (const ward of wards) {
      if (typeof ward.lat === 'number' && typeof ward.lng === 'number') {
        const dist = haversineMeters({ lat, lng }, { lat: ward.lat, lng: ward.lng });
        if (dist < minDistance) {
          minDistance = dist;
          nearestWard = ward;
        }
      }
    }

    if (!nearestWard) {
      return {
        address: null,
        street: null,
        wardId: null,
        isWardEstimated: false,
        wardEstimateNote: null,
        distanceToWardCenterM: null,
      };
    }

    return {
      address: null,
      street: null,
      wardId: nearestWard.id,
      isWardEstimated: true,
      wardEstimateNote: 'TẠM THỜI – CHỜ RANH GIỚI THẬT TỪ NV6',
      distanceToWardCenterM: Math.round(minDistance),
    };
  }
}

export const geocodeService = new GeocodeService();
export default geocodeService;
