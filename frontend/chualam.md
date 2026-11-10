# Tiến độ Nv2: Giao diện và trang phường

## Đã hoàn thành ✅

1. **Thiết kế giao diện toàn bộ ứng dụng**
   - Design tokens (CSS variables), light/dark/system theme
   - Component library: Button, Icon, Field, Dialog, Feedback, Badges
   - Layout: CitizenLayout (header + bottom nav), AdminLayout (sidebar + mobile nav)

2. **Trang chủ / Trang bản đồ** (`/`)
   - Bản đồ Leaflet với markers theo mức ngập (severe/moderate/light)
   - Cluster markers, danh sách điểm ngập, chi tiết điểm ngập
   - Bộ lọc (thời gian, mức ngập, khu vực, xác minh), lớp bản đồ
   - Tìm kiếm địa điểm, vị trí của tôi, cảnh báo banner
   - Bottom sheet (điện thoại) / split layout (máy tính)

3. **Báo ngập** (`/bao-ngap`)
   - 3 bước: Ảnh → Vị trí và thời điểm → Xem lại và gửi
   - Camera/thư viện ảnh, bản đồ chọn vị trí, GPS, kéo ghim
   - Phân tích AI giả lập, lưu bản nháp, đăng nhập giữa luồng

4. **Dự báo / Cảnh báo** (`/canh-bao`)
   - Tab "Đang ghi nhận" (điểm ngập active) + "Nguy cơ sắp tới" (dự báo)
   - ForecastCard, RainBars, horizon chips 6–12 giờ

5. **Đường bị ảnh hưởng** (`/duong-bi-anh-huong`)
   - Danh sách đường, mức ảnh hưởng, gợi ý tuyến thay thế

6. **Trang phường / Bản đồ địa bàn** (`/quan-ly/ban-do`)
   - Card tổng hợp theo khu vực (7 areas)
   - Desktop: split layout (danh sách + bản đồ)
   - Mobile: Tabs Danh sách / Bản đồ
   - Bộ lọc tình trạng ngập, cảnh báo "hết ngập cần xác nhận"
   - Card popup trên bản đồ khi chọn điểm

7. **Xác nhận vẫn ngập / hết ngập**
   - Phía người dân: ConditionConfirm component trong chi tiết điểm ngập
     - 2 nút "Vẫn còn ngập" / "Đã hết ngập"
     - Dialog chọn mức ngập, ghi chú
     - Yêu cầu đăng nhập, thông báo thành công
   - Phía phường (admin): trong AdminReportDetail
     - Nút "Xác nhận tình trạng ngập" (Vẫn ngập / Đã hết ngập)
     - Version check chống conflict

8. **Quản lý báo cáo** (`/quan-ly`)
   - KPIs, tìm kiếm, bộ lọc, bảng, phân trang
   - Chi tiết báo cáo: ảnh, bản đồ mini, AI result, timeline, actions

9. **Nguồn dữ liệu** (`/quan-ly/nguon-du-lieu`)
   - Bảng nguồn dữ liệu với trạng thái kết nối

10. **Responsive cho điện thoại**
    - Bottom nav < 1024px, header ≥ 1024px
    - Bottom sheet cho trang bản đồ
    - Admin: sidebar desktop, bottom nav mobile

11. **Bản đồ linh hoạt**
    - Leaflet tích hợp ở: trang chủ, báo ngập (chọn vị trí), chi tiết báo cáo (mini map), trang phường

## Hoàn thiện giao diện ngày 10/11/2026

- Phân biệt lỗi tải với không có dữ liệu ở trang phường, cảnh báo/dự báo, bản đồ và chi tiết quản lý; có nút Thử lại và thông báo khi giữ dữ liệu cũ.
- Nút Xem trên bản đồ của dự báo mở đúng vùng, bật lớp dự báo và làm nổi vùng đã chọn. Tab dự báo được lưu trong địa chỉ để quay lại đúng nội dung.
- Sửa lớp bản đồ che công cụ, danh sách và thẻ chi tiết; dành chỗ cho thanh điều hướng điện thoại, giới hạn chiều cao bảng danh sách.
- Bổ sung nút Lọc trong danh sách điện thoại. Chuyển Danh sách/Bản đồ ở trang phường đưa bản đồ đến đúng điểm đã chọn.
- Sửa bố cục đầu trang quản lý và cột bản đồ ở các chiều rộng nhỏ.
- Hộp thoại xác nhận không đóng khi đang gửi; xử lý Escape theo trạng thái mới nhất, giữ focus và khóa cuộn nền của bảng lọc.
- Thử lại nền bản đồ không khởi tạo lại toàn bộ bản đồ, giữ các lớp dữ liệu đang hiển thị.
- Giữ nguyên trang chủ dạng bản đồ (`/`) và dự báo trong Cảnh báo (`/canh-bao?tab=forecast`).

## Kiểm tra

- Build sản xuất: `npm --prefix frontend run build`.
- Kiểm tra trên Edge chạy ẩn, mô phỏng chiều rộng 375, 390, 768, 1024 và 1440px: trang bản đồ, dự báo, báo ngập, trang phường, chi tiết quản lý không tràn ngang.
- Đã chạy luồng dự báo → bản đồ → quay lại dự báo; lỗi tải lần đầu, thử lại và giữ dữ liệu cũ khi làm mới thất bại.
- Đã chạy luồng người dùng báo hết ngập → quản lý xác nhận → điểm bị loại khỏi lớp đang ngập → xác nhận vẫn ngập để hiển thị lại.
- Đã chạy đủ 3 bước báo ngập, đăng nhập trước khi gửi và kiểm tra thông tin đã nhập được giữ lại.
- Đã kiểm tra thao tác Lớp, Lọc, Escape và mở rộng danh sách trên điện thoại.
- Đã kiểm tra lỗi nền bản đồ và Thử lại: lớp dự báo vẫn được giữ. Không ghi nhận lỗi JavaScript trong các kịch bản đã chạy.
- Kịch bản kiểm tra: `outputs/nv2-ui-check.cjs` tại thư mục gốc; chạy với máy chủ thử tại `http://127.0.0.1:4175`. Dùng phiên trình duyệt riêng, không sửa dữ liệu mẫu trong mã nguồn.
- Chưa kiểm tra trên điện thoại vật lý hoặc Safari/iOS; camera và GPS thật cần thiết bị tương ứng.

## Ngoài phạm vi giao diện

- Không tạo hoặc thay đổi backend, API dữ liệu, mô hình AI hay bộ dữ liệu mẫu.
- Kết nối máy chủ, dự báo thật và phân quyền thực sự theo phường vẫn cần phía backend. Bộ lọc khu vực ở giao diện không thay thế phân quyền.

## Cần dọn dẹp 🧹

1. **Xóa file tạm**: `D:/Mô hình phát hiện ngập lụt AI/spec.txt` (text trích từ PDF)

## Thông tin truy cập

- **Dev server**: `npm --prefix frontend run dev` (port 3000)
- **Tài khoản người dân**: `nguoidan` + mật khẩu bất kỳ ≥ 6 ký tự
- **Tài khoản quản lý**: `quanly` + mật khẩu bất kỳ ≥ 6 ký tự
- **Trang phường**: đăng nhập `quanly` → `/quan-ly/ban-do`
- **Xác nhận ngập (citizen)**: vào chi tiết điểm ngập (`/diem-ngap/BC-2611-0101`)

## Cấu trúc thư mục chính

```
frontend/
├── src/
│   ├── app/          # App.jsx, CitizenLayout, config
│   ├── components/ui/ # Button, Icon, Field, Dialog, Feedback, Badges
│   ├── data/mock/    # geo.js, reports.js, photos.js
│   ├── features/
│   │   ├── admin/    # AdminLayout, Reports, ReportDetail, MapPage, DataSources
│   │   ├── alerts/   # AlertsPage (cảnh báo + dự báo)
│   │   ├── auth/     # LoginPage
│   │   ├── map/      # MapPage, FloodMap, FloodList, FloodDetail, ConditionConfirm
│   │   ├── report/   # ReportFlow, PhotoCapture, LocationPicker, MyReports
│   │   ├── roads/    # AffectedRoadsPage, RoutingPage
│   │   └── settings/ # SettingsPage
│   ├── hooks/        # useTheme, useData, useOnlineStatus
│   ├── locales/vi/   # labels.js
│   ├── services/     # api.js, storage.js, drafts.js
│   └── styles/       # tokens.css, base.css, layout.css, map.css, report.css, pages.css, admin.css
└── package.json
```
