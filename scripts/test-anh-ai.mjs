// Chạy bộ ảnh thử qua AI (NV3) và tính số ảnh đúng.
// Cách dùng: node scripts/test-anh-ai.mjs <thu-muc-anh> [http://localhost:3001]
// Tên file cho biết đáp án: nhe-1.jpg, vua-2.png, nang-1.jpg, khong-ngap-1.jpg, kho-1.jpg
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dir = process.argv[2];
const base = process.argv[3] || 'http://localhost:3001';
if (!dir) {
  console.log('Cách dùng: node scripts/test-anh-ai.mjs <thu-muc-anh> [http://localhost:3001]');
  process.exit(1);
}

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
// đáp án theo tên file
const EXPECT = {
  nhe: { status: 'flooded', severity: 'low' },
  vua: { status: 'flooded', severity: 'medium' },
  nang: { status: 'flooded', severity: 'high' },
  'khong-ngap': { status: 'not_flooded' },
  kho: null // ảnh khó: không chấm, chỉ ghi lại AI trả lời gì
};

function expectOf(file) {
  const name = file.toLowerCase();
  for (const key of ['khong-ngap', 'nhe', 'vua', 'nang', 'kho']) {
    if (name.startsWith(key)) return { key, want: EXPECT[key] };
  }
  return null;
}

const files = (await readdir(dir)).filter((f) => TYPES[path.extname(f).toLowerCase()]).sort();
if (!files.length) {
  console.log('Không thấy ảnh jpg/png/webp trong thư mục', dir);
  process.exit(1);
}

const rows = [];
for (const file of files) {
  const info = expectOf(file);
  if (!info) {
    console.log('Bỏ qua (tên không bắt đầu bằng nhe/vua/nang/khong-ngap/kho):', file);
    continue;
  }
  const buf = await readFile(path.join(dir, file));
  const form = new FormData();
  form.append('image', new Blob([buf], { type: TYPES[path.extname(file).toLowerCase()] }), file);
  let got = null;
  let error = '';
  try {
    const res = await fetch(`${base}/api/analyze-flood`, { method: 'POST', body: form });
    const data = await res.json();
    if (res.ok) got = data;
    else error = data?.error?.message || `HTTP ${res.status}`;
  } catch (e) {
    error = 'Không kết nối được máy chủ AI';
  }
  let statusOk = null;
  let severityOk = null;
  if (info.want && got) {
    statusOk = got.status === info.want.status;
    if (info.want.severity) severityOk = got.severity === info.want.severity;
  }
  rows.push({ file, key: info.key, want: info.want, got, error, statusOk, severityOk });
  const show = got ? `${got.status} / ${got.severity}` : `LỖI: ${error}`;
  const mark = statusOk === null ? '-' : statusOk ? 'đúng' : 'SAI';
  console.log(`${file.padEnd(24)} ${show.padEnd(28)} ${mark}`);
}

const graded = rows.filter((r) => r.statusOk !== null);
const okStatus = graded.filter((r) => r.statusOk).length;
const withSev = rows.filter((r) => r.severityOk !== null);
const okSev = withSev.filter((r) => r.severityOk).length;
const errors = rows.filter((r) => r.error).length;
console.log('\n--- Kết quả ---');
console.log(`Ngập / không ngập đúng: ${okStatus}/${graded.length} ảnh`);
console.log(`Đúng cả mức nhẹ/vừa/nặng: ${okSev}/${withSev.length} ảnh ngập`);
if (errors) console.log(`Ảnh bị lỗi: ${errors} (kiểm tra key Gemini, mạng, dung lượng ảnh)`);

const csv = ['file,dap_an,ai_status,ai_severity,summary,dung_ngap_khong,dung_muc']
  .concat(rows.map((r) => [
    r.file,
    r.want ? `${r.want.status}${r.want.severity ? '/' + r.want.severity : ''}` : 'khong cham',
    r.got?.status || '',
    r.got?.severity || '',
    `"${(r.got?.summary || r.error || '').replace(/"/g, "'")}"`,
    r.statusOk === null ? '' : r.statusOk ? 'dung' : 'sai',
    r.severityOk === null ? '' : r.severityOk ? 'dung' : 'sai'
  ].join(',')))
  .join('\n');
await writeFile('ket-qua-test-ai.csv', '﻿' + csv);
console.log('Đã lưu bảng chi tiết: ket-qua-test-ai.csv');
