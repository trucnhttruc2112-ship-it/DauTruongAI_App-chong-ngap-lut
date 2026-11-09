# FloodLens – NV3: AI phân tích ảnh ngập đường và Backend

Backend độc lập dùng JavaScript ES Modules, Express và SDK `@google/genai`.
Phạm vi NV3: nhận ảnh, kiểm tra ảnh, gọi Gemini, chuẩn hóa JSON và cung cấp trang kiểm thử.
Không triển khai frontend chính, bản đồ, database, GPS, dự báo thời tiết hay định tuyến.

## 1. Cài đặt và chạy

Yêu cầu Node.js **20.9 trở lên** (đã kiểm thử trên 20.14.0), npm và kết nối mạng khi cài dependencies.
Các phiên bản được khóa trong `package-lock.json`; SDK Gemini dùng nhánh 2.x tương thích Node 20.

Từ thư mục repository:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Mở `backend/.env`, điền API key rồi chạy:

```powershell
npm start
```

Trang kiểm thử: <http://localhost:3001/test>
Health: <http://localhost:3001/api/health>

Khi chưa có API key, kiểm thử HTTP bằng:

```powershell
npm run start:mock
```

Lệnh này bật mock cho tiến trình hiện tại, không sửa `.env`.
Mock luôn trả `status: "uncertain"`, `model: "mock"`, `mode: "mock"` và thông báo
ảnh chưa được AI phân tích. Không có chuyển sang mock tự động khi Gemini lỗi.
Dừng tiến trình bằng Ctrl+C. `npm run dev` chạy với chế độ theo dõi thay đổi.

## 2. Cấu hình Gemini

Tạo key trong [Google AI Studio](https://aistudio.google.com/apikey).
Chỉ đặt key ở backend, tuyệt đối không đưa vào mã frontend, ảnh chụp màn hình hay Git.

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `GEMINI_API_KEY` | rỗng | Key của Gemini Developer API; bắt buộc khi không dùng mock |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Model có nhận ảnh và structured JSON output |
| `PORT` | `3001` | Cổng HTTP, 1–65535 |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Danh sách HTTP(S) origin được phép, cách nhau bằng dấu phẩy |
| `MOCK_GEMINI` | `false` | Chỉ chấp nhận `true` hoặc `false` |
| `GEMINI_TIMEOUT_MS` | `30000` | Thời hạn gọi Gemini, 1–120000 ms |

`.env` luôn được đọc từ thư mục backend, không phụ thuộc thư mục chạy lệnh.
Biến môi trường của tiến trình có ưu tiên cao hơn `.env`.
`.gitignore` loại trừ `.env`, các biến thể `.env.*` (trừ mẫu), `node_modules`, log và coverage.

Model mặc định được chọn theo [tài liệu Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).
Quyền truy cập và quota phụ thuộc project/key; có thể thay `GEMINI_MODEL` mà không sửa code.
Tài liệu kỹ thuật: [structured output của SDK](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html)
và [lịch thay đổi model](https://ai.google.dev/gemini-api/docs/deprecations).

CORS cho phép các origin được cấu hình và origin của chính backend (để dùng `/test`).
Origin phải gồm giao thức, host, port nếu có; không dùng wildcard, đường dẫn hoặc thông tin đăng nhập.
Request không có Origin (ví dụ curl) vẫn được phép. CORS không phải cơ chế xác thực.

## 3. Hợp đồng API cho NV4

### POST /api/analyze-flood

Gửi `multipart/form-data` với **đúng một file** ở trường `image`; không gửi thêm trường khác.

- Nội dung ảnh JPEG, PNG hoặc WebP tĩnh; tối đa **5.242.880 byte (5 MiB, gọi là 5 MB trong API)**.
- Kiểm tra nội dung và giải mã ảnh bằng sharp, không tin đuôi file hoặc MIME do client khai báo.
- Ảnh hỏng, giả mạo, ảnh động hoặc trên 25 triệu pixel bị từ chối.
- Trước khi gửi Gemini: áp dụng hướng EXIF, giới hạn cạnh dài 2048 pixel, chuyển JPEG và loại metadata.
- Ảnh được xử lý trong RAM, không lưu vào database hoặc thư mục upload. Trong chế độ Gemini, ảnh đã xử lý được gửi tới Google.

Thành công trả HTTP **200**, trực tiếp là đối tượng JSON:

```json
{
  "isFlooded": true,
  "status": "flooded",
  "severity": "medium",
  "evidence": ["Nước phủ một phần mặt đường"],
  "summary": "Ảnh có dấu hiệu ngập đường; cần xác minh thực địa.",
  "needsVerification": true,
  "analyzedAt": "2026-11-09T02:00:00.000Z",
  "model": "gemini-3.8-flash",
  "mode": "gemini"
}
```

Đây là ví dụ hợp đồng, không phải kết quả kiểm thử Gemini thật.

| Trường | Kiểu / giá trị | Quy tắc |
| --- | --- | --- |
| `status` | `flooded`, `not_flooded`, `uncertain` | Không đủ bằng chứng thì uncertain |
| `isFlooded` | boolean hoặc null | flooded → true; not_flooded → false; uncertain → null |
| `severity` | `none`, `low`, `medium`, `high`, `unknown` | not_flooded → none; uncertain → unknown; flooded → low/medium/high/unknown |
| `evidence` | string[] | Tối đa 8 dấu hiệu, mỗi dấu hiệu tối đa 300 ký tự; có thể rỗng khi uncertain |
| `summary` | string | Mô tả ngắn tiếng Việt, tối đa 600 ký tự |
| `needsVerification` | boolean | Luôn true, do backend thiết lập |
| `analyzedAt` | string | Thời điểm backend xử lý, ISO 8601 UTC; **không phải thời điểm chụp** |
| `model` | string | Giá trị GEMINI_MODEL; mock dùng "mock" |
| `mode` | `gemini` hoặc `mock` | NV4 phải hiển thị rõ khi là mock |

Backend kiểm tra kiểu, enum, độ dài và tính nhất quán.
Kết luận flooded/not_flooded nhưng không có bằng chứng, hoặc severity mâu thuẫn,
được hạ về uncertain. JSON sai hoặc thiếu trường bắt buộc trả 502.
Prompt yêu cầu chỉ mô tả dấu hiệu quan sát, không suy đoán độ sâu chính xác,
vị trí, thời gian chụp hay đường an toàn. Bộ kiểm tra có thêm chặn các mẫu
khẳng định phổ biến; không thay thế kiểm chứng thực địa hoặc đánh giá độ chính xác AI.
NV4 không được diễn giải `not_flooded` thành cam kết tuyến đường an toàn.

Ví dụ fetch phía frontend:

```javascript
async function analyzeFlood(file) {
  const body = new FormData();
  body.append('image', file);
  const response = await fetch('http://localhost:3001/api/analyze-flood', {
    method: 'POST',
    body,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Không thể phân tích ảnh.');
  }
  return data;
}
```

**Không tự đặt Content-Type khi gửi FormData.** Trình duyệt tự tạo multipart boundary.
Cấu hình origin frontend trong ALLOWED_ORIGINS và khởi động lại backend khi thay `.env`.

Ví dụ Windows PowerShell (dùng `curl.exe`, tránh alias `curl`):

```powershell
curl.exe http://localhost:3001/api/health
curl.exe -X POST http://localhost:3001/api/analyze-flood -F "image=@C:/images/duong-ngap.jpg"
```

### GET /api/health

Trả 200 khi backend đang chạy:

```json
{
  "status": "ok",
  "service": "floodlens-nv3",
  "mode": "gemini",
  "gemini": {
    "configured": false,
    "model": "gemini-3.8-flash",
    "connectivity": "not_checked"
  },
  "analysisReady": false
}
```

`configured` chỉ cho biết có key, không xác nhận key hợp lệ.
`analysisReady` là trạng thái sẵn sàng về cấu hình (hoặc mock).
Health không gọi Google, không tiêu tốn quota và không tiết lộ key.

### GET /test

Trang HTML chỉ dùng kiểm thử NV3: chọn ảnh, xem trước, gửi phân tích,
hiển thị loading và JSON/lỗi. Nhãn mock được hiển thị rõ.
Kết quả được chèn bằng `textContent`, không thực thi HTML từ model.

## 4. Lỗi và cách xử lý

Mọi lỗi API có dạng:

```json
{
  "error": {
    "code": "IMAGE_REQUIRED",
    "message": "Vui lòng gửi một ảnh trong trường image."
  }
}
```

| HTTP | Code | Xử lý |
| --- | --- | --- |
| 400 | `IMAGE_REQUIRED` | Chọn ảnh không rỗng, gửi trường image |
| 400 | `INVALID_UPLOAD` | Kiểm tra boundary, tên field, chỉ một file và không có field phụ |
| 403 | `ORIGIN_NOT_ALLOWED` | Bổ sung đúng origin frontend vào ALLOWED_ORIGINS |
| 404 | `NOT_FOUND` | Kiểm tra đường dẫn endpoint |
| 413 | `IMAGE_TOO_LARGE` | Giảm file xuống tối đa 5 MB |
| 415 | `MULTIPART_REQUIRED` | Dùng FormData, không gửi JSON/base64 trực tiếp |
| 415 | `UNSUPPORTED_IMAGE` | Chuyển ảnh sang JPEG, PNG hoặc WebP |
| 415 | `INVALID_IMAGE` | Thử ảnh không hỏng, tối đa 25 triệu pixel |
| 415 | `ANIMATED_IMAGE_UNSUPPORTED` | Dùng ảnh tĩnh |
| 429 | `GEMINI_QUOTA_EXCEEDED` | Kiểm tra quota/rate limit project, chờ trước khi thử lại |
| 502 | `GEMINI_AUTH_ERROR` | Kiểm tra key/quyền nếu Google trả 401/403 |
| 502 | `GEMINI_API_ERROR` | Kiểm tra mạng, model và cấu hình project; Google có thể trả 400 cho key sai |
| 502 | `GEMINI_INVALID_RESPONSE` | Model trả JSON/giá trị sai, bị chặn hoặc bị cắt; thử ảnh khác hoặc model phù hợp |
| 503 | `GEMINI_NOT_CONFIGURED` | Điền GEMINI_API_KEY hoặc bật mock để chỉ kiểm thử HTTP |
| 504 | `GEMINI_TIMEOUT` | Thử lại sau hoặc điều chỉnh timeout hợp lý |
| 500 | `INTERNAL_ERROR` | Kiểm tra backend; client không nhận stack trace |

Backend không tự retry Gemini để tránh phát sinh nhiều lượt gọi ngoài dự kiến.
Khi quá hạn, client SDK bị hủy; việc hủy không bảo đảm Google đã ngừng xử lý request.
Không trả/log thông báo thô từ provider, key, stack trace hoặc nội dung ảnh.

## 5. Kiểm thử

```powershell
npm run check
npm test
```

Bộ test sử dụng Node test runner, ảnh được tạo cục bộ và HTTP server ở cổng ngẫu nhiên.
Bao phủ cấu hình; chuẩn hóa JSON; JPEG/PNG/WebP; EXIF; ảnh động/hỏng/quá số pixel;
ngưỡng đúng 5 MB và vượt một byte; thiếu ảnh; multipart sai; CORS; health; trang test;
key thiếu; Gemini quota/timeout/lỗi/JSON sai; che giấu lỗi nội bộ.
Có kiểm thử SDK thật gửi HTTP tới server giả cục bộ để kiểm tra serialization và mã lỗi.
Các test này **không gọi dịch vụ Gemini thật, không chứng minh độ chính xác AI**.

Để gọi Gemini thật, cấu hình key hợp lệ, `MOCK_GEMINI=false`, chọn ảnh đường phố thực tế:

```powershell
npm run test:live -- "C:/images/duong-ngap.jpg"
```

Lệnh mở backend tạm, upload ảnh qua HTTP, gọi Gemini và in HTTP status cùng JSON.
Thiếu key, thiếu đường dẫn hoặc đang bật mock: thoát mã 2, không báo thành công.
Request có lỗi: thoát mã 1. Chỉ HTTP thành công với mode gemini mới thoát mã 0.
Lượt gọi này có thể dùng quota/tính phí của project.
Nên đánh giá thủ công ảnh ngập, đường khô, đường ướt, ảnh mờ và ảnh không có đường
trước khi sử dụng kết quả phân loại.

## 6. Cấu trúc và bàn giao

- `src/config.js`: đọc và kiểm tra biến môi trường.
- `src/app.js`: Express, upload, CORS, endpoint và lỗi JSON.
- `src/server.js`: khởi động, tải .env và tắt tiến trình.
- `src/gemini.js`: prompt, JSON schema, SDK, mock và deadline.
- `src/utils.js`: giải mã/chuẩn bị ảnh và chuẩn hóa kết quả.
- `public/test.html`: trang kiểm thử độc lập.
- `tests/`: unit test và kiểm thử HTTP/SDK cục bộ.
- `scripts/`: kiểm tra cú pháp, chạy mock và kiểm thử Gemini thật.

Backend phục vụ phát triển/tích hợp NV3; xác thực người dùng, lưu báo cáo,
giới hạn lưu lượng triển khai công khai và vận hành hosting chưa nằm trong phần triển khai này.
NV4 chỉ cần ghép API theo hợp đồng ở trên và phân biệt rõ kết quả mock.

## 7. Kết quả kiểm tra bàn giao (09/11/2026)

- Cài dependencies thành công; npm audit khi cài báo 0 vulnerabilities.
- `npm run check`: đạt cho mã backend, scripts, tests và JavaScript trong trang /test.
- `npm test`: **24/24 đạt**, không có test bị bỏ qua.
- Khởi động tiến trình bằng script mock: đạt; health, /test và upload ảnh đều trả HTTP 200.
- Lệnh test:live khi chưa có key/đường dẫn thoát đúng mã 2, không báo AI thành công.
- Chưa gọi Gemini thật vì môi trường không có GEMINI_API_KEY; chưa đánh giá độ chính xác phân loại.
- Trang /test đã được kiểm tra phục vụ HTTP và cú pháp script; chưa kiểm thử tương tác bằng trình duyệt tự động.

Node 20.14 có thể in ExperimentalWarning về JSON modules từ dependency;
đây không phải lỗi kiểm thử.
