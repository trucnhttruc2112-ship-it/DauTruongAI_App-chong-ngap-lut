# Tài liệu Tích hợp AI (NV4 <-> NV3)

Tài liệu hướng dẫn kết nối hệ thống Tiếp nhận báo cáo & Điểm ngập (NV4) với dịch vụ AI phân tích hình ảnh (NV3).

---

## 1. Hợp đồng API giữa hai bên

### 1.1 Yêu cầu gửi từ NV4 sang NV3
- **Phương thức & Đường dẫn**: `POST {AI_ANALYZE_URL}` (Mặc định: `http://localhost:3001/api/analyze-flood`)
- **Định dạng dữ liệu**: `multipart/form-data`
- **Trường file**: Duy nhất 1 trường tên `image`, định dạng JPEG/PNG/WebP, dung lượng $\le$ 5 MB (NV4 gửi ảnh JPEG đã tối ưu, xoay đúng chiều và xóa EXIF/GPS).
- **Quyền riêng tư**: NV4 **không** gửi kèm tọa độ GPS, deviceId, hay ghi chú người dùng sang NV3.
- **Xác thực**: Gửi header `X-API-Key: {AI_API_KEY}` nếu cấu hình `AI_API_KEY` trong `.env`.

### 1.2 Phản hồi chuẩn từ NV3 trả về
```json
{
  "isFlooded": true,
  "status": "flooded",
  "severity": "medium",
  "evidence": ["Đường ngập nước qua nửa bánh xe"],
  "summary": "Khu vực ngập úng mức độ trung bình",
  "needsVerification": false,
  "confidence": 0.85
}
```

---

## 2. Bảng ánh xạ trường & Luật chuyển đổi

| Trường NV3 | Giá trị NV3 | Trường NV4 tương ứng | Giá trị NV4 / Ghi chú |
| :--- | :--- | :--- | :--- |
| `status` | `'flooded'` | `isFlood` | `true` |
| | `'not_flooded'` | `isFlood` | `false` |
| | `'uncertain'` | `isFlood` | `null` (chuyển sang pending) |
| `severity` | `'low'`, `'medium'`, `'high'` | `severity` | `'low'`, `'medium'`, `'high'` |
| | `'none'`, `'unknown'` | `severity` | Mặc định `'low'` nếu ngập, kèm cờ `AI_SEVERITY_UNKNOWN` |
| `confidence` | `0.0 .. 1.0` | `confidence` | Nếu NV3 thiếu trường này, NV4 tự ước lượng: flooded (0.75), not_flooded (0.75), uncertain (0.3) kèm cờ `AI_CONFIDENCE_ESTIMATED` |
| `summary` | Chuỗi mô tả | `description` | Cắt tối đa 300 ký tự |
| `evidence` | Mảng chuỗi | `reason` | Ghép tối đa 5 mục, mỗi mục $\le$ 200 ký tự |
| `needsVerification` | `true` | `flags` | Gắn thêm cờ `AI_NEEDS_VERIFICATION` |

---

## 3. Danh sách cờ tin cậy (`trust_flags`) liên quan AI

- `AI_CONFIDENCE_ESTIMATED`: NV3 không trả trường `confidence`, NV4 tạm ước lượng theo luật mặc định.
- `AI_INCONSISTENT`: Dữ liệu NV3 mâu thuẫn giữa `status` và `isFlooded` (ví dụ `isFlooded: true` nhưng `status: 'not_flooded'`). NV4 tự động hạ về `isFlood: null` (uncertain).
- `AI_SEVERITY_UNKNOWN`: NV3 báo ngập nhưng trả `severity: 'unknown'` hoặc `'none'`.
- `AI_NEEDS_VERIFICATION`: NV3 trả cờ `needsVerification: true`.

---

## 4. Khả năng chịu lỗi & Chế độ Retry

- **Retry**: Khi gặp lỗi mạng, timeout (mặc định 20.000ms) hoặc HTTP 5xx từ NV3, NV4 tự động thử lại đúng 1 lần (cách 1.000ms).
- **Không retry**: Khi NV3 trả mã lỗi 4xx (như 400, 429) để tránh lãng phí tài nguyên.
- **Fail-safe**: Mọi sự cố không thể khắc phục từ phía NV3 đều trả về `{ isFlood: null, error: ... }`. Báo cáo ngập của người dân vẫn được lưu an toàn với trạng thái `pending` và điểm tin cậy tính từ các yếu tố cộng đồng.
- **Bảo mật**: Khóa `X-API-Key` không bao giờ được ghi vào log console, log DB (`reports.ai_json`) hay API trả về client.

---

## 5. Hướng dẫn cấu hình & Chuyển đổi chế độ

### 5.1 Cấu hình file `.env`
```ini
# Chế độ AI: mock | remote | local
AI_MODE=remote

# URL server AI của NV3 (NV4 chạy cổng 3000, NV3 chạy cổng 3001)
AI_ANALYZE_URL=http://localhost:3001/api/analyze-flood

# Khóa API nếu NV3 yêu cầu xác thực
AI_API_KEY=your_secret_api_key_here

# Thời gian chờ tối đa (ms)
AI_TIMEOUT_MS=20000
```

### 5.2 Lệnh curl mẫu kiểm tra server NV3 độc lập
```bash
curl -X POST http://localhost:3001/api/analyze-flood \
  -H "X-API-Key: your_secret_api_key_here" \
  -F "image=@tests/fixtures/sample_flood.jpg"
```

---

## 6. Các câu hỏi mở & Phối hợp NV3

1. **Trường `confidence`**: NV3 dự kiến khi nào bổ sung chính thức trường `confidence` vào response JSON?
2. **Rate Limit**: NV3 có giới hạn số lượng request đồng thời (concurrency limit) hoặc request per minute (RPM) không để NV4 cấu hình queue nếu lượng người dùng tăng đột biến?
3. **Kích thước ảnh**: Chuẩn hóa dung lượng tối đa (hiện tại NV4 nén ảnh client $\le$ 1600px, dung lượng thường $< 1$ MB trước khi gửi sang NV3).
