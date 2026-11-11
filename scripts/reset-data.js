// Xóa database của NV4 rồi tạo lại với 8 điểm ngập của NV6.
// Dùng trước khi demo. Nhớ tắt app (npm run dev) trước khi chạy.
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const dir = path.join(__dirname, '..', 'server', 'data')
for (const f of fs.readdirSync(dir)) {
  if (f.includes('.sqlite')) fs.rmSync(path.join(dir, f))
}
execSync('npm --prefix server run migrate', { stdio: 'inherit' })
execSync('npm --prefix server run seed:real', { stdio: 'inherit' })
