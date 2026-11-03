import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createStore } from '../src/relay/store.mjs';
export function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'codex-relay-test-'));
  const repo = join(root, 'repo'); mkdirSync(repo);
  const git = args => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git(['init', '--initial-branch=main']);
  git(['config', 'user.email', 'fixture@example.invalid']); git(['config', 'user.name', 'Relay Test']); git(['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(repo, 'README.md'), '# Temporary test repository\n'); git(['add', '.']); git(['commit', '-m', 'Fixture']);
  const store = createStore(join(root, 'state'));
  const create = () => store.create({ repo, title: 'Fix validation', prompt: 'Add a validation check.' });
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return { root, repo, store, create, git };
}
