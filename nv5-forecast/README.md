# NV5 – Dự báo ngập (module độc lập, DEMO)

> ⚠️ Mô hình demo, **không phải dự báo thủy văn chính thức**. Ngưỡng mưa là thử nghiệm, chỉnh trong `src/config.js`.

Không phụ thuộc thư viện ngoài. Cần Node.js ≥ 18.

## Chạy độc lập với JSON mẫu (PowerShell)

```powershell
cd nv5-forecast
npm test
npm start            # http://localhost:3005 (nguồn mặc định: json)
```

## Kết nối với API NV4 (cổng 3000) + NV5 (cổng 3005)

1. **Khởi động máy chủ NV4** ở cổng `3000` (đảm bảo endpoint `GET http://localhost:3000/api/flood-prone?minEvents=1` hoạt động).
2. **Khởi động máy chủ NV5** ở cổng `3005` với biến môi trường `NV5_POINTS_SOURCE=nv4`:

```powershell
cd nv5-forecast
$env:NV5_POINTS_SOURCE="nv4"
$env:NV4_API_URL="http://localhost:3000"
npm start            # NV5 chạy tại http://localhost:3005
```

- Cache danh sách điểm ngập từ NV4: **10 phút**, timeout: **5 giây**.
- Khi NV4 mất kết nối, NV5 trả lỗi nguồn dữ liệu rõ ràng (`502` / `NV4_NETWORK`, `NV4_TIMEOUT`, `NV4_HTTP`), **không** tự ý chuyển sang JSON demo (trừ khi bật riêng `$env:NV4_FALLBACK_JSON="1"`).
- Dữ liệu từ NV4 được gắn `source: "nv4-api"`, `verification_status: "chua_ro"`, `verified: false` (không coi là dữ liệu chính thức).

## Chế độ DEMO mô phỏng mưa lớn (chỉ development/demo)

```powershell
npm run demo                 # hoặc mở trực tiếp http://localhost:3005
```

Bị tắt khi `NODE_ENV=production`. Trên giao diện chọn "Nguồn mưa" = kịch bản DEMO (Trung bình 20mm/3h, Cao 36mm/3h, Rất cao 60mm/3h + 3 lần ngập), rồi bấm "Mô phỏng cảnh báo 19:00". API: `/demo/forecast`, `/demo/alerts?scenario=cao&lat=..&lng=..&simulate=19`.

## API

| Endpoint | Tham số | Mô tả |
|---|---|---|
| `GET /forecast` | `lat`, `lng`, `so_lan` (tùy chọn, demo) | Mưa theo giờ, tích lũy 1h/3h/6h, mức nguy cơ, khoảng cảnh báo đã gộp |
| `GET /alerts` | như trên + `simulate=19` | Cảnh báo ngày mai trong khung 19:00–23:00 (giờ VN), có chống trùng |

## Ánh xạ dữ liệu từ NV4 (`GET /api/flood-prone?minEvents=1`)

| Trường NV4 | Trường NV5 | Ghi chú |
|---|---|---|
| `key` | `id` | Mã cụm điểm/tuyến đường |
| `street` | `duong` | Tên đường |
| `wardId` | `phuong` | Mã phường/xã |
| `centerLat`, `centerLng` | `lat`, `lng` | Tọa độ tâm cụm |
| `eventCount` | `so_lan_ngap` | Số sự kiện ngập tích lũy |
| `avgSeverity` | `muc_ngap` | `low`→`nhe`, `medium`→`vua`, `high`→`nang` |
| `lastFloodAt` | `gio_bao` | Thời điểm ngập gần nhất |
| *(không có)* | `nguyen_nhan`, `anh`, `trang_thai` | Giữ `null`, không tự bịa |
