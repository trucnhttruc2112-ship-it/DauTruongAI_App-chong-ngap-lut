/* NV1 - Chỉ xử lý hiển thị bản đồ, lớp, điểm và popup. */
if (typeof L === "undefined") {
  document.getElementById("map").textContent = "Không tải được Leaflet. Kiểm tra kết nối Internet rồi tải lại trang.";
} else {
  // 1. Dựng bản đồ đặt tại Đồng Nai.
  const map = L.map("map", { zoomControl: true }).setView([11.35, 107.05], 9);

  // 2. Bản đồ nền OpenStreetMap. Không chứa dữ liệu ngập.
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);

  const currentLayer = L.layerGroup();
  const frequentLayer = L.layerGroup();
  const colorByLevel = { heavy: "#e23c41", moderate: "#ee8d28", light: "#e5c42e" };
  const labelByLevel = { heavy: "Đang ngập – nặng (mẫu)", moderate: "Đang ngập – vừa (mẫu)", light: "Đang ngập – nhẹ (mẫu)" };

  // Đảm bảo dữ liệu văn bản được hiển thị an toàn trong popup.
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  // 3. Tạo marker theo màu; 4. nhấn marker để thấy thông tin + ảnh;
  // 5. popup hiển thị số lần ngập giả định tại từng điểm.
  for (const point of floodPoints) {
    const isCurrent = point.type === "current";
    const color = isCurrent ? (colorByLevel[point.level] || "#e23c41") : "#2776cb";
    const status = isCurrent ? (labelByLevel[point.level] || "Đang ngập (mẫu)") : "Hay ngập (mẫu)";
    const marker = L.circleMarker([point.lat, point.lng], {
      radius: isCurrent ? 11 : 10,
      color: "#fff", weight: 2.5,
      fillColor: color, fillOpacity: 0.95,
      dashArray: isCurrent ? undefined : "4, 3"
    });
    marker.bindTooltip(escapeHtml(point.name));
    marker.bindPopup(`
      <div class="popup-title">${escapeHtml(point.name)}</div>
      <span class="popup-pill">${escapeHtml(status)}</span>
      <p class="popup-line"><strong>Số lần ngập:</strong> ${Number(point.floodCount) || 0} (giả lập)</p>
      <p class="popup-line"><strong>Tọa độ:</strong> ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</p>
      <p class="popup-line">${escapeHtml(point.description)}</p>
      <img class="popup-photo" src="${escapeHtml(point.image)}" alt="Hình minh họa, không phải ảnh ngập thực tế" />
      <div class="popup-warning">DỮ LIỆU MẪU – KHÔNG PHẢI CẢNH BÁO THẬT</div>
    `, { maxWidth: 300 });
    (isCurrent ? currentLayer : frequentLayer).addLayer(marker);
  }

  // Hai lớp có thể bật/tắt độc lập.
  currentLayer.addTo(map);
  frequentLayer.addTo(map);
  L.control.layers(null, {
    "Đang ngập (mẫu)": currentLayer,
    "Hay ngập (mẫu)": frequentLayer
  }, { collapsed: false, position: "topright" }).addTo(map);

  const currentCount = floodPoints.filter((p) => p.type === "current").length;
  const frequentCount = floodPoints.filter((p) => p.type === "frequent").length;
  document.getElementById("data-count").textContent =
    `Đang hiển thị ${currentCount} điểm đang ngập mẫu và ${frequentCount} điểm hay ngập mẫu. Không phải dữ liệu ngập thực tế.`;
}
