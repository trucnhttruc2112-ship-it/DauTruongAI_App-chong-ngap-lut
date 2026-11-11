'use strict';
// Cấu hình NV5. Các ngưỡng là THỬ NGHIỆM (demo), không phải tiêu chuẩn thủy văn chính thức.
module.exports = {
  timezone: 'Asia/Ho_Chi_Minh',
  utcOffsetHours: 7, // Việt Nam không có giờ mùa hè
  openMeteo: {
    url: 'https://api.open-meteo.com/v1/forecast',
    forecastDays: 3,
    cacheMs: 20 * 60 * 1000,
    timeoutMs: 8000,
  },
  pointsSource: (process.env.NV5_POINTS_SOURCE || 'json').toLowerCase(),
  nv4: {
    apiUrl: process.env.NV4_API_URL || 'http://localhost:3000',
    minEvents: 1,
    cacheMs: 10 * 60 * 1000,
    timeoutMs: 5000,
    fallbackToJson: process.env.NV4_FALLBACK_JSON === '1',
  },
  windows: [1, 3, 6], // giờ
  // Phân loại theo mưa tích lũy 3h (mm)
  thresholds: {
    windowHours: 3,
    trung_binh: 15,
    cao: 30,
    rat_cao: 50,
    rat_cao_min_so_lan_ngap: 3,
  },
  alertMinLevel: 'trung_binh',
  evening: { startHour: 19, endHour: 23 }, // [19:00, 23:00)
  port: Number(process.env.PORT) || 3005,
};
