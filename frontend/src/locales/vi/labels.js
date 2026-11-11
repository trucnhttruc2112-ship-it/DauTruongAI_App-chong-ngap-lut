// Nội dung tiếng Việt dùng chung. Tách mức ngập, xác minh, xử lý, tình trạng ngập
// và công khai thành các nhóm độc lập (mục 4.1, mục 8) – không dùng một trường status chung.

export const APP_NAME = 'Bản đồ ngập'
export const APP_DESCRIPTION = 'Phát hiện và cảnh báo ngập lụt AI'
export const DEFAULT_AREA_NAME = 'Biên Hòa, Đồng Nai'

export const SEVERITY = {
  light: 'Ngập nhẹ',
  moderate: 'Ngập vừa',
  severe: 'Ngập nặng',
  unknown: 'Chưa xác định'
}
export const SEVERITY_SHORT = { light: 'Nhẹ', moderate: 'Vừa', severe: 'Nặng', unknown: 'Chưa xác định' }
export const SEVERITY_ORDER = ['severe', 'moderate', 'light', 'unknown']

export const VERIFICATION = {
  unchecked: 'Chưa kiểm tra',
  checking: 'Đang kiểm tra',
  verified: 'Đã xác minh',
  insufficient: 'Không đủ căn cứ',
  invalid: 'Không hợp lệ'
}

export const PROCESSING = {
  submitted: 'Đã gửi',
  received: 'Đã tiếp nhận',
  'needs-info': 'Cần bổ sung',
  'in-progress': 'Đang xử lý',
  closed: 'Đã đóng'
}

export const FLOOD_CONDITION = {
  active: 'Đang ghi nhận ngập',
  'reported-clear': 'Có thông tin hết ngập',
  'confirmed-clear': 'Đã xác nhận hết ngập',
  'no-update': 'Chưa có cập nhật mới'
}

export const PUBLICATION = {
  pending: 'Chờ kiểm tra',
  public: 'Công khai',
  private: 'Không công khai',
  hidden: 'Đã ẩn'
}

export const AI_RESULT = {
  flood: 'Có dấu hiệu ngập',
  'no-sign': 'Không thấy dấu hiệu rõ',
  insufficient: 'Không đủ thông tin'
}

export const PHOTO_SOURCE = {
  camera: 'Chụp trực tiếp trong website',
  library: 'Ảnh có sẵn trên thiết bị'
}

export const LOCATION_SOURCE = {
  gps: 'Vị trí từ GPS thiết bị',
  manual: 'Vị trí do người gửi chọn'
}

export const DATA_MODE = {
  demo: 'Mô phỏng',
  sample: 'Mẫu',
  live: 'Thật',
  offline: 'Chưa kết nối'
}

export const TIME_FILTER = {
  '6h': '6 giờ gần nhất',
  '24h': '24 giờ gần nhất',
  '7d': '7 ngày gần nhất',
  all: 'Tất cả thời gian'
}
