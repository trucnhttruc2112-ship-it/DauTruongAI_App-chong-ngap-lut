# Tiến Độ Triển Khai Module NV4 (Báo Cáo Ngập & Xác Thực)

## Hiện trạng tổng quan
- **Prompt đã hoàn thành:** P1, P2, P3, P5, P4, P6.
- **Tổng số test hiện tại:** 118 passed / 0 failed (12 test files).
- **Benchmark 1000 điểm:**
  + GET `/api/flood-points.geojson`: ~77 ms (< 200 ms: ĐẠT)
  + GET `/api/flood-prone`: ~17 ms (< 200 ms: ĐẠT)
  + ETag 304: ĐẠT
- **Prompt tiếp theo:** P7 (Tích hợp với NV1, NV2, NV5).

---

## Chi tiết các prompt

### P1: Schema DB, Repository, Dữ liệu mẫu (Seed 20 điểm)
- `src/db/connection.js`, `scripts/migrate.js`, `scripts/seed.js`
- `src/repositories/`: `floodPointRepo.js`, `reportRepo.js`, `confirmationRepo.js`, `eventRepo.js`
- Test: `tests/p1.test.js` (6 tests passed)

### P2: Logic nghiệp vụ Domain thuần + Unit Test
- `src/domain/`: `geo.js`, `reportValidator.js`, `dedupe.js`, `lifecycle.js`, `trustScore.js`, `floodProne.js`, `imageHash.js`
- Pure functions nhận `now` làm tham số.
- Test: `tests/domain/*.test.js` (49 tests passed)

### P3: API Tiếp nhận Báo cáo Ngập (POST /api/reports)
- `src/services/reportService.js`, `src/services/aiAnalyzer.js`, `src/services/geocodeService.js`
- Pipeline: validate Zod, magic bytes, dedupe 50m/6h, nén Sharp q80 <= 1280px, AI mock (ném lỗi nếu local/remote chưa cấu hình), transaction rollback + xóa ảnh nếu lỗi.
- Rate limiter: IP limiter (20/phút), device limiter (5/giờ).
- Test: `tests/p3.test.js` (15 tests passed)

### P5: API Đọc dữ liệu (GET list, GeoJSON, chi tiết, flood-prone, wards)
- `src/services/floodPointQueryService.js`, `src/controllers/floodPointController.js`
- Sanitization: `formatContractB` không làm lộ trường nội bộ (deviceId, sha256, đường dẫn tuyệt đối).
- GeoJSON: chuẩn `[lng, lat]`, markerColor, layer, ageMinutes, ETag + 304.
- Test: `tests/p5.test.js` (17 tests passed)

### P4: Xác nhận vẫn ngập/hết ngập & Tự động hết hạn (POST /:id/confirm)
- `src/services/confirmationService.js`:
  + Kiểm tra trạng thái pending/active, bán kính `CONFIRM_MAX_DISTANCE_M = 300m`.
  + Transaction an toàn xử lý đồng thời, chống trùng deviceId/type (409).
  + Đủ 2 thiết bị khác nhau báo 'ended' -> `resolved`, đóng `flood_event` với `confirmed_ended`, tăng `floodEventCount`, tính lại `isFloodProne`.
  + 'still' -> tăng `confirmStill`, cập nhật `lastConfirmedAt`, tính lại `trustScore`.
- `src/services/expirationService.js`:
  + `runExpireOnce(now)`: quét điểm pending/active quá 6h, đóng `flood_event` với `auto_expired`, tăng `floodEventCount`.
  + Job `setInterval` chỉ chạy trong `server.js` khi `NODE_ENV !== 'test'`.
- Bảo mật:
  + `x-fake-now`, `x-ai-mode`, `x-ai-simulate`, `x-simulate-db-error` chỉ hoạt động khi `NODE_ENV=test`, ngoài test bị bỏ qua hoàn toàn.
- Test: `tests/p4.test.js` (18 tests passed)

### P6: Module Frontend Camera, GPS, Báo Cáo, Xác Nhận
- `public/nv4/`:
  + `deviceId.js`: tạo và lưu uuid ẩn danh trong localStorage, có in-memory fallback.
  + `geo.js`: `getPosition()`, `formatGeoError()` phân biệt quyền / tín hiệu / timeout kèm hướng dẫn tiếng Việt.
  + `camera.js`: ưu tiên `input capture="environment"`, hỗ trợ `getUserMedia`, nén canvas JPEG cạnh dài ≤ 1600px q0.85, cảnh báo `isSecureContext`.
  + `errorMessages.js`: ánh xạ mã lỗi API (OUT_OF_AREA, GPS_TOO_INACCURATE, REPORT_TOO_OLD, DUPLICATE_IMAGE, RATE_LIMITED...) sang tiếng Việt.
  + `reportFlow.js`: lớp `ReportFlow` 5 bước, fallback ghim thủ công `onRequestManualPin`, hiển thị textContent an toàn.
  + `confirmWidget.js`: widget xác nhận "Vẫn ngập / Đã hết ngập", lấy GPS, gọi POST confirm, khóa nút sau bấm.
  + `nv4.css`: CSS prefix `.nv4-`, mobile-first 360px, nút to dễ bấm một tay.
  + `demo.html`: trang demo độc lập không cần NV2.
- `src/server.js`: phục vụ tĩnh `public/` cho `/nv4/demo.html`.
- Test: `tests/p6.test.js` (13 tests passed)
