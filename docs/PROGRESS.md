# Tiến Độ Triển Khai Module NV4 (Báo Cáo Ngập & Xác Thực)

## Hiện trạng tổng quan
- **Prompt đã hoàn thành:** P1, P2, P3, P5, P4, P6, P7, Tích hợp NV3, P9 (Toàn diện 13/13 mục), P8 (Toàn bộ 3 nhóm Demo, Verify, Handoff & Test Cases).
- **Tổng số test hiện tại:** 198 passed / 0 failed (20 test files).
- **Benchmark 1000 điểm:**
  + GET `/api/flood-points.geojson`: ~77 ms (< 200 ms: ĐẠT)
  + GET `/api/flood-prone`: ~17 ms (< 200 ms: ĐẠT)
  + ETag 304: ĐẠT
- **Kịch bản E2E:** 6/6 bước PASS (`npm run e2e`).
- **Kiểm tra tổng thể (`npm run verify`):** 6/6 mục PASS (npm test, git .env, uploads sạch, AI/DATA mode, 9 API endpoints trên server tạm, npm run e2e). Báo cáo tại `docs/VERIFY_REPORT.md`.
- **Trạng thái:** HOÀN THÀNH TOÀN DIỆN MODULE NV4. SẴN SÀNG BÀN GIAO.

---

## Chi tiết các prompt

### P8: Chuẩn bị Demo & Bàn giao NV4 (ĐÃ HOÀN THÀNH TOÀN BỘ 3 NHÓM)
- **Nhóm 1 – Demo & Benchmark (ĐÃ XONG - 5 tests passed):**
  + `scripts/demo-reset.js` & lệnh `npm run demo:reset`: Thiết lập 12 điểm ngập chuẩn (6 active đủ mức low/med/high, 3 pending, 3 resolved, >=4 prone) với mốc thời gian tương đối (10 - 90 phút trước) không bị job 6h tự động đóng điểm; từ chối khi `DATA_MODE=real`; idempotency không nhân đôi khi chạy lại; báo lỗi khi DB chưa migrate.
  + `scripts/benchmark.js`: Đã sửa sang dùng DB tạm riêng biệt (`./data/benchmark_temp.sqlite`), dọn sạch và xóa file sau khi chạy, hoàn toàn không đụng DB dev.
  + Test: `tests/demoReset.test.js` (5 tests mới). Mốc test: 193 -> 198 tests.
- **Nhóm 2 – Kiểm tra tổng & Gói phụ thuộc (ĐÃ XONG):**
  + `scripts/verify.js` & lệnh `npm run verify`: Tự động kiểm tra 6 tiêu chí (npm test, .env ngoài git, thư mục uploads sạch, AI_MODE/DATA_MODE hợp lệ, 9 endpoints API trên server port ngẫu nhiên với DB tạm, npm run e2e). Báo cáo kết quả tại `docs/VERIFY_REPORT.md`.
  + `package.json`: Phân định chuẩn xác dependencies phục vụ runtime và devDependencies cho test (vitest, supertest). Server chạy độc lập không phụ thuộc thư viện dev.
- **Nhóm 3 – Tài liệu bàn giao & Test Cases (ĐÃ XONG):**
  + `docs/NV4_HANDOFF.md`: Kiến trúc phân tầng, sơ đồ mermaid luồng báo cáo, bảng luật nghiệp vụ từ `rules.js`, cách chạy, cách đổi AI_MODE sang remote (cổng 3001), cách chuyển DATA_MODE=real (seed:clear), các giới hạn đã biết và checklist trước khi triển khai production.
  + `docs/TEST_CASES.csv`: Danh mục 57 test cases chi tiết (id, mô tả, đầu vào, kết quả mong đợi, kết quả thực tế, đạt/không) bao gồm unit test, integration test, security test và checklist 15 tình huống mobile test cho NV6 sử dụng.

### P9: Rà soát Bảo Mật & Độ Bền (ĐÃ HOÀN THÀNH TOÀN DIỆN 13/13 MỤC)
- **Nhóm 1 – Mức Cao (ĐÃ XONG - 12 tests passed):**
  + Upload, Static, Chống lạm dụng IP, Cấu hình Production, Trust Proxy, AI Remote.
  + Test: `tests/securityGroup1.test.js` (12 tests).
- **Nhóm 2 (Mục 7-10) – Mức Trung (ĐÃ XONG - 6 tests passed):**
  + Mục 7 (SQL Injection), Mục 8 (XSS Static Analysis), Mục 9 (Header bảo mật), Mục 10 (Lỗi/404 JSON).
  + Test: `tests/securityGroup2.test.js` (6 tests).
- **Nhóm 2 & 3 (Mục 11-13) – Mức Trung & Nhỏ (ĐÃ XONG - 7 tests passed):**
  + Mục 11 (Độ bền lưu trữ & Graceful Shutdown), Mục 12 (Quyền riêng tư & EXIF), Mục 13 (scripts/seedClear.js).
  + Test: `tests/securityGroup3.test.js` (7 tests).
- **Nâng cấp P9 Mục 5 (Cấu hình TRUST_PROXY loopback tunnel & CORS):**
  + Ngoài production tự động nhận `'loopback'` (Express chỉ tin `X-Forwarded-*` khi kết nối trực tiếp đến từ 127.0.0.1/::1, tức tunnel chạy local), không cần đặt thêm biến; production mặc định `false`.
  + CORS và limiter dùng `req.hostname`, `req.ip` của Express.
  + Test: `tests/securityTrustProxy.test.js` (10 tests mới). Mốc test: 183 -> 193 tests.
- **Tài liệu:** `docs/SECURITY_REVIEW.md`, `docs/MOBILE_TEST.md` (hợp nhất đầy đủ checklist 15 tình huống), `.env.example`.

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
