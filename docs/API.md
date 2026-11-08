# Tài liệu Hợp đồng Giao diện Lập trình Ứng dụng (API Documentation) - NV4

> **Phiên bản:** 1.0.0  
> **Phạm vi:** Module NV4 – Tiếp nhận Báo cáo ngập & Xác thực (Hệ thống Cảnh báo ngập lụt Đồng Nai).  
> **Quy chuẩn mã hóa:** JSON UTF-8.  
> **Lưu ý tọa độ:** Chuẩn **GeoJSON Feature** dùng thứ tự `[kinh độ (lng), vĩ độ (lat)]`. Các endpoint dữ liệu đối tượng phẳng và CSDL dùng thứ tự `(lat, lng)`.

---

## 1. Định dạng phản hồi chuẩn (Response Format)

Mọi phản hồi JSON từ hệ thống đều tuân thủ cấu trúc đồng nhất:

### Thành công (HTTP 200 / 201)
```json
{
  "ok": true,
  "data": { ... }
}
```

### Thất bại (HTTP 4xx / 5xx)
```json
{
  "ok": false,
  "error": {
    "code": "OUT_OF_AREA",
    "message": "Vị trí báo cáo nằm ngoài phạm vi địa lý tỉnh Đồng Nai",
    "details": []
  }
}
```

### Bảng mã lỗi chuẩn (Error Codes)
| Mã lỗi (`code`) | HTTP Status | Ý nghĩa |
|---|---|---|
| `OUT_OF_AREA` | 422 | Tọa độ nằm ngoài ranh giới tỉnh Đồng Nai (Bounding Box). |
| `GPS_TOO_INACCURATE` | 422 | Sai số GPS lớn hơn 100 mét (`GPS_MAX_ACCURACY_M`). |
| `REPORT_TOO_OLD` | 422 | Thời điểm chụp ảnh cũ hơn 5 phút. |
| `REPORT_IN_FUTURE` | 422 | Thời điểm chụp ảnh ở tương lai (lệch đồng hồ quá 1 phút). |
| `DUPLICATE_IMAGE` | 409 | Ảnh gửi lên trùng lặp mã băm SHA-256 với ảnh đã có. |
| `INVALID_IMAGE_FILE` | 400 | File không đúng magic bytes của JPEG, PNG hoặc WebP. |
| `FILE_TOO_LARGE` | 400 | Dung lượng file vượt quá giới hạn 8MB. |
| `INVALID_QUERY` | 400 | Tham số URL Query không vượt qua kiểm tra Zod. |
| `RATE_LIMITED` | 429 | Gửi quá 5 báo cáo/giờ/thiết bị hoặc 20 req/phút/IP. |
| `NOT_FOUND` | 404 | Không tìm thấy điểm ngập với mã định danh cung cấp. |
| `INTERNAL_SERVER_ERROR` | 500 | Lỗi máy chủ nội bộ. |

---

## 2. Danh sách Endpoint Chi tiết

### 2.1. Tiếp nhận Báo cáo Ngập
- **Endpoint:** `POST /api/reports`
- **Dành cho:** NV2 (Form người dân báo ngập)
- **Content-Type:** `multipart/form-data`
- **Giới hạn:** 5 báo cáo / giờ / `deviceId`.

#### Tham số Form Data:
| Tên trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `image` | Binary File | Có | File ảnh JPEG/PNG/WebP, dung lượng $\le 8\text{MB}$. |
| `lat` | Number | Có | Vĩ độ WGS84 (trong Đồng Nai: 10.35 – 11.60). |
| `lng` | Number | Có | Kinh độ WGS84 (trong Đồng Nai: 106.75 – 107.60). |
| `accuracyM` | Number | Có | Sai số GPS tính bằng mét ($\le 100\text{m}$). |
| `capturedAt` | ISO8601 String | Có | Thời điểm chụp ảnh (trong vòng 5 phút). |
| `deviceId` | String (UUID) | Có | Mã định danh thiết bị ẩn danh của người gửi. |
| `source` | Enum | Không | `'camera'` (mặc định), `'gallery'`, `'manual-pin'`. |
| `note` | String | Không | Ghi chú thêm của người dân ($\le 200$ ký tự). |

#### Ví dụ phản hồi (HTTP 201 Created):
```json
{
  "ok": true,
  "data": {
    "floodPoint": {
      "id": "fp_01HX87AB...",
      "lat": 10.9447,
      "lng": 106.8243,
      "address": null,
      "street": null,
      "wardId": "long-binh",
      "status": "active",
      "severity": "medium",
      "estimatedDepthCm": 25,
      "trustScore": 75,
      "confirmStill": 0,
      "confirmEnded": 0,
      "reportCount": 1,
      "isFloodProne": false,
      "floodEventCount": 1,
      "firstReportedAt": "2026-11-08T07:30:00.000Z",
      "lastUpdatedAt": "2026-11-08T07:30:00.000Z"
    },
    "report": {
      "id": "rep_a8f9c1d2-..."
    },
    "merged": false,
    "aiResult": {
      "isFlood": true,
      "confidence": 0.88,
      "severity": "medium",
      "estimatedDepthCm": 25,
      "description": "Đường ngập nước, xe máy lội nước ngang bánh",
      "reason": "Thấy mặt nước phủ mặt đường, phản chiếu",
      "error": null
    },
    "message": "Cảm ơn bạn! Báo cáo điểm ngập mới đã được tiếp nhận thành công."
  }
}
```

---

### 2.2. Danh sách Điểm ngập dạng JSON Đối tượng
- **Endpoint:** `GET /api/flood-points`
- **Dành cho:** NV1, NV2, NV5
- **Mặc định:** `status=active`, sắp xếp `last_updated_at` giảm dần.

#### Tham số Query (Xác thực bằng Zod):
| Tham số | Kiểu | Mặc định | Ý nghĩa |
|---|---|---|---|
| `status` | String | `'active'` | Lọc theo trạng thái: `'active'`, `'pending'`, hoặc `'active,pending'`. |
| `wardId` | String | - | Lọc theo mã phường (ví dụ `long-binh`). |
| `severity` | Enum | - | `'low'`, `'medium'`, `'high'`. |
| `isFloodProne` | Boolean | - | `true` hoặc `false` (chỉ lấy điểm hay ngập). |
| `limit` | Integer | - | Giới hạn số lượng (tối đa 1000). |
| `bbox` | String | - | Bounding Box lọc: `minLng,minLat,maxLng,maxLat`. |

#### Ví dụ phản hồi (HTTP 200 OK):
```json
{
  "ok": true,
  "data": [
    {
      "id": "fp_demo_01",
      "lat": 10.9447,
      "lng": 106.8243,
      "address": "Ngã tư Amata, P. Long Bình, TP. Biên Hòa",
      "street": "Xa lộ Hà Nội",
      "wardId": "long-binh",
      "status": "active",
      "severity": "medium",
      "estimatedDepthCm": 30,
      "trustScore": 85,
      "confirmStill": 4,
      "confirmEnded": 0,
      "reportCount": 5,
      "isFloodProne": true,
      "floodEventCount": 6,
      "firstReportedAt": "2026-11-08T04:10:00.000Z",
      "lastUpdatedAt": "2026-11-08T05:30:00.000Z",
      "lastConfirmedAt": "2026-11-08T05:25:00.000Z",
      "historicalEventCount": 5,
      "isDemo": true
    }
  ]
}
```

---

### 2.3. Danh sách Điểm ngập chuẩn GeoJSON
- **Endpoint:** `GET /api/flood-points.geojson`
- **Dành cho:** NV1 (Vẽ trực tiếp lên lớp Leaflet GeoJSON)
- **Header:** `Cache-Control: public, max-age=10`
- **Bộ lọc:** Giống hệt mục 2.2 (`status`, `wardId`, `severity`, `bbox`...).

#### Quy ước hiển thị:
- **Tọa độ geometry:** Bắt buộc thứ tự `[lng, lat]`.
- **`markerColor`:**
  - `high` $\rightarrow$ `'red'`
  - `medium` $\rightarrow$ `'orange'`
  - `low` $\rightarrow$ `'yellow'`
  - `resolved` / `expired` / `rejected` $\rightarrow$ `'gray'`
- **`layer`:** `'current'` (đang ngập) hoặc `'prone'` (tuyến hay ngập).

#### Ví dụ phản hồi (HTTP 200 OK):
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [106.8243, 10.9447]
      },
      "properties": {
        "id": "fp_demo_01",
        "address": "Ngã tư Amata, P. Long Bình, TP. Biên Hòa",
        "street": "Xa lộ Hà Nội",
        "wardId": "long-binh",
        "status": "active",
        "severity": "medium",
        "estimatedDepthCm": 30,
        "trustScore": 85,
        "confirmStill": 4,
        "confirmEnded": 0,
        "reportCount": 5,
        "isFloodProne": true,
        "floodEventCount": 6,
        "firstReportedAt": "2026-11-08T04:10:00.000Z",
        "lastUpdatedAt": "2026-11-08T05:30:00.000Z",
        "markerColor": "orange",
        "layer": "current",
        "isCurrent": true,
        "ageMinutes": 12,
        "thumbnailUrl": "http://localhost:3000/uploads/2026/11/amata_demo.jpg"
      }
    }
  ]
}
```

---

### 2.4. Chi tiết Điểm ngập & Lịch sử
- **Endpoint:** `GET /api/flood-points/:id`
- **Dành cho:** NV1 (Popup xem chi tiết), NV2 (Trang chi tiết điểm ngập)

#### Ví dụ phản hồi (HTTP 200 OK):
```json
{
  "ok": true,
  "data": {
    "id": "fp_demo_01",
    "lat": 10.9447,
    "lng": 106.8243,
    "address": "Ngã tư Amata, P. Long Bình, TP. Biên Hòa",
    "street": "Xa lộ Hà Nội",
    "wardId": "long-binh",
    "status": "active",
    "severity": "medium",
    "estimatedDepthCm": 30,
    "trustScore": 85,
    "confirmStill": 4,
    "confirmEnded": 0,
    "reportCount": 5,
    "isFloodProne": true,
    "floodEventCount": 6,
    "images": [
      "http://localhost:3000/uploads/2026/11/amata_recent_1.jpg",
      "http://localhost:3000/uploads/2026/11/amata_recent_2.jpg"
    ],
    "aiDescription": "Đường ngập nước, xe máy lội nước ngang bánh",
    "events": [
      {
        "id": "evt_demo_01",
        "floodPointId": "fp_demo_01",
        "startedAt": "2026-11-08T04:10:00.000Z",
        "endedAt": null,
        "endReason": null,
        "isDemo": true
      }
    ],
    "lastFloodAt": "2026-11-08T04:10:00.000Z"
  }
}
```

---

### 2.5. Danh sách Tuyến đường / Khu vực hay ngập (Flood-prone)
- **Endpoint:** `GET /api/flood-prone`
- **Dành cho:** NV5 (Đối chiếu với dữ liệu đo mưa và dự báo ngập lụt), NV1 (Lớp bản đồ cảnh báo)
- **Cơ chế:** Gom cụm theo tên đường chuẩn hóa hoặc lưới ~100 mét. Sắp xếp giảm dần theo tổng số sự kiện ngập (`eventCount`).

#### Tham số Query:
| Tham số | Kiểu | Mặc định | Ý nghĩa |
|---|---|---|---|
| `minEvents` | Integer | 3 | Ngưỡng số sự kiện ngập tối thiểu để đưa vào danh sách. |
| `wardId` | String | - | Lọc theo phường cụ thể. |

#### Ví dụ phản hồi (HTTP 200 OK):
```json
{
  "ok": true,
  "data": [
    {
      "key": "street:xa lo ha noi",
      "street": "Xa lộ Hà Nội",
      "wardId": "long-binh",
      "centerLat": 10.9447,
      "centerLng": 106.8243,
      "eventCount": 11,
      "lastFloodAt": "2026-11-08T05:30:00.000Z",
      "avgSeverity": "medium",
      "pointIds": ["fp_demo_01"]
    },
    {
      "key": "street:quoc lo 1a",
      "street": "Quốc lộ 1A",
      "wardId": "an-binh",
      "centerLat": 10.9525,
      "centerLng": 106.8421,
      "eventCount": 15,
      "lastFloodAt": "2026-11-08T05:40:00.000Z",
      "avgSeverity": "high",
      "pointIds": ["fp_demo_02"]
    }
  ]
}
```

---

### 2.6. Điểm ngập theo Phường / Xã
- **Endpoint:** `GET /api/wards/:wardId/flood-points`
- **Dành cho:** NV2 (Trang chuyên biệt quản lý và hiển thị thông tin từng phường)

#### Ví dụ phản hồi (HTTP 200 OK):
```json
{
  "ok": true,
  "data": {
    "wardId": "long-binh",
    "summary": {
      "activeCount": 1,
      "proneCount": 1,
      "totalEvents": 11
    },
    "streets": [
      {
        "street": "Xa lộ Hà Nội",
        "count": 1,
        "points": [
          {
            "id": "fp_demo_01",
            "lat": 10.9447,
            "lng": 106.8243,
            "address": "Ngã tư Amata, P. Long Bình, TP. Biên Hòa",
            "street": "Xa lộ Hà Nội",
            "wardId": "long-binh",
            "status": "active",
            "severity": "medium",
            "isFloodProne": true
          }
        ]
      }
    ],
    "points": [ ... ]
  }
}
```

---

### 2.7. Kiểm tra Tình trạng Hệ thống (Health Check)
- **Endpoint:** `GET /api/health`
- **Dành cho:** Tất cả các nhóm kiểm tra tính khả dụng của dịch vụ.

#### Ví dụ phản hồi (HTTP 200 OK):
```json
{
  "ok": true,
  "data": {
    "status": "up",
    "time": "2026-11-08T07:45:00.000Z",
    "pointsCount": 20,
    "aiMode": "mock",
    "dataMode": "demo"
  }
}
```
