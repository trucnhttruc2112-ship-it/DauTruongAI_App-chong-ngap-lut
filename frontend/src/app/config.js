// Cấu hình giao diện. Các giá trị là đề xuất trong tài liệu UI/UX, có thể đổi theo AI/máy chủ.

export const APP_CONFIG = {
  /** 'demo' = dùng dữ liệu mẫu có nhãn Mô phỏng. Đổi sang 'live' khi lớp dịch vụ nối máy chủ thật. */
  dataMode: 'demo',

  /** Địa bàn mặc định đã cấu hình (tọa độ minh họa, cần thay bằng dữ liệu dự án) */
  map: {
    center: [10.9575, 106.8515],
    zoom: 14,
    minZoom: 11,
    maxZoom: 18,
    /** Phạm vi có dữ liệu của dự án (minh họa) */
    supportedBounds: [[10.90, 106.78], [11.02, 106.93]],
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },

  photo: {
    maxBytes: 10 * 1024 * 1024,
    acceptTypes: ['image/jpeg', 'image/png', 'image/webp'],
    longEdge: 1600,
    /** Ảnh cũ hơn mốc này hiện cảnh báo độ mới (cần nhóm chốt) */
    staleAfterMinutes: 6 * 60
  },

  ai: {
    /** Hết thời gian chờ thì hướng dẫn lựa chọn, không xoay vô hạn */
    timeoutMs: 20_000
  },

  /** Nhịp kiểm tra thay đổi khi trang đang được xem (không phải cam kết thời gian thực) */
  refreshIntervalMs: 30_000,

  /** Dịch vụ tính tuyến chưa sẵn sàng → trang Tìm đường hiển thị trạng thái chưa bật */
  routingEnabled: false,

  admin: { pageSize: 8 }
}
