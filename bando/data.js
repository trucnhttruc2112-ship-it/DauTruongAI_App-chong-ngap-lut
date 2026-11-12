/*
 * DỮ LIỆU GIẢ LẬP để học và demo NV1.
 * Tọa độ chỉ là vị trí minh họa quanh các khu vực tại Đồng Nai;
 * không phải bằng chứng có ngập, không sử dụng để cảnh báo thật.
 * type: "current" (đang ngập) hoặc "frequent" (hay ngập)
 * level: "heavy" / "moderate" / "light" đối với điểm đang ngập
 * floodCount: số lần ngập giả định để thử chức năng hiển thị.
 */
const floodPoints = [
  {
    id: "M01", name: "Điểm mẫu A – khu vực Biên Hòa", lat: 10.955, lng: 106.820,
    type: "current", level: "heavy", floodCount: 4,
    description: "Đây là điểm đang ngập được GIẢ LẬP để thử màu đỏ và popup.",
    image: "assets/anh-minh-hoa.svg"
  },
  {
    id: "M02", name: "Điểm mẫu B – khu vực Trảng Bom", lat: 10.963, lng: 107.004,
    type: "current", level: "moderate", floodCount: 2,
    description: "Đây là điểm đang ngập được GIẢ LẬP để thử màu cam.",
    image: "assets/anh-minh-hoa.svg"
  },
  {
    id: "M03", name: "Điểm mẫu C – khu vực Long Khánh", lat: 10.933, lng: 107.241,
    type: "current", level: "light", floodCount: 1,
    description: "Đây là điểm đang ngập được GIẢ LẬP để thử màu vàng.",
    image: "assets/anh-minh-hoa.svg"
  },
  {
    id: "M04", name: "Điểm mẫu D – khu vực Nhơn Trạch", lat: 10.719, lng: 106.948,
    type: "frequent", floodCount: 7,
    description: "Địa điểm hay ngập GIẢ LẬP; không có nghĩa đang ngập.",
    image: "assets/anh-minh-hoa.svg"
  },
  {
    id: "M05", name: "Điểm mẫu E – khu vực Vĩnh Cửu", lat: 11.122, lng: 106.975,
    type: "frequent", floodCount: 5,
    description: "Địa điểm hay ngập GIẢ LẬP; dùng thử lớp lịch sử.",
    image: "assets/anh-minh-hoa.svg"
  },
  {
    id: "M06", name: "Điểm mẫu F – khu vực Định Quán", lat: 11.201, lng: 107.353,
    type: "frequent", floodCount: 3,
    description: "Địa điểm hay ngập GIẢ LẬP; không có nghĩa đang ngập.",
    image: "assets/anh-minh-hoa.svg"
  }
];
