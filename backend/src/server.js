import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { readConfig } from './config.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
let config;
try {
  config = readConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const server = createApp({ config }).listen(config.port, () => {
  console.log(`FloodLens NV3: http://localhost:${config.port}/test (${config.mock ? 'mock' : 'gemini'})`);
  if (!config.mock && !config.apiKey) console.warn('Chưa cấu hình GEMINI_API_KEY; endpoint phân tích sẽ trả 503.');
});
server.requestTimeout = 60_000;
server.headersTimeout = 15_000;
server.on('error', () => {
  console.error('Không thể khởi động backend. Kiểm tra PORT và quyền mở cổng.');
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
