import dotenv from 'dotenv';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { MAX_IMAGE_BYTES } from '../src/utils.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const config = readConfig();
if (config.mock || !config.apiKey || !process.argv[2]) {
  console.error('Cần MOCK_GEMINI=false, GEMINI_API_KEY và đường dẫn ảnh: npm run test:live -- ./duong.jpg');
  process.exit(2);
}
let server;
try {
  const info = await stat(process.argv[2]);
  if (info.size > MAX_IMAGE_BYTES) throw new Error('Ảnh vượt 5 MB.');
  const buffer = await readFile(process.argv[2]);
  server = createApp({ config }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const body = new FormData();
  body.append('image', new Blob([buffer]), 'live-image');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/analyze-flood`, { method: 'POST', body });
  const result = await response.json();
  console.log(JSON.stringify({ httpStatus: response.status, result }, null, 2));
  if (!response.ok || result.mode !== 'gemini') process.exitCode = 1;
} catch {
  console.error('Kiểm thử Gemini thật không hoàn tất. Kiểm tra file ảnh và cấu hình backend.');
  process.exitCode = 1;
} finally {
  server?.close();
  server?.closeAllConnections();
}
