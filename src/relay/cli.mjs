#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createStore } from './store.mjs';
import { runTask } from './runner.mjs';
import { startServer } from './server.mjs';
import { startPanel } from './panel.mjs';

const HELP = `Codex Relay 0.2.0 — a visual task workspace for Codex desktop\n\n`
  + `codex-relay gui                    Start the live panel for Codex\n`
  + `codex-relay create --repo PATH --title TITLE --prompt REQUEST\n`
  + `codex-relay run TASK_ID [--reply TEXT] [--model MODEL]\n`
  + `codex-relay list | show TASK_ID | done TASK_ID | recover TASK_ID\n`
  + `codex-relay serve [--port 4317]    Local read-only inbox\n`
  + `codex-relay preview [--port 4317]  Sample data only\n\n`
  + `All state commands accept --state PATH. Default: CODEX_RELAY_HOME or ~/.codex-relay.\n`
  + `Run uses existing local Codex authentication. Codex usage follows your account's limits.\n`;
async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    state: { type: 'string' }, repo: { type: 'string' }, title: { type: 'string' }, prompt: { type: 'string' },
    reply: { type: 'string' }, model: { type: 'string' }, port: { type: 'string' }, codex: { type: 'string' }, help: { type: 'boolean' }
  } });
  const [command, id] = positionals;
  if (!command || values.help) return process.stdout.write(HELP);
  if (!['create', 'run', 'list', 'show', 'done', 'recover', 'serve', 'preview', 'gui'].includes(command)) throw new Error('Unknown command; use --help');
  const port = values.port === undefined ? 4317 : Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  if (command === 'preview') {
    const server = await startServer({ demo: true, port });
    console.log(`Sample preview: http://127.0.0.1:${server.address().port}`);
    return;
  }
  const store = createStore(resolve(values.state ?? process.env.CODEX_RELAY_HOME ?? join(homedir(), '.codex-relay')));
  if (command === 'gui') { const panel = await startPanel({ store, port: values.port === undefined ? 0 : port }); console.log(JSON.stringify({ panelUrl: panel.url, pid: process.pid })); return; }
  if (command === 'serve') { const server = await startServer({ store, port }); console.log(`Local inbox: http://127.0.0.1:${server.address().port}/?mode=local`); return; }
  let result;
  if (command === 'create') result = store.create({ repo: values.repo ?? process.cwd(), title: values.title, prompt: values.prompt });
  if (command === 'list') result = store.list();
  if (command === 'show') result = store.read(id);
  if (command === 'recover') result = store.recover(id);
  if (command === 'done') {
    const release = store.lock(id);
    try { const task = store.read(id); if (task.status !== 'needs_review') throw new Error('Only a task needing review can be marked done'); result = store.save({ ...task, status: 'done' }); }
    finally { release(); }
  }
  if (command === 'run') {
    const controller = new AbortController();
    const abort = () => controller.abort();
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    try { result = await runTask(store, id, { reply: values.reply, model: values.model, codexPath: values.codex, signal: controller.signal }); }
    finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
  }
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(`Codex Relay: ${error.message}`); process.exitCode = 1; });
