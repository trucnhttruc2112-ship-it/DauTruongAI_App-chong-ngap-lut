'use strict';
const { LEVEL_LABEL } = require('./riskCalculator');

const hm = (s) => s.slice(11, 16);
const dmy = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

function formatAlert({ point, interval, isDemo }) {
  const place = [point.duong, point.phuong].filter(Boolean).join(', ') || point.id;
  const range = interval.start.slice(0, 10) === interval.end.slice(0, 10)
    ? `${hm(interval.start)}–${hm(interval.end)} ngày ${dmy(interval.start)}`
    : `${hm(interval.start)} ${dmy(interval.start)} – ${hm(interval.end)} ${dmy(interval.end)}`;
  const prob = interval.maxProbability !== null ? `, xác suất mưa tới ${interval.maxProbability}%` : '';
  const tag = isDemo ? '[DEMO - tọa độ thử nghiệm, chưa xác minh] ' : '';
  return `${tag}⚠️ Cảnh báo ngập ngày mai tại ${place}: nguy cơ ${LEVEL_LABEL[interval.level].toUpperCase()} khoảng ${range}. ` +
    `Mưa dự kiến tới ${interval.maxRain3h}mm/3h${prob}. Lý do: ${interval.reason}. ` +
    '(Mô hình demo, không phải dự báo thủy văn chính thức.)';
}

module.exports = { formatAlert };
