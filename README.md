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

## Cấu trúc thư mục sau khi nối

```text
Noi/
├── README.md                  # Tổng quan, cách nối và hướng dẫn chỉnh sửa
├── bando/
│   ├── map.js                 # Module tạo bản đồ và marker dùng chung
│   ├── main.js                # Khởi chạy trang demo bản đồ độc lập
│   ├── index.html             # Trang demo; tải main.js bằng type="module"
│   ├── data.js                # Sáu điểm mẫu đã có của trang demo
│   ├── style.css              # Giao diện riêng của trang demo
│   ├── assets/
│   │   └── anh-minh-hoa.svg    # Ảnh popup của trang demo
│   └── README.md              # Hướng dẫn riêng của bando
└── frontend/
    ├── src/                   # Giao diện React và các chức năng hiện có
    ├── public/                # Tài nguyên tĩnh của frontend
    ├── index.html             # Trang khởi động frontend
    ├── package.json           # Thư viện và các lệnh npm
    ├── package-lock.json      # Phiên bản thư viện đã khóa
    ├── vite.config.js         # Cấu hình Vite
    └── dist/                  # Kết quả build, được tạo tự động
```

Cây trên tập trung vào mã nguồn và các file liên quan đến việc nối. Các thư mục
cài đặt như `node_modules` không được liệt kê.

Khi sao chép **mã nguồn** sang máy khác, cần giữ `frontend` và `bando` cùng cấp
trong `Noi`. Frontend import trực tiếp file ở thư mục bên cạnh; chỉ sao chép
riêng `frontend` sẽ làm thiếu module bản đồ.

### Chi tiết frontend

```text
frontend/
├── index.html                 # HTML entry point và metadata
├── package.json               # Dependencies và scripts
├── vite.config.js             # Dev server và build
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

## Luồng dữ liệu hiện có

Các màn hình gọi hàm từ `src/services/api.js` thay vì truy cập dữ liệu trực
tiếp. Ở chế độ hiện tại, service sử dụng dữ liệu trong `src/data/mock/` và
IndexedDB. Khi có backend, có thể thay phần triển khai trong service bằng các
request thật mà không phải viết lại các màn hình.

Chế độ dữ liệu và các thông số chính được cấu hình trong
`src/app/config.js`:

- `dataMode: 'demo'`: dữ liệu mô phỏng. Chỉ đổi giá trị thành `'live'` không tự
  tạo kết nối thật; hiện lớp dịch vụ vẫn là phần mô phỏng có sẵn.
- `routingEnabled: false`: tính năng tìm đường hiện đang hiển thị trạng thái
  chưa bật.
- `refreshIntervalMs`: chu kỳ kiểm tra cập nhật khi người dùng đang xem trang.

## Các thay đổi khi nối frontend với bando

### Phạm vi thay đổi

Frontend dùng trực tiếp module `bando/map.js` để khởi tạo bản đồ Leaflet và
marker. `FloodMap` dùng module này cho bản đồ người dân và quản lý;
`LocationPicker` dùng cùng module cho bản đồ chọn vị trí báo ngập.
Giao diện, bộ lọc và dữ liệu hiện có của frontend được giữ nguyên. Không thêm
backend, API, thư viện hay dữ liệu mới; `bando/data.js` chỉ dùng cho bản demo
độc lập của `bando`.

Trước khi nối, `bando/main.js` tự dựng bản đồ của trang demo, còn frontend tự
dựng bản đồ trong các component React. Sau khi nối, phần tạo bản đồ và marker
được tách ra `bando/map.js` để hai bên cùng gọi.

| File | Thay đổi và vai trò sau khi nối |
| --- | --- |
| `bando/map.js` | File mới, tách từ phần hiển thị trong `main.js`; xuất `createBandoMap` và `createBandoMarker`. |
| `bando/main.js` | Import hai hàm dùng chung; vẫn quản lý hai lớp đang ngập/hay ngập và dòng thống kê của trang demo. |
| `bando/index.html` | Đổi thẻ tải `main.js` sang `<script type="module" src="main.js"></script>`; Leaflet CDN và `data.js` vẫn được tải trước. |
| `frontend/src/features/map/FloodMap.jsx` | Dùng `createBandoMap` để dựng bản đồ; dùng `createBandoMarker` cho từng điểm ngập và điểm lịch sử. Giữ các icon, lớp, sự kiện và cách mở chi tiết của frontend. |
| `frontend/src/features/report/LocationPicker.jsx` | Dùng `createBandoMap` cho bản đồ chọn vị trí; giữ ghim kéo thả, chọn bằng chạm, GPS và vòng sai số. |
| `bando/README.md` | Bổ sung cách chạy trang độc lập qua HTTP và cách dùng cùng frontend. |
| `README.md` | Ghi lại cấu trúc, cách nối, cách chạy và hướng dẫn bảo trì. |

`MapPage.jsx` và `AdminMapPage.jsx` tiếp tục dùng `FloodMap`, nên cùng sử dụng
module bản đồ đã nối mà không cần sửa riêng từng trang. Các marker cụm, vùng
dự báo, đường bị ảnh hưởng và vị trí người dùng vẫn do `FloodMap` xử lý.

Các file dữ liệu, CSS, thư viện trong `package.json` và cấu hình Vite không cần
thay đổi trong lần nối này. Thư mục `frontend/dist` được tạo lại khi build.

### Cách các phần gọi nhau

```text
frontend/src/services/api.js + dữ liệu mô phỏng hiện có
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
      MapPage.jsx       AdminMapPage.jsx
          └─────────┬──────────┘
                    ▼
               FloodMap.jsx
                    │
                    ├── createBandoMap(L, phần_tử, cấu_hình)
                    └── createBandoMarker(L, điểm, tùy_chọn)
                                  ▲
                                  │ xuất từ
                            bando/map.js
                                  ▲
                                  │
                     LocationPicker.jsx
                     gọi createBandoMap

Trang độc lập: bando/index.html
                ├── Leaflet CDN + data.js
                └── main.js → map.js → bản đồ, marker và popup
```

Frontend chỉ import `bando/map.js`; không nhúng trang bằng iframe và không
import `bando/main.js`, `bando/data.js` hay `bando/style.css`.
Vì vậy, sáu điểm mẫu của bản demo không được trộn vào danh sách báo cáo của
frontend, và CSS riêng của bản demo không ghi đè giao diện React.

Trong frontend, Leaflet được import từ package `leaflet`. Trong trang độc lập,
Leaflet được tải từ CDN. Cả hai đều truyền đối tượng `L` vào module dùng chung;
`map.js` không tự tải Leaflet, không gọi dịch vụ dữ liệu và không tự tạo bản đồ
khi được import.

### Hai hàm dùng chung trong bando/map.js

#### `createBandoMap(L, target, options)`

Tạo bản đồ, thêm lớp nền và trả về `{ map, tileLayer }` để bên gọi tiếp tục
gắn sự kiện, thêm lớp hoặc tải lại nền bản đồ. `target` là phần tử DOM hoặc ID
của phần tử chứa bản đồ.

| Tùy chọn | Mặc định trong module | Ý nghĩa |
| --- | --- | --- |
| `center` | `[11.35, 107.05]` | Tâm bản đồ khi khởi tạo. |
| `zoom` | `9` | Mức thu phóng ban đầu. |
| `mapOptions` | `{}` | Các tùy chọn bổ sung cho `L.map`; mặc định có nút thu phóng. |
| `tileUrl` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Địa chỉ lớp bản đồ nền. |
| `tileOptions` | `{}` | Ghi đè tùy chọn lớp nền; module có sẵn attribution OSM và `maxZoom: 19`. |
| `scale` | `true` | Hiển thị thước tỷ lệ. |

Frontend truyền cấu hình riêng để giữ cách hiển thị cũ:

- `FloodMap` lấy tâm/zoom từ vùng nhìn đã lưu hoặc `APP_CONFIG.map`, truyền
  giới hạn zoom, URL nền và attribution từ cấu hình frontend. Component tắt
  nút zoom mặc định của Leaflet và thước tỷ lệ vì đã có thanh công cụ riêng.
- `LocationPicker` lấy tâm từ vị trí đã chọn hoặc `APP_CONFIG.map.center`.
  Zoom khởi tạo hiện là `17` khi có vị trí, `14` khi chưa có vị trí; giới hạn
  zoom lớp nền là `19`. Component giữ nút zoom Leaflet và tắt thước tỷ lệ.

**Lưu ý khi sửa:** thay giá trị mặc định trong `bando/map.js` chỉ ảnh hưởng các
nơi không truyền giá trị ghi đè. Ví dụ, đổi `zoom` mặc định ở module sẽ không
đổi zoom khởi tạo của `LocationPicker`.

#### `createBandoMarker(L, point, options)`

Tạo và trả về marker; bên gọi tự thêm marker vào lớp bản đồ thích hợp.

| Tùy chọn | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `icon` | Không truyền | Không có icon thì dùng marker tròn của bản demo; có icon thì tạo `L.marker` với icon đó. |
| `markerOptions` | `{}` | Tùy chọn marker như tiêu đề, bàn phím, thứ tự hiển thị hoặc kiểu nét. |
| `tooltip` | `true` | Gắn nhãn mặc định từ `point.name`. |
| `popup` | `true` | Gắn popup mặc định với ảnh, mô tả và số lần ngập mẫu. |

Trang độc lập truyền các điểm có sẵn từ `bando/data.js`, gồm tọa độ, `name`,
`type`, `level`, `floodCount`, `description` và `image`. Frontend truyền các
điểm hiện có của mình cùng `icon`, `tooltip: false` và `popup: false`, rồi tự
gắn sự kiện, nhãn hoặc popup theo giao diện hiện tại.

Không bật popup mặc định cho điểm frontend nếu chưa đối chiếu các trường dữ
liệu: frontend dùng tên như `place`, `severity`, trong khi bản demo dùng
`name`, `level`. Việc nối hiện tại không chuyển đổi hay bổ sung các trường đó.

## Hướng dẫn chỉnh sửa tiếp

### Cần sửa ở file nào?

Các đường dẫn trong bảng được tính từ thư mục `Noi`.

| Nội dung muốn chỉnh | File hoặc thư mục cần xem |
| --- | --- |
| Cách khởi tạo bản đồ hoặc tạo marker dùng chung | `bando/map.js` |
| Tâm bản đồ chính, giới hạn zoom, URL nền và attribution của frontend | `frontend/src/app/config.js` |
| Marker, gộp cụm, lớp lịch sử/dự báo/đường và sự kiện bản đồ frontend | `frontend/src/features/map/FloodMap.jsx` |
| Bố cục trang bản đồ, chọn điểm, kết nối danh sách với bản đồ | `frontend/src/features/map/MapPage.jsx` |
| Các nút lớp bản đồ, định vị, thu phóng và chú giải | `frontend/src/features/map/MapControls.jsx` |
| Bộ lọc và trạng thái bản đồ khi chuyển trang | `frontend/src/features/map/Filters.jsx`, `frontend/src/features/map/mapState.jsx` |
| Kiểu icon, marker và popup trong frontend | `frontend/src/styles/leaflet-overrides.css`, `frontend/src/components/ui/Icon.jsx`, `FloodMap.jsx` |
| Bố cục trang bản đồ trên máy tính/điện thoại | `frontend/src/styles/map.css` |
| Ghim chọn vị trí, GPS, zoom của bước báo ngập | `frontend/src/features/report/LocationPicker.jsx` |
| Giao diện bản đồ quản lý và chọn báo cáo cần xem | `frontend/src/features/admin/AdminMapPage.jsx` |
| Hai lớp và dòng thống kê của bản demo độc lập | `bando/main.js` |
| Bố cục, chú giải và CSS popup của bản demo độc lập | `bando/index.html`, `bando/style.css` |

Màu marker mặc định trong `bando/map.js` áp dụng cho marker tròn của bản demo.
Frontend đang truyền icon riêng, nên muốn đổi màu marker frontend cần xem
`pointIcon`, `historyIcon` trong `FloodMap.jsx` và các lớp `.fm-marker`,
`.fm-history` trong `leaflet-overrides.css`. Màu vùng dự báo và đường nằm ở
`SEVERITY_COLOR` trong `FloodMap.jsx`.

### Quy tắc giữ phần nối hoạt động

1. Giữ `bando/map.js` độc lập với React và dữ liệu của từng trang. Hàm dùng
   chung nhận cấu hình/tham số từ bên gọi.
2. Giữ tên export `createBandoMap`, `createBandoMarker` và cấu trúc trả về,
   hoặc cập nhật đồng thời mọi nơi gọi khi đổi chúng.
3. Từ vị trí hiện tại của `FloodMap.jsx` và `LocationPicker.jsx`, đường dẫn
   import là `../../../../bando/map.js`. Khi di chuyển file phải kiểm tra lại
   đường dẫn này.
4. Khởi tạo bản đồ trong effect của React, giữ tham chiếu trong ref, dọn sự
   kiện/`ResizeObserver` và gọi `map.remove()` khi component bị tháo. Không
   tạo lại `L.map` trên cùng phần tử mỗi lần render.
5. Giữ các nhóm lớp riêng và chỉ cập nhật marker/lớp cần thay đổi. Các thao
   tác chọn điểm và bộ lọc vẫn được điều phối ở frontend.
6. Giữ chiều cao của phần tử chứa bản đồ trong CSS. Khi bố cục đổi kích
   thước, giữ cơ chế `invalidateSize()` hiện có để Leaflet vẽ lại đúng vùng.
7. Khi chỉnh `map.js`, kiểm tra cả frontend lẫn trang `bando` độc lập vì cả
   hai cùng dùng file này. Không sửa trực tiếp file trong `frontend/dist`.

## Cài đặt và chạy

### Chạy ứng dụng đã nối

Chạy ứng dụng từ `Noi/frontend`. Vite đóng gói module `bando/map.js` cùng
frontend, nên không cần chạy thêm máy chủ cho `bando` khi sử dụng ứng dụng.

Yêu cầu: **Node.js 18+** và **npm**.

```bash
# Nếu terminal đang ở thư mục Noi
cd frontend
npm install
npm run dev
```

Sau đó mở địa chỉ local mà Vite hiển thị trong terminal. Cổng dev được cấu
hình là `3000`; nếu cổng bận, hãy dùng địa chỉ thực tế Vite in ra.

### Các lệnh có sẵn

```bash
npm run dev      # Chạy development server
npm run build    # Kiểm tra và tạo bản build production trong dist/
npm run preview  # Xem thử bản build production
```

Các lệnh trên chạy trong `Noi/frontend`. Sau khi build, mã được import từ
`bando/map.js` đã nằm trong bundle của `frontend/dist`; bản build frontend
không cần một máy chủ riêng hay bản sao thư mục `bando` bên cạnh.

### Chạy riêng trang bando

Mở `Noi/bando/index.html` bằng Live Server trong VS Code hoặc một trình phục
vụ file tĩnh qua HTTP. Trang hiện dùng ES module nên mở trực tiếp bằng
`file://` sẽ không tải được phần JavaScript như trước.

Trang độc lập cần Internet để tải Leaflet từ CDN và nền OpenStreetMap.
Frontend dùng Leaflet đã cài qua npm; nền OpenStreetMap vẫn cần kết nối mạng.

## Kiểm tra sau khi nối hoặc chỉnh sửa

Lần nối này đã được kiểm tra bằng `npm run build` và trình duyệt Edge ở chế
độ headless, trên bản chạy development và bản preview sau build. Các bước
kiểm tra đã qua:

- Frontend tải module dùng chung từ `bando/map.js` và hiển thị các điểm đã có.
- Nhấn marker mở đúng phần chi tiết, đóng chi tiết quay về danh sách.
- Thu phóng, bật/tắt lớp đang ngập và mở popup lớp lịch sử.
- Chuyển sang trang khác rồi quay lại chỉ tạo một bản đồ, không báo lỗi
  khởi tạo trùng Leaflet.
- Hiển thị bản đồ trên màn hình máy tính và điện thoại, không tràn ngang
  trong các kích thước đã kiểm tra (`1440 × 1000`, `390 × 844`).
- Bản đồ quản lý chọn được điểm; bước báo ngập chọn được vị trí bằng ghim.
- Bản preview sau build hiển thị bản đồ và mở chi tiết từ marker.
- Trang `bando` độc lập hiện đủ sáu marker, bật/tắt hai lớp, mở popup và tải
  ảnh minh họa. Không ghi nhận lỗi JavaScript trong các luồng đã kiểm tra.

Đây là kết quả kiểm tra của lần tích hợp, không phải bộ test tự động đã thêm
vào project. Khi sửa phần dùng chung, chạy lại build và kiểm tra các thao tác
liên quan ở cả hai giao diện.

### Một số lỗi thường gặp

| Hiện tượng | Kiểm tra và cách xử lý |
| --- | --- |
| Không tìm thấy `bando/map.js` khi chạy/build | Giữ hai thư mục cùng cấp, kiểm tra đường dẫn import nếu vừa di chuyển file. |
| Trang `bando` mở trực tiếp nhưng không có bản đồ | Chuyển sang mở qua HTTP/Live Server vì `main.js` dùng ES module. |
| Khung bản đồ không có chiều cao hoặc vẽ lệch sau đổi bố cục | Kiểm tra CSS vùng chứa và cơ chế `ResizeObserver`/`invalidateSize()`. |
| Sửa mặc định trong `map.js` nhưng frontend không đổi | Kiểm tra giá trị ghi đè tại `FloodMap`, `LocationPicker` và `APP_CONFIG.map`. |
| Đổi CSS trong `bando/style.css` nhưng frontend không đổi | Frontend dùng CSS riêng trong `src/styles`; không import stylesheet của trang demo. |
| Marker xuất hiện nhưng nền bản đồ không tải | Kiểm tra mạng và request tile OpenStreetMap; frontend có thông báo lỗi nền và nút thử lại. |
| Báo lỗi `Map container is already initialized` | Kiểm tra effect tạo bản đồ, tránh khởi tạo trùng và bảo đảm cleanup gọi `map.remove()`. |

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
