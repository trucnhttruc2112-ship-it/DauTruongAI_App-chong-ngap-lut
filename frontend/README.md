# Hệ thống phát hiện và cảnh báo ngập lụt AI

## Giới thiệu frontend

Frontend là ứng dụng web **Bản đồ ngập**, hỗ trợ người dân theo dõi các điểm ngập,
xem cảnh báo, gửi báo cáo hiện trường và tìm hiểu các tuyến đường bị ảnh hưởng.
Ứng dụng cũng có khu vực quản lý dành cho cán bộ để tiếp nhận, xác minh và xử lý
báo cáo.

Giao diện được thiết kế ưu tiên cho bản đồ và thao tác trên thiết bị di động, có
hỗ trợ giao diện sáng/tối, trạng thái ngoại tuyến, trạng thái tải/lỗi và nhãn
phân biệt dữ liệu mô phỏng.

> **Trạng thái hiện tại:** frontend đang chạy ở chế độ `demo`. Dữ liệu được tạo
> trong trình duyệt, lưu cục bộ và có độ trễ mô phỏng; chưa kết nối backend thật.

## Chức năng chính

### Khu vực người dân

- Xem bản đồ các điểm ngập và chi tiết từng điểm.
- Lọc, tìm kiếm địa điểm và xem các tuyến đường bị ảnh hưởng.
- Xem cảnh báo, lịch sử và dự báo ngập.
- Gửi báo cáo ngập bằng ảnh, chọn vị trí và nhận kết quả phân tích AI mô phỏng.
- Theo dõi báo cáo đã gửi và bổ sung thông tin khi cần.
- Xác nhận tình trạng ngập tại một điểm.
- Đăng nhập, thay đổi tùy chọn giao diện và kiểm tra các công cụ trình diễn.

### Khu vực quản lý

- Xem danh sách và chi tiết báo cáo.
- Cập nhật trạng thái, thêm ghi chú và xử lý báo cáo.
- Xem bản đồ quản lý.
- Theo dõi các nguồn dữ liệu đang được sử dụng.

## Công nghệ sử dụng

- **React 18**: xây dựng giao diện theo component.
- **Vite 6**: phát triển cục bộ và đóng gói production.
- **React Router DOM 6**: định tuyến SPA và phân tách các khu vực giao diện.
- **Leaflet 1.9**: hiển thị bản đồ, marker và lớp bản đồ.
- **JavaScript ES Modules (JSX)**: ngôn ngữ và cú pháp chính của frontend.
- **CSS thuần**: design token, layout, component và style theo từng tính năng.
- **IndexedDB và localStorage**: lưu dữ liệu mô phỏng, phiên đăng nhập, bản nháp
  và tùy chọn giao diện trong trình duyệt.
- **OpenStreetMap tiles**: nguồn tile bản đồ mặc định.
- **Be Vietnam Pro**: font chữ giao diện tiếng Việt.

## Cấu trúc frontend

```text
frontend/
├── index.html                 # HTML entry point và metadata
├── package.json               # Dependencies và scripts
├── src/
│   ├── main.jsx               # Khởi tạo React, Router và ThemeProvider
│   ├── app/
│   │   ├── App.jsx            # Khai báo routes và lazy loading
│   │   ├── CitizenLayout.jsx  # Layout khu vực người dân
│   │   └── config.js          # Cấu hình chế độ dữ liệu, bản đồ, AI
│   ├── components/ui/         # Component dùng chung: button, dialog,
│   │                           # field, badge, feedback, icon
│   ├── features/
│   │   ├── admin/             # Màn hình và layout quản lý
│   │   ├── alerts/            # Cảnh báo
│   │   ├── auth/              # Đăng nhập
│   │   ├── map/               # Bản đồ, điểm ngập, bộ lọc, tìm kiếm
│   │   ├── report/            # Tạo và quản lý báo cáo
│   │   ├── roads/             # Đường bị ảnh hưởng và tìm đường
│   │   └── settings/          # Tùy chọn người dùng
│   ├── data/mock/             # Dữ liệu mẫu về địa lý, ảnh và báo cáo
│   ├── hooks/                 # Hook dữ liệu, theme và trạng thái online
│   ├── locales/vi/            # Nhãn và nội dung tiếng Việt
│   ├── services/
│   │   ├── api.js             # API facade; hiện thực hiện bằng dữ liệu mẫu
│   │   ├── drafts.js          # Lưu bản nháp báo cáo
│   │   └── storage.js         # Abstraction cho IndexedDB/localStorage
│   ├── styles/                # Token, layout, map, report, admin và page CSS
│   └── utils/                 # Hàm tiện ích, ví dụ định dạng thời gian
└── dist/                      # Output sau khi build (được tạo bởi Vite)
```

## Luồng dữ liệu

Các màn hình gọi hàm từ `src/services/api.js` thay vì truy cập dữ liệu trực
tiếp. Ở chế độ hiện tại, service sử dụng dữ liệu trong `src/data/mock/` và
IndexedDB. Khi có backend, có thể thay phần triển khai trong service bằng các
request thật mà không phải viết lại các màn hình.

Chế độ dữ liệu và các thông số chính được cấu hình trong
`src/app/config.js`:

- `dataMode: 'demo'`: dữ liệu mô phỏng; đổi sang `'live'` khi tích hợp backend.
- `routingEnabled: false`: tính năng tìm đường hiện đang hiển thị trạng thái
  chưa bật.
- `refreshIntervalMs`: chu kỳ kiểm tra cập nhật khi người dùng đang xem trang.

## Cài đặt và chạy

Yêu cầu: **Node.js 18+** và **npm**.

```bash
cd frontend
npm install
npm run dev
```

Sau đó mở địa chỉ local mà Vite hiển thị trong terminal.

### Các lệnh có sẵn

```bash
npm run dev      # Chạy development server
npm run build    # Kiểm tra và tạo bản build production trong dist/
npm run preview  # Xem thử bản build production
```

## Ghi chú phát triển

- Không chỉnh sửa trực tiếp thư mục `frontend/dist`; thư mục này được tạo lại
  bằng `npm run build`.
- Khi thêm màn hình mới, khai báo route trong `src/app/App.jsx` và đặt mã nguồn
  trong feature tương ứng.
- Component dùng chung nên đặt trong `src/components/ui`.
- Nội dung hiển thị cho người dùng nên bổ sung vào `src/locales/vi/labels.js`
  khi phù hợp.
- Các thay đổi liên quan đến backend nên giữ cùng contract với các hàm trong
  `src/services/api.js` để không phá vỡ giao diện hiện có.
