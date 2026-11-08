# LƯU Ý KHI ĐỌC VÀ THỰC HIỆN FILE NV4_ke_hoach_va_prompts.md

> Đặt file này ở thư mục gốc dự án (tên `AGENTS.md`) hoặc dán vào phần rules của Antigravity. Áp dụng cho mọi prompt P0 → P9.

## A. CÁCH ĐỌC FILE
1. Đọc toàn bộ Phần A (phân tích) và A4/A5 (luật nghiệp vụ, hợp đồng dữ liệu) trước khi viết bất kỳ dòng code nào. Đây là nguồn sự thật duy nhất.
2. Chỉ thực hiện MỘT prompt mỗi lần (P1, P2…). Không làm trước các prompt sau, không "tiện tay" làm thêm tính năng ngoài phạm vi prompt đang chạy.
3. Nếu hai chỗ trong file mâu thuẫn nhau, hoặc file mâu thuẫn với yêu cầu tôi nói trong chat, hãy dừng lại, nêu rõ chỗ mâu thuẫn và hỏi tôi. Không tự chọn.
4. Các giá trị trong [ngoặc vuông] hoặc đánh dấu "đề xuất" là giá trị tạm. Đưa vào `src/config/rules.js` để chỉnh sửa dễ, không hard-code.

## B. PHẠM VI VÀ RANH GIỚI
5. Chỉ làm phần NV4. Không sửa, không ghi đè code của NV1 (bản đồ), NV2 (giao diện), NV3 (AI/server), NV5 (dự báo), NV6 (dữ liệu). Cần tích hợp thì tạo adapter hoặc file ví dụ trong `integration/`.
6. NV3 chưa xong thì dùng `aiAnalyzer` ở chế độ mock. Tuyệt đối không tự gọi Gemini trực tiếp và không tự tạo API key.
7. Không đổi hợp đồng dữ liệu (tên trường, kiểu dữ liệu, thứ tự lng/lat trong GeoJSON, mã trạng thái). Muốn đổi phải hỏi tôi, vì các NV khác đang dựa vào nó.
8. Không thêm thư viện ngoài danh sách đã nêu nếu chưa giải thích lý do và chờ tôi đồng ý.

## C. CÁCH LÀM VIỆC
9. Trước khi code mỗi prompt, tóm tắt kế hoạch trong tối đa 10 dòng (file sẽ tạo/sửa, cách kiểm thử), rồi mới bắt đầu.
10. Không được nói "đã xong" khi chưa chạy test. Phải dán kết quả lệnh test thật (số test pass/fail). Test lỗi thì sửa rồi chạy lại, không xóa hoặc bỏ qua test để cho qua.
11. Không bịa dữ liệu thật. Dữ liệu điểm ngập, danh sách phường, ranh giới hành chính là dữ liệu giả lập tạm, phải ghi chú "DỮ LIỆU GIẢ LẬP – CHỜ NV6" ngay trong file và trong báo cáo.
12. Nếu thiếu thông tin (tọa độ, danh sách phường, định dạng NV3), hỏi tối đa 3 câu ngắn hoặc dùng giá trị tạm có ghi chú. Không đoán âm thầm.
13. Mỗi prompt xong phải báo cáo theo mẫu:
    - (1) file đã tạo/sửa
    - (2) cách chạy
    - (3) kết quả test
    - (4) việc còn tồn đọng / giả định đã dùng

    Sau đó dừng và chờ tôi commit.

## D. LƯU Ý KỸ THUẬT DỄ SAI
14. GeoJSON dùng thứ tự `[lng, lat]`; còn Leaflet và DB của ta dùng `(lat, lng)`. Phải ghi chú rõ ở mọi chỗ chuyển đổi.
15. "Số lần ngập" = số **sự kiện** ngập (một vòng đời active → resolved/expired), không phải số lượt báo.
16. Hàm nghiệp vụ trong `src/domain` phải thuần, nhận `now` làm tham số, không gọi `Date.now()` bên trong, để test được.
17. Camera/GPS chỉ chạy trên HTTPS hoặc localhost. Khi viết frontend phải kiểm tra `window.isSecureContext` và báo lỗi tiếng Việt rõ ràng.
18. Ảnh người dùng gửi: kiểm tra magic bytes, xóa EXIF/GPS, giới hạn kích thước và số pixel, đặt tên file ngẫu nhiên. Không tin tên file hoặc mimetype từ client.
19. Mọi thao tác ghi nhiều bảng phải nằm trong một transaction; lỗi giữa chừng thì rollback và xóa file ảnh đã ghi.
20. Không log API key, ảnh hoặc tọa độ chi tiết ở mức info. `.env` không được commit; luôn có `.env.example`.
21. Thông báo lỗi trả cho người dùng viết bằng tiếng Việt thân thiện; mã lỗi (`code`) giữ tiếng Anh viết hoa như `OUT_OF_AREA`.

## E. KHÔNG ĐƯỢC LÀM
22. Không xóa hoặc ghi đè dữ liệu và file hiện có ngoài thư mục NV4 khi chưa hỏi tôi.
23. Không chạy lệnh phá hủy (xóa thư mục, reset git, force push) khi chưa được tôi cho phép.
24. Không tự deploy, không tự mở cổng ra internet (ngrok/cloudflared) khi chưa được tôi yêu cầu; chỉ viết sẵn lệnh để tôi tự chạy.
25. Không tạo tính năng ngoài kế hoạch (đăng nhập, chatbot, trang quản trị…). Nếu thấy hữu ích, ghi vào mục "Đề xuất thêm" cuối báo cáo.

## F. NHẮC NHANH KHI ANTIGRAVITY LÀM LỆCH
- "Quay lại mục B và C của AGENTS.md, chỉ làm đúng prompt hiện tại."
- Sau mỗi 2–3 prompt, mở cuộc trò chuyện mới và dán lại Prompt 0 cùng file này để tránh quên quy tắc khi ngữ cảnh dài.
- Tự đọc lại các đoạn code quan trọng (khoảng cách, đếm sự kiện ngập, transaction) thay vì chỉ tin báo cáo.
