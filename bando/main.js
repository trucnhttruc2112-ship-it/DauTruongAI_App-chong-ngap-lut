/* NV1 - Chỉ xử lý hiển thị bản đồ, lớp, điểm và popup. */
import { createBandoMap, createBandoMarker } from "./map.js";

if (typeof L === "undefined") {
  document.getElementById("map").textContent = "Không tải được Leaflet. Kiểm tra kết nối Internet rồi tải lại trang.";
} else {
  // 1. Dựng bản đồ đặt tại Đồng Nai.
  const { map } = createBandoMap(L, "map");

  const currentLayer = L.layerGroup();
  const frequentLayer = L.layerGroup();

  // 3. Tạo marker theo màu; 4. nhấn marker để thấy thông tin + ảnh;
  // 5. popup hiển thị số lần ngập giả định tại từng điểm.
  for (const point of floodPoints) {
    const isCurrent = point.type === "current";
    const marker = createBandoMarker(L, point);
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
