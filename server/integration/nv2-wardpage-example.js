/**
 * Module ví dụ mẫu dành riêng cho NV2 (Giao diện Trang thông tin Phường/Xã).
 *
 * TÍNH NĂNG MINH HỌA:
 * 1. Lấy dữ liệu điểm ngập theo phường từ API: GET /api/wards/:wardId/flood-points
 * 2. Hiển thị tóm tắt (số điểm đang ngập, hay ngập, số lần ngập)
 * 3. Render danh sách điểm ngập phân nhóm theo tuyến đường
 * 4. Nhúng ConfirmWidget ("Vẫn ngập / Hết ngập") cho từng điểm ngập
 * 5. Nhúng ReportFlow ("Báo cáo ngập") vào trang để người dân gửi báo cáo trực tiếp
 *
 * AN TOÀN XSS: Toàn bộ dữ liệu từ máy chủ được gán bằng .textContent.
 */

import { ConfirmWidget } from '../public/nv4/confirmWidget.js';
import { ReportFlow } from '../public/nv4/reportFlow.js';

/**
 * Gọi API lấy dữ liệu điểm ngập theo phường
 * @param {string} wardId Mã định danh phường (VD: 'trang-dai', 'long-binh')
 * @param {string} [apiBase='']
 * @returns {Promise<Object>}
 */
export async function fetchWardFloodPoints(wardId, apiBase = '') {
  const url = `${apiBase.replace(/\/+$/, '')}/api/wards/${encodeURIComponent(wardId)}/flood-points`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Lỗi khi lấy dữ liệu phường ${wardId}: HTTP ${res.status}`);
  }

  const json = await res.json();
  if (!json || !json.ok) {
    throw new Error(json?.error?.message || 'Dữ liệu không hợp lệ');
  }

  return json.data;
}

/**
 * Render trang phường hoàn chỉnh vào một container DOM
 *
 * @param {Object} options
 * @param {HTMLElement | string} options.container - Phần tử DOM cha
 * @param {string} options.wardId - Mã phường (VD: 'trang-dai')
 * @param {string} [options.apiBase=''] - URL máy chủ API
 * @param {Function} [options.onRequestManualPin] - Callback mở bản đồ chọn vị trí nếu GPS lỗi
 */
export async function renderWardPage({ container, wardId, apiBase = '', onRequestManualPin }) {
  const mountEl = typeof container === 'string' ? document.querySelector(container) : container;
  if (!mountEl) {
    throw new Error('[NV2 Example] Container không tồn tại');
  }

  mountEl.innerHTML = ''; // Dọn sạch nội dung ban đầu

  // Loading
  const loadingEl = document.createElement('div');
  loadingEl.textContent = 'Đang tải dữ liệu điểm ngập của phường...';
  mountEl.appendChild(loadingEl);

  try {
    const data = await fetchWardFloodPoints(wardId, apiBase);
    mountEl.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'nv2-ward-root';
    root.style.fontFamily = 'system-ui, sans-serif';
    root.style.maxWidth = '640px';
    root.style.margin = '0 auto';
    root.style.padding = '16px';

    // 1. Tiêu đề phường & Tóm tắt số liệu
    const header = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = `Thông Tin Ngập Lụt - Phường: ${data.wardId}`;
    header.appendChild(title);

    const summaryBox = document.createElement('div');
    summaryBox.style.display = 'flex';
    summaryBox.style.gap = '12px';
    summaryBox.style.padding = '10px';
    summaryBox.style.backgroundColor = '#f1f5f9';
    summaryBox.style.borderRadius = '8px';
    summaryBox.style.marginBottom = '16px';

    const s = data.summary || {};
    const itemActive = document.createElement('div');
    itemActive.textContent = `🌊 Đang ngập: ${s.activeCount || 0}`;
    const itemProne = document.createElement('div');
    itemProne.textContent = `🟣 Tuyến hay ngập: ${s.proneCount || 0}`;
    const itemTotal = document.createElement('div');
    itemTotal.textContent = `📊 Tổng số lần ngập: ${s.totalEvents || 0}`;

    summaryBox.appendChild(itemActive);
    summaryBox.appendChild(itemProne);
    summaryBox.appendChild(itemTotal);
    header.appendChild(summaryBox);
    root.appendChild(header);

    // 2. Khu vực nhúng ReportFlow (Báo cáo ngập mới)
    const reportSection = document.createElement('section');
    reportSection.style.marginBottom = '24px';
    const reportTitle = document.createElement('h3');
    reportTitle.textContent = 'Báo Cáo Điểm Ngập Tại Phường';
    reportSection.appendChild(reportTitle);

    const reportMount = document.createElement('div');
    reportSection.appendChild(reportMount);
    root.appendChild(reportSection);

    // Khởi tạo ReportFlow
    new ReportFlow({
      apiBase,
      mount: reportMount,
      onRequestManualPin,
      onSuccess: () => {
        // Tự làm mới dữ liệu trang phường sau khi gửi báo cáo thành công
        renderWardPage({ container, wardId, apiBase, onRequestManualPin });
      },
    });

    // 3. Danh sách điểm ngập theo từng tuyến đường
    const pointsSection = document.createElement('section');
    const pointsTitle = document.createElement('h3');
    pointsTitle.textContent = 'Danh Sách Tuyến Đường & Điểm Ngập';
    pointsSection.appendChild(pointsTitle);

    const streets = data.streets || [];
    if (streets.length === 0) {
      const emptyP = document.createElement('p');
      emptyP.textContent = 'Hiện không có điểm ngập nào được ghi nhận tại phường này.';
      pointsSection.appendChild(emptyP);
    } else {
      streets.forEach((streetGroup) => {
        const streetCard = document.createElement('div');
        streetCard.style.border = '1px solid #cbd5e1';
        streetCard.style.borderRadius = '8px';
        streetCard.style.padding = '12px';
        streetCard.style.marginBottom = '12px';

        const streetName = document.createElement('h4');
        streetName.style.margin = '0 0 8px 0';
        streetName.textContent = `📍 ${streetGroup.street || 'Đường nội bộ / chưa đặt tên'} (${streetGroup.count} điểm)`;
        streetCard.appendChild(streetName);

        // Render từng điểm ngập trong tuyến đường
        streetGroup.points.forEach((point) => {
          const ptBox = document.createElement('div');
          ptBox.style.padding = '8px';
          ptBox.style.backgroundColor = '#f8fafc';
          ptBox.style.borderRadius = '6px';
          ptBox.style.marginBottom = '8px';

          const addrP = document.createElement('div');
          addrP.textContent = point.address || `Tọa độ: ${point.lat}, ${point.lng}`;
          ptBox.appendChild(addrP);

          const statusP = document.createElement('div');
          statusP.style.fontSize = '0.85rem';
          statusP.style.color = '#475569';
          statusP.textContent = `Trạng thái: ${point.status} | Mức độ: ${point.severity} | Lịch sử: ${point.floodEventCount} lần`;
          ptBox.appendChild(statusP);

          // Nhúng ConfirmWidget cho điểm ngập
          const confirmMount = document.createElement('div');
          confirmMount.style.marginTop = '6px';
          ptBox.appendChild(confirmMount);

          new ConfirmWidget({
            apiBase,
            floodPointId: point.id,
            initialStill: point.confirmStill || 0,
            initialEnded: point.confirmEnded || 0,
            mount: confirmMount,
            onConfirmed: () => {
              // Cập nhật lại số liệu sau khi xác nhận
              renderWardPage({ container, wardId, apiBase, onRequestManualPin });
            },
          });

          streetCard.appendChild(ptBox);
        });

        pointsSection.appendChild(streetCard);
      });
    }

    root.appendChild(pointsSection);
    mountEl.appendChild(root);
  } catch (err) {
    mountEl.innerHTML = '';
    const errEl = document.createElement('div');
    errEl.style.color = '#dc2626';
    errEl.textContent = `Lỗi tải trang phường: ${err.message}`;
    mountEl.appendChild(errEl);
  }
}
