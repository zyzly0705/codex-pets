#!/usr/bin/env node
const { createReadStream, existsSync, statSync } = require('fs');
const { createServer } = require('http');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || process.argv[2] || 5177);
const contentTypes = new Map([
  ['.html', 'text/html'],
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.css', 'text/css'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
  ['.json', 'application/json'],
]);

function sendFile(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const requested = decodeURIComponent(url.pathname).replace(/^\/+/u, '') || 'src/yoyo-home-preview.html';
  const full = path.join(repoRoot, requested);
  if (!full.startsWith(repoRoot) || !existsSync(full) || statSync(full).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  const ext = path.extname(full);
  res.writeHead(200, { 'content-type': contentTypes.get(ext) || 'application/octet-stream' });
  createReadStream(full).pipe(res);
}

const server = createServer(sendFile);
server.listen(port, '127.0.0.1', () => {
  console.log(`Yoyo Home preview: http://127.0.0.1:${port}/src/yoyo-home-preview.html?debug=1`);
});
