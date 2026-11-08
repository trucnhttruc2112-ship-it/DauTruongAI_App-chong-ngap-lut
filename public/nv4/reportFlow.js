/**
 * Điều khiển toàn bộ luồng báo cáo ngập lụt phía Client:
 * 1. Lấy tọa độ GPS (hoặc ghim thủ công)
 * 2. Chụp/chọn ảnh hiện trường & nén ở client
 * 3. Xem lại ảnh & nhập ghi chú
 * 4. Gửi báo cáo tới POST /api/reports
 * 5. Hiển thị kết quả an toàn (textContent, không dùng innerHTML)
 */

import { getDeviceId } from './deviceId.js';
import { getPosition } from './geo.js';
import { compressImage, checkSecureContext } from './camera.js';
import { getFriendlyErrorMessage } from './errorMessages.js';

export class ReportFlow {
  /**
   * @param {Object} options
   * @param {string} [options.apiBase=''] - URL gốc của API (VD: 'http://localhost:3000' hoặc '')
   * @param {HTMLElement | string} options.mount - Phần tử DOM để gắn component
   * @param {Function} [options.onSuccess] - Callback khi gửi báo cáo thành công
   * @param {Function} [options.onError] - Callback khi có lỗi
   * @param {Function} [options.onRequestManualPin] - Callback yêu cầu người dùng chấm điểm trên bản đồ ({lat, lng})
   */
  constructor({ apiBase = '', mount, onSuccess, onError, onRequestManualPin }) {
    this.apiBase = apiBase.replace(/\/+$/, '');
    this.mount = typeof mount === 'string' ? document.querySelector(mount) : mount;
    this.onSuccess = onSuccess || (() => {});
    this.onError = onError || (() => {});
    this.onRequestManualPin = onRequestManualPin || null;

    if (!this.mount) {
      throw new Error('[NV4 ReportFlow] Phần tử gắn giao diện (mount) không tồn tại.');
    }

    // State
    this.step = 1; // 1: GPS, 2: Chụp ảnh, 3: Xem lại & ghi chú, 4: Đang gửi, 5: Hoàn tất
    this.coords = null; // { lat, lng, accuracyM, source: 'gps' | 'manual-pin' }
    this.compressedFile = null;
    this.previewUrl = null;
    this.note = '';
    this.error = null;
    this.isSubmitting = false;
    this.resultData = null;

    this.render();
  }

  /**
   * Chuyển bước và vẽ lại giao diện
   */
  setStep(step) {
    this.step = step;
    this.error = null;
    this.render();
  }

  /**
   * Hủy bỏ và đặt lại luồng
   */
  reset() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.step = 1;
    this.coords = null;
    this.compressedFile = null;
    this.note = '';
    this.error = null;
    this.isSubmitting = false;
    this.resultData = null;
    this.render();
  }

  /**
   * Bước 1: Yêu cầu lấy tọa độ GPS
   */
  async handleGetGps() {
    this.error = null;
    this.render();

    try {
      const pos = await getPosition();
      this.coords = {
        lat: pos.lat,
        lng: pos.lng,
        accuracyM: pos.accuracyM,
        source: 'gps',
      };
      this.setStep(2);
    } catch (err) {
      this.error = {
        code: err.code || 'GEO_ERROR',
        message: err.message,
        detail: err.detail || '',
      };
      this.render();
    }
  }

  /**
   * Cho phép người dùng ghim vị trí thủ công nếu GPS bị lỗi/từ chối
   */
  async handleManualPin() {
    if (typeof this.onRequestManualPin !== 'function') {
      this.error = {
        code: 'NO_MANUAL_PIN_HANDLER',
        message: 'Tính năng ghim vị trí thủ công chưa được cấu hình.',
      };
      this.render();
      return;
    }

    try {
      const pinResult = await this.onRequestManualPin();
      if (!pinResult || typeof pinResult.lat !== 'number' || typeof pinResult.lng !== 'number') {
        throw new Error('Chưa nhận được tọa độ ghim hợp lệ.');
      }

      this.coords = {
        lat: Number(pinResult.lat.toFixed(7)),
        lng: Number(pinResult.lng.toFixed(7)),
        accuracyM: null,
        source: 'manual-pin',
      };
      this.setStep(2);
    } catch (err) {
      this.error = {
        code: 'MANUAL_PIN_ERROR',
        message: err.message || 'Lỗi khi ghim vị trí thủ công.',
      };
      this.render();
    }
  }

  /**
   * Bước 2: Xử lý tệp ảnh được chọn/chụp
   */
  async handleFileSelected(file) {
    if (!file) return;

    this.error = null;
    this.render();

    try {
      const { file: compressedFile, blob } = await compressImage(file, 1600, 0.85);
      this.compressedFile = compressedFile;

      if (this.previewUrl) {
        URL.revokeObjectURL(this.previewUrl);
      }
      this.previewUrl = URL.createObjectURL(blob);
      this.setStep(3);
    } catch (err) {
      this.error = {
        code: err.code || 'IMAGE_COMPRESS_ERROR',
        message: getFriendlyErrorMessage(err),
      };
      this.render();
    }
  }

  /**
   * Bước 4: Gửi báo cáo ngập lên máy chủ (POST /api/reports)
   */
  async handleSubmitReport() {
    if (this.isSubmitting) return;

    if (!this.coords || !this.compressedFile) {
      this.error = { message: 'Thiếu thông tin vị trí hoặc ảnh hiện trường.' };
      this.render();
      return;
    }

    this.isSubmitting = true;
    this.error = null;
    this.render();

    const deviceId = getDeviceId();
    const formData = new FormData();
    formData.append('image', this.compressedFile);
    formData.append('lat', String(this.coords.lat));
    formData.append('lng', String(this.coords.lng));
    if (this.coords.accuracyM !== null && this.coords.accuracyM !== undefined) {
      formData.append('accuracyM', String(this.coords.accuracyM));
    }
    formData.append('capturedAt', new Date().toISOString());
    if (this.note && this.note.trim()) {
      formData.append('note', this.note.trim());
    }
    formData.append('deviceId', deviceId);
    formData.append('source', this.coords.source || 'gps');

    try {
      const response = await fetch(`${this.apiBase}/api/reports`, {
        method: 'POST',
        body: formData,
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json.ok) {
        const errObj = json.error || {
          code: response.status === 429 ? 'RATE_LIMITED' : String(response.status),
          message: json.message || response.statusText,
        };
        const error = new Error(getFriendlyErrorMessage(errObj));
        error.code = errObj.code;
        error.details = errObj;
        throw error;
      }

      this.isSubmitting = false;
      this.resultData = json.data;
      this.setStep(5);
      this.onSuccess(json.data);
    } catch (err) {
      this.isSubmitting = false;
      this.error = {
        code: err.code || 'SUBMIT_ERROR',
        message: getFriendlyErrorMessage(err),
      };
      this.onError(err);
      this.render();
    }
  }

  /**
   * Tạo phần tử an toàn (sử dụng textContent)
   */
  createEl(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
  }

  /**
   * Vẽ giao diện hoàn chỉnh bằng DOM API chuẩn (ngăn chặn XSS)
   */
  render() {
    this.mount.innerHTML = ''; // Làm sạch container

    const container = this.createEl('div', 'nv4-container');

    // Header
    const header = this.createEl('div', 'nv4-header');
    const title = this.createEl('h3', 'nv4-title', 'Báo Cáo Điểm Ngập Lụt');
    header.appendChild(title);

    // Steps indicator
    const stepsBar = this.createEl('div', 'nv4-steps');
    const stepNames = ['1. Vị trí', '2. Chụp ảnh', '3. Xác nhận', '4. Kết quả'];
    const currentActiveIndex = Math.min(this.step - 1, 3);

    stepNames.forEach((name, idx) => {
      const stepItem = this.createEl('span', `nv4-step-item ${idx === currentActiveIndex ? 'active' : ''}`, name);
      stepsBar.appendChild(stepItem);
    });
    header.appendChild(stepsBar);
    container.appendChild(header);

    // Hiển thị Cảnh báo nếu không có HTTPS
    if (!checkSecureContext() && typeof window !== 'undefined' && window.location?.protocol !== 'https:') {
      const secureNotice = this.createEl(
        'div',
        'nv4-alert nv4-alert-warning',
        'Lưu ý: Bạn đang không dùng kết nối bảo mật HTTPS. Một số trình duyệt có thể hạn chế quyền GPS hoặc camera.'
      );
      container.appendChild(secureNotice);
    }

    // Hiển thị Lỗi nếu có
    if (this.error) {
      const alertBox = this.createEl('div', 'nv4-alert nv4-alert-danger');
      const errTitle = this.createEl('strong', '', this.error.message || 'Đã xảy ra lỗi.');
      alertBox.appendChild(errTitle);

      if (this.error.detail) {
        const detailP = this.createEl('p', '', this.error.detail);
        detailP.style.whiteSpace = 'pre-line';
        detailP.style.marginTop = '6px';
        alertBox.appendChild(detailP);
      }
      container.appendChild(alertBox);
    }

    // Body theo từng bước
    const body = this.createEl('div', 'nv4-step-body');

    if (this.step === 1) {
      this.renderStep1(body);
    } else if (this.step === 2) {
      this.renderStep2(body);
    } else if (this.step === 3) {
      this.renderStep3(body);
    } else if (this.step === 5) {
      this.renderStep5(body);
    }

    container.appendChild(body);
    this.mount.appendChild(container);
  }

  /**
   * Render Bước 1: Lấy GPS
   */
  renderStep1(body) {
    const desc = this.createEl('p', '', 'Hệ thống cần xác định vị trí của bạn để định vị điểm ngập chính xác.');
    desc.style.marginBottom = '16px';
    body.appendChild(desc);

    const btnGps = this.createEl('button', 'nv4-btn nv4-btn-primary', '📍 Lấy vị trí hiện tại (GPS)');
    btnGps.onclick = () => this.handleGetGps();
    body.appendChild(btnGps);

    if (this.onRequestManualPin) {
      const orText = this.createEl('p', '', 'hoặc');
      orText.style.textAlign = 'center';
      orText.style.margin = '10px 0';
      body.appendChild(orText);

      const btnPin = this.createEl('button', 'nv4-btn nv4-btn-outline', '📌 Ghim vị trí thủ công trên bản đồ');
      btnPin.onclick = () => this.handleManualPin();
      body.appendChild(btnPin);
    }
  }

  /**
   * Render Bước 2: Chụp/Chọn ảnh
   */
  renderStep2(body) {
    // Hiển thị tọa độ đã nhận
    const locCard = this.createEl('div', 'nv4-location-card');
    const locText = this.createEl(
      'div',
      '',
      `Vị trí: ${this.coords.lat}, ${this.coords.lng} (${
        this.coords.source === 'manual-pin' ? 'Ghim thủ công' : `GPS sai số ~${this.coords.accuracyM || 0}m`
      })`
    );
    locCard.appendChild(locText);
    body.appendChild(locCard);

    const promptText = this.createEl('p', '', 'Vui lòng chụp ảnh hoặc chọn ảnh rõ ràng mực nước ngập tại hiện trường:');
    promptText.style.marginBottom = '12px';
    body.appendChild(promptText);

    // Input file ẩn ưu tiên camera sau
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.setAttribute('capture', 'environment');
    fileInput.style.display = 'none';
    fileInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) this.handleFileSelected(file);
    };
    body.appendChild(fileInput);

    const btnCapture = this.createEl('button', 'nv4-btn nv4-btn-primary', '📷 Mở máy ảnh chụp hiện trường');
    btnCapture.onclick = () => fileInput.click();
    body.appendChild(btnCapture);

    const btnBack = this.createEl('button', 'nv4-btn nv4-btn-outline', 'Quay lại chọn vị trí');
    btnBack.style.marginTop = '10px';
    btnBack.onclick = () => this.setStep(1);
    body.appendChild(btnBack);
  }

  /**
   * Render Bước 3: Xem lại ảnh & nhập ghi chú
   */
  renderStep3(body) {
    const previewBox = this.createEl('div', 'nv4-image-preview-box');
    const img = document.createElement('img');
    img.src = this.previewUrl;
    img.alt = 'Ảnh hiện trường đã chọn';
    previewBox.appendChild(img);
    body.appendChild(previewBox);

    const noteLabel = this.createEl('label', '', 'Ghi chú thêm (độ sâu ước lượng, phương tiện lưu thông...):');
    noteLabel.style.display = 'block';
    noteLabel.style.marginBottom = '6px';
    noteLabel.style.fontSize = '0.9rem';
    body.appendChild(noteLabel);

    const textarea = this.createEl('textarea', 'nv4-textarea');
    textarea.placeholder = 'Ví dụ: Nước ngập nửa bánh xe máy, xe gầm thấp không qua được...';
    textarea.value = this.note;
    textarea.oninput = (e) => {
      this.note = e.target.value;
    };
    body.appendChild(textarea);

    const btnGroup = this.createEl('div', 'nv4-btn-group');

    const btnRetake = this.createEl('button', 'nv4-btn nv4-btn-outline', 'Chụp lại');
    btnRetake.disabled = this.isSubmitting;
    btnRetake.onclick = () => this.setStep(2);
    btnGroup.appendChild(btnRetake);

    const btnSubmit = this.createEl('button', 'nv4-btn nv4-btn-primary');
    btnSubmit.disabled = this.isSubmitting;
    if (this.isSubmitting) {
      const spinner = this.createEl('span', 'nv4-spinner');
      btnSubmit.appendChild(spinner);
      btnSubmit.appendChild(document.createTextNode(' Đang gửi...'));
    } else {
      btnSubmit.textContent = 'Gửi báo cáo ngập';
    }
    btnSubmit.onclick = () => this.handleSubmitReport();
    btnGroup.appendChild(btnSubmit);

    body.appendChild(btnGroup);
  }

  /**
   * Render Bước 5: Hiển thị kết quả an toàn bằng textContent
   */
  renderStep5(body) {
    const res = this.resultData;
    if (!res) return;

    const alertBox = this.createEl('div', 'nv4-alert nv4-alert-success');
    const heading = this.createEl('strong', '', 'Báo cáo đã được tiếp nhận thành công!');
    alertBox.appendChild(heading);
    body.appendChild(alertBox);

    const infoCard = this.createEl('div', 'nv4-location-card');

    // Phân loại: Điểm mới hay đã gộp vào điểm hiện có
    const typeRow = this.createEl('div');
    const typeLabel = this.createEl('span', 'nv4-badge ' + (res.isNewPoint ? 'nv4-badge-warning' : 'nv4-badge-success'));
    typeLabel.textContent = res.isNewPoint ? 'Điểm ngập mới ghi nhận' : 'Đã gộp vào điểm ngập hiện có';
    typeRow.appendChild(typeLabel);
    infoCard.appendChild(typeRow);

    // Trạng thái điểm ngập
    const statusRow = this.createEl('div', '', `Trạng thái: ${res.floodPoint?.status || 'Chờ xác thực'}`);
    statusRow.style.marginTop = '6px';
    infoCard.appendChild(statusRow);

    // Nhận định AI
    if (res.aiAnalysis) {
      const ai = res.aiAnalysis;
      const aiRow = this.createEl(
        'div',
        '',
        `AI nhận định: ${ai.isFlooded ? 'Có ngập nước' : 'Chưa rõ ngập'} (Độ sâu ước lượng: ${
          ai.waterLevelCm ? ai.waterLevelCm + ' cm' : 'Chưa xác định'
        }, độ tin cậy: ${Math.round((ai.confidence || 0) * 100)}%)`
      );
      aiRow.style.marginTop = '6px';
      infoCard.appendChild(aiRow);
    }

    body.appendChild(infoCard);

    const btnNew = this.createEl('button', 'nv4-btn nv4-btn-primary', 'Tạo báo cáo khác');
    btnNew.style.marginTop = '14px';
    btnNew.onclick = () => this.reset();
    body.appendChild(btnNew);
  }
}
