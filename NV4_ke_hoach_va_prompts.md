# NV4 – Báo cáo ngập & Xác thực: Phân tích, Kế hoạch, Bộ Prompt cho Antigravity

---

# PHẦN A. PHÂN TÍCH CHUYÊN SÂU NV4

## A1. NV4 thực chất là gì?
NV4 là **"trạm trung chuyển dữ liệu"** của cả hệ thống. Mọi điểm ngập hiển thị trên bản đồ (NV1), trang phường (NV2), cảnh báo (NV5) đều **bắt nguồn từ dữ liệu NV4 tạo ra**. Nếu NV4 chậm hoặc sai định dạng, 4 NV còn lại đều bị chặn.

```
Người dùng (điện thoại)
   │  chụp ảnh + GPS
   ▼
[NV4] Kiểm tra vị trí/ảnh ──► [NV3] AI Gemini phân tích ảnh
   │                              │ (isFlood, mức độ, độ tin cậy)
   ◄──────────────────────────────┘
   ▼
[NV4] Gộp trùng → Lưu điểm ngập → Cập nhật "đường hay ngập"
   │
   ├──► NV1: GeoJSON để vẽ bản đồ
   ├──► NV2: danh sách theo phường + màn xác nhận vẫn ngập/hết ngập
   └──► NV5: danh sách điểm hay ngập để đối chiếu lượng mưa
```

## A2. Bóc tách 7 đầu việc thành các "bài toán thật"

| # | Đầu việc đề bài | Bài toán kỹ thuật thật sự | Độ khó |
|---|---|---|---|
| 1 | Gửi báo cáo ngập | API nhận multipart, nén ảnh, validate, chống spam, quy trình xử lý bất đồng bộ | Trung bình |
| 2 | Mở camera + GPS | `getUserMedia` / `<input capture>`, `navigator.geolocation`, xử lý xin quyền bị từ chối, **bắt buộc HTTPS trên điện thoại** | Trung bình – dễ vỡ khi demo |
| 3 | Kiểm tra vị trí | Nằm trong ranh giới Đồng Nai? Độ chính xác GPS đủ tốt? Thời điểm chụp còn mới? Ảnh có bị dùng lại? | Cao (nhiều luật) |
| 4 | Nhận kết quả NV3 | Thống nhất **hợp đồng JSON**, xử lý AI lỗi/timeout/trả sai format | Trung bình |
| 5 | Lưu điểm ngập | Chọn nơi lưu, schema, **gộp báo cáo trùng**, vòng đời trạng thái | **Cao nhất** |
| 6 | Cập nhật đường hay ngập | Định nghĩa "hay ngập" bằng số, đếm theo *sự kiện ngập* chứ không đếm theo *số báo cáo* | Cao |
| 7 | Kết nối NV1 | Chuẩn GeoJSON + API đọc, thống nhất màu/trạng thái | Dễ nếu chốt contract sớm |

## A3. Những vấn đề dễ làm hỏng sản phẩm (cần xử lý chủ động)

1. **Camera & GPS chỉ chạy trên HTTPS** (trừ `localhost`). Test trên điện thoại bằng IP LAN `http://192.168...` sẽ *không* lấy được GPS/camera. → Phải dùng tunnel HTTPS (ngrok / cloudflared) hoặc deploy sớm. Đây là rủi ro #1 khi demo.
2. **Báo cáo trùng**: 10 người cùng báo 1 ngã tư ≠ 10 điểm ngập. Cần luật gộp (đề xuất bán kính 50 m, trong 6 giờ) → tăng `confirmCount`, không tạo điểm mới.
3. **"Số lần ngập" phải đếm sự kiện**, không đếm lượt báo. Một đợt ngập kéo dài 3 giờ với 20 báo cáo = **1 lần ngập**.
4. **Ảnh cũ/ảnh mạng/ảnh trong thư viện**: ưu tiên chụp trực tiếp từ camera; nếu cho chọn từ thư viện thì đánh dấu độ tin cậy thấp. Băm ảnh (SHA-256) để phát hiện ảnh gửi lặp.
5. **GPS sai số lớn** (trong nhà, nhiều tầng): từ chối hoặc cảnh báo khi `accuracy > 100 m`.
6. **Điểm ngập "treo" mãi**: không ai bấm "hết ngập" → bản đồ đỏ vĩnh viễn. Cần **TTL tự hết hạn** (đề xuất 6 giờ không có xác nhận mới).
7. **AI sai**: nếu Gemini trả `isFlood=false` hoặc confidence thấp → không đưa lên bản đồ ngay, để trạng thái `pending`/`rejected`.
8. **Phụ thuộc NV3**: NV3 chưa xong thì NV4 bị kẹt. → Viết `aiAnalyzer` **mock** theo đúng contract để làm song song.
9. **Lưu trữ ảnh khi deploy**: nhiều dịch vụ free (Render…) xóa đĩa khi restart. Demo ngắn thì ổn; cần nói rõ giới hạn hoặc dùng Cloudinary.
10. **Đơn vị hành chính/phường**: Đồng Nai đã sắp xếp lại đơn vị cấp xã/phường từ 2025. **Phải thống nhất với NV2 + NV6** dùng danh sách phường nào (cũ hay mới) *trước khi* thiết kế trường `wardId`. (Nên kiểm tra lại danh sách chính thức hiện hành.)
11. **Quyền riêng tư**: ảnh có thể chứa người/biển số. Không lưu EXIF thừa, không lưu thông tin cá nhân; chỉ dùng `deviceId` ẩn danh.
12. **Chống spam**: giới hạn tần suất theo `deviceId` + IP (vd 5 báo cáo/giờ).

## A4. Các quyết định thiết kế đề xuất (cần chốt với nhóm)

| Hạng mục | Đề xuất | Lý do |
|---|---|---|
| Stack | Node.js + Express (chung server NV3) | Cùng NV3, dễ ghép |
| Lưu dữ liệu | **SQLite (better-sqlite3)**; nếu cài lỗi trên Windows → file JSON qua lớp `repository` | Đủ nhanh, có truy vấn; hoán đổi được |
| Upload ảnh | `multer` (memory) + `sharp` nén ≤ 1280px, JPEG q80 | Giảm băng thông, giảm token gửi Gemini |
| Mô hình tọa độ | WGS84 (lat, lng) | Leaflet dùng trực tiếp |
| Geofence | Bounding box Đồng Nai (lat ≈ 10.35–11.60, lng ≈ 106.75–107.60) ở giai đoạn đầu; nâng lên polygon nếu NV6 có | Làm nhanh, đủ chặn sai lệch lớn |
| Trùng lặp | Bán kính **50 m**, cửa sổ **6 giờ**, cùng ảnh hash → loại | Có thể chỉnh trong `config` |
| Vòng đời | `pending → active → resolved` hoặc `expired` / `rejected` | Rõ ràng, dễ vẽ màu |
| Hết hạn | 6 giờ không có xác nhận mới → `expired` | Tránh điểm treo |
| Hết ngập | ≥ 2 thiết bị khác nhau báo "hết ngập" → `resolved` | Chống 1 người báo bậy |
| "Hay ngập" | ≥ **3 sự kiện ngập** trong 365 ngày tại cùng khu vực (cụm 100 m hoặc cùng tên đường) **hoặc** có cờ từ dữ liệu lịch sử NV6 | Có số liệu để nói trước ban giám khảo |
| Độ tin cậy | Điểm 0–100 từ: AI confidence, GPS accuracy, ảnh chụp trực tiếp, số xác nhận | Hiển thị & lọc |
| Màu mức độ (gợi ý cho NV1) | nhẹ = vàng, vừa = cam, nặng = đỏ, đã hết = xám, hay ngập = viền tím | Thống nhất sớm |

## A5. Hợp đồng dữ liệu (data contract) – để đưa cho NV1/NV2/NV3/NV5

**(a) NV3 → NV4: kết quả phân tích ảnh** (đề nghị NV3 chốt đúng mẫu này)
```json
{
  "isFlood": true,
  "confidence": 0.87,
  "severity": "medium",
  "estimatedDepthCm": 25,
  "description": "Đường ngập nước, xe máy lội nước ngang bánh",
  "reason": "Thấy mặt nước phủ mặt đường, phản chiếu",
  "error": null
}
```
`severity` ∈ `low | medium | high`. Khi lỗi: `isFlood:null, error:"mô tả"`.

**(b) NV4 → NV1/NV2/NV5: điểm ngập**
```json
{
  "id": "fp_01HX...",
  "lat": 10.9447, "lng": 106.8243,
  "address": "Ngã tư Amata, P. Long Bình",
  "street": "Xa lộ Hà Nội",
  "wardId": "long-binh",
  "status": "active",
  "severity": "medium",
  "estimatedDepthCm": 25,
  "trustScore": 78,
  "confirmStill": 3,
  "confirmEnded": 0,
  "reportCount": 5,
  "images": ["/uploads/2026/11/abc.jpg"],
  "isFloodProne": true,
  "floodEventCount": 4,
  "firstReportedAt": "2026-11-08T04:10:00Z",
  "lastUpdatedAt": "2026-11-08T05:02:00Z"
}
```

**(c) Danh sách API NV4 cung cấp**

| Method | Endpoint | Dùng bởi |
|---|---|---|
| POST | `/api/reports` | NV2 (form báo ngập) |
| GET | `/api/flood-points?status=active&wardId=` | NV1, NV2 |
| GET | `/api/flood-points.geojson?status=` | NV1 |
| GET | `/api/flood-points/:id` | NV1 (popup), NV2 |
| POST | `/api/flood-points/:id/confirm` `{type:"still"\|"ended", deviceId, lat, lng}` | NV2 |
| GET | `/api/flood-prone` | NV1, NV5 |
| GET | `/api/wards/:wardId/flood-points` | NV2 (trang phường) |
| GET | `/api/health` | tất cả |

---

# PHẦN B. BẢNG KẾ HOẠCH TRƯỚC KHI LÀM

## B1. Việc phải xong TRƯỚC khi viết code (Giai đoạn 0)

| # | Việc cần làm | Với ai | Đầu ra | Hạn |
|---|---|---|---|---|
| 0.1 | Họp 30 phút chốt **data contract** (A5) | NV1, NV2, NV3, NV5, NV6 | Tài liệu contract được tất cả đồng ý | Ngày 1 |
| 0.2 | Chốt stack, cấu trúc thư mục, nhánh Git, cổng server | NV3 | Repo + `README` quy ước | Ngày 1 |
| 0.3 | Chốt **luật nghiệp vụ** (bán kính, TTL, ngưỡng hay ngập, màu) | Cả nhóm | Bảng A4 được duyệt | Ngày 1 |
| 0.4 | Chốt danh sách phường/đơn vị hành chính | NV2, NV6 | `wards.json` | Ngày 1–2 |
| 0.5 | Xin NV6 bộ **dữ liệu điểm ngập mẫu** (≥ 20 điểm, có tọa độ, đường, phường, số lần ngập) | NV6 | `seed-flood-points.csv/json` | Ngày 2 |
| 0.6 | Xin NV3 bản **mock aiAnalyzer** hoặc tự viết theo contract (a) | NV3 | `services/aiAnalyzer.js` | Ngày 2 |
| 0.7 | Kế hoạch **HTTPS để test trên điện thoại** (ngrok/cloudflared hoặc deploy) | NV3 | Link HTTPS dùng được | Ngày 2 |
| 0.8 | Cài môi trường: Node LTS, Git, Antigravity, tài khoản ngrok | Bạn | Chạy được `node -v` | Ngày 1 |
| 0.9 | Viết **kịch bản kiểm thử** NV4 (A3 → test case) | NV6 hỗ trợ | Bảng test case | Ngày 2–3 |

## B2. Kế hoạch thực hiện NV4 (mỗi dòng ứng với 1 prompt ở Phần C)

| GĐ | Công việc | Prompt | Phụ thuộc | Ước lượng | Tiêu chí hoàn thành |
|---|---|---|---|---|---|
| 1 | Khởi tạo module, schema DB, seed dữ liệu | P1 | 0.1–0.5 | 2–3 giờ | Chạy server, DB có dữ liệu mẫu |
| 2 | Thư viện nghiệp vụ: khoảng cách, geofence, gộp trùng, vòng đời, hay ngập + unit test | P2 | P1 | 3–4 giờ | Test pass 100% |
| 3 | API `POST /api/reports` (nhận ảnh, kiểm tra, gọi AI, lưu) | P3 | P2, mock NV3 | 4 giờ | curl gửi được báo cáo, ra điểm ngập |
| 4 | API xác nhận vẫn ngập/hết ngập + tự hết hạn | P4 | P3 | 2–3 giờ | Trạng thái chuyển đúng |
| 5 | API đọc: danh sách, GeoJSON, hay ngập, theo phường | P5 | P3 | 2–3 giờ | NV1/NV2 gọi được |
| 6 | Module frontend: camera + GPS + gửi báo cáo + nút xác nhận | P6 | P3, P4 | 4 giờ | Chạy trên điện thoại qua HTTPS |
| 7 | Tích hợp NV1, NV2, NV5 (kiểm tra chéo) | P7 | P5, P6 | 2–3 giờ | Điểm hiện lên bản đồ |
| 8 | Test tự động, kịch bản lỗi, tài liệu `API.md` | P8 | P1–P7 | 3 giờ | Báo cáo test + tài liệu |
| 9 | Rà soát bảo mật & hiệu năng | P9 | P8 | 1–2 giờ | Danh sách lỗi đã sửa |

**Tổng ước lượng: ~24–30 giờ làm việc**, nên ưu tiên P1→P3→P5 trước (để NV1 có dữ liệu sớm), P4/P6 song song.

## B3. Rủi ro & phương án dự phòng

| Rủi ro | Phương án |
|---|---|
| NV3 trễ | Dùng mock aiAnalyzer, đổi sang thật chỉ bằng đổi biến `.env` |
| Không có HTTPS khi demo | Chuẩn bị tunnel + video demo dự phòng (NV6) |
| GPS không lấy được | Cho **ghim vị trí thủ công trên bản đồ** (fallback) và đánh dấu trustScore thấp |
| Gemini hết quota/lỗi | Trạng thái `pending`, cho phép duyệt tay hoặc hiển thị "chưa xác minh" |
| Cài `better-sqlite3` lỗi | Chuyển sang JSON store qua lớp repository |
| Dữ liệu demo ít | Dùng seed của NV6 + script sinh dữ liệu mô phỏng |

---

# PHẦN C. BỘ PROMPT CHO ANTIGRAVITY

> **Cách dùng:** (1) Tạo thư mục dự án, mở bằng Antigravity. (2) Dán **Prompt 0** vào file quy tắc dự án (AGENTS.md / rules) *hoặc* dán đầu phiên chat. (3) Chạy lần lượt P1 → P9, mỗi prompt xong thì chạy test, commit Git, rồi mới sang prompt tiếp. (4) Nếu Antigravity làm lệch, dán lại phần "Ràng buộc" của prompt đó.
> Nội dung trong `[ngoặc vuông]` là chỗ bạn điền theo thỏa thuận nhóm.

---

## PROMPT 0 – Bối cảnh & quy tắc chung (dán trước mọi thứ)

```
Bạn là kỹ sư backend/fullstack senior hỗ trợ tôi (NV4) trong dự án thi: ứng dụng cảnh báo & báo cáo ngập lụt tỉnh Đồng Nai có tích hợp AI (Gemini) phân tích ảnh.

PHẠM VI CỦA TÔI (NV4 – Báo cáo ngập & xác thực):
- Gửi báo cáo ngập (ảnh + GPS), mở camera, lấy GPS
- Kiểm tra vị trí/thời gian/ảnh báo cáo
- Nhận kết quả phân tích ảnh từ NV3 (AI Gemini)
- Lưu dữ liệu điểm ngập, gộp báo cáo trùng, quản lý vòng đời trạng thái
- Cập nhật danh sách đường/điểm hay ngập
- Cung cấp dữ liệu cho NV1 (bản đồ Leaflet), NV2 (giao diện, trang phường), NV5 (dự báo mưa Open-Meteo)

CÔNG NGHỆ: Node.js (LTS) + Express, JavaScript (ES modules), SQLite qua better-sqlite3 (đặt sau lớp repository để có thể thay bằng JSON store), multer, sharp, dotenv, zod (validate), express-rate-limit, vitest (test). Frontend: HTML/JS thuần dạng ES module, không framework nặng.

QUY TẮC BẮT BUỘC:
1. Mọi hằng số nghiệp vụ nằm trong src/config/rules.js (có comment tiếng Việt), không hard-code rải rác.
2. Không hard-code API key; đọc từ .env, cung cấp .env.example.
3. Mọi endpoint trả JSON dạng { ok: boolean, data?: ..., error?: { code, message } }. Thông báo lỗi bằng tiếng Việt thân thiện.
4. Validate đầu vào bằng zod; không tin dữ liệu từ client.
5. Code chia lớp: routes → controllers → services → repositories. Hàm nghiệp vụ thuần (không phụ thuộc Express/DB) nằm trong src/domain/ để test được.
6. Comment tiếng Việt ở các đoạn logic nghiệp vụ; tên biến/hàm tiếng Anh.
7. Mỗi tính năng phải có unit test hoặc test tích hợp; chạy test và báo kết quả trước khi kết luận xong.
8. Không thêm thư viện ngoài danh sách nếu chưa giải thích lý do.
9. Làm theo từng bước nhỏ; cuối mỗi bước liệt kê: file đã tạo/sửa, cách chạy, cách kiểm thử, việc còn tồn đọng.
10. Nếu thiếu thông tin hoặc có nhiều cách hiểu, hãy hỏi tôi tối đa 3 câu ngắn rồi mới làm.

HỢP ĐỒNG DỮ LIỆU (phải tuân thủ chính xác):
(a) Kết quả NV3 trả về cho NV4:
{ "isFlood": boolean|null, "confidence": 0..1, "severity": "low"|"medium"|"high", "estimatedDepthCm": number|null, "description": string, "reason": string, "error": string|null }
(b) Điểm ngập NV4 cung cấp:
{ id, lat, lng, address, street, wardId, status ("pending"|"active"|"resolved"|"expired"|"rejected"), severity, estimatedDepthCm, trustScore (0-100), confirmStill, confirmEnded, reportCount, images[], isFloodProne, floodEventCount, firstReportedAt, lastUpdatedAt }
(c) Endpoint: POST /api/reports; GET /api/flood-points; GET /api/flood-points.geojson; GET /api/flood-points/:id; POST /api/flood-points/:id/confirm; GET /api/flood-prone; GET /api/wards/:wardId/flood-points; GET /api/health.

LUẬT NGHIỆP VỤ MẶC ĐỊNH (đặt trong rules.js, chỉnh được):
- DUPLICATE_RADIUS_M = 50; DUPLICATE_WINDOW_HOURS = 6
- GPS_MAX_ACCURACY_M = 100; REPORT_MAX_AGE_MINUTES = 5 (từ lúc chụp đến lúc gửi)
- Đồng Nai bounding box: lat 10.35–11.60, lng 106.75–107.60
- AI_MIN_CONFIDENCE_ACTIVE = 0.6 (dưới ngưỡng → status "pending"); isFlood=false → "rejected"
- EXPIRE_AFTER_HOURS = 6 (active không có xác nhận mới → "expired")
- ENDED_CONFIRMATIONS_TO_RESOLVE = 2 thiết bị khác nhau
- FLOOD_PRONE_MIN_EVENTS = 3 trong FLOOD_PRONE_WINDOW_DAYS = 365; cụm khu vực = bán kính 100 m hoặc trùng tên đường
- RATE_LIMIT: 5 báo cáo / giờ / deviceId; 20 request / phút / IP
- "Số lần ngập" = số SỰ KIỆN ngập (một vòng đời active→resolved/expired), KHÔNG phải số lượt báo.

Hãy xác nhận bạn đã hiểu bằng cách tóm tắt lại trong 8 dòng, rồi chờ prompt tiếp theo của tôi.
```

---

## PROMPT 1 – Khởi tạo module, schema DB, dữ liệu mẫu

```
Nhiệm vụ P1: dựng khung dự án NV4 và tầng dữ liệu.

Làm các việc sau:
1. Tạo cấu trúc:
   src/{config,routes,controllers,services,repositories,domain,middleware,utils}
   data/ (chứa file SQLite, git-ignore), uploads/ (git-ignore, có .gitkeep), tests/, scripts/
   Tạo package.json (type: module), .env.example (PORT, DB_PATH, UPLOAD_DIR, AI_MODE=mock|real, PUBLIC_BASE_URL), .gitignore, README ngắn.
2. src/config/rules.js: toàn bộ hằng số nghiệp vụ trong Prompt 0, export object đóng băng (Object.freeze).
3. Schema SQLite (scripts/migrate.js, chạy idempotent):
   - flood_points(id TEXT PK, lat REAL, lng REAL, address TEXT, street TEXT, ward_id TEXT, status TEXT, severity TEXT, estimated_depth_cm INTEGER, trust_score INTEGER, confirm_still INTEGER, confirm_ended INTEGER, report_count INTEGER, is_flood_prone INTEGER, flood_event_count INTEGER, first_reported_at TEXT, last_updated_at TEXT, last_confirmed_at TEXT, historical_event_count INTEGER DEFAULT 0)
   - reports(id TEXT PK, flood_point_id TEXT FK, device_id TEXT, lat REAL, lng REAL, accuracy_m REAL, captured_at TEXT, created_at TEXT, image_path TEXT, image_sha256 TEXT, ai_json TEXT, trust_flags TEXT)
   - confirmations(id TEXT PK, flood_point_id TEXT FK, device_id TEXT, type TEXT CHECK in ('still','ended'), lat REAL, lng REAL, created_at TEXT, UNIQUE(flood_point_id, device_id, type))
   - flood_events(id TEXT PK, flood_point_id TEXT FK, started_at TEXT, ended_at TEXT, end_reason TEXT)  -- mỗi vòng đời = 1 sự kiện
   Thêm index: (status), (ward_id), (lat,lng), (image_sha256), (device_id, created_at).
4. Repository pattern: src/repositories/floodPointRepo.js, reportRepo.js, confirmationRepo.js, eventRepo.js với các hàm CRUD & truy vấn cần thiết (findActiveInBox(lat,lng,radius), listByStatus, listByWard, insert, update…). Mọi truy vấn dùng prepared statement.
5. scripts/seed.js: đọc data/seed-flood-points.json (tạo file mẫu 20 điểm ngập thực tế quanh Biên Hòa, Long Thành, Nhơn Trạch, Trảng Bom với trường street, wardId, historicalEventCount, isFloodProne — ghi chú rõ đây là dữ liệu giả lập chờ NV6 thay bằng dữ liệu thật) rồi nạp vào DB.
6. src/server.js tối giản: Express, cors, json, endpoint GET /api/health trả { ok:true, data:{ status:'up', time } }, static /uploads.
7. npm scripts: dev, start, migrate, seed, test.

Ràng buộc: chưa viết logic nghiệp vụ gộp trùng/vòng đời ở bước này.
Kiểm thử: chạy migrate, seed, khởi động server, gọi /api/health và in ra số điểm đã seed. Báo kết quả.
```

---

## PROMPT 2 – Thư viện nghiệp vụ (domain) + unit test

```
Nhiệm vụ P2: viết các hàm nghiệp vụ THUẦN trong src/domain/ (không import express, không truy cập DB trực tiếp) và unit test bằng vitest.

Module cần có:
1. geo.js: haversineMeters(a,b); isInsideDongNai(lat,lng) dùng bounding box trong rules.js (thiết kế để sau này thay bằng polygon); isValidCoordinate.
2. reportValidator.js: validateReportContext({lat,lng,accuracyM,capturedAt,now,source}) trả { ok, errors[], flags[] }.
   - Từ chối: ngoài Đồng Nai; accuracy > GPS_MAX_ACCURACY_M; capturedAt cũ hơn REPORT_MAX_AGE_MINUTES hoặc ở tương lai (> 1 phút).
   - Gắn cờ (không từ chối): source = 'gallery' → "LOW_TRUST_SOURCE"; accuracy > 50 → "LOW_GPS_ACCURACY".
3. dedupe.js: findMergeTarget(newPoint, candidates, now) → trả điểm ngập gần nhất trong DUPLICATE_RADIUS_M và còn trong DUPLICATE_WINDOW_HOURS (tính theo last_updated_at) và status ∈ {pending, active}; nếu không có trả null. Xử lý trường hợp nhiều ứng viên → chọn gần nhất.
4. lifecycle.js: các hàm thuần quyết định chuyển trạng thái:
   - decideInitialStatus(aiResult) → 'rejected' nếu isFlood=false; 'pending' nếu isFlood=null (AI lỗi) hoặc confidence < AI_MIN_CONFIDENCE_ACTIVE; ngược lại 'active'.
   - applyConfirmation(point, confirmations, newConfirmation, now) → trả { status, confirmStill, confirmEnded, resolved } theo luật: đủ ENDED_CONFIRMATIONS_TO_RESOLVE thiết bị khác nhau báo 'ended' → 'resolved'; 'still' làm mới last_confirmed_at.
   - shouldExpire(point, now) → true nếu active/pending và quá EXPIRE_AFTER_HOURS kể từ mốc hoạt động gần nhất.
   - promotePendingToActive(point, extraReports) → pending lên active khi có ≥ 2 thiết bị khác nhau báo cùng điểm.
5. trustScore.js: computeTrustScore({aiConfidence, gpsAccuracyM, source, confirmStill, confirmEnded, reportCount}) → số nguyên 0–100, công thức minh bạch (liệt kê trọng số trong comment): AI 40%, GPS 20%, nguồn chụp trực tiếp 15%, số xác nhận 20%, số báo cáo độc lập 5%; trừ điểm khi confirmEnded cao.
6. floodProne.js: computeFloodProne(events, now, {pointKey}) → { isFloodProne, eventCountInWindow }; cộng cả historicalEventCount; hàm clusterKey(point) gom theo tên đường chuẩn hóa (bỏ dấu, lowercase) nếu có, ngược lại lưới ~100 m.
7. imageHash.js: sha256Hex(buffer).

Unit test (tests/domain/*.test.js) tối thiểu 30 test, bao gồm biên: đúng 50 m / 50.1 m; đúng 6 giờ; toạ độ ngoài tỉnh; accuracy 100 vs 101; capturedAt tương lai; 1 thiết bị báo 'ended' 2 lần không được tính 2; AI isFlood=null; 20 lượt báo trong 1 đợt ngập chỉ tính 1 sự kiện.

Ràng buộc: hàm thuần, nhận `now` làm tham số (không gọi Date.now() bên trong) để test được.
Kiểm thử: chạy `npm test`, dán kết quả tóm tắt.
```

---

## PROMPT 3 – API nhận báo cáo ngập (POST /api/reports)

```
Nhiệm vụ P3: xây pipeline nhận báo cáo ngập.

Endpoint: POST /api/reports (multipart/form-data)
Trường: image (file jpeg/png/webp ≤ 8MB), lat, lng, accuracyM, capturedAt (ISO), deviceId (uuid), source ('camera'|'gallery'|'manual-pin', mặc định 'camera'), note (tùy chọn ≤ 200 ký tự).

Quy trình xử lý (viết thành src/services/reportService.js, mỗi bước là hàm riêng):
1. Validate bằng zod + file type bằng magic bytes (không tin mimetype); từ chối file không phải ảnh.
2. validateReportContext (P2) → lỗi trả 422 với mã lỗi rõ ràng (OUT_OF_AREA, GPS_TOO_INACCURATE, REPORT_TOO_OLD…), thông báo tiếng Việt.
3. Tính sha256 ảnh; nếu đã tồn tại trong reports → 409 DUPLICATE_IMAGE.
4. Nén ảnh bằng sharp: xoay theo EXIF rồi XÓA metadata, resize cạnh dài ≤ 1280, JPEG q80; lưu uploads/YYYY/MM/<uuid>.jpg.
5. Gọi aiAnalyzer: tạo src/services/aiAnalyzer.js với 2 chế độ theo AI_MODE:
   - mock: trả kết quả giả lập đúng contract (a), có thể điều khiển bằng tên file/biến môi trường để test các nhánh: flood cao, flood thấp, không ngập, lỗi.
   - real: gọi hàm do NV3 cung cấp (để chỗ TODO rõ ràng, đặt timeout 15s, retry 1 lần). Mọi lỗi AI phải được bắt và chuyển thành { isFlood:null, error }.
   Tôi sẽ thay chế độ real khi NV3 xong; KHÔNG tự gọi Gemini trực tiếp ở bước này.
6. decideInitialStatus; tìm điểm trùng (findMergeTarget):
   - Có điểm trùng → gắn report vào điểm đó, tăng report_count, cập nhật last_updated_at, severity = mức cao hơn giữa hai bên (chỉ nâng khi AI confidence đủ), thử promotePendingToActive.
   - Không trùng → tạo flood_point mới, tạo flood_event mới nếu status = active.
   - Trạng thái rejected: vẫn lưu report để truy vết nhưng KHÔNG tạo điểm trên bản đồ.
7. Tính trustScore, lưu DB trong một transaction duy nhất (lỗi giữa chừng thì rollback và xóa file ảnh đã ghi).
8. Reverse geocode (tùy chọn, bọc try/catch, không chặn luồng chính): để interface geocodeService.reverse(lat,lng) → { address, street, wardId } với bản cài đặt mặc định trả null; wardId thì thử suy ra từ data/wards.json (nếu có) — chừa TODO cho NV6/NV2 cung cấp danh sách phường.
9. Trả 201: { ok:true, data:{ floodPoint, report:{id}, merged:boolean, aiResult, message } } trong đó message là câu tiếng Việt thân thiện (vd "Cảm ơn bạn! Báo cáo đã được ghi nhận và gộp vào điểm ngập gần đó.").

Middleware: rate limit theo deviceId (5/giờ) và IP (20/phút), trả 429 RATE_LIMITED kèm retryAfter.

Kiểm thử bằng script scripts/try-report.sh hoặc file requests.http với các ca: báo mới; báo trùng trong 50 m; báo lặp ảnh; ngoài Đồng Nai; ảnh quá cũ; AI lỗi; AI nói không ngập; vượt rate limit. Viết thêm test tích hợp bằng supertest cho các ca trên. Báo kết quả.
```

---

## PROMPT 4 – Xác nhận vẫn ngập / hết ngập + tự hết hạn

```
Nhiệm vụ P4: xây chức năng xác nhận và vòng đời tự động.

1. POST /api/flood-points/:id/confirm  body { type:'still'|'ended', deviceId, lat, lng, accuracyM }
   - Điều kiện: điểm tồn tại và status ∈ {pending, active}; người xác nhận phải ở trong bán kính CONFIRM_MAX_DISTANCE_M = 300 m quanh điểm ngập (thêm hằng số vào rules.js); mỗi deviceId chỉ xác nhận 1 lần/loại/điểm (trả 409 nếu trùng).
   - Dùng applyConfirmation (P2); khi status chuyển 'resolved' → đóng flood_event (ended_at, end_reason='confirmed_ended'), cập nhật flood_event_count và tính lại isFloodProne.
   - 'still' → cập nhật last_confirmed_at, tăng confirmStill, tính lại trustScore.
   - Trả điểm ngập sau cập nhật + thông điệp tiếng Việt.
2. Job tự hết hạn: src/jobs/expireJob.js chạy mỗi 5 phút bằng setInterval (cấu hình trong rules.js), gọi shouldExpire; điểm quá hạn → status 'expired', đóng flood_event với end_reason='auto_expired'. Viết dưới dạng hàm runExpireOnce(now) để test được, và chỉ khởi động job trong server.js (không khởi động khi test).
3. Xử lý đồng thời: 2 xác nhận cùng lúc không được làm sai đếm (dùng transaction).
4. Test: chuyển trạng thái đủ các nhánh; cùng thiết bị xác nhận 2 lần; xác nhận từ quá xa; hết hạn đúng mốc 6 giờ (dùng `now` giả); sau resolved thì báo cáo mới ở cùng chỗ phải tạo SỰ KIỆN mới và floodEventCount tăng đúng.

Báo kết quả test và liệt kê các mã lỗi mới.
```

---

## PROMPT 5 – API đọc dữ liệu (cho NV1, NV2, NV5)

```
Nhiệm vụ P5: xây các endpoint đọc dữ liệu, tối ưu cho Leaflet và trang phường.

1. GET /api/flood-points?status=active,pending&wardId=&severity=&limit=&bbox=minLng,minLat,maxLng,maxLat
   → mảng điểm ngập theo contract (b). Mặc định status=active. Sắp xếp last_updated_at giảm dần.
2. GET /api/flood-points.geojson (cùng bộ lọc) → FeatureCollection, mỗi Feature: geometry Point [lng, lat] (CHÚ Ý thứ tự lng,lat) và properties = toàn bộ trường contract (b) + thêm: markerColor ('yellow'|'orange'|'red'|'gray'), layer ('current'|'prone'), ageMinutes, thumbnailUrl. Quy tắc markerColor: low→yellow, medium→orange, high→red, resolved/expired→gray. layer='prone' nếu isFloodProne, nếu vừa prone vừa đang active thì trả cả hai giá trị bằng cách thêm 2 trường boolean isCurrent và isFloodProne.
3. GET /api/flood-points/:id → chi tiết kèm: danh sách ảnh (tối đa 5, URL tuyệt đối dựa PUBLIC_BASE_URL), mô tả AI, lịch sử sự kiện (tối đa 10 sự kiện gần nhất), số lần ngập (floodEventCount), thời điểm ngập gần nhất.
4. GET /api/flood-prone → danh sách khu vực/đường hay ngập: { key, street, wardId, centerLat, centerLng, eventCount, lastFloodAt, avgSeverity, pointIds[] } sắp theo eventCount giảm dần. Đây là dữ liệu NV5 dùng để đối chiếu lượng mưa — thêm ?minEvents= để lọc.
5. GET /api/wards/:wardId/flood-points → danh sách điểm ngập của phường, kèm tóm tắt: { activeCount, proneCount, totalEvents } và nhóm theo đường.
6. Thêm Cache-Control ngắn (10 giây) cho GeoJSON, ETag; bảo đảm phản hồi < 200 ms với 1000 điểm (viết script benchmark nhỏ).
7. Mọi tham số truy vấn phải qua zod; sai trả 400 INVALID_QUERY.
8. Viết tài liệu ví dụ phản hồi thật trong docs/API.md (cho từng endpoint: request, response mẫu, mã lỗi).

Test tích hợp bằng supertest dựa trên dữ liệu seed. Báo kết quả.
```

---

## PROMPT 6 – Frontend module: camera, GPS, gửi báo cáo, xác nhận

```
Nhiệm vụ P6: viết module frontend dùng lại được để NV2 gắn vào giao diện. Đặt trong public/nv4/ (hoặc src-fe/nv4/), HTML/JS thuần ES module, mobile-first.

Cung cấp:
1. nv4/deviceId.js: tạo & lưu uuid ẩn danh trong localStorage (có fallback nếu bị chặn).
2. nv4/geo.js: getPosition() dùng navigator.geolocation (enableHighAccuracy, timeout 10s) trả { lat, lng, accuracyM, timestamp }; phân biệt lỗi: bị từ chối quyền / không khả dụng / hết thời gian, mỗi loại có thông điệp tiếng Việt hướng dẫn cách bật quyền trên Android/iOS.
3. nv4/camera.js: ưu tiên <input type="file" accept="image/*" capture="environment"> (ổn định nhất trên điện thoại); thêm chế độ getUserMedia (camera sau, facingMode:'environment') có nút chụp, xem lại, chụp lại; tự kiểm tra isSecureContext và hiển thị cảnh báo rõ nếu không phải HTTPS. Nén ảnh phía client (canvas, cạnh dài ≤ 1600, JPEG q0.85) trước khi gửi.
4. nv4/reportFlow.js: lớp ReportFlow điều khiển các bước: (1) xin GPS → (2) chụp ảnh → (3) xem lại + ghi chú → (4) gửi POST /api/reports → (5) hiển thị kết quả (đã gộp hay điểm mới, AI nhận định gì, trạng thái). Có trạng thái loading, thử lại khi mạng lỗi, huỷ, và xử lý đầy đủ mã lỗi từ P3 bằng thông báo tiếng Việt. Nếu GPS thất bại → cho "ghim vị trí thủ công" bằng callback do NV2/NV1 cung cấp (giao diện: hàm `onRequestManualPin()` trả về {lat,lng}); gửi source='manual-pin'.
5. nv4/confirmWidget.js: thành phần "Vẫn ngập / Đã hết ngập" cho 1 điểm: tự lấy GPS, gọi POST /confirm, khóa nút sau khi bấm, hiển thị số xác nhận hiện tại.
6. API tuỳ chỉnh được: new ReportFlow({ apiBase, mount, onSuccess, onError, onRequestManualPin }). Không phụ thuộc framework, CSS gói gọn trong 1 file có tiền tố .nv4- để không đụng giao diện NV2. Nút to, dễ bấm bằng một tay, tương phản tốt, hoạt động từ màn hình 360px.
7. Trang demo public/nv4/demo.html để tôi thử độc lập, không cần giao diện NV2.

Ràng buộc: không thư viện UI; không lưu ảnh vào localStorage; không gửi dữ liệu GPS nếu người dùng chưa bấm gửi.
Kiểm thử: hướng dẫn tôi chạy qua tunnel HTTPS (ngrok hoặc cloudflared) để thử trên điện thoại thật, viết sẵn lệnh và các bước kiểm tra (cấp quyền, từ chối quyền, tắt GPS, mất mạng giữa chừng). Liệt kê checklist thủ công.
```

---

## PROMPT 7 – Tích hợp với NV1, NV2, NV5

```
Nhiệm vụ P7: chuẩn bị gói tích hợp, KHÔNG sửa code của NV khác; chỉ tạo tài liệu, ví dụ và adapter trong thư mục integration/.

1. integration/nv1-leaflet-example.html: ví dụ Leaflet tối giản (OpenStreetMap) lấy /api/flood-points.geojson, vẽ circleMarker theo markerColor, viền tím cho isFloodProne, popup hiển thị: địa chỉ, mức độ, số lần ngập (floodEventCount), ảnh, số xác nhận, nút gọi confirmWidget. Tự làm mới mỗi 30 giây. Hai lớp bật/tắt: "Đang ngập" và "Hay ngập". Đây chỉ là mẫu để NV1 tham khảo.
2. integration/nv2-wardpage-example.js: ví dụ lấy /api/wards/:wardId/flood-points và render danh sách; hướng dẫn nhúng ReportFlow và confirmWidget vào trang.
3. integration/nv5-flood-prone-adapter.js: hàm getFloodProneForForecast() lấy /api/flood-prone và trả mảng { id, lat, lng, street, wardId, eventCount, severityWeight } để NV5 đối chiếu lượng mưa; kèm lưu ý về tần suất gọi.
4. docs/INTEGRATION.md: checklist tích hợp theo từng NV (URL, tham số, ví dụ, lỗi thường gặp như đảo lat/lng, CORS, ảnh URL tương đối), và danh sách câu hỏi mở cần NV1/NV2/NV5/NV6 xác nhận.
5. Cấu hình CORS qua biến môi trường ALLOWED_ORIGINS; test CORS bằng 1 lệnh curl mẫu.

Sau cùng, chạy một kịch bản end-to-end bằng script: seed → gửi 3 báo cáo mới/trùng → xác nhận → lấy GeoJSON → kiểm tra điểm hiện đúng layer. In kết quả.
```

---

## PROMPT 8 – Kiểm thử toàn diện & tài liệu bàn giao

```
Nhiệm vụ P8: kiểm soát chất lượng cho toàn bộ NV4.

1. Chạy toàn bộ test hiện có, đo coverage (vitest --coverage); mục tiêu ≥ 80% cho src/domain và src/services. Bổ sung test còn thiếu.
2. Bổ sung test cho các tình huống thực tế/biên: 
   - 10 thiết bị báo cùng lúc 1 ngã tư (đồng thời) → chỉ 1 điểm ngập, reportCount=10
   - ảnh hỏng/ảnh 0 byte/ảnh quá lớn/file giả ảnh (đuôi .jpg nhưng là .exe)
   - toạ độ NaN, chuỗi, lat/lng bị đảo (lat=106..., lng=10...)
   - capturedAt sai múi giờ
   - AI trả JSON sai định dạng / timeout
   - Điểm ngập lặp lại: ngập → hết → ngập lại trong cùng 1 ngày → đếm 2 sự kiện
3. Tạo bộ dữ liệu kiểm thử cho NV6: scripts/make-test-payloads (tạo sẵn các request mẫu) + bảng test-case dạng CSV (id, mô tả, đầu vào, kết quả mong đợi, kết quả thực tế, đạt/không).
4. Viết docs/API.md hoàn chỉnh + docs/NV4_HANDOFF.md: kiến trúc, luồng xử lý (sơ đồ mermaid), bảng luật nghiệp vụ, cách chạy, cách thay mock AI bằng AI thật, các giới hạn đã biết, cách reset dữ liệu demo (npm run demo:reset).
5. Tạo scripts/demo-reset.js: xóa dữ liệu động, nạp lại seed, tạo sẵn vài báo cáo mô phỏng để demo trước ban giám khảo luôn có điểm ngập hiển thị.
6. Báo cáo cuối: danh sách lỗi tìm thấy & đã sửa, rủi ro còn lại, việc nên làm tiếp.
```

---

## PROMPT 9 – Rà soát bảo mật & hiệu năng

```
Nhiệm vụ P9: đóng vai reviewer bảo mật cho NV4. Hãy ĐỌC code hiện có và liệt kê vấn đề theo mức Cao/Trung/Thấp rồi sửa các mục Cao & Trung, kèm test.

Kiểm tra tối thiểu:
- Upload: path traversal, đặt tên file, giới hạn kích thước, kiểm tra magic bytes, nguy cơ zip-bomb/ảnh khổng lồ (giới hạn pixel của sharp), thư mục uploads không thực thi được.
- Injection: mọi truy vấn SQL dùng tham số; escape khi hiển thị chuỗi (note, address) ở frontend (chống XSS trong popup Leaflet).
- Rate limit & lạm dụng: bơm báo cáo giả, đổi deviceId liên tục (bổ sung giới hạn theo IP), spam xác nhận 'ended' để xoá điểm ngập thật.
- Bảo mật cấu hình: .env không bị commit, không log API key/ảnh/toạ độ chi tiết ở mức info, helmet, CORS theo whitelist, giới hạn body.
- Quyền riêng tư: ảnh đã xoá EXIF/GPS, không lưu thông tin cá nhân, deviceId ẩn danh, thêm dòng thông báo/đồng ý thu thập vị trí trong frontend.
- Hiệu năng: chỉ mục DB, N+1, kích thước phản hồi GeoJSON, nén gzip.
- Độ bền: xử lý SIGTERM (đóng DB, dừng job), lỗi không bắt (unhandledRejection), thư mục uploads đầy.

Trả về bảng: vấn đề – mức độ – file/dòng – cách sửa – đã sửa? – test chứng minh.
```

---

# PHẦN D. GỢI Ý CÁCH LÀM VIỆC VỚI ANTIGRAVITY

1. **Một prompt – một commit.** Chạy test xong mới sang bước kế để lỗi không dồn.
2. **Luôn bắt Antigravity chạy test và dán kết quả**; không tin câu "đã xong".
3. **Làm trước, ghép sau:** P1 → P2 → P3 → P5 (NV1 có dữ liệu sớm) → P4 → P6 → P7 → P8 → P9.
4. **Gửi NV1 sớm:** sau P5, gửi file `docs/API.md` + 1 URL GeoJSON để NV1 vẽ bản đồ ngay.
5. **Gửi NV3 sớm:** gửi contract (a) ở mục A5 ngay hôm nay để NV3 làm đúng mẫu.
6. **Nhờ NV6** chuẩn bị ≥ 20 điểm ngập thật + 10 ảnh kiểm thử trước khi chạy P1 (nếu chưa có, dùng seed giả lập của P1 rồi thay sau).
7. **Chuẩn bị HTTPS trước ngày demo**; nhờ NV6 quay video dự phòng ngay khi P6 chạy được trên điện thoại.

# PHẦN E. CÂU HỎI CẦN CHỐT VỚI NHÓM (gửi vào group)

1. NV3 chốt đúng contract (a)? Gọi AI theo hàm nội bộ hay qua HTTP `/api/analyze`?
2. Dùng đơn vị phường/xã nào (theo danh sách hành chính hiện hành)? NV6 có file polygon/ranh giới không?
3. NV1 muốn dùng GeoJSON hay mảng JSON? Màu và tên layer có đồng ý với mục A4?
4. NV5 cần thêm trường nào từ `/api/flood-prone`?
5. Deploy ở đâu (Render, Railway, VPS, chạy local + ngrok)? Ai chịu trách nhiệm?
6. Có cho người dùng chọn ảnh từ thư viện không, hay chỉ chụp trực tiếp?
7. Có cần đăng nhập không (nếu không → dựa deviceId ẩn danh như thiết kế này)?
