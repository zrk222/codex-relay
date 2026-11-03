import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { runTask } from './runner.mjs';

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
function diff(task) {
  const git = args => execFileSync('git', ['-C', task.directory, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
  return { status: git(['status', '--short']), diff: git(['diff', 'HEAD', '--']), directory: task.directory,
    note: 'Tracked changes versus HEAD. Untracked files are listed in status; their contents are not included.' };
}
/** A loopback control surface opened inside a Codex browser panel. */
export async function startPanel(options) {
  const token = randomBytes(32).toString('hex'), active = new Map(), store = options.store;
  const runner = options.runner ?? runTask;
  function launch(id, reply) {
    if (active.has(id)) throw new Error('Task is already running');
    const task = store.read(id);
    if (task.status === 'done') throw new Error('Completed tasks cannot run again');
    const controller = new AbortController();
    active.set(id, controller);
    Promise.resolve().then(() => runner(store, id, { reply, signal: controller.signal })).catch(() => {}).finally(() => active.delete(id));
    return { ...task, status: 'working' };
  }
  async function handle(req, res) {
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) return send(res, 403, { error: 'Local origin required' });
    const path = new URL(req.url, origin).pathname;
    if (req.method === 'GET' && assets[path]) {
      const [name, type] = assets[path];
      return send(res, 200, await readFile(new URL(`../../docs/${name}`, import.meta.url)), type);
    }
    if (!authorized(req, token)) return send(res, 403, { error: 'Open Relay from Codex to authorize this panel' });
    if (path === '/api/tasks' && req.method === 'GET') return send(res, 200, { tasks: store.list().map(task => active.has(task.id) ? { ...task, status: 'working' }
      : task.status === 'working' ? { ...task, status: 'interrupted', summary: 'The panel service no longer owns this run. Inspect the worktree, then recover it only after its process has stopped.' } : task) });
    if (path === '/api/tasks' && req.method === 'POST') return send(res, 201, store.create(await body(req)));
    const match = /^\/api\/tasks\/([^/]+)\/(run|stop|done|recover|diff)$/.exec(path);
    if (!match) return send(res, 404, { error: 'Not found' });
    const [, id, action] = match; store.read(id);
    if (action === 'diff' && req.method === 'GET') return send(res, 200, diff(store.read(id)));
    if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
    const input = await body(req);
    if (action === 'run') {
      if (input.reply !== undefined && (typeof input.reply !== 'string' || input.reply.length > 16000)) throw new Error('Invalid answer');
      return send(res, 202, launch(id, input.reply));
    }
    if (action === 'stop') { const controller = active.get(id); if (!controller) throw new Error('No active run to stop'); controller.abort(); return send(res, 202, { stopping: true }); }
    if (active.has(id)) throw new Error('Stop the active run before changing its state');
    if (action === 'recover') return send(res, 200, store.recover(id));
    if (action === 'done') {
      const release = store.lock(id);
      try { const task = store.read(id); if (task.status !== 'needs_review') throw new Error('Review the task before marking it done'); return send(res, 200, store.save({ ...task, status: 'done' })); }
      finally { release(); }
    }
  }
  const server = createServer((req, res) => handle(req, res).catch(error => send(res, 400, { error: error.message })));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(options.port ?? 0, '127.0.0.1', resolve); });
  server.on('close', () => { for (const controller of active.values()) controller.abort(); });
  return { server, url: `http://127.0.0.1:${server.address().port}/#${token}`, token };
}
