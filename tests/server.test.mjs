import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { startServer } from '../src/relay/server.mjs';
import { fixture } from './helpers.mjs';
function closeAfter(t, server) { t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); })); return `http://127.0.0.1:${server.address().port}`; }
test('R4 local inbox serves only GET, excludes prompts, and redirects to local mode', async t => {
  const { store, create } = fixture(t); create(); const server = await startServer({ store, port: 0 }); const url = closeAfter(t, server);
  assert.equal(server.address().address, '127.0.0.1');
  const response = await fetch(`${url}/api/tasks`); const payload = await response.json();
  assert.equal(payload.mode, 'local'); assert.equal(payload.tasks.length, 1); assert.equal(payload.tasks[0].prompt, undefined);
  assert.equal((await fetch(`${url}/api/tasks`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${url}/api/tasks`, { headers: { Origin: 'https://external.example' } })).status, 403);
  assert.match((await fetch(url)).url, /mode=local/);
});
test('R4 forged Host requests fail and unknown asset paths return 404', async t => {
  const server = await startServer({ demo: true, port: 0 }); const url = closeAfter(t, server);
  const code = await new Promise((resolve, reject) => { const req = request(url, { headers: { Host: 'external.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(); });
  assert.equal(code, 403); assert.equal((await fetch(`${url}/unknown`)).status, 404);
});
test('R5 sample preview is separate from local state and includes narrative controls', async t => {
  const server = await startServer({ demo: true, port: 0 }); const url = closeAfter(t, server);
  assert.equal((await fetch(`${url}/api/tasks`)).status, 404);
  const sample = await (await fetch(`${url}/sample.json`)).json(); assert.equal(sample.mode, 'sample'); assert.equal(sample.tasks.length, 4);
  const html = await (await fetch(url)).text(); assert.match(html, /sample data/); assert.equal((html.match(/data-filter=/g) ?? []).length, 3); assert.match(html, /story-next/);
});
