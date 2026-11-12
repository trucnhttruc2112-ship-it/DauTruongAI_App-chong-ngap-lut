'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');
const { createRoutes } = require('../api/routes');

const PUBLIC = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

function createServer(opts) {
  const api = createRoutes(opts);
  return http.createServer(async (req, res) => {
    if (await api(req, res)) return;
    const u = new URL(req.url, 'http://localhost');
    const name = u.pathname === '/' ? 'index.html' : path.basename(u.pathname);
    try {
      const buf = await fs.readFile(path.join(PUBLIC, name));
      res.writeHead(200, { 'Content-Type': `${TYPES[path.extname(name)] || 'text/plain'}; charset=utf-8` });
      res.end(buf);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  });
}

if (require.main === module) {
  createServer().listen(config.port, () => console.log(`NV5 demo: http://localhost:${config.port}`));
}

module.exports = { createServer };
