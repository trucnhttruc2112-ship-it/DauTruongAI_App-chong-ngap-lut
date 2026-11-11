# Hướng Dẫn Tích Hợp Hệ Thống (Integration Guide) - Module NV4

Tài liệu hướng dẫn kết nối và phối hợp giữa **NV4 (Báo cáo ngập & Xác thực)** với các phân hệ khác: **NV1 (Bản đồ Leaflet)**, **NV2 (Giao diện người dân & Trang phường)**, **NV5 (Mô hình dự báo ngập)** và **NV6 (Dữ liệu nền)**.

---

## 1. Hướng dẫn tích hợp cho từng phân hệ

### 1.1. NV1 – Bản đồ số & Hiển thị Leaflet
- **File mẫu tham khảo:** [`integration/nv1-leaflet-example.html`](file:///c:/Users/TDEV/source/Flood-app-PJ/integration/nv1-leaflet-example.html).
- **Cách mở xem:** Truy cập trực tiếp qua server: `http://localhost:3000/integration/nv1-leaflet-example.html`.
- **Endpoint sử dụng:** `GET /api/flood-points.geojson` (Hỗ trợ ETag 304 để tiết kiệm băng thông).
- **Quy tắc hiển thị:**
  + **Tọa độ:** GeoJSON trả về mảng `[kinh độ (lng), vĩ độ (lat)]`. Trong Leaflet cần truyền `[lat, lng]` vào `L.circleMarker`.
  + **Màu sắc (`markerColor`):** `red` (ngập sâu/nguy hiểm), `orange` (ngập vừa), `yellow` (ngập nhẹ), `gray` (đã rút/hết hạn).
  + **Tuyến đường hay ngập (`isFloodProne`):** Điểm có `isFloodProne = true` vẽ viền tím đậm (`#7b1fa2`, độ dày 3px).
  + **Phân lớp (Layer):** Thuộc tính `layer` gồm `'current'` (đang ngập) và `'prone'` (tuyến hay ngập). Chia thành 2 `L.layerGroup` để người dùng bật/tắt.
  + **Popup:** Render thông tin bằng `.textContent` (tránh `innerHTML`). Nhúng component xác nhận `ConfirmWidget` từ `/nv4/confirmWidget.js`.
  + **Chu kỳ làm mới:** Khuyến nghị tự động tải lại mỗi 30 giây.

---

### 1.2. NV2 – Giao diện Người dân & Trang Phường/Xã
- **File mẫu tham khảo:**
  + Nhúng luồng báo cáo & xác nhận: [`public/nv4/demo.html`](file:///c:/Users/TDEV/source/Flood-app-PJ/public/nv4/demo.html).
  + Trang thông tin theo phường: [`integration/nv2-wardpage-example.js`](file:///c:/Users/TDEV/source/Flood-app-PJ/integration/nv2-wardpage-example.js).
- **Endpoints sử dụng:**
  + `POST /api/reports`: Tiếp nhận báo cáo kèm ảnh (gửi qua component `ReportFlow`).
  + `POST /api/flood-points/:id/confirm`: Xác nhận "Vẫn ngập" / "Đã hết ngập" (qua `ConfirmWidget`).
  + `GET /api/wards/:wardId/flood-points`: Lấy danh sách điểm ngập phân nhóm theo đường của phường.
- **Cách nhúng Component của NV4 vào giao diện NV2:**
  ```javascript
  import { ReportFlow } from '/nv4/reportFlow.js';
  import { ConfirmWidget } from '/nv4/confirmWidget.js';

  // 1. Nhúng form báo cáo ngập
  new ReportFlow({
    apiBase: '',
    mount: '#report-container',
    onRequestManualPin: async () => {
      // Gọi modal bản đồ của NV2/NV1 cho người dùng ghim điểm
      return { lat: 10.9515, lng: 106.8245 };
    },
    onSuccess: (data) => console.log('Báo cáo thành công:', data)
  });

  // 2. Nhúng nút xác nhận cho 1 điểm ngập
  new ConfirmWidget({
    apiBase: '',
    floodPointId: 'fp_bienhoa_01',
    initialStill: 2,
    initialEnded: 0,
    mount: '#confirm-container'
  });
  ```

---

### 1.3. NV5 – Mô hình Dự báo ngập theo lượng mưa
- **File adapter chuẩn bị sẵn:** [`integration/nv5-flood-prone-adapter.js`](file:///c:/Users/TDEV/source/Flood-app-PJ/integration/nv5-flood-prone-adapter.js).
- **Endpoint sử dụng:** `GET /api/flood-prone` (Tùy chọn query: `?minEvents=3&wardId=...`).
- **Cách sử dụng adapter:**
  ```javascript
  import { getFloodProneForForecast } from './integration/nv5-flood-prone-adapter.js';

  const pronePoints = await getFloodProneForForecast({
    apiBase: 'http://localhost:3000',
    minEvents: 3
  });
  // Kết quả: Mảng các đối tượng { id, lat, lng, street, wardId, eventCount, severityWeight }
  // severityWeight: high = 3, medium = 2, low = 1.
  ```
- **Lưu ý tần suất gọi:** Dữ liệu điểm hay ngập là thống kê tích lũy, thay đổi chậm. NV5 chỉ nên gọi định kỳ **5 - 15 phút một lần** hoặc đồng bộ theo chu kỳ bản tin dự báo thời tiết. Không gọi dồn dập.

---

### 1.4. NV6 – Cung cấp Dữ liệu nền
- NV4 hiện đang sử dụng danh sách 30 phường/xã giả lập tạm thời của TP. Biên Hòa và gán phường bằng thuật toán khoảng cách tâm gần nhất (Voronoi).
- Khi NV6 cung cấp file GeoJSON Polygon ranh giới chính thức, NV4 sẽ nạp vào CSDL để thay thế thuật toán ước lượng.

---

## 2. Các lỗi thường gặp khi tích hợp (Gotchas)

1. **Đảo thứ tự tọa độ vĩ độ / kinh độ:**
   - Chuẩn GeoJSON: `[kinh độ (lng), vĩ độ (lat)]` (VD: `[106.82, 10.95]`).
   - Leaflet / Database / Google Maps: `[vĩ độ (lat), kinh độ (lng)]` (VD: `[10.95, 106.82]`).
2. **Cấu hình CORS khi chạy qua Domain hoặc Tunnel HTTPS:**
   - Khi chạy production hoặc reverse proxy, cần khai báo các domain được phép vào biến môi trường `ALLOWED_ORIGINS` (phân tách bởi dấu phẩy).
   - Truy cập cùng nguồn (same-origin qua tunnel như Cloudflare Tunnel/ngrok) đã được máy chủ tự động nhận diện qua header `Host` và `X-Forwarded-Host`.
3. **URL ảnh trả về là đường dẫn tương đối:**
   - Các trường ảnh (`imagePath`, `images`, `thumbnailUrl`) trả về dạng tương đối `/uploads/YYYY/MM/<uuid>.jpg`. Client cần ghép nối với tiền tố `PUBLIC_BASE_URL` khi hiển thị trên các ứng dụng di động độc lập.
4. **Cờ cảnh báo `WARD_ESTIMATED`:**
   - Các điểm ngập hiện có cờ `WARD_ESTIMATED` trong `trustFlags` vì ranh giới phường hiện tại là ước lượng hình học, chờ dữ liệu ranh giới chính thức từ NV6.
5. **Chế độ AI đang ở chế độ Giả lập (Mock):**
   - API trả về trường `aiMode: 'mock'`. Khi NV3 bàn giao API AI thật, hệ thống chỉ cần đổi `AI_MODE=remote` trong biến môi trường `.env`, không cần đổi code.

---

## 3. Danh sách câu hỏi mở cần thống nhất liên NV

1. **Với NV1:** Chu kỳ tự làm mới bản đồ 30 giây một lần với tập dữ liệu hàng nghìn điểm có gây giật lag trên thiết bị di động yếu không? Có cần bổ sung viewport bbox filter trên bản đồ Leaflet không?
2. **Với NV2:** Khi người dùng từ chối cấp quyền GPS trên Safari iOS, giao diện modal của NV2 có sẵn sàng nhận callback `onRequestManualPin()` để người dùng tự chấm điểm trên bản đồ không?
3. **Với NV5:** Trọng số mức độ nghiêm trọng `severityWeight` (thang 1 - 3) đã đủ thông tin cho mô hình đối chiếu lượng mưa chưa, hay NV5 cần thêm trường `estimatedDepthCm` (độ sâu ước lượng cm)?
4. **Với NV6:** Định dạng file ranh giới hành chính 30 phường/xã TP. Biên Hòa dự kiến bàn giao là GeoJSON EPSG:4326 hay Shapefile? Thời gian dự kiến bàn giao?
