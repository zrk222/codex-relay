import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2] ?? 'http://127.0.0.1:4317';
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage(); const errors = [], failedRequests = [];
page.on('pageerror', error => errors.push(error.message)); page.on('response', response => { if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() }); });
await page.addInitScript(() => {
  window.relayMetrics = { lcp: null, cls: 0 };
  new PerformanceObserver(list => { for (const entry of list.getEntries()) window.relayMetrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.relayMetrics.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
});
mkdirSync('artifacts/browser', { recursive: true });
try {
  await page.goto(target, { waitUntil: 'networkidle' });
  await page.locator('#task-detail h2').waitFor();
  assert.match(await page.locator('#mode-description').innerText(), /sample data/);
  assert.equal(await page.locator('.task-card').count(), 2);
  await page.locator('[data-filter=working]').click(); assert.equal(await page.locator('.task-card').count(), 1);
  await page.locator('[data-filter=all]').click(); assert.equal(await page.locator('.task-card').count(), 4);
  await page.getByRole('button', { name: /Handle empty search results/ }).click(); assert.match(await page.locator('#task-detail').innerText(), /Should an empty search/);
  for (let step = 1; step <= 5; step++) { await page.locator('#story-next').click(); assert.match(await page.locator('#story-caption').innerText(), new RegExp(`${step}/5`)); }
  assert.match(await page.locator('#task-detail').innerText(), /Sample task complete/);
  await page.locator('[data-filter=attention]').focus(); await page.keyboard.press('Enter'); assert.equal(await page.locator('[data-filter=attention]').getAttribute('aria-pressed'), 'true');
  const screenshots = [];
  for (const [name, width, height] of [['mobile', 375, 900], ['tablet', 768, 1024], ['desktop', 1440, 1000]]) {
    await page.setViewportSize({ width, height }); await page.reload({ waitUntil: 'networkidle' }); await page.locator('#task-detail h2').waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.equal(overflow, 0, `${name} horizontal overflow`);
    await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'));
    const axe = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
    writeFileSync(`artifacts/browser/axe-${name}.json`, JSON.stringify({ violations: axe.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target }) => target) })), incompleteCount: axe.incomplete.length }, null, 2));
    assert.equal(axe.violations.length, 0, `${name}: ${axe.violations.map(item => item.id).join(', ')}`);
    const path = `docs/preview-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push({ name, width, height, overflow, axeViolations: 0, path });
  }
  assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  const receipt = { schema: 'codex-relay.browser.v1', observedAt: new Date().toISOString(), target, interactions: ['3 filters', 'task selection', '5 sample story steps', 'keyboard activation'],
    pageErrors: errors, failedRequests, screenshots, metrics: await page.evaluate(() => window.relayMetrics),
    limits: ['Initial screenshots establish a baseline; no earlier baseline exists for visual regression.', 'Lab LCP/CLS only; no field Core Web Vitals or INP claim.', 'Automated axe and keyboard checks do not establish complete accessibility conformance.'] };
  writeFileSync('artifacts/browser/receipt.json', JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt, null, 2));
} finally { await browser.close(); }
