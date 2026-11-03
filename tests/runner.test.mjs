import test from 'node:test';
import assert from 'node:assert/strict';
import { runTask } from '../src/relay/runner.mjs';
import { fixture } from './helpers.mjs';
const report = { status: 'needs_review', summary: 'Fixture change ready', question: '', checks: ['Fixture check only; no provider call'] };
function clientFor(result = report, fail) {
  const calls = []; const thread = { id: 'relay-fixture-1', async runStreamed(prompt, turnOptions) {
    calls.push({ prompt, turnOptions }); return { events: (async function* () {
      yield { type: 'thread.started', thread_id: thread.id }; if (fail) throw fail;
      yield { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(result) } };
      yield { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5, cached_input_tokens: 0 } };
    })() };
  } };
  return { calls, startThread(config) { calls.push({ start: config }); return thread; }, resumeThread(id, config) { calls.push({ resume: id, config }); return thread; } };
}
test('R2 runs and resumes the same saved thread with bounded permissions', async t => {
  const { store, create } = fixture(t); const task = create(); const client = clientFor();
  await runTask(store, task.id, { client }); const result = await runTask(store, task.id, { client, reply: 'Proceed with the named validation.' });
  assert.equal(result.status, 'needs_review'); assert.equal(result.threadId, 'relay-fixture-1'); assert.equal(result.history.length, 2);
  assert.equal(client.calls[0].start.sandboxMode, 'workspace-write'); assert.equal(client.calls[0].start.approvalPolicy, 'never');
  assert.equal(client.calls[2].resume, 'relay-fixture-1'); assert.equal(client.calls[0].start.networkAccessEnabled, false);
});
test('structured questions become needs_answer', async t => {
  const { store, create } = fixture(t); const task = create();
  const result = await runTask(store, task.id, { client: clientFor({ ...report, status: 'needs_answer', question: 'Allow an empty name?' }) });
  assert.equal(result.status, 'needs_answer'); assert.equal(result.question, 'Allow an empty name?');
});
test('R3 failures retain thread ID and release locks for retry', async t => {
  const { store, create } = fixture(t); const task = create();
  await assert.rejects(runTask(store, task.id, { client: clientFor(report, new Error('Fixture provider failure')) }), /Fixture provider failure/);
  assert.equal(store.read(task.id).status, 'failed'); assert.equal(store.read(task.id).threadId, 'relay-fixture-1');
  assert.equal((await runTask(store, task.id, { client: clientFor() })).status, 'needs_review');
});
test('R3 cancelled turns are interrupted and another run never calls the client while locked', async t => {
  const { store, create } = fixture(t); const task = create(); const release = store.lock(task.id); const client = clientFor();
  await assert.rejects(runTask(store, task.id, { client }), /active lock/); assert.equal(client.calls.length, 0); release();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runTask(store, task.id, { client: clientFor(report, new Error('Cancelled')), signal: controller.signal }), /Cancelled/);
  assert.equal(store.read(task.id).status, 'interrupted');
});
test('invalid results fail closed rather than announcing review readiness', async t => {
  const { store, create } = fixture(t); const task = create();
  await assert.rejects(runTask(store, task.id, { client: clientFor({ status: 'deployed' }) }), /invalid structured result/);
  assert.equal(store.read(task.id).status, 'failed');
});
