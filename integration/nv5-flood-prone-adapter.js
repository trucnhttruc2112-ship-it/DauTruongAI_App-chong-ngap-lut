/**
 * Module Adapter tích hợp dành riêng cho NV5 (Dự báo ngập theo lượng mưa).
 *
 * NHIỆM VỤ:
 * - Gọi endpoint GET /api/flood-prone của NV4.
 * - Chuẩn hóa dữ liệu sang cấu trúc NV5 cần: { id, lat, lng, street, wardId, eventCount, severityWeight }.
 *
 * LƯU Ý TẦN SUẤT GỌI CHO NV5:
 * - Dữ liệu các điểm/tuyến đường hay ngập (flood-prone) là dữ liệu lịch sử tích lũy, thay đổi chậm.
 * - Khuyến nghị: Cache phía NV5 trong khoảng 5 - 15 phút hoặc gọi theo chu kỳ nhận bản tin dự báo mưa (Radar/vệ tinh).
 * - Tuyệt đối không gọi dồn dập ở mỗi request của người dùng cuối.
 */

const SEVERITY_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Lấy danh sách các điểm/tuyến đường hay ngập để NV5 đối chiếu lượng mưa dự báo.
 *
 * @param {Object} [options]
 * @param {string} [options.apiBase=''] URL gốc API NV4 (VD: 'http://localhost:3000' hoặc '')
 * @param {number} [options.minEvents] Số sự kiện ngập tối thiểu (mặc định server là 3)
 * @param {string} [options.wardId] Lọc theo mã định danh phường/xã nếu cần
 * @param {typeof fetch} [options.fetchImpl=fetch] Có thể inject fetch tùy biến cho môi trường Node.js / test
 * @returns {Promise<Array<{
 *   id: string,
 *   lat: number,
 *   lng: number,
 *   street: string | null,
 *   wardId: string | null,
 *   eventCount: number,
 *   severityWeight: number
 * }>>}
 */
export async function getFloodProneForForecast(options = {}) {
  const {
    apiBase = '',
    minEvents,
    wardId,
    fetchImpl = globalThis.fetch,
  } = options;

  if (typeof fetchImpl !== 'function') {
    throw new Error('[NV5 Adapter] fetch implementation không khả dụng.');
  }

  const cleanBase = apiBase.replace(/\/+$/, '');
  const url = new URL(`${cleanBase}/api/flood-prone`, 'http://localhost');

  if (minEvents !== undefined && minEvents !== null) {
    url.searchParams.set('minEvents', String(minEvents));
  }
  if (wardId) {
    url.searchParams.set('wardId', String(wardId));
  }

  const endpoint = cleanBase ? `${cleanBase}${url.pathname}${url.search}` : `${url.pathname}${url.search}`;

  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[NV5 Adapter] Lỗi khi tải dữ liệu flood-prone: HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json || !json.ok || !Array.isArray(json.data)) {
    throw new Error('[NV5 Adapter] Dữ liệu trả về từ /api/flood-prone không đúng định dạng hợp đồng');
  }

  return json.data.map((item) => {
    const rawSeverity = (item.avgSeverity || '').toLowerCase();
    const severityWeight = SEVERITY_WEIGHTS[rawSeverity] || 2;

    return {
      id: item.key || (item.pointIds && item.pointIds[0]) || `prone_${item.street || 'unknown'}`,
      lat: item.centerLat,
      lng: item.centerLng,
      street: item.street || null,
      wardId: item.wardId || null,
      eventCount: item.eventCount || 0,
      severityWeight,
    };
  });
}

export default {
  getFloodProneForForecast,
};
