# Hướng dẫn chạy app trên máy demo

Nhóm Nexora · cập nhật 11/11/2026

## Repo gồm những gì

| Thư mục | Phần | Cổng |
|---|---|---|
| `frontend/` | NV2 giao diện (React + Vite), đã gộp bản đồ | 5173 |
| `server/` | NV4 báo cáo ngập, xác thực, trang phường (Express + SQLite) | 3000 |
| `backend/` | NV3 AI phân tích ảnh (Gemini) | 3001 |
| `nv5-forecast/` | NV5 dự báo mưa và cảnh báo (Open-Meteo) | 3005 |
| `nv1-ban-do/` | NV1 bản đồ Leaflet bản đầu (trang riêng) | – |
| `data/`, `docs/` | NV6 dữ liệu điểm ngập, danh sách phường, tài liệu | – |

Giao diện chỉ gọi cổng 5173, Vite tự chuyển `/api` sang NV4, `/ai` sang NV3, `/nv5` sang NV5.

## Lần đầu

Cần Node.js 20 hoặc 22 và Git.

```
git clone https://github.com/trucnhttruc2112-ship-it/DauTruongAI_App-chong-ngap-lut.git
cd DauTruongAI_App-chong-ngap-lut
npm install
npm run setup
```

`npm run setup` cài thư viện cho từng phần, tạo database và nạp 8 điểm ngập của NV6.

Muốn AI chạy thật thì chép `backend/.env.example` thành `backend/.env` rồi điền `GEMINI_API_KEY` (xin Thành). Không đưa file `.env` lên GitHub.

## Chạy

```
npm run dev        # AI thật (cần GEMINI_API_KEY)
npm run dev:mock   # AI giả lập, không cần key
```

Mở http://localhost:5173

- Tài khoản thử: `nguoidan` (người dân) và `quanly` (phường), mật khẩu bất kỳ từ 6 ký tự.
- Trang phường: đăng nhập `quanly` rồi vào http://localhost:5173/quan-ly
- Tắt app: bấm Ctrl + C trong cửa sổ đang chạy.

## Kịch bản demo (khoảng 3 phút)

1. Mở bản đồ: thấy các điểm đang ngập và lớp điểm hay ngập.
2. Bấm **Báo ngập** → chụp ảnh → **Dùng vị trí của tôi** → đánh dấu xác nhận vị trí → xem kết quả AI → gửi.
3. Đăng nhập `quanly` ở tab khác → mở báo cáo vừa gửi → **Tiếp nhận** → **Xác nhận thông tin** → **Chuyển đang xử lý**.
4. Quay lại tab người dân → **Báo cáo của tôi**: thấy trạng thái "Đang xử lý", điểm hiện trên bản đồ.
5. Tab **Cảnh báo → Nguy cơ sắp tới**: dự báo theo lượng mưa.

## Lưu ý khi demo

- Máy chủ NV4 chống báo cáo giả nên:
  - ảnh phải chụp trong vòng 5 phút;
  - GPS sai số tối đa 100 m;
  - vị trí phải trong Đồng Nai;
  - mỗi trình duyệt gửi tối đa 5 báo cáo/giờ.
- Xác nhận "vẫn ngập / hết ngập" cần đứng cách điểm không quá 300 m. Demo thì xác nhận trên điểm vừa báo.
- Dự báo cần Internet. Nếu hôm demo trời không mưa, vào **Tùy chọn → Kịch bản mưa** chọn "Mô phỏng mưa lớn". Thẻ dự báo sẽ có nhãn "Mô phỏng".
- Trước giờ thi: tắt app, chạy `npm run reset-data` để xóa báo cáo thử và nạp lại 8 điểm ban đầu.
- Mở bằng điện thoại cùng WiFi: http://<IP máy tính>:5173. Điện thoại không dùng được camera và GPS qua http, nên chọn ảnh có sẵn và ghim vị trí trên bản đồ.

## Kiểm tra

```
npm test
```

Chạy test của NV3, NV4 và NV5 (kết quả ngày 11/11: 24 + 206 + 21 test đều qua).

## Lỗi hay gặp

| Lỗi | Cách sửa |
|---|---|
| `EADDRINUSE` (cổng bị chiếm) | Tắt cửa sổ app cũ, hoặc khởi động lại máy |
| Cài `better-sqlite3` lỗi | Dùng Node 20 hoặc 22 bản LTS, chạy lại `npm run setup` |
| AI báo lỗi 503 | Chưa có `GEMINI_API_KEY`, dùng `npm run dev:mock` |
| Trang Dự báo báo lỗi | Máy không có Internet, chọn kịch bản mưa mô phỏng |
| Gửi báo cáo bị từ chối | Đọc thông báo: ảnh quá cũ, GPS kém hoặc gửi quá 5 lần/giờ |
