import { execFileSync } from 'node:child_process';
import { runTask } from './runner.mjs';

/** Shared process owner for browser and MCP transports; never owns approval. */
export function createController({ store, runner = runTask }) {
  const active = new Map();
  return {
    list() { return { tasks: store.list().map(task => active.has(task.id) ? { ...task, status: 'working' }
      : task.status === 'working' ? { ...task, status: 'interrupted', summary: 'The service no longer owns this run. Inspect the worktree, then recover only after its process has stopped.' } : task) }; },
    create(input) { return store.create(input); },
    run(id, reply) {
      if (reply !== undefined && (typeof reply !== 'string' || reply.length > 16000)) throw new Error('Invalid answer');
      if (active.has(id)) throw new Error('Task is already running');
      const task = store.read(id);
      if (task.status === 'done') throw new Error('Completed tasks cannot run again');
      const controller = new AbortController(); active.set(id, controller);
      Promise.resolve().then(() => runner(store, id, { reply, signal: controller.signal })).catch(() => {}).finally(() => active.delete(id));
      return { ...task, status: 'working' };
    },
    stop(id) { store.read(id); const controller = active.get(id); if (!controller) throw new Error('No active run to stop'); controller.abort(); return { stopping: true }; },
    recover(id) { if (active.has(id)) throw new Error('Stop the active run before changing its state'); return store.recover(id); },
    done(id) {
      if (active.has(id)) throw new Error('Stop the active run before changing its state');
      const release = store.lock(id);
      try { const task = store.read(id); if (task.status !== 'needs_review') throw new Error('Review the task before marking it done'); return store.save({ ...task, status: 'done' }); }
      finally { release(); }
    },
    diff(id) {
      const task = store.read(id);
      const git = args => execFileSync('git', ['-C', task.directory, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
      return { status: git(['status', '--short']), diff: git(['diff', 'HEAD', '--']), directory: task.directory,
        note: 'Tracked changes versus HEAD. Untracked files are listed in status; their contents are not included.' };
    },
    close() { for (const controller of active.values()) controller.abort(); }
  };
}
