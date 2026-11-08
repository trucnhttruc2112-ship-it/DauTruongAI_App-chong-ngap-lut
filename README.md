# NV4 – Báo Cáo Ngập & Xác Thực (Dự án Cảnh Báo Ngập Lụt Đồng Nai)

Module phụ trách tiếp nhận báo cáo ngập từ người dân, kiểm tra tính hợp lệ của ảnh và GPS, tích hợp AI Gemini (NV3), gộp báo cáo trùng lặp, quản lý vòng đời điểm ngập và cung cấp dữ liệu bản đồ (GeoJSON cho NV1), giao diện phường (NV2), dự báo mưa (NV5).

## 1. Cài đặt & Khởi động
```bash
# Cài đặt thư viện
npm install

# Khởi tạo bảng dữ liệu
npm run migrate

# Nạp dữ liệu mẫu demo (20 điểm ngập Đồng Nai)
npm run seed

# Xóa dữ liệu mẫu demo
npm run seed:clear

# Chạy kiểm thử tự động
npm test

# Chạy server ở môi trường phát triển
npm run dev
```

## 2. Cấu trúc thư mục
- `src/config/`: Cấu hình hệ thống và hằng số nghiệp vụ (`rules.js`).
- `src/db/`: Kết nối cơ sở dữ liệu SQLite.
- `src/domain/`: Logic nghiệp vụ thuần (geofence, trùng lặp, vòng đời, điểm tin cậy).
- `src/repositories/`: Tầng truy xuất dữ liệu (Data Access Layer).
- `src/services/`: Nghiệp vụ ứng dụng (báo cáo, AI analyzer mock, reverse geocode).
- `src/routes/`: Khai báo endpoints Express.
- `data/demo/`: Dữ liệu mẫu giả lập (`seed-flood-points.json`, `wards.demo.json`).
- `data/real/`: Nơi lưu trữ dữ liệu chính thức từ NV6.
- `uploads/`: Thư mục lưu trữ ảnh báo cáo đã được nén và chuẩn hóa.
- `tests/`: Bộ kiểm thử tự động.
