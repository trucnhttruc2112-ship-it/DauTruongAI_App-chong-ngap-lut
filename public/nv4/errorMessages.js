/**
 * Chuyển đổi mã lỗi hệ thống sang thông điệp tiếng Việt thân thiện với người dùng.
 * Hàm thuần (pure function) để dễ dàng kiểm thử độc lập.
 */

export function getFriendlyErrorMessage(err) {
  if (!err) {
    return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
  }

  // Trường hợp truyền vào chuỗi mã lỗi trực tiếp hoặc object lỗi
  const code = (typeof err === 'string' ? err : err.code || err.status || '').toString().toUpperCase();
  const details = typeof err === 'object' ? err : {};

  switch (code) {
    case 'OUT_OF_AREA':
      return 'Vị trí này nằm ngoài địa bàn tỉnh Đồng Nai được hỗ trợ báo cáo ngập.';

    case 'GPS_TOO_INACCURATE':
      return 'Độ chính xác định vị GPS quá thấp (sai số > 100m). Vui lòng di chuyển ra nơi thông thoáng hơn và thử lại.';

    case 'REPORT_TOO_OLD':
      return 'Thời gian chụp ảnh đã quá cũ (vượt quá 30 phút). Vui lòng chụp ảnh hiện trường mới nhất.';

    case 'DUPLICATE_IMAGE':
      return 'Ảnh này trùng lặp với một báo cáo gần đây trên hệ thống. Vui lòng chụp ảnh trực tiếp tại hiện trường.';

    case 'RATE_LIMITED':
    case 'TOO_MANY_REQUESTS':
    case '429': {
      const waitMin = details.retryAfterMinutes || details.retryAfter || '';
      if (waitMin) {
        return `Bạn đã gửi quá nhiều yêu cầu. Vui lòng đợi khoảng ${waitMin} phút trước khi thử lại.`;
      }
      return 'Bạn thao tác quá nhanh hoặc vượt quá số lượt cho phép. Vui lòng chờ ít phút và thử lại.';
    }

    case 'CONFLICT':
    case '409':
      return details.message || 'Xác nhận của bạn bị trùng hoặc điểm ngập đã chuyển trạng thái.';

    case 'UNPROCESSABLE_ENTITY':
    case 'VALIDATION_ERROR':
    case '422':
      return details.message || 'Dữ liệu gửi lên không đúng định dạng hoặc không hợp lệ. Vui lòng kiểm tra lại.';

    case 'POINT_NOT_FOUND':
    case '404':
      return 'Không tìm thấy điểm ngập được yêu cầu hoặc điểm đã được xóa.';

    case 'POINT_INACTIVE':
      return 'Điểm ngập này đã kết thúc hoặc không còn tiếp nhận xác nhận.';

    case 'GPS_OUT_OF_RANGE':
      return 'Vị trí hiện tại của bạn cách điểm ngập quá xa (vượt quá 300m) để có thể xác nhận.';

    case 'NETWORK_ERROR':
    case 'FETCH_FAILED':
      return 'Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối mạng (4G/Wi-Fi) và thử lại.';

    case 'SECURE_CONTEXT_REQUIRED':
      return 'Trình duyệt yêu cầu kết nối bảo mật HTTPS để mở máy ảnh và định vị GPS. Vui lòng truy cập qua HTTPS hoặc localhost.';

    default:
      if (details.message && typeof details.message === 'string') {
        return details.message;
      }
      return 'Đã xảy ra lỗi trong quá trình xử lý. Vui lòng thử lại sau.';
  }
}
