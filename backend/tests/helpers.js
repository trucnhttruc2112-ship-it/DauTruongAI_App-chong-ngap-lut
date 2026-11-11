import { once } from 'node:events';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';

export const mockConfig = () => readConfig({ MOCK_GEMINI: 'true' });

export async function startApp(t, options = {}) {
  const server = createApp({ config: mockConfig(), ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

export function makeImage(format = 'png', width = 32, height = 24) {
  return sharp({ create: { width, height, channels: 3, background: '#4a7281' } }).toFormat(format).toBuffer();
}

export function upload(buffer, { name = 'street.png', type = 'image/png', field = 'image' } = {}) {
  const body = new FormData();
  body.append(field, new Blob([buffer], { type }), name);
  return body;
}

export const prediction = () => ({
  status: 'flooded',
  severity: 'medium',
  evidence: ['Nước phủ một phần mặt đường'],
  summary: 'Ảnh có dấu hiệu ngập đường; cần xác minh thực địa.',
});
