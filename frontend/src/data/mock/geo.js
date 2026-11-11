// Dữ liệu địa lý MẪU cho bản trình diễn. Tọa độ và tên khu vực chỉ để minh họa –
// ranh giới địa bàn và tọa độ thật phải lấy từ bộ dữ liệu dự án (mục 2).
import { minutesAgo, minutesFromNow } from '../../utils/time.js'

/** Khu vực minh họa (không phải ranh giới hành chính đã xác minh) */
export const AREAS = ['Trảng Dài', 'Tân Phong', 'Trấn Biên', 'Đồng Khởi', 'Cổng 11', 'Hố Nai']

/** Danh mục địa điểm của dự án dùng cho ô tìm kiếm (bản đầu chỉ tìm trong danh mục này). */
export const PLACES = [
  { id: 'pl-01', name: 'Đường Đồng Khởi', context: 'Biên Hòa, Đồng Nai', area: 'Đồng Khởi', lat: 10.9612, lng: 106.8545, zoom: 15 },
  { id: 'pl-02', name: 'Ngã tư Tân Phong', context: 'Đường Đồng Khởi, Biên Hòa', area: 'Tân Phong', lat: 10.9718, lng: 106.8508, zoom: 16 },
  { id: 'pl-03', name: 'Chợ Trảng Dài', context: 'Trảng Dài, Biên Hòa', area: 'Trảng Dài', lat: 10.9786, lng: 106.8662, zoom: 16 },
  { id: 'pl-04', name: 'Đường Nguyễn Khuyến', context: 'Trảng Dài, Biên Hòa', area: 'Trảng Dài', lat: 10.9741, lng: 106.8705, zoom: 16 },
  { id: 'pl-05', name: 'Cổng 11', context: 'Quốc lộ 51, Biên Hòa', area: 'Cổng 11', lat: 10.9318, lng: 106.8789, zoom: 16 },
  { id: 'pl-06', name: 'Đường Phạm Văn Thuận', context: 'Trấn Biên, Biên Hòa', area: 'Trấn Biên', lat: 10.9516, lng: 106.8352, zoom: 16 },
  { id: 'pl-07', name: 'Công viên Biên Hùng', context: 'Trấn Biên, Biên Hòa', area: 'Trấn Biên', lat: 10.9468, lng: 106.8195, zoom: 16 },
  { id: 'pl-08', name: 'Ngã ba Chợ Sặt', context: 'Hố Nai, Biên Hòa', area: 'Hố Nai', lat: 10.9655, lng: 106.8902, zoom: 16 },
  { id: 'pl-09', name: 'Đường Bùi Trọng Nghĩa', context: 'Trảng Dài, Biên Hòa', area: 'Trảng Dài', lat: 10.9683, lng: 106.8612, zoom: 16 },
  { id: 'pl-10', name: 'Đường Võ Thị Sáu', context: 'Trấn Biên, Biên Hòa', area: 'Trấn Biên', lat: 10.9445, lng: 106.8248, zoom: 16 },
  // Ngoài vùng có dữ liệu – để thể hiện thông báo "chưa thuộc khu vực có dữ liệu"
  { id: 'pl-90', name: 'Thành phố Thủ Dầu Một', context: 'Ngoài khu vực dự án', area: null, lat: 10.9804, lng: 106.6519, zoom: 14, outside: true },
  { id: 'pl-91', name: 'Long Thành', context: 'Ngoài khu vực dự án', area: null, lat: 10.7836, lng: 106.9505, zoom: 14, outside: true }
]

/** Lớp Thường ngập – dữ liệu lịch sử, không phải tình trạng hiện tại. */
export const HISTORY_POINTS = [
  { id: 'h-01', place: 'Đường Đồng Khởi gần ngã tư Tân Phong', area: 'Tân Phong', lat: 10.9705, lng: 106.8515, count: 14, period: '06/2025 – 10/2026', lastSeen: minutesAgo(60 * 24 * 26), source: 'Tổng hợp báo cáo cũ của dự án' },
  { id: 'h-02', place: 'Khu chợ Trảng Dài', area: 'Trảng Dài', lat: 10.9792, lng: 106.8655, count: 11, period: '06/2025 – 10/2026', lastSeen: minutesAgo(60 * 24 * 19), source: 'Tổng hợp báo cáo cũ của dự án' },
  { id: 'h-03', place: 'Đường Phạm Văn Thuận đoạn gần cầu', area: 'Trấn Biên', lat: 10.9522, lng: 106.8338, count: 7, period: '06/2025 – 10/2026', lastSeen: minutesAgo(60 * 24 * 41), source: 'Tổng hợp báo cáo cũ của dự án' },
  { id: 'h-04', place: 'Cổng 11 – hướng Quốc lộ 51', area: 'Cổng 11', lat: 10.9325, lng: 106.8775, count: 9, period: '06/2025 – 10/2026', lastSeen: minutesAgo(60 * 24 * 12), source: 'Tổng hợp báo cáo cũ của dự án' }
]

/**
 * Vùng nguy cơ dự báo (Mô phỏng). Kịch bản mẫu chỉ dùng trong khu trình diễn.
 * Không vẽ vùng chi tiết giả khi chỉ có dữ liệu cấp khu vực.
 */
export const FORECAST_AREAS = [
  {
    id: 'fc-01',
    title: 'Dự báo nguy cơ ngập – Trảng Dài',
    area: 'Trảng Dài',
    level: 'moderate',
    issuedAt: minutesAgo(35),
    validFrom: minutesFromNow(6 * 60),
    validTo: minutesFromNow(12 * 60),
    rain: { amount: '40–60 mm', window: '6 giờ', probability: 80 },
    basis: ['Lượng mưa dự báo từ nguồn thời tiết mẫu', 'Số lần ghi nhận ngập trước đây ở khu vực', 'Quy tắc nguy cơ mẫu của dự án'],
    ruleVersion: 'Quy tắc mẫu v0.1',
    dataMode: 'demo',
    polygon: [[10.9858, 106.8578], [10.9861, 106.8745], [10.9712, 106.8768], [10.9688, 106.8596]]
  },
  {
    id: 'fc-02',
    title: 'Dự báo nguy cơ ngập – Tân Phong',
    area: 'Tân Phong',
    level: 'light',
    issuedAt: minutesAgo(35),
    validFrom: minutesFromNow(6 * 60),
    validTo: minutesFromNow(12 * 60),
    rain: { amount: '20–35 mm', window: '6 giờ', probability: 65 },
    basis: ['Lượng mưa dự báo từ nguồn thời tiết mẫu', 'Số lần ghi nhận ngập trước đây ở khu vực', 'Quy tắc nguy cơ mẫu của dự án'],
    ruleVersion: 'Quy tắc mẫu v0.1',
    dataMode: 'demo',
    polygon: [[10.9772, 106.8452], [10.9776, 106.8566], [10.9654, 106.8571], [10.9649, 106.8458]]
  }
]

/** Mưa theo giờ cho phần dự báo (đơn vị mm/giờ; xác suất mưa %). Không phải xác suất ngập. */
export function rainHourly(seed = 1) {
  return Array.from({ length: 12 }, (_, i) => {
    const base = [0.4, 0.8, 1.6, 3.2, 6.5, 11.2, 14.8, 12.1, 8.4, 5.1, 2.3, 1.0][i]
    return {
      at: minutesFromNow((i + 1) * 60),
      mm: Math.round(base * seed * 10) / 10,
      probability: Math.min(95, Math.round(35 + base * 4 * seed))
    }
  })
}

/**
 * Đường bị ảnh hưởng. Chỉ vẽ đoạn có hình học xác nhận;
 * mục chỉ có điểm thì ghi "Điểm ngập tại đường X", không vẽ cả tuyến.
 */
export const AFFECTED_ROADS = [
  {
    id: 'rd-01',
    name: 'Đường Đồng Khởi',
    from: 'Ngã tư Tân Phong',
    to: 'Cầu vượt Tam Hiệp hướng nam',
    severity: 'severe',
    source: 'Báo cáo người dân đã xác minh',
    observedAt: minutesAgo(38),
    hasGeometry: true,
    dataMode: 'demo',
    reportId: 'BC-2611-0101',
    line: [[10.9718, 106.8508], [10.9676, 106.8519], [10.9631, 106.8534], [10.9590, 106.8551]]
  },
  {
    id: 'rd-02',
    name: 'Đường Nguyễn Khuyến',
    from: 'Chợ Trảng Dài',
    to: 'Hẻm 120',
    severity: 'moderate',
    source: 'Báo cáo người dân đã xác minh',
    observedAt: minutesAgo(75),
    hasGeometry: true,
    dataMode: 'demo',
    reportId: 'BC-2611-0102',
    line: [[10.9786, 106.8662], [10.9765, 106.8681], [10.9741, 106.8705]]
  },
  {
    id: 'rd-03',
    name: 'Đường Phạm Văn Thuận',
    from: null,
    to: null,
    severity: 'light',
    source: 'Báo cáo người dân',
    observedAt: minutesAgo(140),
    hasGeometry: false,
    dataMode: 'demo',
    reportId: 'BC-2611-0104',
    lat: 10.9516,
    lng: 106.8352
  }
]

/** Nguồn dữ liệu – nhãn Thật / Mẫu / Chưa kết nối (mục 11.3). */
export const DATA_SOURCES = [
  { id: 'src-01', name: 'Báo cáo người dân qua website', area: 'Biên Hòa (khu trình diễn)', status: 'connected', mode: 'demo', lastReceived: minutesAgo(12), note: 'Dữ liệu mẫu do nhóm tạo cho bản trình diễn' },
  { id: 'src-02', name: 'Mô hình AI phân tích ảnh', area: 'Toàn bộ khu trình diễn', status: 'connected', mode: 'demo', lastReceived: minutesAgo(12), note: 'Kết quả AI hiện là mô phỏng, chưa nối mô hình thật' },
  { id: 'src-03', name: 'Thông tin thời tiết (lượng mưa)', area: 'Biên Hòa', status: 'stale', mode: 'sample', lastReceived: minutesAgo(60 * 7), note: 'Số liệu mẫu, chưa có cập nhật mới' },
  { id: 'src-04', name: 'Quy tắc nguy cơ ngập', area: 'Trảng Dài, Tân Phong', status: 'connected', mode: 'demo', lastReceived: minutesAgo(35), note: 'Kịch bản nguy cơ mẫu' },
  { id: 'src-05', name: 'Trạm đo mực nước', area: '—', status: 'offline', mode: 'offline', lastReceived: null, note: 'Chưa có nguồn được phép sử dụng' },
  { id: 'src-06', name: 'Dữ liệu triều cường', area: '—', status: 'offline', mode: 'offline', lastReceived: null, note: 'Chưa kết nối' },
  { id: 'src-07', name: 'Ảnh vệ tinh', area: '—', status: 'offline', mode: 'offline', lastReceived: null, note: 'Chưa kết nối' }
]
