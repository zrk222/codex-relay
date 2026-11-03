import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createController } from './controller.mjs';

const assets = { '/': ['panel.html', 'text/html'], '/panel.js': ['panel.js', 'text/javascript'], '/panel.css': ['panel.css', 'text/css'] };
function send(res, code, value, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:" });
  res.end(type === 'application/json' ? JSON.stringify(value) : value);
}
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 24000) throw new Error('Request too large'); }
  return JSON.parse(text || '{}');
}
function authorized(req, token) {
  const value = req.headers['x-relay-token'];
  return typeof value === 'string' && value.length === token.length && timingSafeEqual(Buffer.from(value), Buffer.from(token));
}
/** A loopback control surface opened inside a Codex browser panel. */
export async function startPanel(options) {
  const token = randomBytes(32).toString('hex'), store = options.store;
  const control = createController(options);
  async function handle(req, res) {
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) return send(res, 403, { error: 'Local origin required' });
    const path = new URL(req.url, origin).pathname;
    if (req.method === 'GET' && assets[path]) {
      const [name, type] = assets[path];
      return send(res, 200, await readFile(new URL(`../../docs/${name}`, import.meta.url)), type);
    }
    if (!authorized(req, token)) return send(res, 403, { error: 'Open Relay from Codex to authorize this panel' });
    if (path === '/api/tasks' && req.method === 'GET') return send(res, 200, control.list());
    if (path === '/api/tasks' && req.method === 'POST') return send(res, 201, control.create(await body(req)));
    const match = /^\/api\/tasks\/([^/]+)\/(run|stop|done|recover|diff)$/.exec(path);
    if (!match) return send(res, 404, { error: 'Not found' });
    const [, id, action] = match; store.read(id);
    if (action === 'diff' && req.method === 'GET') return send(res, 200, control.diff(id));
    if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
    const input = await body(req);
    if (action === 'run') {
      return send(res, 202, control.run(id, input.reply));
    }
    if (action === 'stop') return send(res, 202, control.stop(id));
    if (action === 'recover') return send(res, 200, control.recover(id));
    if (action === 'done') return send(res, 200, control.done(id));
  }
  const server = createServer((req, res) => handle(req, res).catch(error => send(res, 400, { error: error.message })));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(options.port ?? 0, '127.0.0.1', resolve); });
  server.on('close', () => control.close());
  return { server, url: `http://127.0.0.1:${server.address().port}/#${token}`, token };
}
