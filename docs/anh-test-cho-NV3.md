# Danh sách ảnh kiểm thử AI (NV6 gửi NV3)

Mục tiêu: 12-15 ảnh, đặt tên theo mẫu `loai-so.jpg`, bỏ chung 1 thư mục `anh-test/`.
Ảnh nên là đường phố Việt Nam, chụp từ tầm mắt người đi xe máy. Đừng dùng ảnh có mặt người hoặc biển số rõ.

| Tên file | Loại | Kết quả đúng (status / severity) | Đã có |
|---|---|---|---|
| ngap-nhe-01.jpg | Nước phủ mặt đường, thấy rõ vạch kẻ | flooded / low | |
| ngap-nhe-02.jpg | Nước đọng ven lề, xe vẫn chạy bình thường | flooded / low | |
| ngap-nhe-03.jpg | Nước mỏng trên mặt đường sau mưa | flooded / low | |
| ngap-vua-01.jpg | Nước tới nửa bánh xe máy | flooded / medium | |
| ngap-vua-02.jpg | Xe máy chạy tạo sóng nước | flooded / medium | |
| ngap-vua-03.jpg | Nước tràn lên vỉa hè, xe chạy chậm | flooded / medium | |
| ngap-nang-01.jpg | Nước qua yên/ngang đùi, xe chết máy | flooded / high | |
| ngap-nang-02.jpg | Nước ngập tới cửa nhà, không thấy mặt đường | flooded / high | |
| ngap-nang-03.jpg | Ô tô ngập quá nửa bánh | flooded / high | |
| khong-ngap-01.jpg | Đường khô ban ngày | not_flooded / none | |
| khong-ngap-02.jpg | Đường ướt sau mưa nhưng không đọng nước | not_flooded / none | |
| khong-ngap-03.jpg | Đường ban đêm, đèn đường | not_flooded / none | |
| kho-01.jpg | Ảnh mờ hoặc tối, khó nhìn | uncertain / unknown | |
| kho-02.jpg | Ảnh không phải đường (ví dụ trong nhà, con vật) | uncertain / unknown | |
| kho-03.jpg | Vũng nước lớn trên sân/ruộng, không phải đường | uncertain | |

## Cách thử (NV3 và NV6)

1. Mở `http://localhost:3001/test`, tải từng ảnh lên, ghi `status` và `severity` AI trả về vào cột kết quả.
2. Tính số ảnh AI trả đúng trên tổng số. Ngập nhẹ/vừa/nặng hay bị lệch 1 bậc là bình thường, quan trọng là phân biệt được ngập / không ngập.
3. Ghi lại các ảnh AI trả sai để đưa vào phần "hạn chế" trong thuyết minh (ví dụ vũng nước lớn bị nhầm thành ngập đường).
4. Nếu nhóm còn phân vân Gemini hay Claude, thử cùng bộ ảnh với cả hai và chọn bên đúng nhiều hơn.

## Nguồn ảnh

- Ảnh tự chụp là tốt nhất (còn mùa mưa tối nay).
- Hoặc lấy ảnh từ bài báo, nhưng chỉ để thử nội bộ, không đưa vào slide nộp bài nếu chưa ghi nguồn.
