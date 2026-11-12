'use strict';
const config = require('./config');

const pad = (n) => String(n).padStart(2, '0');

/** Trả về {date:'YYYY-MM-DD', hour, minute, iso:'YYYY-MM-DDTHH:00'} theo giờ Việt Nam. */
function vnParts(d = new Date()) {
  const t = new Date(d.getTime() + config.utcOffsetHours * 3600e3);
  const date = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  return { date, hour: t.getUTCHours(), minute: t.getUTCMinutes(), iso: `${date}T${pad(t.getUTCHours())}:00` };
}

/** Cộng giờ vào chuỗi giờ địa phương 'YYYY-MM-DDTHH:mm' (an toàn qua nửa đêm). */
function addHoursLocal(local, h) {
  const d = new Date(`${local}:00Z`);
  d.setUTCHours(d.getUTCHours() + h);
  return d.toISOString().slice(0, 16);
}

function addDays(date, n) {
  return addHoursLocal(`${date}T00:00`, 24 * n).slice(0, 10);
}

/** Tạo Date ứng với HH:00 giờ Việt Nam của ngày date (mặc định hôm nay). */
function vnTime(hour, date = vnParts().date) {
  return new Date(`${date}T${pad(hour)}:00:00+07:00`);
}

/** Hàm mô phỏng 19:00 giờ VN để test. */
const simulate19 = (date) => vnTime(19, date);

module.exports = { vnParts, addHoursLocal, addDays, vnTime, simulate19 };
