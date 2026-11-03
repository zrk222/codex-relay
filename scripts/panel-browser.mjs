import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createStore } from '../src/relay/store.mjs';
import { startPanel } from '../src/relay/panel.mjs';

mkdirSync('artifacts/panel', { recursive: true });
const root = mkdtempSync(resolve('artifacts/panel/fixture-')), repo = join(root, 'repo'); mkdirSync(repo);
const git = args => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
git(['init', '--initial-branch=main']); git(['config', 'user.name', 'Relay UI verification']); git(['config', 'user.email', 'fixture@example.invalid']); git(['config', 'commit.gpgsign', 'false']);
writeFileSync(join(repo, 'README.md'), '# Relay visual verification fixture\nRead-only test. No product source.\n'); git(['add', '.']); git(['commit', '-m', 'Controlled visual fixture']);
const store = createStore(join(root, 'state'));
const live = process.argv.includes('--live');
const runner = async (s, id, options) => {
  s.save({ ...s.read(id), status: 'working' });
  await new Promise(resolve => setTimeout(resolve, 250));
  s.save({ ...s.read(id), threadId: 'fixture-thread', status: options.reply ? 'needs_review' : 'needs_answer', question: options.reply ? '' : 'Ready to review?', summary: 'Controlled adapter fixture.', checks: ['Fixture execution only'] });
};
const panel = await startPanel({ store, ...(live ? {} : { runner }) });
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } }); const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(panel.url); await page.getByRole('button', { name: '＋ New task', exact: true }).click();
  await page.locator('[name=repo]').fill(repo); await page.locator('[name=title]').fill('Read-only visual verification');
  await page.locator('[name=prompt]').fill('Read README.md. Make no changes, do not commit, do not access external services. On this first turn return needs_answer with question Ready to review? and a concise summary of the file. When the developer answers Yes, run node --version, return needs_review, clear question, and report that exact command and its observed result. This is a read-only adapter verification.');
  await page.getByRole('button', { name: 'Create task', exact: true }).click(); await page.getByRole('button', { name: 'Run with Codex', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Run with Codex', exact: true }).click();
  await page.locator('.question').waitFor({ timeout: 180000 });
  await page.locator('[name=reply]').fill('Yes. Run node --version and return needs_review with the observed result. Do not modify files.');
  await page.getByRole('button', { name: 'Send & continue', exact: true }).click();
  await page.getByRole('button', { name: 'Mark reviewed & done', exact: true }).waitFor({ timeout: 180000 });
  await page.getByRole('button', { name: 'Review changes', exact: true }).click(); await page.locator('#diff').getByText('No pending changes.', { exact: false }).waitFor();
  const task = store.list()[0]; assert.equal(task.status, 'needs_review'); assert.ok(task.threadId); assert.equal(task.history.length, live ? 2 : 0);
  const views = [];
  for (const width of [375, 768, 1200]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.equal(overflow, 0);
    await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'));
    const results = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
    assert.equal(results.violations.length, 0, JSON.stringify(results.violations.map(v => v.id)));
    await page.screenshot({ path: `artifacts/panel/panel-${width}.png`, fullPage: true }); views.push({ width, overflow, axeViolations: 0 });
  }
  await page.getByRole('button', { name: 'Mark reviewed & done', exact: true }).click(); await page.locator('#detail>.state').filter({ hasText: 'Completed' }).waitFor();
  assert.equal(store.list()[0].status, 'done'); await page.reload(); await page.locator('#detail h2').waitFor(); assert.deepEqual(errors, []);
  const receipt = { observedAt: new Date().toISOString(), liveCodex: live, providerTurns: live ? 2 : 0, persistedCompletion: true, resumedThread: live && store.list()[0].history.length === 2,
    interactions: ['create', 'run', 'answer and resume', 'Git diff', 'manual completion', 'reload persistence'], views, pageErrors: errors,
    limits: ['Controlled read-only fixture. The Codex in-app panel was opened through open_in_codex; automation of that host browser is disabled in Work settings. These browser checks use a separate test-owned browser.'] };
  writeFileSync(`artifacts/panel/${live ? 'live' : 'fixture'}-receipt.json`, JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
} finally { await browser.close(); panel.server.closeAllConnections(); await new Promise(resolve => panel.server.close(resolve)); }
