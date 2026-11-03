import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { readFileSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createController } from './controller.mjs';
import { createStore } from './store.mjs';
import { runTask } from './runner.mjs';

export const UI_URI = 'ui://codex-relay/workspace-v0.3.0.html';
export const VERSION = '0.3.0';
function nativeCodex() {
  const binary = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const paths = process.env.CODEX_RELAY_CODEX_PATH ? [process.env.CODEX_RELAY_CODEX_PATH]
    : (process.env.PATH ?? process.env.Path ?? '').split(delimiter).filter(Boolean).map(p => join(p, binary));
  const found = paths.find(p => { try { return statSync(p).isFile(); } catch { return false; } });
  if (!found) throw new Error('Codex executable unavailable. Put the native Codex binary on PATH or set CODEX_RELAY_CODEX_PATH to its absolute path.');
  return found;
}
export function createNativeServer(options = {}) {
  const store = options.store ?? createStore(process.env.CODEX_RELAY_STATE ?? process.env.CODEX_RELAY_HOME ?? join(homedir(), '.codex-relay'));
  const control = createController({ store, runner: options.runner ?? ((store, id, args) => runTask(store, id, { ...args, codexPath: nativeCodex() })) });
  const server = new McpServer({ name: 'codex-relay', version: VERSION });
  const html = options.html ?? (() => readFileSync(new URL('./workspace.html', import.meta.url), 'utf8'));
  registerAppResource(server, 'Relay workspace', UI_URI, { description: 'Local coding task workspace', _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } } }, async () => ({ contents: [{
    uri: UI_URI, mimeType: RESOURCE_MIME_TYPE, text: typeof html === 'function' ? html() : html,
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } }, 'openai/ui': { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'] } }
  }] }));
  const readonly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  const wrap = fn => async args => { try { const data = await fn(args); return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }; }
    catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; } };
  registerAppTool(server, 'relay_open', { title: 'Codex Relay', description: 'Open the native Relay task workspace. Create, run, answer and review local coding tasks.', inputSchema: {}, annotations: readonly,
    _meta: { ui: { resourceUri: UI_URI, visibility: ['model', 'app'] }, 'openai/outputTemplate': UI_URI,
      'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] } } }, wrap(() => control.list()));
  const tool = (name, description, inputSchema, fn, readOnly = false, openWorld = false) => server.registerTool(`relay_${name}`, {
    title: `Relay: ${name}`, description, inputSchema, annotations: readOnly ? readonly : { readOnlyHint: false, destructiveHint: false, openWorldHint: openWorld },
    _meta: { ui: { visibility: ['app', 'model'] } }
  }, wrap(fn));
  const id = z.string().uuid();
  tool('list', 'List persisted Relay tasks and actual active-run state.', {}, () => control.list(), true);
  tool('create', 'Create a task in an isolated Git worktree. Requires a clean source repository.', { repo: z.string().min(1).max(4096), title: z.string().min(1).max(160), prompt: z.string().min(1).max(16000) }, a => control.create(a));
  tool('run', 'Start or resume Codex in the task worktree. May edit files and run checks. Never pushes, merges or deploys.', { id, reply: z.string().max(16000).optional() }, a => {
    if (!options.runner) nativeCodex();
    return control.run(a.id, a.reply);
  }, false, true);
  tool('stop', 'Abort this service-owned active Codex turn.', { id }, a => control.stop(a.id));
  tool('diff', 'Read Git status and tracked diff versus HEAD from the task worktree.', { id }, a => control.diff(a.id), true);
  tool('recover', 'Recover a stopped task only after the recorded owner process has exited.', { id }, a => control.recover(a.id));
  tool('done', 'Record developer-reviewed completion. Only allowed from needs_review. Does not merge or deploy.', { id }, a => control.done(a.id));
  server.server.onclose = () => control.close();
  return { server, control };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { server, control } = createNativeServer();
  process.once('SIGTERM', () => { control.close(); server.close().finally(() => process.exit(0)); });
  await server.connect(new StdioServerTransport());
}
