/**
 * Quản lý định vị GPS qua Geolocation API của trình duyệt.
 * Hỗ trợ hiển thị hướng dẫn bật quyền trên Android / iOS bằng tiếng Việt.
 */

/**
 * Phân tích đối tượng GeolocationPositionError và trả về thông báo tiếng Việt chi tiết.
 * Hàm thuần, test được không cần trình duyệt.
 * @param {GeolocationPositionError | { code: number, message?: string }} err
 * @returns {{ code: string, message: string, detail: string }}
 */
export function formatGeoError(err) {
  if (!err) {
    return {
      code: 'GEO_UNKNOWN',
      message: 'Không thể xác định vị trí.',
      detail: 'Vui lòng kiểm tra lại thiết lập GPS.',
    };
  }

  const code = err.code;
  switch (code) {
    case 1: // PERMISSION_DENIED
      return {
        code: 'GEO_PERMISSION_DENIED',
        message: 'Bạn đã từ chối quyền truy cập vị trí.',
        detail:
          'Để bật lại:\n' +
          '• Trên Android: Nhấn vào biểu tượng ổ khóa bên cạnh thanh địa chỉ web → Quyền trang web → Vị trí → Cho phép.\n' +
          '• Trên iPhone (iOS): Vào Cài đặt → Quyền riêng tư & Bảo mật → Dịch vụ định vị → Safari → Chọn "Khi dùng ứng dụng".',
      };
    case 2: // POSITION_UNAVAILABLE
      return {
        code: 'GEO_POSITION_UNAVAILABLE',
        message: 'Tín hiệu GPS không khả dụng hoặc quá yếu.',
        detail: 'Vui lòng kiểm tra xem bạn đã bật GPS/Vị trí trên máy chưa, hoặc di chuyển ra khu vực thông thoáng hơn.',
      };
    case 3: // TIMEOUT
      return {
        code: 'GEO_TIMEOUT',
        message: 'Quá thời gian chờ phản hồi GPS (10 giây).',
        detail: 'Đường truyền hoặc kết nối vệ tinh chập chờn. Bạn có thể nhấn Thử lại hoặc chọn Ghim vị trí thủ công.',
      };
    default:
      return {
        code: 'GEO_ERROR',
        message: err.message || 'Lỗi định vị vị trí không xác định.',
        detail: 'Vui lòng thử lại hoặc ghim vị trí thủ công trên bản đồ.',
      };
  }
}

/**
 * Lấy tọa độ GPS hiện tại từ trình duyệt
 * @param {PositionOptions} [options]
 * @returns {Promise<{ lat: number, lng: number, accuracyM: number, timestamp: number }>}
 */
export function getPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const err = new Error('Trình duyệt của bạn không hỗ trợ định vị Geolocation.');
      err.code = 'GEO_UNSUPPORTED';
      return reject(err);
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      ...options,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(7)),
          lng: Number(pos.coords.longitude.toFixed(7)),
          accuracyM: Math.round(pos.coords.accuracy || 0),
          timestamp: pos.timestamp || Date.now(),
        });
      },
      (err) => {
        const formatted = formatGeoError(err);
        const error = new Error(formatted.message);
        error.code = formatted.code;
        error.detail = formatted.detail;
        error.rawCode = err.code;
        reject(error);
      },
      defaultOptions
    );
  });
}
