# Phường mới cho NV4 (NV6 gửi Thiên)

Danh sách phường trong `data/demo/wards.demo.json` đang dùng tên cũ (trước 7/2025). File `data/wards.json` là danh sách mới.

## Cách dùng
1. Chép `data/wards.json` đè lên `data/demo/wards.demo.json` (giữ cấu trúc `wards[]` có `id`, `name`, `lat`, `lng`).
2. Đổi `wardId` trong seed demo theo bảng `doiMaCu` trong file.
3. Nạp dữ liệu thật: `data/seed-flood-points.real.json` (8 điểm). Hiện `npm run seed` chỉ đọc file demo, cần thêm lệnh nạp file này.
4. Test `p3 #14` dùng toạ độ 10.9447, 106.8243 ("Amata") sẽ ra `tran-bien`. Toạ độ này cách tâm Trấn Biên ~1 km nên cần đổi toạ độ test sang điểm trong Long Bình (vd 10.94583, 106.8775).

## Phường cũ -> phường mới
| Mã cũ | Mã mới |
|---|---|
| long-binh, ho-nai (cũ) | long-binh |
| an-binh, quyet-thang | tran-bien |
| tan-phong | tan-trieu |
| ho-nai-3 | ho-nai (mới) |
| tt-long-thanh, loc-an | long-thanh |
| tt-trang-bom | trang-bom |
| tt-hiep-phuoc, phu-hoi | nhon-trach |
| trang-dai, tam-hiep, phuoc-tan, an-phuoc | giữ nguyên |

Chú ý: `ho-nai` cũ là phường Hố Nai cũ (nay thuộc Long Bình), `ho-nai` mới là phường Hố Nai gồm Tân Hòa + Hố Nai 3.

## Còn cần kiểm tra
- Toạ độ ghi "ước lượng" trong `nguonToaDo`: Hố Nai, Long Thành, An Phước. Phường Biên Hòa chưa có toạ độ nên không dùng để tự gán.
- 3 điểm có phường theo nguồn khác với phường gán theo toạ độ: Cổng 11, Bùi Trọng Nghĩa, khu vực Hố Nai.

Nguồn: NQ 1662/NQ-UBTVQH15 (1/7/2025), NQ 237/NQ-UBTVQH16 (30/4/2026), Wikipedia, Báo Pháp luật 10/09/2026.
