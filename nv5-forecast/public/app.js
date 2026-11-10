'use strict';
const $ = (s) => document.querySelector(s);
const LABEL = { thap: 'Thấp', trung_binh: 'Trung bình', cao: 'Cao', rat_cao: 'Rất cao', khong_du_du_lieu: 'Không đủ dữ liệu' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const v = (x) => (x === null || x === undefined ? '<span class="null">thiếu</span>' : x);

function qs() {
  return `lat=${encodeURIComponent($('#lat').value)}&lng=${encodeURIComponent($('#lng').value)}&so_lan=${encodeURIComponent($('#solan').value || 1)}`;
}

async function getJson(url) {
  const r = await fetch(url);
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || r.status);
  return b;
}

function renderPoints(data) {
  $('#points').innerHTML = '<h2>Nguy cơ theo điểm</h2>' + data.results.map((a) => `
    <div>
      <b>${esc(a.point.duong || a.point.id)}</b> – ${esc(a.point.phuong)}
      ${a.point.is_demo ? '<span class="badge-demo">[DEMO]</span>' : `<span>[${a.point.verified ? 'Thực tế' : 'Mẫu/chưa xác minh'}]</span>`}
      <span class="badge ${a.maxLevel}">${LABEL[a.maxLevel]}</span>
      ${a.reasons.length ? `<div class="null">${a.reasons.map(esc).join('; ')}</div>` : ''}
      <ul>${a.intervals.map((i) => `<li>${esc(i.start)} → ${esc(i.end)}: <span class="badge ${i.level}">${i.levelLabel}</span> ${i.maxRain3h}mm/3h – ${esc(i.reason)}</li>`).join('')}</ul>
    </div>`).join('<hr>') + `<p class="null">${esc(data.disclaimer)}</p>`;

  const demo = data.results.find((a) => a.hourly.length);
  $('#hourly').innerHTML = demo ? `<table><tr><th>Giờ</th><th>Mưa (mm)</th><th>Xác suất %</th><th>1h</th><th>3h</th><th>6h</th><th>Nguy cơ</th></tr>${
    demo.hourly.map((h) => `<tr><td>${esc(h.time.replace('T', ' '))}</td><td>${v(h.precipitation)}</td><td>${v(h.probability)}</td><td>${v(h.rain1h)}</td><td>${v(h.rain3h)}</td><td>${v(h.rain6h)}</td><td><span class="badge ${h.level}">${LABEL[h.level]}</span></td></tr>`).join('')
  }</table>` : '<p>Không có dữ liệu theo giờ.</p>';
}

function renderAlerts(d) {
  let html = `<h2>Thông báo ngày mai (${esc(d.tomorrow)})</h2>`;
  if (d.simulated) html += '<p class="demo-note">Đang mô phỏng thời điểm 19:00.</p>';
  if (!d.inWindow) html += `<p>Hiện ${esc(d.now)} – ngoài khung 19:00–23:00, chưa kiểm tra cảnh báo.</p>`;
  else if (!d.alerts.length) html += '<p>Không có cảnh báo từ mức Trung bình trở lên cho các điểm đủ dữ liệu.</p>';
  const isNew = new Set(d.newAlerts.map((a) => a.key));
  html += d.alerts.map((a) => `<div class="alert ${isNew.has(a.key) ? 'new' : ''}">${esc(a.message)}${isNew.has(a.key) ? ' <b>(mới)</b>' : ''}</div>`).join('');
  if (d.insufficient?.length) html += `<p class="null">Không đủ dữ liệu (không kết luận an toàn): ${d.insufficient.map((i) => esc(i.point.duong || i.point.id)).join(', ')}</p>`;
  $('#alerts').innerHTML = html;
}

// Mô phỏng: endpoint /demo/* tách riêng, không trộn với Open-Meteo thật.
const scen = () => $('#scenario').value;
const base = (p) => (scen() ? `/demo${p}?scenario=${scen()}&${qs()}` : `${p}?${qs()}`);
function banner(d) {
  return scen() ? `<p class="demo-banner">${esc(d.data_source)} – kịch bản ${esc(d.scenario)}. Không phải Open-Meteo.</p>` : '';
}

async function load() {
  try { const d = await getJson(base('/forecast')); renderPoints(d); $('#points').insertAdjacentHTML('afterbegin', banner(d)); } catch (e) { $('#points').innerHTML = `<h2>Lỗi</h2><p>${esc(e.message)}</p>`; }
  checkAlerts(false);
}

let demoSoLan = {};
let userSoLan = $('#solan').value;
// Đồng bộ ô "Số lần ngập" với giá trị thuật toán thực sự dùng cho kịch bản DEMO
function syncSoLan() {
  const s = scen();
  if (s && demoSoLan[s] !== undefined) {
    if (!$('#solan').disabled) userSoLan = $('#solan').value;
    $('#solan').value = demoSoLan[s];
    $('#solan').disabled = true;
    $('#solan').title = 'Giá trị cố định của kịch bản DEMO';
  } else if ($('#solan').disabled) {
    $('#solan').value = userSoLan;
    $('#solan').disabled = false;
    $('#solan').title = '';
  }
}

getJson('/demo/info').then((i) => {
  demoSoLan = i.so_lan_ngap || {};
  if (i.demoAllowed) document.querySelectorAll('#scenario option[disabled]').forEach((o) => { o.disabled = false; });
  else $('#scenario').title = 'Chế độ DEMO bị tắt (production hoặc không phải localhost)';
  syncSoLan();
}).catch((e) => console.warn('Không kiểm tra được chế độ DEMO:', e));
$('#scenario').addEventListener('change', () => { syncSoLan(); load(); });

async function checkAlerts(sim) {
  try { const d = await getJson(`${base('/alerts')}${sim ? '&simulate=19' : ''}`); renderAlerts(d); $('#alerts').insertAdjacentHTML('afterbegin', banner(d)); } catch (e) { $('#alerts').innerHTML = `<h2>Lỗi cảnh báo</h2><p>${esc(e.message)}</p>`; }
}

$('#f').addEventListener('submit', (e) => { e.preventDefault(); load(); });
$('#sim').addEventListener('click', () => checkAlerts(true));
setInterval(() => checkAlerts(false), 5 * 60 * 1000); // kiểm tra trong app khi đang mở
load();
