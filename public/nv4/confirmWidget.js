/**
 * Thành phần xác nhận tình trạng điểm ngập: "Vẫn ngập" / "Đã hết ngập".
 * Tự động lấy GPS người dùng khi bấm, gọi POST /api/flood-points/:id/confirm,
 * khóa nút sau khi gửi và hiển thị số lượng xác nhận hiện tại.
 */

import { getDeviceId } from './deviceId.js';
import { getPosition } from './geo.js';
import { getFriendlyErrorMessage } from './errorMessages.js';

export class ConfirmWidget {
  /**
   * @param {Object} options
   * @param {string} [options.apiBase='']
   * @param {string} options.floodPointId - ID điểm ngập
   * @param {number} [options.initialStill=0] - Số lượt xác nhận vẫn ngập ban đầu
   * @param {number} [options.initialEnded=0] - Số lượt xác nhận đã hết ngập ban đầu
   * @param {HTMLElement | string} options.mount - Phần tử gắn widget
   * @param {Function} [options.onConfirmed] - Callback khi xác nhận thành công
   */
  constructor({ apiBase = '', floodPointId, initialStill = 0, initialEnded = 0, mount, onConfirmed }) {
    this.apiBase = apiBase.replace(/\/+$/, '');
    this.floodPointId = floodPointId;
    this.stillCount = initialStill;
    this.endedCount = initialEnded;
    this.mount = typeof mount === 'string' ? document.querySelector(mount) : mount;
    this.onConfirmed = onConfirmed || (() => {});

    if (!this.mount) {
      throw new Error('[NV4 ConfirmWidget] Mount element không tồn tại.');
    }

    this.hasConfirmed = false;
    this.isSubmitting = false;
    this.errorMsg = null;
    this.successMsg = null;

    this.render();
  }

  async handleConfirm(type) {
    if (this.hasConfirmed || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMsg = null;
    this.successMsg = null;
    this.render();

    try {
      // 1. Lấy vị trí GPS hiện tại
      let pos;
      try {
        pos = await getPosition();
      } catch (geoErr) {
        throw new Error('Cần cấp quyền vị trí GPS để xác nhận điểm ngập: ' + geoErr.message);
      }

      // 2. Gửi yêu cầu xác nhận
      const deviceId = getDeviceId();
      const response = await fetch(`${this.apiBase}/api/flood-points/${this.floodPointId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          lat: pos.lat,
          lng: pos.lng,
          deviceId,
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json.ok) {
        const errObj = json.error || {
          code: String(response.status),
          message: json.message || response.statusText,
        };
        throw new Error(getFriendlyErrorMessage(errObj));
      }

      this.hasConfirmed = true;
      this.isSubmitting = false;

      // Cập nhật số đếm từ kết quả máy chủ nếu có
      if (json.data && json.data.floodPoint) {
        this.stillCount = json.data.floodPoint.confirmStill || this.stillCount;
        this.endedCount = json.data.floodPoint.confirmEnded || this.endedCount;
      } else {
        if (type === 'still') this.stillCount += 1;
        if (type === 'ended') this.endedCount += 1;
      }

      this.successMsg = type === 'still' ? 'Đã ghi nhận: Điểm vẫn ngập!' : 'Đã ghi nhận: Điểm đã hết ngập!';
      this.render();
      this.onConfirmed(json.data);
    } catch (err) {
      this.isSubmitting = false;
      this.errorMsg = err.message || getFriendlyErrorMessage(err);
      this.render();
    }
  }

  createEl(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
  }

  render() {
    this.mount.innerHTML = '';

    const box = this.createEl('div', 'nv4-confirm-box');

    // Thống kê số lượng xác nhận
    const countRow = this.createEl('div', 'nv4-confirm-counts');
    const stillSpan = this.createEl('span', '', `🌊 Vẫn ngập: ${this.stillCount}`);
    const endedSpan = this.createEl('span', '', `🌤️ Hết ngập: ${this.endedCount}`);
    countRow.appendChild(stillSpan);
    countRow.appendChild(endedSpan);
    box.appendChild(countRow);

    // Thông báo lỗi nếu có
    if (this.errorMsg) {
      const alert = this.createEl('div', 'nv4-alert nv4-alert-danger', this.errorMsg);
      alert.style.padding = '8px 10px';
      alert.style.marginBottom = '8px';
      box.appendChild(alert);
    }

    // Thông báo thành công nếu có
    if (this.successMsg) {
      const alert = this.createEl('div', 'nv4-alert nv4-alert-success', this.successMsg);
      alert.style.padding = '8px 10px';
      alert.style.marginBottom = '8px';
      box.appendChild(alert);
    }

    // Các nút bấm
    const btnRow = this.createEl('div', 'nv4-confirm-buttons');

    const btnStill = this.createEl('button', 'nv4-btn nv4-btn-danger', '🌊 Vẫn ngập');
    btnStill.disabled = this.hasConfirmed || this.isSubmitting;
    btnStill.onclick = () => this.handleConfirm('still');

    const btnEnded = this.createEl('button', 'nv4-btn nv4-btn-success', '🌤️ Đã hết ngập');
    btnEnded.disabled = this.hasConfirmed || this.isSubmitting;
    btnEnded.onclick = () => this.handleConfirm('ended');

    if (this.isSubmitting) {
      btnStill.textContent = 'Đang xử lý...';
      btnEnded.textContent = 'Đang xử lý...';
    }

    btnRow.appendChild(btnStill);
    btnRow.appendChild(btnEnded);
    box.appendChild(btnRow);

    this.mount.appendChild(box);
  }
}
