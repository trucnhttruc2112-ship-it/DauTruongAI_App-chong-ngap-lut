# Tiến Độ Triển Khai Module NV4 (Báo Cáo Ngập & Xác Thực)

## Hiện trạng tổng quan
- **Prompt đã hoàn thành:** P1, P2, P3, P5, P4.
- **Tổng số test hiện tại:** 105 passed / 0 failed (11 test files).
- **Benchmark 1000 điểm:**
  + GET `/api/flood-points.geojson`: ~77 ms (< 200 ms: ĐẠT)
  + GET `/api/flood-prone`: ~17 ms (< 200 ms: ĐẠT)
  + ETag 304: ĐẠT
- **Prompt tiếp theo:** P6 (Module frontend: camera, GPS, gửi báo cáo, nút xác nhận).

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
