import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, lstatSync, realpathSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const STATES = ['queued', 'working', 'needs_answer', 'needs_review', 'failed', 'interrupted', 'done'];
const git = (repo, args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function assertId(id) { if (!ID.test(id)) throw new Error('Invalid task id'); }
function safeDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (lstatSync(path).isSymbolicLink()) throw new Error('Symlink state directories are not allowed');
  return realpathSync(path);
}
function boundedText(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid ${name}: use 1-${max} characters`);
  return value.trim();
}
function writeRecord(path, task) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, `${JSON.stringify(task, null, 2)}\n`, { mode: 0o600, flag: 'wx' }); renameSync(temporary, path); }
  finally { if (existsSync(temporary)) rmSync(temporary); }
}

/** Open local task persistence. State is private and never part of the public preview. */
export function createStore(root) {
  const directory = safeDirectory(resolve(root));
  const records = safeDirectory(join(directory, 'tasks'));
  const worktrees = safeDirectory(join(directory, 'worktrees'));
  const locks = safeDirectory(join(directory, 'locks'));
  const file = id => { assertId(id); return join(records, `${id}.json`); };
  function read(id) {
    const path = file(id);
    if (lstatSync(path).isSymbolicLink()) throw new Error('Symlink task records are not allowed');
    const task = JSON.parse(readFileSync(path, 'utf8'));
    if (task.id !== id || !STATES.includes(task.status)) throw new Error('Invalid task record');
    if (resolve(task.directory) !== join(worktrees, id)) throw new Error('Task directory escapes workspace');
    if (realpathSync(task.directory) !== join(worktrees, id)) throw new Error('Task worktree was redirected');
    return task;
  }
  function save(task) {
    file(task.id);
    if (!STATES.includes(task.status) || resolve(task.directory) !== join(worktrees, task.id)) throw new Error('Invalid task record');
    const next = { ...task, updatedAt: new Date().toISOString() };
    writeRecord(file(task.id), next);
    return next;
  }
  function create(input) {
    const title = boundedText(input.title, 'title', 160);
    const prompt = boundedText(input.prompt, 'prompt', 16000);
    const repo = realpathSync(resolve(input.repo));
    if (git(repo, ['rev-parse', '--show-toplevel']).replaceAll('\\', '/') !== repo.replaceAll('\\', '/')) throw new Error('Use the repository root');
    if (git(repo, ['status', '--porcelain'])) throw new Error('Source repository must be clean; commit or preserve existing changes first');
    if (directory === repo || directory.startsWith(`${repo}${sep}`)) throw new Error('State directory must be outside the source repository');
    const id = randomUUID();
    const path = join(worktrees, id);
    const branch = `relay/${id}`;
    git(repo, ['worktree', 'add', '-b', branch, path, 'HEAD']);
    const now = new Date().toISOString();
    return save({ id, title, prompt, repo, directory: path, branch, status: 'queued', createdAt: now, updatedAt: now,
      threadId: null, summary: 'Ready for a local Codex run.', question: '', checks: [], usage: null, history: [] });
  }
  function list() {
    return readdirSync(records).filter(name => name.endsWith('.json')).map(name => read(name.slice(0, -5))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  function lock(id) {
    assertId(id);
    const path = join(locks, id);
    try { mkdirSync(path, { mode: 0o700 }); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('Task already has an active lock; use recover only after its process has stopped'); throw error; }
    writeFileSync(join(path, 'owner.json'), JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }), { mode: 0o600 });
    return () => rmSync(path, { recursive: true });
  }
  function recover(id) {
    const task = read(id);
    const path = join(locks, id);
    if (existsSync(path)) {
      const owner = JSON.parse(readFileSync(join(path, 'owner.json'), 'utf8'));
      try { process.kill(owner.pid, 0); throw new Error('The task process is still running'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
      rmSync(path, { recursive: true });
    }
    return save({ ...task, status: 'interrupted', summary: 'Recovered after the previous process stopped. Inspect the worktree before resuming.' });
  }
  return { root: directory, create, read, save, list, lock, recover };
}
