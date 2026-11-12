'use strict';
const config = require('./config');
const { createOpenMeteoClient, ForecastError } = require('./openMeteoClient');
const risk = require('./riskCalculator');
const { createAlertService, isEveningWindow } = require('./alertScheduler');
const { formatAlert } = require('./alertFormatter');
const sources = require('./adapters/floodPointsSource');
const time = require('./time');

/** Đánh giá danh sách điểm: điểm thiếu GPS không gọi API; lỗi API -> không đủ dữ liệu. */
async function assessPoints(points, client) {
  return Promise.all(points.map(async (p) => {
    if (!risk.hasCoords(p)) return risk.assessPoint(p, null);
    try {
      const fc = await client.getHourly(p.lat, p.lng);
      return { ...risk.assessPoint(p, fc), fetchedAt: fc.fetchedAt, cached: fc.cached };
    } catch (e) {
      const r = risk.assessPoint({ ...p, lat: p.lat, lng: p.lng }, null);
      return { ...r, reasons: [`Lỗi lấy dự báo: ${e.message}`], error: e.code || 'ERROR' };
    }
  }));
}

module.exports = {
  config, createOpenMeteoClient, ForecastError, ...risk,
  createAlertService, isEveningWindow, formatAlert, ...sources, ...time, assessPoints,
};
