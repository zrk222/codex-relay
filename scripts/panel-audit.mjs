import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(Array.isArray(value) ? value.map(v => JSON.parse(canonical(v))) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(canonical(value[k]))])) : value);
mkdirSync('.factory/panel', { recursive: true });
const log = execFileSync(process.execPath, ['--test', ...readdirSync('tests').filter(n => n.endsWith('.test.mjs')).map(n => `tests/${n}`)], { encoding: 'utf8' });
if (!/# pass 16\b/.test(log) || !/# fail 0\b/.test(log)) throw new Error('Test evidence is incomplete');
writeFileSync('.factory/panel/tests.log', `Command: node --test tests/*.test.mjs\n${new Date().toISOString()} ${process.platform} ${process.version}\n${log}`);
const live = JSON.parse(readFileSync('artifacts/panel/live-receipt.json'));
const browser = JSON.parse(readFileSync('artifacts/panel/fixture-receipt.json'));
if (!live.liveCodex || !live.persistedCompletion || !live.resumedThread || browser.views.some(v => v.overflow || v.axeViolations)) throw new Error('Live or browser verification incomplete');
function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${path}/${e.name}`) : [`${path}/${e.name}`]); }
const paths = ['AGENTS.md', 'README.md', '.gitignore', 'package.json', 'package-lock.json', ...['src', 'docs', 'scripts', 'tests', 'specs', 'plans', 'skills/codex-relay'].flatMap(walk)].filter(p => p !== 'docs/panel-verification.json').sort();
const artifact = (path, kind = 'evidence') => ({ path, sha256: sha(readFileSync(path)), kind });
const candidate = paths.map(p => artifact(p, 'source'));
const categories = ['happy_path', 'validation', 'failure_recovery', 'state_consistency', 'security_privacy', 'performance', 'accessibility', 'external_effects'];
const checks = [
  'Visual create/run/answer/resume/diff/completion succeeds against a real local Codex fixture.',
  'Invalid task identifiers, missing tokens and external Origin requests are rejected.',
  'A Stop action aborts its active runner and exclusive runs are enforced.',
  'Thread context, task state and authentication survive the declared reload lifecycle.',
  'A secret capability and local Host/Origin protect all data and mutation endpoints.',
  'Local panel interactions complete within browser test timeouts and updates poll every 1500 milliseconds; no field performance claim.',
  'The controls have zero automated axe violations and no horizontal overflow at three sizes.',
  'Read-only Codex fixture preserves source; completion performs no Git push, merge or deployment.'
];
const contract = { schema: 'factory.workflow-audit.contract.v1', project_id: 'codex-relay-desktop-panel', candidate,
  applicability: categories.map((category, i) => ({ category, applicable: true, reason: checks[i] })), checks: categories.map((category, i) => ({ id: `panel-${category}`, requirement: checks[i], category, profiles: ['windows-node22-local-codex-edge'] })) };
const text = JSON.stringify(contract, null, 2); writeFileSync('.factory/panel/contract.json', text);
const observations = { schema: 'factory.workflow-audit.observations.v1', contract_sha256: sha(text), candidate_sha256: sha(canonical(candidate)), observations: categories.map((category, i) => ({
  id: `panel-${category}`, profile: 'windows-node22-local-codex-edge', status: 'PASS', reason: checks[i], execution_identity: 'Local Node tests and controlled Playwright/Codex runs', observed_at: new Date().toISOString(),
  artifacts: ['.factory/panel/tests.log', 'artifacts/panel/live-receipt.json', 'artifacts/panel/fixture-receipt.json', '.prestige/panel-critique.json', '.prestige/panel-challenge.json', ...browser.views.map(v => `artifacts/panel/panel-${v.width}.png`)].map(p => artifact(p)) })) };
writeFileSync('.factory/panel/observations.json', JSON.stringify(observations, null, 2));
writeFileSync('docs/panel-verification.json', JSON.stringify({ observedAt: new Date().toISOString(), version: '0.2.0', unitTests: 16, live, browser, candidateSha256: observations.candidate_sha256,
  limits: ['In-app panel open receipt exists. Host UI automation is disabled; no automated click inside the Codex host is claimed.', 'UI lifecycle uses a controlled read-only fixture. No full accessibility or production claims.'] }, null, 2));
console.log('Current candidate bound to 16 passing tests and 8 panel workflow checks.');
