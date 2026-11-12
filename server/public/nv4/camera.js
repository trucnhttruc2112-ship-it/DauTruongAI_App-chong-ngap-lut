/**
 * Quản lý camera và xử lý nén ảnh phía Client cho module NV4.
 * Ưu tiên input type="file" capture="environment" cho độ ổn định cao nhất trên mobile.
 * Hỗ trợ getUserMedia trực tiếp và nén ảnh canvas JPEG <= 1600px q0.85.
 */

/**
 * Kiểm tra xem môi trường hiện tại có an toàn (HTTPS hoặc localhost) không.
 * @param {Window} [win]
 * @returns {boolean}
 */
export function checkSecureContext(win) {
  const targetWin = win || (typeof window !== 'undefined' ? window : null);
  if (!targetWin) return false;
  if (targetWin.isSecureContext === true) {
    return true;
  }
  // Fallback kiểm tra hostname hoặc protocol
  const host = targetWin.location?.hostname || '';
  const proto = targetWin.location?.protocol || '';
  return host === 'localhost' || host === '127.0.0.1' || proto === 'https:';
}

/**
 * Tính toán kích thước mới sao cho cạnh dài nhất <= maxDim và giữ đúng tỷ lệ khung hình.
 * Hàm thuần (pure function) để test độc lập.
 * @param {number} width
 * @param {number} height
 * @param {number} [maxDim=1600]
 * @returns {{ width: number, height: number, scaled: boolean }}
 */
export function calculateScaledDimensions(width, height, maxDim = 1600) {
  if (!width || !height || width <= 0 || height <= 0) {
    return { width: 0, height: 0, scaled: false };
  }

  const maxOriginal = Math.max(width, height);
  if (maxOriginal <= maxDim) {
    return { width: Math.round(width), height: Math.round(height), scaled: false };
  }

  const scale = maxDim / maxOriginal;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    scaled: true,
  };
}

/**
 * Nén và đổi định dạng ảnh sang JPEG bằng Canvas ở client.
 * Giới hạn cạnh dài <= 1600px, chất lượng q ≈ 0.85 để đảm bảo nhẹ và dưới giới hạn 8MB.
 * Bắt lỗi định dạng không hỗ trợ (HEIC, corrupt) và báo tiếng Việt.
 * @param {File | Blob} file
 * @param {number} [maxDim=1600]
 * @param {number} [quality=0.85]
 * @returns {Promise<{ blob: Blob, file: File, width: number, height: number }>}
 */
export async function compressImage(file, maxDim = 1600, quality = 0.85) {
  if (!file) {
    throw new Error('Chưa chọn ảnh nào để xử lý.');
  }

  return new Promise((resolve, reject) => {
    // Kiểm tra định dạng đuôi file nếu là HEIC/HEIF
    const fileName = (file.name || '').toLowerCase();
    if (fileName.endsWith('.heic') || fileName.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
      const err = new Error('Định dạng ảnh HEIC không được trình duyệt hỗ trợ trực tiếp. Vui lòng chọn chụp trực tiếp từ máy ảnh.');
      err.code = 'UNSUPPORTED_HEIC';
      return reject(err);
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const { width: targetWidth, height: targetHeight } = calculateScaledDimensions(img.naturalWidth, img.naturalHeight, maxDim);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          return reject(new Error('Không thể khởi tạo môi trường đồ họa Canvas của trình duyệt.'));
        }

        // Vẽ ảnh lên canvas (tự động điều chỉnh kích thước)
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        URL.revokeObjectURL(objectUrl);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Lỗi xuất dữ liệu nén ảnh sang JPEG.'));
            }

            const processedFile = new File([blob], 'report_image.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve({
              blob,
              file: processedFile,
              width: targetWidth,
              height: targetHeight,
            });
          },
          'image/jpeg',
          quality
        );
      } catch (drawErr) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Lỗi khi nén và xử lý khung hình: ' + drawErr.message));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const err = new Error('Không thể giải mã định dạng ảnh (ví dụ định dạng HEIC hoặc tệp bị hỏng). Vui lòng chọn chụp trực tiếp từ máy ảnh.');
      err.code = 'IMAGE_DECODE_FAILED';
      reject(err);
    };

    img.src = objectUrl;
  });
}

/**
 * Trình điều khiển getUserMedia cho camera sau (facingMode: environment)
 */
export class LiveCamera {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.stream = null;
  }

  /**
   * Bắt đầu luồng camera
   */
  async start() {
    if (!checkSecureContext()) {
      const err = new Error('Camera yêu cầu kết nối bảo mật HTTPS hoặc truy cập từ localhost.');
      err.code = 'INSECURE_CONTEXT';
      throw err;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error('Trình duyệt không hỗ trợ truy cập máy ảnh trực tiếp qua getUserMedia.');
      err.code = 'GETUSERMEDIA_UNSUPPORTED';
      throw err;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
      }
      return this.stream;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        const error = new Error('Bạn đã từ chối quyền truy cập máy ảnh.');
        error.code = 'CAMERA_PERMISSION_DENIED';
        throw error;
      }
      throw err;
    }
  }

  /**
   * Dừng luồng camera
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  /**
   * Chụp khung hình hiện tại từ video
   * @returns {Promise<Blob>}
   */
  async captureSnapshot() {
    if (!this.videoElement || this.videoElement.videoWidth === 0) {
      throw new Error('Camera chưa sẵn sàng hoặc chưa nhận được khung hình.');
    }

    const width = this.videoElement.videoWidth;
    const height = this.videoElement.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0, width, height);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Không thể xuất ảnh từ video snapshot.'));
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  }
}
