# Báo Cáo Rà Soát Bảo Mật & Độ Bền Module NV4 (Security Review)

Báo cáo tổng hợp kết quả rà soát, vá lỗ hổng và củng cố độ bền hệ thống cho module NV4 (Báo cáo ngập & Xác thực cộng đồng) theo 13 mục tiêu chuẩn.

---

## 1. Bảng tổng hợp 13 mục rà soát bảo mật & độ bền

| STT | Vấn đề bảo mật / Độ bền | Mức độ | File liên quan | Cách sửa & Biện pháp xử lý | Đã sửa | Test chứng minh |
| :---: | :--- | :---: | :--- | :--- | :---: | :--- |
| **1** | **Bảo vệ Upload ảnh**: Tránh tệp độc hại, decompression bomb, path traversal, lộ thư mục uploads | **Cao** | `src/utils/imageUtils.js`, `src/services/reportService.js`, `src/server.js` | Kiểm tra magic bytes (JPEG/PNG/WebP); cấu hình `limitInputPixels: 50M` cho Sharp; đặt tên UUID random; kiểm tra path không thoát `uploads/`; `/uploads` chỉ cho phép GET/HEAD với đuôi `.jpg, .jpeg, .png, .webp`, chặn directory listing & nosniff. | ✅ | `tests/securityGroup1.test.js` (Test 1.1, 1.2, 1.3) |
| **2** | **Phục vụ tĩnh & Chống rò rỉ dữ liệu**: Tránh path traversal, không để lộ `.env`, `.sqlite` hoặc code integration trên production | **Cao** | `src/server.js` | Thêm middleware chặn triệt để mọi request chứa `.env`, `.sqlite`, `..` hoặc file ẩn (trả về 403); cấu hình `/integration` trả về 404 khi `NODE_ENV=production`. | ✅ | `tests/securityGroup1.test.js` (Test 2.1, 2.2) |
| **3** | **Chống lạm dụng & Spam xác nhận**: Đổi deviceId liên tục, spam 'ended' để xóa điểm ngập thật | **Cao** | `src/middleware/rateLimiter.js`, `src/routes/floodPointRoutes.js`, `src/services/confirmationService.js` | Thêm `confirmIpLimiter` (10 request/phút/IP) trên endpoint confirm; giữ nguyên kiểm tra bán kính 300m và yêu cầu 2 thiết bị khác nhau để đóng điểm ngập. | ✅ | `tests/securityGroup1.test.js` (Test 3.1), `tests/p4.test.js` |
| **4** | **Cấu hình môi trường Production**: Vô hiệu cơ chế giả lập, cấm chạy mock/demo ở production | **Cao** | `src/config/env.js`, `src/server.js` | Vô hiệu các header giả lập (`x-fake-now`, `x-ai-mode`, `simulate`) ngoài test; `validateEnvironmentConfig` từ chối khởi động nếu `AI_MODE=mock` hoặc `DATA_MODE=demo` trên production trừ khi có cờ `ALLOW_DEMO_IN_PROD=true` (kèm cảnh báo). | ✅ | `tests/securityGroup1.test.js` (Test 4.1, 4.2, 4.3) |
| **5** | **Cấu hình Trust Proxy an toàn & Hỗ trợ Tunnel**: Tránh giả mạo IP client qua X-Forwarded-For nhưng hỗ trợ chạy qua tunnel | **Cao** | `src/config/env.js`, `src/server.js`, `src/middleware/rateLimiter.js` | Mặc định: ngoài production dùng `'loopback'` (Express chỉ tin header `X-Forwarded-*` khi kết nối trực tiếp đến từ loopback 127.0.0.1/::1, tức tunnel cloudflared/ngrok chạy local); trên production mặc định `false` (bắt buộc đặt tường minh số hop hoặc IP proxy). Logic CORS cùng nguồn và limiter dùng `req.hostname`, `req.ip` của Express thay vì tự đọc header. | ✅ | `tests/securityGroup1.test.js` (Test 5.1), `tests/securityTrustProxy.test.js` |
| **6** | **Bảo mật kết nối AI NV3 từ xa**: Chống lộ API Key, chống tấn công SSRF và tràn bộ nhớ | **Cao** | `src/services/aiAnalyzer.js` | `AI_API_KEY` chỉ gửi trong header `X-API-Key`, không ghi log hay phản hồi; URL AI chỉ đọc từ biến môi trường và chỉ nhận protocol `http:`/`https:`; giới hạn dung lượng phản hồi từ NV3 tối đa 1MB (`AI_MAX_RESPONSE_BYTES`). | ✅ | `tests/securityGroup1.test.js` (Test 6.1, 6.2) |
| **7** | **Chống SQL Injection**: Đảm bảo toàn bộ câu lệnh truy vấn CSDL đều dùng tham số hóa | **Trung** | `src/repositories/*.js` | Mọi truy vấn đọc/ghi đều sử dụng Parameterized Query của SQLite (`@param` hoặc `?`), không nối chuỗi dữ liệu người dùng. Thử nghiệm với các payload inject nguy hiểm, bảng dữ liệu vẫn được bảo vệ nguyên vẹn. | ✅ | `tests/securityGroup2.test.js` (Test 7.1, 7.2) |
| **8** | **Chống tấn công XSS (Frontend)**: Đảm bảo giao diện người dùng không chèn mã script độc hại | **Trung** | `public/nv4/*.js`, `integration/*` | Phân tích quét tĩnh toàn bộ mã nguồn frontend: chỉ cho phép dùng `textContent` và `createElement` để hiển thị dữ liệu server; cấm hoàn toàn gán giá trị vào `innerHTML` (chỉ cho phép gán rỗng `''` để dọn sạch). | ✅ | `tests/securityGroup2.test.js` (Test 8.1) |
| **9** | **Header bảo mật cơ bản**: Thiếu các tiêu đề bảo vệ trình duyệt chuẩn | **Trung** | `src/server.js` | Thêm middleware nhẹ đặt các tiêu đề bảo mật: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` mà không cần cài đặt thêm thư viện cồng kềnh. | ✅ | `tests/securityGroup2.test.js` (Test 9.1) |
| **10** | **Xử lý lỗi & 404 chuẩn JSON**: Tránh lộ stack trace, đường dẫn máy chủ cục bộ hoặc cấu trúc SQL | **Trung** | `src/server.js` | Đăng ký handler 404 cho mọi route không tồn tại trả về `{ ok: false, error: { code: 'NOT_FOUND', message } }`; lỗi 500 được chuẩn hóa thành `INTERNAL_SERVER_ERROR`, loại bỏ toàn bộ stack trace và đường dẫn máy chủ. | ✅ | `tests/securityGroup2.test.js` (Test 10.1, 10.2) |
| **11** | **Độ bền lưu trữ & Graceful Shutdown**: Xử lý đĩa đầy, sập tiến trình bất ngờ | **Trung** | `src/utils/imageUtils.js`, `src/server.js` | Bắt lỗi `ENOSPC` (hết đĩa) và `EACCES` khi ghi ảnh, dọn dẹp file dở dang và trả về mã lỗi 507 (`STORAGE_FULL`); bắt tín hiệu `SIGTERM`/`SIGINT` dừng background job và đóng DB an toàn (`shutdownServer`); bắt `unhandledRejection`. | ✅ | `tests/securityGroup3.test.js` (Test 11.1, 11.2, 11.3) |
| **12** | **Quyền riêng tư (Privacy)**: Rò rỉ vị trí qua EXIF ảnh; người dùng chưa được thông báo thu thập dữ liệu | **Trung** | `src/utils/imageUtils.js`, `public/nv4/reportFlow.js` | Sharp tự động loại bỏ toàn bộ metadata EXIF/GPS khỏi ảnh trước khi lưu trữ; thêm thông báo "Ứng dụng sẽ dùng vị trí và ảnh bạn chụp để ghi nhận điểm ngập" trước nút gửi báo cáo. | ✅ | `tests/securityGroup3.test.js` (Test 12.1, 12.2) |
| **13** | **Xử lý CLI seedClear an toàn**: Tránh văng lỗi unhandled crash khi DB chưa migrate | **Nhỏ** | `scripts/seedClear.js` | Bắt lỗi `no such table`, in thông báo tiếng Việt: "DB chưa được khởi tạo. Chạy npm run migrate trước.", thoát với exit code 1 và không in stack trace. | ✅ | `tests/securityGroup3.test.js` (Test 13.1, 13.2) |

---

## 2. Việc cần làm khi triển khai (Production Deployment Checklist)

Khi đưa module NV4 lên môi trường Production, quản trị viên hệ thống bắt buộc phải thực hiện các bước cấu hình sau:

1. **Thiết lập `NODE_ENV=production`**:
   - Tự động tắt toàn bộ các cờ giả lập thời gian (`x-fake-now`), cờ ép kết quả AI (`x-ai-simulate`, `x-ai-mode`), cờ giả lập lỗi (`x-simulate-db-error`).
   - Tự động khóa và trả về 404 cho thư mục ví dụ `/integration`.
2. **Cấu hình `ALLOWED_ORIGINS`**:
   - Bắt buộc khai báo danh sách tên miền được phép gọi API (ví dụ: `https://ngaplut.dongnai.gov.vn,https://app.dongnai.gov.vn`).
   - Server sẽ từ chối khởi động nếu `NODE_ENV=production` mà `ALLOWED_ORIGINS` bị bỏ trống.
3. **Cấu hình `TRUST_PROXY`**:
   - Mặc định trên môi trường Production là `false`. Nếu triển khai sau Nginx, HAProxy, Cloudflare hoặc AWS ALB/Load Balancer, bắt buộc phải đặt tường minh số hop (ví dụ: `TRUST_PROXY=1`) hoặc dải CIDR tin cậy (ví dụ: `TRUST_PROXY=10.0.0.0/8`).
   - Tuyệt đối không để `TRUST_PROXY=true` trong môi trường sản xuất khi không có proxy chặn trước, để ngăn chặn kẻ tấn công tự chế header `X-Forwarded-For` nhằm vượt qua hệ thống rate limiter.
   - Trong môi trường phát triển / thử nghiệm, mặc định hệ thống đặt `'loopback'` để hỗ trợ chạy qua tunnel (Cloudflared/Ngrok) mà không cần cấu hình thêm, đảm bảo chỉ tin cậy header khi kết nối đến trực tiếp từ máy cục bộ (`127.0.0.1`/`::1`).
4. **Bảo mật khóa `AI_API_KEY` & `AI_ANALYZE_URL`**:
   - Khai báo `AI_ANALYZE_URL` trỏ tới endpoint HTTPS của NV3.
   - Giữ bí mật `AI_API_KEY` trong file `.env` hoặc hệ thống quản lý Secret của máy chủ, tuyệt đối không commit lên Git.
5. **Cấm chạy chế độ thử nghiệm trên Production**:
   - Bắt buộc sử dụng `DATA_MODE=real` và `AI_MODE=remote` (hoặc `local`).
   - Server sẽ từ chối khởi động nếu phát hiện `AI_MODE=mock` hoặc `DATA_MODE=demo` trên production (trừ khi có chủ ý đặt `ALLOW_DEMO_IN_PROD=true`).
6. **Quyền truy cập thư mục `uploads/`**:
   - Đảm bảo tiến trình Node.js có quyền ghi vào thư mục `UPLOAD_DIR` và dung lượng ổ cứng được giám sát cảnh báo ngưỡng đầy (>80%).
