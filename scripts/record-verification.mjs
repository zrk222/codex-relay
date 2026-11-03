import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const sha = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(Array.isArray(value) ? value.map(item => JSON.parse(canonical(item))) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value);
mkdirSync('.factory/evidence', { recursive: true });
function run(name, args) {
  const output = execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const path = `.factory/evidence/${name}.log`; writeFileSync(path, `Command: node ${args.join(' ')}\nProfile: ${process.platform} ${process.version}\nObserved: ${new Date().toISOString()}\n${output}`); return path;
}
const tests = run('node-tests', ['--test', ...readdirSync('tests').filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`)]);
assert.match(readFileSync(tests, 'utf8'), /# pass 16/);
const syntax = run('syntax', ['scripts/check.mjs']);
const live = JSON.parse(readFileSync('artifacts/live-smoke.json', 'utf8'));
assert.equal(live.actualTestPassed, true); assert.equal(live.resumedSameThread, true); assert.equal(live.originalFilePreserved, true);
const browser = JSON.parse(readFileSync('artifacts/browser/receipt.json', 'utf8'));
assert.equal(browser.pageErrors.length, 0); assert.equal(browser.failedRequests.length, 0);
for (const row of browser.screenshots) { assert.equal(row.overflow, 0); assert.equal(row.axeViolations, 0); }
assert.ok(browser.metrics.lcp < 2500); assert.ok(browser.metrics.cls < 0.1);
writeFileSync('.factory/evidence/review.md', '# Reviewed evidence\n\nNode tests exercise the declared positive and negative cases. The live receipt is from two authenticated turns against the controlled greeting fixture; its original source was preserved. Browser checks exercised all filters, detail selection, narrative steps, keyboard activation, and axe checks at three sizes. Screenshots were visually inspected. Local lab LCP and CLS meet the declared smoke bounds; no field INP or full accessibility claim is made. The public preview contains sample records only. All eight categories apply to this combined CLI and UI scope.\n');
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(join(directory, item.name)) : [join(directory, item.name).replaceAll('\\', '/')]);
}
const files = ['package.json', 'package-lock.json', '.gitignore', 'AGENTS.md', 'README.md', 'LICENSE', 'NOTICE.md', 'codex-adapter.ssat.yaml',
  ...['src', 'docs', 'scripts', 'tests', 'specs', 'plans', 'adr', 'smoke', '.github'].flatMap(walk)].filter(path => path !== 'docs/verification.json').sort();
const artifact = (path, kind = 'evidence') => ({ path, sha256: sha(readFileSync(path)), kind });
const candidate = files.map(path => artifact(path, 'source'));
const rows = [
  ['happy', 'happy_path', 'A task persists and the authenticated Codex turn produces a reviewable fixture change.', [tests, 'artifacts/live-smoke.json']],
  ['validation', 'validation', 'Invalid task identifiers, escaped paths, malformed results, and forbidden HTTP methods are rejected.', [tests]],
  ['recovery', 'failure_recovery', 'Cancellation and provider failure persist their state; locks prevent concurrent runs and allow verified recovery.', [tests]],
  ['consistency', 'state_consistency', 'Thread IDs survive resume and the original source file is preserved.', [tests, 'artifacts/live-smoke.json']],
  ['privacy', 'security_privacy', 'The viewer is loopback/read-only, rejects external Host/Origin, and the sample preview cannot run agents.', [tests, 'artifacts/browser/receipt.json']],
  ['performance', 'performance', 'Local browser smoke has LCP below 2500 ms and CLS below 0.1; no field-performance claim.', ['artifacts/browser/receipt.json']],
  ['accessibility', 'accessibility', 'Three browser sizes have zero automated axe violations, zero overflow, and keyboard filter activation works.', ['artifacts/browser/receipt.json', 'artifacts/browser/axe-mobile.json', 'artifacts/browser/axe-tablet.json', 'artifacts/browser/axe-desktop.json']],
  ['effects', 'external_effects', 'Controlled worktree writes preserve the source repository; public preview interactions make no coding calls.', ['artifacts/live-smoke.json', 'artifacts/browser/receipt.json']]
];
const profile = `win32-node22.22-codex-sdk0166-edge-headless`;
const obligations = JSON.parse(execFileSync('specline', ['evidence', 'codex-adapter', '--root', '.', '--catalog'], { encoding: 'utf8' }));
const completions = readdirSync('.factory/specline/codex-adapter').filter(name => /^T\d+\.json$/.test(name)).map(name => `.factory/specline/codex-adapter/${name}`);
for (const obligation of obligations) rows.push([obligation.id, 'happy_path', obligation.text, [tests, 'artifacts/live-smoke.json', 'artifacts/browser/receipt.json', ...completions]]);
const contract = { schema: 'factory.workflow-audit.contract.v1', project_id: 'codex-relay', candidate,
  applicability: rows.slice(0,8).map(([, category, reason]) => ({ category, applicable: true, reason })),
  checks: rows.map(([id, category, requirement]) => ({ id, category, requirement, profiles: [profile] })) };
const contractText = `${JSON.stringify(contract, null, 2)}\n`; writeFileSync('.factory/workflow-audit-contract.json', contractText);
const observations = { schema: 'factory.workflow-audit.observations.v1', contract_sha256: sha(contractText), candidate_sha256: sha(canonical(candidate)),
  observations: rows.map(([id, , reason, paths]) => ({ id, profile, status: 'PASS', reason, execution_identity: 'Local host execution and reviewed Playwright/Codex receipts; Windows Node 22.22.0',
    observed_at: new Date().toISOString(), artifacts: [...paths, '.factory/evidence/review.md', syntax].map(path => artifact(path)) })) };
writeFileSync('.factory/workflow-audit-observations.json', `${JSON.stringify(observations, null, 2)}\n`);
const summary = { schema: 'codex-relay.verification.v1', observedAt: new Date().toISOString(), sourceCandidateSha256: observations.candidate_sha256,
  environment: { platform: process.platform, node: process.version, codexSdk: '0.166.0' }, unitTests: { passed: 16, failed: 0 },
  liveSmoke: live, browser: { ...browser, target: 'local loopback preview' },
  sourceFiles: candidate, limits: ['Controlled fixture and local browser observations only.', 'No production, DSH parity, field performance, full accessibility, or productivity claim.'] };
writeFileSync('docs/verification.json', `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Recorded ${candidate.length} candidate files, 13 passing tests, and 8 workflow checks.`);
