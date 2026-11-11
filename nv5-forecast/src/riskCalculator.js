'use strict';
// MÔ HÌNH DEMO - không phải dự báo thủy văn chính thức.
const config = require('./config');
const { addHoursLocal } = require('./time');

const LEVELS = ['thap', 'trung_binh', 'cao', 'rat_cao'];
const LEVEL_LABEL = { thap: 'Thấp', trung_binh: 'Trung bình', cao: 'Cao', rat_cao: 'Rất cao', khong_du_du_lieu: 'Không đủ dữ liệu' };
const rank = (l) => LEVELS.indexOf(l);

/** Tổng trượt: out[i] = tổng values[i-w+1..i]; null nếu thiếu dữ liệu trong cửa sổ. */
function rollingSum(values, w) {
  return values.map((_, i) => {
    if (i - w + 1 < 0) return null;
    let s = 0;
    for (let j = i - w + 1; j <= i; j++) {
      if (values[j] === null || values[j] === undefined) return null;
      s += values[j];
    }
    return Math.round(s * 10) / 10;
  });
}

function classify(rain3h, soLanNgap, t = config.thresholds) {
  if (rain3h === null || rain3h === undefined) return 'khong_du_du_lieu';
  if (rain3h >= t.rat_cao && soLanNgap >= t.rat_cao_min_so_lan_ngap) return 'rat_cao';
  if (rain3h >= t.cao) return 'cao';
  if (rain3h >= t.trung_binh) return 'trung_binh';
  return 'thap';
}

function hasCoords(p) {
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/**
 * Đánh giá nguy cơ cho một điểm với dữ liệu mưa theo giờ.
 * @returns {{status, point, intervals, hourly, maxLevel, reasons}}
 */
function assessPoint(point, forecast, opts = {}) {
  const t = opts.thresholds || config.thresholds;
  const minLevel = opts.minLevel || config.alertMinLevel;
  const base = {
    point: {
      id: point.id,
      duong: point.duong,
      phuong: point.phuong,
      is_demo: !!point.is_demo,
      verified: !point.is_demo && point.trang_thai === 'da_xac_minh',
      ...(point.source ? { source: point.source } : {}),
      ...(point.verification_status ? { verification_status: point.verification_status } : {}),
    },
  };

  if (!hasCoords(point)) {
    return { ...base, status: 'khong_du_du_lieu', maxLevel: 'khong_du_du_lieu', intervals: [], hourly: [], reasons: ['Chưa có tọa độ GPS - không thể dự báo'] };
  }
  const soLan = Number.isFinite(point.so_lan_ngap) ? point.so_lan_ngap : null;
  if (soLan === null || soLan < 1) {
    return { ...base, status: 'khong_du_du_lieu', maxLevel: 'khong_du_du_lieu', intervals: [], hourly: [], reasons: ['Chưa có lịch sử ngập - mô hình demo chưa áp dụng được'] };
  }
  if (!forecast || !Array.isArray(forecast.hours) || forecast.hours.length === 0) {
    return { ...base, status: 'khong_du_du_lieu', maxLevel: 'khong_du_du_lieu', intervals: [], hourly: [], reasons: ['Không có dữ liệu dự báo mưa'] };
  }

  const hours = forecast.hours;
  const p = hours.map((h) => h.precipitation);
  const sums = {};
  for (const w of config.windows) sums[w] = rollingSum(p, w);
  const main = sums[t.windowHours] || rollingSum(p, t.windowHours);

  const hourly = hours.map((h, i) => ({
    time: h.time,
    precipitation: h.precipitation,
    probability: h.probability,
    rain1h: sums[1] ? sums[1][i] : null,
    rain3h: main[i],
    rain6h: sums[6] ? sums[6][i] : null,
    level: classify(main[i], soLan, t),
  }));

  const missing = hourly.filter((h) => h.precipitation === null).length;
  const valid = hourly.filter((h) => h.level !== 'khong_du_du_lieu');
  const reasons = [];
  if (missing) reasons.push(`Thiếu dữ liệu mưa ${missing} giờ - các giờ này không được coi là an toàn`);
  if (valid.length === 0) {
    return { ...base, status: 'khong_du_du_lieu', maxLevel: 'khong_du_du_lieu', intervals: [], hourly, reasons: reasons.concat('Không đủ dữ liệu để tính mưa tích lũy') };
  }

  // Mỗi giờ vượt ngưỡng -> khoảng [time-(w-1)h, time+1h], rồi gộp các khoảng chồng/kề nhau.
  const raw = hourly
    .filter((h) => rank(h.level) >= rank(minLevel))
    .map((h) => ({ start: addHoursLocal(h.time, -(t.windowHours - 1)), end: addHoursLocal(h.time, 1), h }));
  const intervals = mergeIntervals(raw, soLan, t);

  const maxLevel = valid.reduce((m, h) => (rank(h.level) > rank(m) ? h.level : m), 'thap');
  return { ...base, status: missing ? 'mot_phan' : 'ok', maxLevel, intervals, hourly, reasons };
}

function mergeIntervals(raw, soLan, t = config.thresholds) {
  const sorted = raw.slice().sort((a, b) => a.start.localeCompare(b.start));
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) {
      if (r.end > last.end) last.end = r.end;
      last._hours.push(r.h);
    } else {
      out.push({ start: r.start, end: r.end, _hours: [r.h] });
    }
  }
  return out.map((iv) => {
    const max = (k) => Math.max(...iv._hours.map((h) => h[k] ?? -Infinity));
    const level = iv._hours.reduce((m, h) => (rank(h.level) > rank(m) ? h.level : m), 'thap');
    const rain3h = max('rain3h');
    const reason = level === 'rat_cao'
      ? `Mưa 3h tối đa ${rain3h}mm ≥ ${t.rat_cao}mm và điểm đã ngập ${soLan} lần`
      : `Mưa 3h tối đa ${rain3h}mm ≥ ngưỡng ${t[level]}mm (${LEVEL_LABEL[level]})`;
    return {
      start: iv.start, end: iv.end, level, levelLabel: LEVEL_LABEL[level],
      maxRain1h: max('rain1h'), maxRain3h: rain3h, maxRain6h: Number.isFinite(max('rain6h')) ? max('rain6h') : null,
      maxProbability: Number.isFinite(max('probability')) ? max('probability') : null,
      reason,
    };
  });
}

module.exports = { rollingSum, classify, assessPoint, mergeIntervals, LEVELS, LEVEL_LABEL, rank, hasCoords };
