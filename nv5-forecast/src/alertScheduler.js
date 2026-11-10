'use strict';
// Cảnh báo tối hôm trước - chỉ trong ứng dụng khi đang chạy (không push khi app tắt).
const config = require('./config');
const { vnParts, addDays } = require('./time');
const { formatAlert } = require('./alertFormatter');

function isEveningWindow(now = new Date(), ev = config.evening) {
  const { hour } = vnParts(now);
  return hour >= ev.startHour && hour < ev.endHour;
}

/** Khoảng có chồng lên ngày D (00:00 D → 00:00 D+1) không. */
function overlapsDate(iv, date) {
  const dayStart = `${date}T00:00`;
  const dayEnd = `${addDays(date, 1)}T00:00`;
  return iv.start < dayEnd && iv.end > dayStart;
}

function createAlertService({ dedupStore = new Set() } = {}) {
  /**
   * @param assessments kết quả assessPoint
   * @param now Date (có thể mô phỏng)
   * @param force bỏ qua kiểm tra khung giờ tối
   */
  function check(assessments, now = new Date(), { force = false } = {}) {
    const tomorrow = addDays(vnParts(now).date, 1);
    if (!force && !isEveningWindow(now)) {
      return { inWindow: false, tomorrow, alerts: [], newAlerts: [], insufficient: [] };
    }
    const alerts = [];
    const newAlerts = [];
    const insufficient = [];
    for (const a of assessments) {
      if (a.status === 'khong_du_du_lieu') {
        insufficient.push({ point: a.point, reasons: a.reasons });
        continue;
      }
      for (const iv of a.intervals) {
        if (!overlapsDate(iv, tomorrow)) continue;
        const key = `${a.point.id}|${tomorrow}|${iv.start}|${iv.end}|${iv.level}`;
        const alert = {
          key, date: tomorrow, point: a.point, ...iv,
          message: formatAlert({ point: a.point, interval: iv, isDemo: a.point.is_demo }),
        };
        alerts.push(alert);
        if (!dedupStore.has(key)) { dedupStore.add(key); newAlerts.push(alert); }
      }
      if (a.status === 'mot_phan') insufficient.push({ point: a.point, reasons: a.reasons });
    }
    return { inWindow: true, tomorrow, alerts, newAlerts, insufficient };
  }
  return { check, reset: () => dedupStore.clear() };
}

module.exports = { isEveningWindow, overlapsDate, createAlertService };
