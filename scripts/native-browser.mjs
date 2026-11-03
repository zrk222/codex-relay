// Controlled MCP host verification. This is deliberately not evidence of Codex host rendering.
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createNativeServer, UI_URI } from '../src/relay/native-server.mjs';
import { createStore } from '../src/relay/store.mjs';

mkdirSync('artifacts/native', { recursive: true });
const bindings = ['plugin/dist/relay-server.mjs', 'plugin/dist/workspace.html', 'src/relay/native-server.mjs', 'src/relay/native-ui.mjs', 'src/relay/controller.mjs', 'src/relay/runner.mjs', 'src/relay/store.mjs', 'docs/panel.js', 'docs/panel.css', 'docs/native.css'];
const hashes = () => Object.fromEntries(bindings.map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')]));
const inputHashes = hashes();
const live = process.argv.includes('--live'), root = mkdtempSync(resolve('artifacts/native/fixture-')), repo = join(root, 'repo'); mkdirSync(repo);
const git = args => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
git(['init', '--initial-branch=main']); git(['config', 'user.name', 'Relay verification']); git(['config', 'user.email', 'fixture@example.invalid']); git(['config', 'commit.gpgsign', 'false']);
writeFileSync(join(repo, 'README.md'), '# Native Relay verification fixture\nRead-only verification.\n'); git(['add', '.']); git(['commit', '-m', 'Controlled native fixture']);
const store = createStore(join(root, 'state'));
const client = new Client({ name: 'relay-controlled-host', version: '1' }); let native;
if (live) await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('plugin/dist/relay-server.mjs')], env: { ...process.env, CODEX_RELAY_STATE: join(root, 'state') }, stderr: 'pipe' }));
else {
  native = createNativeServer({ store, html: readFileSync('plugin/dist/workspace.html', 'utf8'), runner: async (s, id, args) => {
    s.save({ ...s.read(id), status: 'working' }); await new Promise(r => setTimeout(r, 200));
    s.save({ ...s.read(id), threadId: 'fixture-thread', status: args.reply ? 'needs_review' : 'needs_answer', question: args.reply ? '' : 'Ready to review?', summary: 'Controlled native bridge fixture.', checks: ['Fixture execution only'] });
  } });
  const [a, b] = InMemoryTransport.createLinkedPair(); await native.server.connect(a); await client.connect(b);
}
const resource = (await client.readResource({ uri: UI_URI })).contents[0].text;
const nonce = randomBytes(24).toString('hex'); const calls = [];
const host = await build({ stdin: { contents: `
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const frame = document.querySelector('iframe');
const bridge = new AppBridge(null, {name:'Controlled verification host', version:'1'}, {serverTools:{}}, {hostContext:{theme:'light',displayMode:'fullscreen'}});
bridge.oncalltool = async params => { const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json','x-test-token':'${nonce}'},body:JSON.stringify(params)}); const data=await r.json(); if(!r.ok)throw Error(data.error); return data; };
await bridge.connect(new PostMessageTransport(frame.contentWindow,frame.contentWindow));
frame.src='/resource'; window.relayTestBridge=bridge;`, resolveDir: process.cwd(), sourcefile: 'controlled-host.mjs' }, bundle: true, write: false, format: 'esm', platform: 'browser' });
const web = createServer(async (req, res) => {
  try {
    if (req.url === '/rpc' && req.method === 'POST') {
      if (req.headers['x-test-token'] !== nonce) throw new Error('Test capability required');
      let body = ''; for await (const c of req) { body += c; if (body.length > 24000) throw new Error('Request too large'); }
      const params = JSON.parse(body); calls.push(params.name); const result = await client.callTool(params);
      res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(result));
    }
    if (req.url === '/resource') { res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:"); return res.end(resource); }
    if (req.url === '/host.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(host.outputFiles[0].text); }
    res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="en"><title>Controlled MCP host</title><body style="margin:0"><iframe title="Relay MCP App" style="border:0;width:100vw;height:100vh"></iframe><script type="module" src="/host.js"></script></body></html>');
  } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error.message })); }
});
await new Promise(r => web.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } }); const errors = [], frameRequests = [];
page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.frame() !== page.mainFrame()) frameRequests.push(r.url()); });
try {
  await page.goto(`http://127.0.0.1:${web.address().port}`); const frame = page.frameLocator('iframe');
  await frame.locator('body[data-relay-transport=mcp]').waitFor();
  await frame.getByRole('button', { name: '＋ New task', exact: true }).click();
  await frame.locator('[name=repo]').fill(repo); await frame.locator('[name=title]').fill('Native bridge verification');
  await frame.locator('[name=prompt]').fill('Read README.md. Make no changes, do not commit, do not access external services. On the first turn return needs_answer with question Ready to review? and summarize the file. When I answer Yes, run node --version, return needs_review, clear question, and report that command and observed result. This is read-only adapter verification.');
  await frame.getByRole('button', { name: 'Create task', exact: true }).click();
  await frame.getByRole('button', { name: 'Run with Codex', exact: true }).click();
  await frame.locator('.question').waitFor({ timeout: 180000 });
  await frame.locator('[name=reply]').fill('Yes. Run node --version, report the result and return needs_review. Do not modify files.');
  await frame.getByRole('button', { name: 'Send & continue', exact: true }).click();
  await frame.getByRole('button', { name: 'Mark reviewed & done', exact: true }).waitFor({ timeout: 180000 });
  await frame.getByRole('button', { name: 'Review changes', exact: true }).click();
  await frame.locator('#diff').getByText('No pending changes.', { exact: false }).waitFor();
  const views = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => window.relayTestBridge.setHostContext({ theme: t }), theme);
    await frame.locator('html').evaluate(async node => { await Promise.all(node.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))); });
    await page.waitForTimeout(200);
    for (const width of [375, 768, 1200]) {
      await page.setViewportSize({ width, height: 900 });
      const content = page.frames().find(f => f.url().endsWith('/resource'));
      const overflow = await content.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.equal(overflow, 0);
      await content.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'));
      const violations = await content.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
      assert.equal(violations.length, 0, JSON.stringify({ theme, width, violations }));
      await page.screenshot({ path: `artifacts/native/${theme}-${width}.png`, fullPage: true }); views.push({ theme, width, overflow, axeViolations: 0 });
    }
  }
  await frame.getByRole('button', { name: 'Mark reviewed & done', exact: true }).click();
  await frame.locator('#detail>.state').filter({ hasText: 'Completed' }).waitFor();
  await page.reload(); await frame.locator('#detail>.state').filter({ hasText: 'Completed' }).waitFor();
  assert.deepEqual(errors, []); assert.equal(store.list()[0].status, 'done');
  if (live) assert.equal(store.list()[0].history.length, 2);
  assert.equal(git(['status', '--porcelain']).toString().trim(), '');
  assert.ok(frameRequests.every(url => url.endsWith('/resource')), JSON.stringify(frameRequests));
  assert.deepEqual(hashes(), inputHashes, 'Runtime inputs changed during verification');
  const receipt = { observedAt: new Date().toISOString(), profile: `${process.platform}-${process.version}-Edge-controlled-MCP-host`, liveCodex: live, providerTurns: live ? 2 : 0, resumedThread: live && store.list()[0].history.length === 2,
    persistedCompletion: true, inputHashes, bridge: 'MCP App SDK App + AppBridge with actual server tools', interactions: [...new Set(calls)], views, pageErrors: errors, frameNetworkRequests: frameRequests.length,
    limits: ['Controlled MCP host, not a screenshot or rendering test inside the installed Codex app. Actual host rendering must be verified separately.'] };
  writeFileSync(`artifacts/native/${live ? 'live' : 'fixture'}-receipt.json`, JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
} catch (error) {
  await page.screenshot({ path: 'artifacts/native/first-failure.png', fullPage: true });
  const messages = await Promise.all(page.frames().map(f => f.locator('#notice').textContent({ timeout: 500 }).catch(() => '')));
  writeFileSync('artifacts/native/last-failure.json', JSON.stringify({ error: error.message, errors, messages, at: new Date().toISOString() }, null, 2));
  console.error(JSON.stringify({ errors, messages })); throw error;
} finally { await browser.close(); await client.close(); if (native) await native.server.close(); web.closeAllConnections(); await new Promise(r => web.close(r)); }
