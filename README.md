# NV1 – Bản đồ và hiển thị dữ liệu ngập Đồng Nai

Đây là **bản demo độc lập, chỉ trong phạm vi NV1**. Không chứa backend, AI, dự báo, SMS hay chức năng báo ngập.

## Chạy thử
1. Giải nén thư mục.
2. Mở `index.html` bằng Chrome/Edge. Cần có Internet để tải thư viện Leaflet và bản đồ nền OpenStreetMap.
3. Nếu dùng VS Code, có thể chọn Open Folder rồi dùng tiện ích Live Server để mở `index.html` (không bắt buộc).
4. Nhấn các chấm trên bản đồ để xem tên, hình minh họa và số lần ngập.
5. Dùng bảng chọn lớp bên phải để bật/tắt `Đang ngập (mẫu)` và `Hay ngập (mẫu)`.

## Mỗi file làm gì?
- `index.html`: Khung trang và thẻ bản đồ.
- `style.css`: Chỉ định kích thước bản đồ, chú giải và kiểu popup.
- `data.js`: 6 vị trí **mô phỏng** với tọa độ và số lần ngập **giả lập**.
- `main.js`: Mở Leaflet, tạo 2 lớp, tô màu điểm và tạo popup.
- `assets/anh-minh-hoa.svg`: Ảnh minh họa đặt trong popup.

## 5 tiêu chí NV1
- [x] Dựng bản đồ Đồng Nai với Leaflet.
- [x] Hiển thị điểm ngập theo màu: đỏ / cam / vàng cho mức ngập giả lập, xanh cho điểm hay ngập.
- [x] Bật/tắt lớp đang ngập và lớp hay ngập.
- [x] Bấm điểm để xem thông tin và ảnh minh họa.
- [x] Hiển thị số lần ngập tại từng địa điểm.

## LƯU Ý về dữ liệu
Tất cả 6 điểm và số lần ngập đều phục vụ demo, **không phải báo cáo ngập đã xác minh**. Không dùng làm cảnh báo thật. Bản đồ nền OpenStreetMap là dữ liệu do cộng đồng cập nhật, có thể không phản ánh tức thời mọi thay đổi đường sá. Demo cũng chưa có lớp ranh giới hành chính chính thức.

## Khi nhóm có dữ liệu thật
Nhờ NV4/NV6 cung cấp danh sách đã xác minh theo cấu trúc tương tự `data.js`:

```js
{
  id: "M01",
  name: "Tên địa điểm",
  lat: 10.955,
  lng: 106.82,
  type: "current", // hoặc "frequent"
  level: "heavy", // heavy/moderate/light (chỉ áp dụng current)
  floodCount: 4,
  description: "Thông tin đã kiểm chứng",
  image: "duong-dan-anh-da-xac-minh.jpg"
}
```

Sau đó thay dữ liệu mẫu bằng dữ liệu thật đã được xác minh. Việc xây API và ghi nhận báo cáo thuộc NV4, không thuộc NV1.

## Nguồn tham khảo
- Leaflet 1.9.4: https://leafletjs.com/download
- Chính sách bản đồ OSM: https://operations.osmfoundation.org/policies/tiles/
- © OpenStreetMap contributors. Không tải hàng loạt bản đồ nền và không dùng máy chủ tile cộng đồng cho hệ thống lớn khi chưa có phương án hạ tầng phù hợp.
