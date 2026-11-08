import fs from 'fs';
import path from 'path';

/**
 * Dịch vụ chuyển đổi tọa độ địa lý sang địa chỉ hành chính (Reverse Geocoding).
 * Bọc trong try/catch, không làm chặn luồng xử lý báo cáo chính nếu gặp sự cố.
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
   * Suy diễn sơ bộ địa chỉ, tên đường và wardId từ tọa độ.
   * Giai đoạn hiện tại trả về cấu trúc mặc định an toàn.
   * TODO: NV6/NV2 cung cấp API reverse geocoding chi tiết hoặc geojson ranh giới phường.
   *
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<{ address: string | null, street: string | null, wardId: string | null }>}
   */
  async reverse(lat, lng) {
    try {
      // Mặc định tạm thời
      return {
        address: null,
        street: null,
        wardId: null,
      };
    } catch {
      return { address: null, street: null, wardId: null };
    }
  }
}

export const geocodeService = new GeocodeService();
export default geocodeService;
