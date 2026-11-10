# Tiến Độ Triển Khai Module NV4 (Báo Cáo Ngập & Xác Thực)

## Hiện trạng tổng quan
- **Prompt đã hoàn thành:** P1, P2, P3, P5, P4, P6, P7, Tích hợp NV3, P9 (Nhóm 1 - Mức Cao).
- **Tổng số test hiện tại:** 170 passed / 0 failed (16 test files).
- **Benchmark 1000 điểm:**
  + GET `/api/flood-points.geojson`: ~77 ms (< 200 ms: ĐẠT)
  + GET `/api/flood-prone`: ~17 ms (< 200 ms: ĐẠT)
  + ETag 304: ĐẠT
- **Kịch bản E2E:** 6/6 bước PASS (`npm run e2e`).
- **Prompt tiếp theo:** P9 (Nhóm 2 - Mức Trung & Nhóm 3 - Mức Nhỏ).

---

## Chi tiết các prompt

### P9: Rà soát Bảo Mật & Độ Bền (Đang thực hiện)
- **Nhóm 1 – Mức Cao (ĐÃ XONG - 12 tests passed):**
  + Upload: Magic bytes, giới hạn 50M pixel Sharp (`limitInputPixels`), tên UUID random, chống path traversal khi lưu ảnh, `/uploads` chỉ phục vụ ảnh (`.jpg`, `.jpeg`, `.png`, `.webp`), chặn directory listing & nosniff.
  + Static: Chặn truy cập nhạy cảm (`.env`, `.sqlite`, file ẩn, path traversal `..` trả về 403), `/integration` chỉ mở khi `NODE_ENV !== 'production'` (404 khi production).
  + Chống lạm dụng: Bổ sung `confirmIpLimiter` (10 request/phút/IP) chống spam xác nhận xóa điểm ngập.
  + Cấu hình Production: Cấm cơ chế giả lập; từ chối khởi động nếu `AI_MODE=mock` hoặc `DATA_MODE=demo` trên production trừ khi có `ALLOW_DEMO_IN_PROD=true`.
  + Trust Proxy: Đọc từ biến `TRUST_PROXY` (mặc định tắt `false`).
  + AI Remote: Kiểm tra protocol `http/https` chống SSRF, giới hạn dung lượng phản hồi từ NV3 (1MB) tránh tràn bộ nhớ.
  + File test: `tests/securityGroup1.test.js` (12 tests mới). Mốc test: 158 -> 170 tests.

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
- Test: `tests/p6.test.js` (26 tests passed)

### P7: Gói tích hợp NV1, NV2, NV5
- `src/config/env.js`: Kiểm tra bắt buộc `ALLOWED_ORIGINS` khi `NODE_ENV=production`.
- `integration/nv5-flood-prone-adapter.js`: Adapter lấy danh sách điểm hay ngập cho NV5 dự báo theo lượng mưa.
- `integration/nv1-leaflet-example.html`: Mẫu Leaflet tối giản cho NV1 (circleMarker, viền tím prone, 2 lớp bật/tắt, nhúng ConfirmWidget, XSS-safe textContent, lưu ý tọa độ GeoJSON `[lng, lat]`).
- `integration/nv2-wardpage-example.js`: Mẫu trang phường cho NV2 (`fetchWardFloodPoints`, `renderWardPage`, nhúng ReportFlow & ConfirmWidget).
- `docs/INTEGRATION.md`: Tài liệu hướng dẫn tích hợp chi tiết, bảng gotchas lỗi thường gặp và 4 câu hỏi mở liên NV.
- `scripts/e2e.js`: Kịch bản kiểm thử End-to-End trên DB tạm (`npm run e2e`) kiểm tra 6 bước (seed, báo mới, gộp trùng 50m, điểm độc lập, xác nhận still/ended, phân lớp layer GeoJSON).
- `src/server.js`: Phục vụ tĩnh `/integration` cho các trang ví dụ mẫu.
- Test: `tests/p7.test.js` (6 tests passed).

### Tích hợp AI NV3 (Chế độ Remote & Adapter)
- `src/domain/aiContract.js`: Xử lý validate Zod, ánh xạ trạng thái NV3 (`flooded`, `not_flooded`, `uncertain`), chuẩn hóa `severity`, ước lượng `confidence` khi thiếu kèm cờ `AI_CONFIDENCE_ESTIMATED`, cắt ngắn văn bản an toàn.
- `src/services/aiAnalyzer.js`: Hỗ trợ mode `remote` gửi multipart/form-data ảnh JPEG nén sang NV3, thêm header `X-API-Key` bảo mật, timeout 20s, retry 1 lần khi lỗi mạng/5xx, fail-safe chuyển pending.
- `docs/INTEGRATION_NV3.md`: Tài liệu đặc tả tích hợp NV4 - NV3, bảng ánh xạ trường, cờ trust_flags, hướng dẫn cấu hình và curl mẫu.
- Tests: `tests/domain/aiContract.test.js` (9 tests), `tests/services/aiAnalyzerRemote.test.js` (8 tests). Tổng 17 tests mới passed.
