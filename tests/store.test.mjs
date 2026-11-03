import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createStore } from '../src/relay/store.mjs';
import { fixture } from './helpers.mjs';

test('R1 creates a durable queued task in a distinct Git worktree', t => {
  const { store, create, git, repo } = fixture(t); const task = create();
  assert.equal(task.status, 'queued'); assert.notEqual(task.directory, repo);
  assert.match(git(['worktree', 'list', '--porcelain']), new RegExp(task.id));
  const reopened = createStore(store.root); assert.equal(reopened.read(task.id).title, 'Fix validation'); assert.equal(reopened.list().length, 1);
});
test('R6 rejects invalid identifiers before access', t => {
  const { store } = fixture(t); for (const id of ['../secret', '', 'sample-01', 'C:\\secret']) assert.throws(() => store.read(id), /Invalid task id/);
});
test('source changes are preserved and a dirty repository is refused', t => {
  const { create, repo } = fixture(t); writeFileSync(join(repo, 'README.md'), 'Uncommitted user work');
  assert.throws(create, /must be clean/); assert.equal(readFileSync(join(repo, 'README.md'), 'utf8'), 'Uncommitted user work');
});
test('R6 forged worktree paths cannot escape state', t => {
  const { store, create, root } = fixture(t); const task = create(); task.directory = root;
  writeFileSync(join(store.root, 'tasks', `${task.id}.json`), JSON.stringify(task)); assert.throws(() => store.read(task.id), /escapes/);
});
test('exclusive locks reject another runner and recovery refuses a live owner', t => {
  const { store, create } = fixture(t); const task = create(); const release = store.lock(task.id);
  assert.throws(() => store.lock(task.id), /active lock/); assert.throws(() => store.recover(task.id), /still running/); release();
  const releaseAgain = store.lock(task.id); releaseAgain();
});
