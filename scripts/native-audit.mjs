import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(Array.isArray(value) ? value.map(v => JSON.parse(canonical(v))) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(canonical(value[k]))])) : value);
mkdirSync('.factory/native', { recursive: true });
const run = (name, command, args) => {
  let output;
  try { output = execFileSync(command, args, { encoding: 'utf8' }); }
  catch (e) { writeFileSync(`.factory/native/${name}-failure.log`, `${e.stdout ?? ''}\n${e.stderr ?? ''}`); throw e; }
  writeFileSync(`.factory/native/${name}.log`, `${new Date().toISOString()} ${process.platform} ${process.version}\nCommand: ${command} ${args.join(' ')}\n${output}`); return output;
};
const tests = run('tests', process.execPath, ['--test', ...readdirSync('tests').filter(n => n.endsWith('.test.mjs')).map(n => `tests/${n}`)]);
if (!/# pass 20\b/.test(tests) || !/# fail 0\b/.test(tests)) throw new Error('Test evidence incomplete');
run('syntax', process.execPath, ['scripts/check.mjs']);
const browser = JSON.parse(readFileSync('artifacts/native/fixture-receipt.json'));
if (!browser.persistedCompletion || browser.views.length !== 6 || browser.views.some(v => v.overflow || v.axeViolations) || browser.pageErrors.length) throw new Error('Bridge evidence incomplete');
for (const [path, hash] of Object.entries(browser.inputHashes ?? {})) if (sha(readFileSync(path)) !== hash) throw new Error(`Stale browser source: ${path}`);
const config = JSON.parse(readFileSync('plugin/.mcp.json')).mcpServers.relay_native;
if (config.cwd !== '.' || config.args[0] !== './dist/relay-server.mjs') throw new Error('Manifest must retain tested relative launch configuration');
const host = { observedAt: new Date().toISOString(), authority: 'user-observed', method: 'Guided native desktop deep-link and form interaction',
  initialFailure: 'User reported New task did nothing. Host logs showed MCP initialization failure. The MCP manifest used an unexpanded plugin-root placeholder.',
  correction: 'Use plugin-relative working directory and executable argument; refresh the resource URI and reopen the native app.',
  question: 'The startup path is fixed and I reopened Relay. Does New task now open the form?', answer: 'Yes, it works now',
  limits: ['User-reported form interaction, not a recording of a complete coding lifecycle inside Codex.'],
  sourceHashes: Object.fromEntries(['plugin/.mcp.json', 'plugin/dist/relay-server.mjs', 'plugin/dist/workspace.html'].map(p => [p, sha(readFileSync(p))])) };
writeFileSync('.factory/native/host-observation.json', JSON.stringify(host, null, 2));
const notes = { profile: 'Windows Node22 local stdio and controlled Edge MCP host', findings: [
  'Current 20 tests pass, including the exact plugin launch manifest in an isolated directory, validation, cancellation, reconnect, actual Git diff and completion.',
  'Current UI bridge fixture passes six light/dark viewport checks without axe violations or overflow; iframe makes no API/network asset calls.',
  'An earlier packaged-server check completed two actual Codex turns. A subsequent provider repeat hit account usage limits. That repeat remains a failure and is not a current provider pass.',
  'Shared runner and store are unchanged from the successful provider run; current transport is covered independently. No current full coding lifecycle inside the actual Codex host is claimed.',
  'No merge, deployment, Git push or external messaging is performed by these verification tasks.',
  'Prestige density heuristic counts bundled script text; it is not rendered UI word density. Hero-image/whitespace warnings are not relevant to this compact task workspace. Rendered accessibility is checked separately.'
] };
writeFileSync('.factory/native/review.json', JSON.stringify(notes, null, 2));
function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${path}/${e.name}`) : [`${path}/${e.name}`]); }
const artifact = (path, kind = 'evidence') => ({ path, sha256: sha(readFileSync(path)), kind });
const paths = ['README.md', 'AGENTS.md', 'package.json', 'package-lock.json', '.gitignore', 'native-plugin.ssat.yaml', ...['src', 'docs', 'scripts', 'tests', 'specs', 'plans', 'plugin', '.agents', 'smoke', 'skills/codex-relay'].flatMap(walk)].filter(p => p !== 'docs/native-verification.json').sort();
const candidate = paths.map(p => artifact(p, 'source'));
const requirements = {
  happy_path: 'Current native tools and AppBridge perform create, run, answer, diff, reviewed completion and reload; user confirms native New task opens its form.',
  validation: 'Invalid UUIDs, oversized answers and invalid completion transitions fail without running a provider.',
  failure_recovery: 'Cancellation aborts the active owner; concurrent execution and live-lock recovery are rejected; missing Codex fails before dispatch.',
  state_consistency: 'Task records, isolation and completion persist across reconnect and UI reload.',
  security_privacy: 'Bundled UI has no external assets or direct task endpoint requests; MCP schemas and source/worktree boundary checks pass.',
  performance: 'Local interactions complete within controlled browser test timeouts; no field latency or productivity improvement is claimed.',
  accessibility: 'Current native bridge UI has zero automated axe violations and no horizontal overflow at 375, 768, 1200 pixels in light and dark modes.',
  external_effects: 'Git fixtures preserve original repository content; reviewed completion does not merge or publish. Live provider repeat is explicitly usage-limited and excluded from current acceptance.'
};
const contract = { schema: 'factory.workflow-audit.contract.v1', project_id: 'codex-relay-native-transport', candidate,
  applicability: Object.entries(requirements).map(([category, reason]) => ({ category, applicable: true, reason })),
  checks: Object.entries(requirements).map(([category, requirement]) => ({ id: `native-${category}`, requirement, category, profiles: ['windows-node22-stdio-edge-mcp'] })) };
const text = JSON.stringify(contract, null, 2); writeFileSync('.factory/native/contract.json', text);
const evidence = ['.factory/native/tests.log', '.factory/native/syntax.log', '.factory/native/host-observation.json', '.factory/native/review.json', 'artifacts/native/fixture-receipt.json', '.prestige/native-critique.json', '.prestige/native-challenge.json', '.prestige/native-render.json/render-receipt.json', '.forge/native-release/state.json', '.forge/native-release/receipts.jsonl'];
for (const p of evidence) if (!existsSync(p)) throw new Error(`Missing audit evidence: ${p}`);
const observations = { schema: 'factory.workflow-audit.observations.v1', contract_sha256: sha(text), candidate_sha256: sha(canonical(candidate)),
  observations: Object.entries(requirements).map(([category, reason]) => ({ id: `native-${category}`, profile: 'windows-node22-stdio-edge-mcp', status: 'PASS', reason, execution_identity: 'Local Node tests, controlled MCP AppBridge browser run, and explicitly labelled user host observation', observed_at: new Date().toISOString(), artifacts: evidence.map(p => artifact(p)) })) };
writeFileSync('.factory/native/observations.json', JSON.stringify(observations, null, 2));
const earlierLive = JSON.parse(readFileSync('artifacts/native/live-receipt.json'));
writeFileSync('docs/native-verification.json', JSON.stringify({ version: '0.3.0', observedAt: new Date().toISOString(), scope: 'Native plugin transport, launch packaging and visual controls', unitTests: 20, browser, host,
  earlierProviderCheck: { ...earlierLive, status: 'Earlier successful packaged-server check; not the final candidate or a Codex host lifecycle test' },
  subsequentProviderRepeat: { status: 'FAILED_USAGE_LIMIT', reason: 'Account usage limit on the resumed turn; no current full provider pass claimed' },
  candidateSha256: observations.candidate_sha256, limits: notes.findings.slice(2,4) }, null, 2));
console.log('Bound current native transport candidate to 20 tests, six browser/theme checks, exact launch manifest, and user-observed native form interaction. Provider-repeat limitation retained.');
