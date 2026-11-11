/* Phần hiển thị Leaflet dùng chung cho bản đồ độc lập và frontend. */
const colorByLevel = { heavy: "#e23c41", moderate: "#ee8d28", light: "#e5c42e" };
const labelByLevel = { heavy: "Đang ngập – nặng (mẫu)", moderate: "Đang ngập – vừa (mẫu)", light: "Đang ngập – nhẹ (mẫu)" };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

export function createBandoMap(L, target, {
  center = [11.35, 107.05],
  zoom = 9,
  mapOptions = {},
  tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileOptions = {},
  scale = true
} = {}) {
  const map = L.map(target, { zoomControl: true, ...mapOptions }).setView(center, zoom);
  const tileLayer = L.tileLayer(tileUrl, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    ...tileOptions
  }).addTo(map);
  if (scale) L.control.scale({ imperial: false }).addTo(map);
  return { map, tileLayer };
}

export function createBandoMarker(L, point, {
  icon,
  markerOptions = {},
  tooltip = true,
  popup = true
} = {}) {
  const isCurrent = point.type === "current";
  const color = isCurrent ? (colorByLevel[point.level] || "#e23c41") : "#2776cb";
  const status = isCurrent ? (labelByLevel[point.level] || "Đang ngập (mẫu)") : "Hay ngập (mẫu)";
  const coordinates = [point.lat, point.lng];
  const marker = icon
    ? L.marker(coordinates, { icon, ...markerOptions })
    : L.circleMarker(coordinates, {
      radius: isCurrent ? 11 : 10,
      color: "#fff", weight: 2.5,
      fillColor: color, fillOpacity: 0.95,
      dashArray: isCurrent ? undefined : "4, 3",
      ...markerOptions
    });
  if (tooltip) marker.bindTooltip(escapeHtml(point.name));
  if (popup) marker.bindPopup(`
      <div class="popup-title">${escapeHtml(point.name)}</div>
      <span class="popup-pill">${escapeHtml(status)}</span>
      <p class="popup-line"><strong>Số lần ngập:</strong> ${Number(point.floodCount) || 0} (giả lập)</p>
      <p class="popup-line"><strong>Tọa độ:</strong> ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</p>
      <p class="popup-line">${escapeHtml(point.description)}</p>
      <img class="popup-photo" src="${escapeHtml(point.image)}" alt="Hình minh họa, không phải ảnh ngập thực tế" />
      <div class="popup-warning">DỮ LIỆU MẪU – KHÔNG PHẢI CẢNH BÁO THẬT</div>
    `, { maxWidth: 300 });
  return marker;
}
