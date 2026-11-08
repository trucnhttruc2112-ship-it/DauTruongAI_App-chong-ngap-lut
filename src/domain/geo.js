import RULES from '../config/rules.js';

/**
 * Tính khoảng cách giữa hai toạ độ theo công thức Haversine (đơn vị: mét).
 * Chấp nhận tham số dạng object { lat, lng } hoặc mảng [lat, lng].
 * 
 * @param {{ lat: number, lng: number } | [number, number]} a 
 * @param {{ lat: number, lng: number } | [number, number]} b 
 * @returns {number} Khoảng cách tính bằng mét
 */
export function haversineMeters(a, b) {
  const lat1 = Array.isArray(a) ? a[0] : (a.lat ?? a.latitude);
  const lng1 = Array.isArray(a) ? a[1] : (a.lng ?? a.longitude);
  const lat2 = Array.isArray(b) ? b[0] : (b.lat ?? b.latitude);
  const lng2 = Array.isArray(b) ? b[1] : (b.lng ?? b.longitude);

  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    throw new Error('Tọa độ không hợp lệ cho phép tính haversine');
  }

  const R = 6371000; // Bán kính Trái Đất trung bình (mét)
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLng2 = Math.sin(dLng / 2);

  const aHarv =
    sinDLat2 * sinDLat2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLng2 * sinDLng2;

  const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
  return R * c;
}

/**
 * Kiểm tra tính hợp lệ của cặp tọa độ WGS84.
 * Vĩ độ [-90, 90], Kinh độ [-180, 180], phải là số thực hữu hạn.
 * 
 * @param {number} lat 
 * @param {number} lng 
 * @returns {boolean}
 */
export function isValidCoordinate(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Kiểm tra xem tọa độ có nằm trong phạm vi tỉnh Đồng Nai hay không.
 * Giai đoạn đầu dùng bounding box định nghĩa trong rules.js (lat 10.35–11.60, lng 106.75–107.60).
 * Có thể mở rộng truyền polygon khi NV6 cung cấp.
 * 
 * @param {number} lat 
 * @param {number} lng 
 * @param {typeof RULES.DONG_NAI_BBOX} [bbox]
 * @returns {boolean}
 */
export function isInsideDongNai(lat, lng, bbox = RULES.DONG_NAI_BBOX) {
  if (!isValidCoordinate(lat, lng)) return false;
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  );
}

/**
 * CHUYỂN ĐỔI SANG GEOJSON:
 * LƯU Ý KỸ THUẬT QUAN TRỌNG (theo quy tắc AGENTS.md):
 * - Leaflet và CSDL của ta lưu thứ tự (lat, lng).
 * - Chuẩn GeoJSON Feature (Point) bắt buộc thứ tự tọa độ là [lng, lat].
 * 
 * @param {object} floodPoint Đối tượng điểm ngập trong CSDL
 * @returns {object} GeoJSON Feature
 */
export function toGeoJsonPoint(floodPoint, extraProperties = {}) {
  if (!floodPoint || !isValidCoordinate(floodPoint.lat, floodPoint.lng)) {
    throw new Error('Dữ liệu điểm ngập không có tọa độ hợp lệ để tạo GeoJSON');
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      // Chuẩn GeoJSON: [kinh độ, vĩ độ]
      coordinates: [floodPoint.lng, floodPoint.lat],
    },
    properties: {
      id: floodPoint.id,
      address: floodPoint.address || null,
      street: floodPoint.street || null,
      wardId: floodPoint.wardId || floodPoint.ward_id || null,
      status: floodPoint.status,
      severity: floodPoint.severity,
      estimatedDepthCm: floodPoint.estimatedDepthCm ?? floodPoint.estimated_depth_cm ?? null,
      trustScore: floodPoint.trustScore ?? floodPoint.trust_score ?? 0,
      confirmStill: floodPoint.confirmStill ?? floodPoint.confirm_still ?? 0,
      confirmEnded: floodPoint.confirmEnded ?? floodPoint.confirm_ended ?? 0,
      reportCount: floodPoint.reportCount ?? floodPoint.report_count ?? 1,
      isFloodProne: Boolean(floodPoint.isFloodProne ?? floodPoint.is_flood_prone),
      floodEventCount: floodPoint.floodEventCount ?? floodPoint.flood_event_count ?? 0,
      firstReportedAt: floodPoint.firstReportedAt || floodPoint.first_reported_at || null,
      lastUpdatedAt: floodPoint.lastUpdatedAt || floodPoint.last_updated_at || null,
      images: floodPoint.images || [],
      ...extraProperties,
    },
  };
}

/**
 * CHUYỂN ĐỔI TỪ GEOJSON SANG ĐỐI TƯỢNG ĐIỂM NGẬP CỦA HỆ THỐNG:
 * Đọc tọa độ GeoJSON [lng, lat] và gán lại thành lat, lng cho Leaflet/DB.
 * 
 * @param {object} geoJsonFeature GeoJSON Feature
 * @returns {object} Đối tượng điểm ngập dạng phẳng
 */
export function fromGeoJsonPoint(geoJsonFeature) {
  if (
    !geoJsonFeature ||
    geoJsonFeature.type !== 'Feature' ||
    !geoJsonFeature.geometry ||
    geoJsonFeature.geometry.type !== 'Point' ||
    !Array.isArray(geoJsonFeature.geometry.coordinates) ||
    geoJsonFeature.geometry.coordinates.length < 2
  ) {
    throw new Error('Định dạng GeoJSON Feature Point không hợp lệ');
  }

  const [lng, lat] = geoJsonFeature.geometry.coordinates;
  const props = geoJsonFeature.properties || {};

  return {
    ...props,
    lat,
    lng,
  };
}

export default {
  haversineMeters,
  isValidCoordinate,
  isInsideDongNai,
  toGeoJsonPoint,
  fromGeoJsonPoint,
};
