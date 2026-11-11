# Hướng dẫn kiểm thử trên điện thoại thật (NV4)

Camera và GPS trên điện thoại **chỉ hoạt động trên HTTPS** (hoặc localhost). Vì vậy cần một đường hầm (tunnel) HTTPS từ điện thoại về máy tính đang chạy server.

> Lưu ý: AI hiện ở chế độ `mock`, kết quả "ngập/không ngập" là giả lập. Buổi test này chỉ kiểm tra camera, GPS, nén ảnh, gửi báo cáo và xác nhận.

---

## 1. Chuẩn bị
1. Máy tính và điện thoại có internet (không cần cùng Wi-Fi khi dùng tunnel).
2. Chạy server: `npm start` (giữ nguyên terminal này).
3. Mở terminal thứ hai để chạy tunnel.

---

## 2. Tạo tunnel HTTPS (chọn 1 trong 2)

### Cách A: Cloudflare Tunnel (không cần tài khoản)
```bash
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
```
Terminal sẽ in một địa chỉ dạng `https://xxxx-xxxx.trycloudflare.com`.
*(Ghi chú: Nếu Windows báo không nhận lệnh `cloudflared` sau khi cài, hãy mở lại cửa sổ terminal mới).*

### Cách B: ngrok (cần tài khoản miễn phí)
```bash
ngrok http 3000
```
Lấy địa chỉ `https://....ngrok-free.app` ở dòng "Forwarding". Nếu ngrok hiện trang cảnh báo, bấm "Visit Site".

---

## 3. Cơ chế hỗ trợ tunnel tự động

Trong môi trường phát triển và thử nghiệm (`NODE_ENV !== 'production'`), máy chủ NV4 tự động cấu hình:
- **`TRUST_PROXY='loopback'`**: Express chỉ tin cậy các tiêu đề `X-Forwarded-*` khi kết nối trực tiếp đến từ chính máy này (`127.0.0.1` hoặc `::1`).
- **Thử qua tunnel không cần đặt thêm biến môi trường nào ngoài production**:
  + Cloudflared hoặc Ngrok chạy trên cùng máy tính với server NV4 sẽ chuyển tiếp request đến `localhost:3000`.
  + Máy chủ tự động nhận diện host công khai của tunnel (thông qua `req.hostname`) và cho phép CORS cùng nguồn cho giao diện web chạy trên điện thoại.
  + Hệ thống áp dụng giới hạn tần suất dựa trên địa chỉ client mà Express nhận diện.
- Ở môi trường `production`, bắt buộc phải đặt `TRUST_PROXY` đúng hạ tầng thật (xem chi tiết tại `docs/SECURITY_REVIEW.md` mục 5).

---

## 4. Mở trên điện thoại
Nhập địa chỉ: `https://<địa-chỉ-tunnel>/nv4/demo.html`
- Điện thoại nên bật GPS (Vị trí) ở chế độ độ chính xác cao.
- Trình duyệt thử nên có Chrome (Android) và Safari (iPhone, nên dùng ở tab riêng tư).
- Địa chỉ tunnel công khai nên chỉ chia sẻ trong nhóm kiểm thử nội bộ.

---

## 5. Checklist kiểm thử (15 tình huống)

| # | Tình huống | Cách làm | Kết quả mong đợi | Đạt? |
|---|---|---|---|---|
| 1 | Luồng bình thường | Cho phép GPS + camera, chụp, gửi | Hiện kết quả, có điểm ngập mới hoặc báo "đã gộp" | |
| 2 | Từ chối quyền GPS | Chọn "Chặn" khi hỏi vị trí | Thông báo tiếng Việt hướng dẫn bật lại quyền | |
| 3 | Từ chối quyền camera | Chặn camera | Thông báo tiếng Việt, có đường lui | |
| 4 | Tắt GPS của máy | Tắt Vị trí trong cài đặt | Thông báo rõ ràng, không treo | |
| 5 | Mất mạng giữa chừng | Bật chế độ máy bay lúc bấm Gửi | Thông báo lỗi mạng, cho phép thử lại, không mất ảnh | |
| 6 | Ảnh lớn | Chọn ảnh từ thư viện > 8 MB | Ảnh được nén tự động, gửi thành công | |
| 7 | Ảnh HEIC (iPhone) | Chọn ảnh HEIC từ thư viện | Gửi được, hoặc có hướng dẫn chụp trực tiếp bằng camera | |
| 8 | Gửi 2 lần liên tiếp | Bấm Gửi hai lần nhanh | Chỉ một báo cáo được tạo, nút bị khóa khi đang gửi | |
| 9 | Gửi lại cùng một ảnh | Gửi ảnh đã gửi trước đó | Báo `DUPLICATE_IMAGE` bằng tiếng Việt | |
| 10 | Vượt giới hạn | Gửi hơn 5 báo cáo trong 1 giờ (cùng thiết bị) | Báo giới hạn kèm thời gian chờ | |
| 11 | Vị trí ngoài Đồng Nai | Dùng ứng dụng giả lập vị trí hoặc test ở nơi khác tỉnh | Báo ngoài khu vực | |
| 12 | Xác nhận vẫn ngập | Mở một điểm ngập, bấm "Vẫn ngập" | Số xác nhận tăng, nút bị khóa | |
| 13 | Xác nhận hết ngập | Dùng 2 thiết bị/trình duyệt khác nhau bấm "Hết ngập" | Điểm chuyển sang `resolved` | |
| 14 | Xác nhận từ xa | Bấm xác nhận khi cách điểm ngập hơn 300 m | Báo quá xa | |
| 15 | Màn hình nhỏ | Xoay ngang, dùng cỡ chữ lớn | Giao diện không vỡ, nút bấm được bằng một tay | |

---

## 6. Mẹo khi test
- Giới hạn 5 báo cáo/giờ/thiết bị: muốn tạo thiết bị mới, xóa dữ liệu trang web (localStorage) hoặc dùng cửa sổ ẩn danh. Giới hạn theo IP là 20 yêu cầu/phút.
- Tọa độ phải nằm trong khung Đồng Nai (vĩ độ 10.35–11.60, kinh độ 106.75–107.60).
- Ảnh gửi lúc test được lưu như dữ liệu thật (`isDemo = false`).

---

## 7. Dọn dẹp sau khi test
1. Đóng tunnel (Ctrl+C) trước để địa chỉ công khai không còn truy cập được vào máy bạn.
2. Dừng server (Ctrl+C).
3. Xóa dữ liệu test: xóa file `.sqlite` trong `data/`, rồi chạy `npm run migrate` và `npm run seed`.
4. Xóa ảnh trong `uploads/` (giữ `.gitkeep`).
5. `git status` phải sạch, không có ảnh hay file `.sqlite`.

---

## 8. Báo lỗi
Ghi lại: thiết bị, trình duyệt, bước làm, thông báo hiển thị, ảnh chụp màn hình. Gửi vào nhóm hoặc dán cho trợ lý để sửa.
