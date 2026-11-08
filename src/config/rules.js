/**
 * Toàn bộ hằng số và quy tắc nghiệp vụ của hệ thống NV4.
 * Mọi giá trị được đóng băng (freeze) để tránh bị thay đổi trong quá trình chạy.
 * Có chú thích tiếng Việt cho từng mục theo quy định tại AGENTS.md.
 */

export const RULES = Object.freeze({
  // --- Quy tắc gộp báo cáo trùng ---
  // Bán kính xác định 2 báo cáo thuộc cùng 1 điểm ngập (mét)
  DUPLICATE_RADIUS_M: 50,
  // Cửa sổ thời gian tính từ lần cập nhật gần nhất để gộp báo cáo (giờ)
  DUPLICATE_WINDOW_HOURS: 6,

  // --- Kiểm tra GPS và thời gian gửi ---
  // Sai số GPS tối đa cho phép chấp nhận báo cáo (mét)
  GPS_MAX_ACCURACY_M: 100,
  // Ngưỡng cảnh báo GPS có độ chính xác thấp (mét)
  GPS_WARNING_ACCURACY_M: 50,
  // Thời gian tối đa kể từ lúc chụp ảnh đến lúc gửi báo cáo (phút)
  REPORT_MAX_AGE_MINUTES: 5,
  // Cho phép sai lệch thời gian tương lai tối đa (phút) do lệch đồng hồ
  REPORT_FUTURE_TOLERANCE_MINUTES: 1,

  // --- Phạm vi địa lý Đồng Nai (Bounding Box giai đoạn đầu) ---
  DONG_NAI_BBOX: Object.freeze({
    minLat: 10.35,
    maxLat: 11.60,
    minLng: 106.75,
    maxLng: 107.60,
  }),

  // --- Ngưỡng đánh giá AI (NV3) ---
  // Độ tin cậy tối thiểu của AI để đưa thẳng điểm ngập vào trạng thái 'active'
  AI_MIN_CONFIDENCE_ACTIVE: 0.6,

  // --- Vòng đời điểm ngập ---
  // Thời gian tự động hết hạn nếu không có xác nhận mới (giờ)
  EXPIRE_AFTER_HOURS: 6,
  // Chu kỳ quét hết hạn của background job (phút)
  EXPIRE_JOB_INTERVAL_MINUTES: 5,
  // Số thiết bị khác nhau xác nhận 'ended' để chuyển sang 'resolved'
  ENDED_CONFIRMATIONS_TO_RESOLVE: 2,
  // Khoảng cách tối đa từ vị trí người xác nhận đến điểm ngập (mét)
  CONFIRM_MAX_DISTANCE_M: 300,
  // Số thiết bị khác nhau báo cùng điểm để nâng từ 'pending' lên 'active'
  PENDING_REPORTS_TO_PROMOTE: 2,

  // --- Tuyến đường hay ngập (Flood-prone) ---
  // Số sự kiện ngập tối thiểu trong khoảng thời gian để xem là "hay ngập"
  FLOOD_PRONE_MIN_EVENTS: 3,
  // Cửa sổ tính sự kiện hay ngập (ngày)
  FLOOD_PRONE_WINDOW_DAYS: 365,
  // Bán kính cụm gom điểm nếu không trùng tên đường (mét)
  FLOOD_PRONE_CLUSTER_RADIUS_M: 100,

  // --- Giới hạn tần suất (Rate Limiting) ---
  // Số báo cáo tối đa trong 1 giờ cho 1 deviceId
  RATE_LIMIT_REPORTS_PER_HOUR: 5,
  // Số request tối đa trong 1 phút cho 1 IP
  RATE_LIMIT_REQUESTS_PER_MINUTE: 20,

  // --- Xử lý ảnh ---
  // Dung lượng file ảnh upload tối đa (8MB)
  MAX_UPLOAD_FILE_SIZE_BYTES: 8 * 1024 * 1024,
  // Chiều dài cạnh tối đa khi nén ảnh (pixel)
  IMAGE_MAX_DIMENSION: 1280,
  // Chất lượng nén ảnh JPEG (1-100)
  IMAGE_JPEG_QUALITY: 80,
  // Khoảng cách Hamming tối đa để coi là ảnh gần trùng (dHash)
  SIMILAR_IMAGE_MAX_HAMMING: 5,
  // Cửa sổ thời gian so sánh ảnh gần trùng (giờ)
  SIMILAR_IMAGE_WINDOW_HOURS: 24,

  // --- Trạng thái và mức độ hợp lệ ---
  STATUSES: Object.freeze(['pending', 'active', 'resolved', 'expired', 'rejected']),
  SEVERITIES: Object.freeze(['low', 'medium', 'high']),
  SOURCES: Object.freeze(['camera', 'gallery', 'manual-pin']),
});

export default RULES;
