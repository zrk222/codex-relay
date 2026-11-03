import test from 'node:test';
import assert from 'node:assert/strict';
import { startPanel } from '../src/relay/panel.mjs';
import { fixture } from './helpers.mjs';
async function panel(t, store, runner) {
  const app = await startPanel({ store, runner }); t.after(() => new Promise(resolve => { app.server.closeAllConnections(); app.server.close(resolve); }));
  const origin = app.url.split('/#')[0];
  const call = (path, method = 'GET', data) => fetch(origin + path, { method, headers: { 'x-relay-token': app.token, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { ...app, origin, call };
}
test('visual panel creates real isolated tasks, renders diff, and completes reviewed work', async t => {
  const { store, repo } = fixture(t); const app = await panel(t, store);
  const response = await app.call('/api/tasks', 'POST', { repo, title: 'Visual task', prompt: 'Inspect the code.' }); assert.equal(response.status, 201); const task = await response.json();
  assert.equal((await (await app.call('/api/tasks')).json()).tasks.length, 1);
  assert.equal((await app.call(`/api/tasks/${task.id}/done`, 'POST', {})).status, 400);
  assert.equal((await app.call(`/api/tasks/${task.id}/diff`)).status, 200);
  store.save({ ...task, status: 'needs_review' }); assert.equal((await app.call(`/api/tasks/${task.id}/done`, 'POST', {})).status, 200); assert.equal(store.read(task.id).status, 'done');
  store.save({ ...task, status: 'working' }); assert.equal((await (await app.call('/api/tasks')).json()).tasks[0].status, 'interrupted');
  assert.match(await (await fetch(app.origin)).text(), /Create task/);
});
test('panel requires a secret capability and refuses hostile origins and invalid inputs', async t => {
  const { store } = fixture(t); const app = await panel(t, store);
  assert.equal((await fetch(app.origin + '/api/tasks')).status, 403);
  assert.equal((await fetch(app.origin + '/api/tasks', { headers: { 'x-relay-token': app.token, Origin: 'https://outside.invalid' } })).status, 403);
  assert.equal((await app.call('/api/tasks', 'POST', { repo: '.', title: '', prompt: '' })).status, 400);
  assert.equal((await app.call('/api/tasks/not-an-id/run', 'POST', {})).status, 400);
});
test('visual run/resume dispatch is exclusive, and Stop aborts its active controller', async t => {
  const { store, create } = fixture(t); const task = create(); let runs = 0, reply;
  const runner = async (s, id, options) => { runs++; reply = options.reply; s.save({ ...s.read(id), status: 'working' }); await new Promise(resolve => options.signal.addEventListener('abort', resolve, { once: true })); s.save({ ...s.read(id), status: 'interrupted' }); };
  const app = await panel(t, store, runner);
  assert.equal((await app.call(`/api/tasks/${task.id}/run`, 'POST', { reply: 'My decision' })).status, 202);
  assert.equal((await app.call(`/api/tasks/${task.id}/run`, 'POST', {})).status, 400); assert.equal(runs, 1); assert.equal(reply, 'My decision');
  assert.equal((await app.call(`/api/tasks/${task.id}/stop`, 'POST', {})).status, 202);
  await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(store.read(task.id).status, 'interrupted');
});
