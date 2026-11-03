import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const PUBLIC = fileURLToPath(new URL('../../docs/', import.meta.url));
const ASSETS = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/style.css', ['style.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']], ['/sample.json', ['sample.json', 'application/json']]]);
function send(response, code, body, type = 'text/plain') {
  response.writeHead(code, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer' });
  response.end(body);
}
async function handle(request, response, options, server) {
  const port = server.address().port;
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host)) return send(response, 403, 'Local Host required');
  if (request.method !== 'GET') return send(response, 405, 'Read-only dashboard');
  if (request.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(request.headers.origin)) return send(response, 403, 'Local Origin required');
  const path = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  if (!options.demo && path === '/' && !new URL(request.url, 'http://localhost').searchParams.has('mode')) {
    response.writeHead(302, { Location: '/?mode=local', 'Cache-Control': 'no-store' }); response.end(); return;
  }
  if (path === '/api/tasks') {
    if (options.demo) return send(response, 404, 'Sample preview');
    return send(response, 200, JSON.stringify({ mode: 'local', tasks: options.store.list().map(({ prompt, history, ...task }) => task) }), 'application/json');
  }
  const asset = ASSETS.get(path);
  if (!asset) return send(response, 404, 'Not found');
  return send(response, 200, await readFile(join(PUBLIC, asset[0])), asset[1]);
}

/** Start the loopback read-only task viewer. */
export function startServer(options) {
  options ??= {};
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => { handle(request, response, options, server).catch(() => send(response, 500, 'Unable to read task data')); });
    server.once('error', reject);
    server.listen(options.port ?? 4317, '127.0.0.1', () => resolve(server));
  });
}
