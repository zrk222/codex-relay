import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createNativeServer, UI_URI } from '../src/relay/native-server.mjs';
import { createController } from '../src/relay/controller.mjs';
import { fixture } from './helpers.mjs';

async function connect(t, options) {
  const app = createNativeServer({ html: readFileSync('plugin/dist/workspace.html', 'utf8'), ...options });
  const client = new Client({ name: 'relay-protocol-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await app.server.connect(a); await client.connect(b);
  t.after(async () => { app.control.close(); await client.close(); await app.server.close(); });
  return { ...app, client, call: (name, args = {}) => client.callTool({ name: `relay_${name}`, arguments: args }) };
}
const waitFor = async fn => { for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('Timed out waiting for task state'); };

test('native MCP advertises desktop entrypoints and a self-contained, restricted app resource', async t => {
  const { store } = fixture(t); const { client, call } = await connect(t, { store });
  const tools = await client.listTools(); const open = tools.tools.find(x => x.name === 'relay_open');
  assert.deepEqual(open._meta['openai/ui'].entrypoints, [{ type: 'global' }, { type: 'thread' }]);
  assert.equal(open._meta.ui.resourceUri, UI_URI);
  const resource = (await client.readResource({ uri: UI_URI })).contents[0];
  assert.match(resource.mimeType, /text\/html/); assert.ok(resource.text.includes('app.connect') || resource.text.includes('relayNative'));
  const markup = resource.text.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
  assert.ok(!/<(?:script|link)\b[^>]*\s(?:src|href)=/i.test(markup), 'UI markup must not request external assets');
  assert.deepEqual(resource._meta.ui.csp, { connectDomains: [], resourceDomains: [] });
  assert.deepEqual((await call('open')).structuredContent, { tasks: [] });
});

test('MCP task create, run, answer, actual diff and completion preserve state across reconnect', async t => {
  const { store, repo } = fixture(t); const replies = [];
  const runner = async (s, id, args) => { replies.push(args.reply); s.save({ ...s.read(id), threadId: 'test-thread', status: args.reply ? 'needs_review' : 'needs_answer', question: args.reply ? '' : 'Proceed?', summary: 'Protocol fixture', checks: [] }); };
  const { call, control } = await connect(t, { store, runner });
  const task = (await call('create', { repo, title: 'Native task', prompt: 'Inspect the fixture' })).structuredContent;
  assert.equal((await call('done', { id: task.id })).isError, true);
  await call('run', { id: task.id }); await waitFor(() => store.read(task.id).status === 'needs_answer');
  await waitFor(() => control.list().tasks[0].status === 'needs_answer');
  await call('run', { id: task.id, reply: 'Yes' }); await waitFor(() => store.read(task.id).status === 'needs_review');
  writeFileSync(join(task.directory, 'README.md'), 'Actual worktree change\n');
  assert.match((await call('diff', { id: task.id })).structuredContent.diff, /Actual worktree change/);
  assert.deepEqual(replies, [undefined, 'Yes']);
  await waitFor(() => control.list().tasks[0].status === 'needs_review');
  assert.equal((await call('done', { id: task.id })).structuredContent.status, 'done');
  assert.equal((await call('run', { id: task.id })).isError, true);
  const second = await connect(t, { store, runner });
  assert.equal((await second.call('list')).structuredContent.tasks[0].status, 'done');
  assert.doesNotMatch(readFileSync(join(repo, 'README.md'), 'utf8'), /Actual worktree change/);
});

test('MCP validation and cancellation refuse invalid identifiers, oversized replies and active transitions', async t => {
  const { store, create } = fixture(t); const task = create(); let calls = 0;
  const runner = async (s, id, args) => { calls++; s.save({ ...s.read(id), status: 'working' }); await new Promise(r => args.signal.addEventListener('abort', r, { once: true })); s.save({ ...s.read(id), status: 'interrupted' }); };
  const { call, control } = await connect(t, { store, runner });
  assert.equal((await call('run', { id: '../escape' })).isError, true);
  assert.equal((await call('run', { id: task.id, reply: 'x'.repeat(16001) })).isError, true);
  await call('run', { id: task.id });
  const observer = createController({ store });
  assert.equal(control.list().tasks[0].status, 'working');
  assert.equal(observer.list().tasks[0].status, 'interrupted', 'A second host must not claim ownership of another process run');
  observer.close();
  assert.equal((await call('run', { id: task.id })).isError, true);
  assert.equal((await call('recover', { id: task.id })).isError, true);
  assert.equal(calls, 1); await call('stop', { id: task.id });
  await waitFor(() => store.read(task.id).status === 'interrupted');
  await waitFor(() => control.list().tasks[0].status === 'interrupted');
  assert.equal((await call('stop', { id: task.id })).isError, true);
});

test('packaged plugin starts over real stdio with no node_modules beside it', async t => {
  const { repo } = fixture(t);
  const root = mkdtempSync(join(tmpdir(), 'relay-native-'));
  mkdirSync(join(root, 'dist'));
  // A clean directory proves the generated package does not need source-relative imports.
  writeFileSync(join(root, 'dist/relay-server.mjs'), readFileSync('plugin/dist/relay-server.mjs'));
  writeFileSync(join(root, 'dist/workspace.html'), readFileSync('plugin/dist/workspace.html'));
  const config = JSON.parse(readFileSync('plugin/.mcp.json', 'utf8')).mcpServers.relay_native;
  const transport = new StdioClientTransport({ command: config.command, args: config.args, cwd: resolve(root, config.cwd), env: { ...process.env, CODEX_RELAY_STATE: join(root, 'state'), CODEX_RELAY_CODEX_PATH: join(root, 'missing-codex') }, stderr: 'pipe' });
  const client = new Client({ name: 'isolated-plugin-test', version: '1' }); t.after(() => client.close());
  await client.connect(transport);
  assert.equal((await client.callTool({ name: 'relay_open', arguments: {} })).structuredContent.tasks.length, 0);
  assert.match((await client.readResource({ uri: UI_URI })).contents[0].text, /Codex Relay/);
  const task = (await client.callTool({ name: 'relay_create', arguments: { repo, title: 'Missing executable', prompt: 'Do not run' } })).structuredContent;
  assert.equal((await client.callTool({ name: 'relay_run', arguments: { id: task.id } })).isError, true);
  assert.equal((await client.callTool({ name: 'relay_list', arguments: {} })).structuredContent.tasks[0].status, 'queued');
});
