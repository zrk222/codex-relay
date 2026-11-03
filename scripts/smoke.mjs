import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createStore } from '../src/relay/store.mjs';
import { runTask } from '../src/relay/runner.mjs';

const parent = resolve('artifacts'); mkdirSync(parent, { recursive: true });
const root = mkdtempSync(join(parent, 'live-smoke-')); const repo = join(root, 'repo'); mkdirSync(repo);
const git = args => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe', encoding: 'utf8' });
git(['init', '--initial-branch=main']); git(['config', 'user.name', 'Relay Smoke']); git(['config', 'user.email', 'smoke@example.invalid']); git(['config', 'commit.gpgsign', 'false']);
writeFileSync(join(repo, 'greet.mjs'), 'export const greet = () => "Hello";\n');
writeFileSync(join(repo, 'greet.test.mjs'), 'import test from "node:test"; import assert from "node:assert/strict"; import {greet} from "./greet.mjs"; test("greeting",()=>assert.equal(greet(),"Hello, Relay!"));\n');
git(['add', '.']); git(['commit', '-m', 'Controlled coding smoke fixture']);
// A host can validate tools that are intentionally unavailable inside the worker sandbox.
// The gate is executed here, never invented or waived by the coding agent.
try {
  const doctor = JSON.parse(execFileSync('factory', ['doctor', '--strict', '--json'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  assert.equal(doctor.ok, true);
  mkdirSync(join(repo, '.factory'), { recursive: true });
  writeFileSync(join(repo, '.factory', 'host-doctor.json'), JSON.stringify(doctor, null, 2));
  writeFileSync(join(repo, 'HOST_VERIFICATION.md'), '# Controlled smoke scope\n\nThe host ran factory doctor --strict --json in this repository before any agent edit. The actual passing receipt is .factory/host-doctor.json. This is the same Code Factory-gated Codex Relay verification workflow, not a bypass. The host owns the post-turn test and hash-bound workflow audit. The worker may use the supplied passing preflight; tools under the operator home are deliberately unavailable inside workspace-write. Only greet.mjs may change. Do not run an alternative gate or weaken these requirements.\n');
  git(['add', '.']); git(['commit', '-m', 'Record host preflight for the controlled smoke']);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const store = createStore(join(root, 'state'));
const task = store.create({ repo, title: 'Complete the greeting', prompt: 'Read HOST_VERIFICATION.md if present: the host has already executed the required Code Factory preflight at this repository root and owns the post-turn audit. In this temporary repository, update only greet.mjs so greet() returns exactly Hello, Relay! Run node --test greet.test.mjs. Do not commit or access external services. Return needs_review with the exact test command and its result.' });
const options = { signal: AbortSignal.timeout(120000), onEvent: event => { if (['thread.started', 'turn.completed', 'turn.failed'].includes(event.type)) console.log(event.type); } };
const first = await runTask(store, task.id, options);
assert.equal(first.status, 'needs_review'); assert.ok(first.threadId);
execFileSync(process.execPath, ['--test', 'greet.test.mjs'], { cwd: first.directory, stdio: 'inherit' });
assert.equal(readFileSync(join(repo, 'greet.mjs'), 'utf8'), 'export const greet = () => "Hello";\n');
const second = await runTask(store, task.id, { ...options, signal: AbortSignal.timeout(120000), reply: 'Confirm the existing greeting test still passes. Make no further file changes. Return needs_review with the exact command and observed result.' });
assert.equal(second.threadId, first.threadId); assert.equal(second.status, 'needs_review');
const receipt = { schema: 'codex-relay.smoke.v1', observedAt: new Date().toISOString(), providerCalls: 2, isolatedWorktree: true, originalFilePreserved: true,
  actualTestCommand: 'node --test greet.test.mjs', actualTestPassed: true, resumedSameThread: true, finalStatus: second.status, environment: { platform: process.platform, node: process.version },
  scope: 'One temporary greeting fixture and a resume turn; not production or DSH parity evidence.' };
writeFileSync(join(parent, 'live-smoke.json'), `${JSON.stringify(receipt, null, 2)}\n`); console.log(JSON.stringify(receipt, null, 2));
