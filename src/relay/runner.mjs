import { Codex } from '@openai/codex-sdk';

export const RESULT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['needs_answer', 'needs_review'] },
    summary: { type: 'string' }, question: { type: 'string' },
    checks: { type: 'array', items: { type: 'string' } }
  }, required: ['status', 'summary', 'question', 'checks']
};
function parseResult(text) {
  const value = JSON.parse(text);
  if (!['needs_answer', 'needs_review'].includes(value.status) || typeof value.summary !== 'string' || typeof value.question !== 'string'
    || !Array.isArray(value.checks) || value.checks.some(check => typeof check !== 'string')) throw new Error('Codex returned an invalid structured result');
  if (value.status === 'needs_answer' && !value.question.trim()) throw new Error('A task needing an answer must include a question');
  return value;
}
function taskPrompt(task, reply) {
  return `You are executing one local Codex Relay task in its isolated worktree.\n`
    + `Follow the repository AGENTS.md and its required checks. Preserve unrelated work. Do not push, publish, merge, send external messages, or widen permissions.\n`
    + `Inspect the existing worktree and history before repeating changes after a resume. If a product decision or unavailable capability blocks progress, return needs_answer with one concrete question.\n`
    + `Return needs_review only when the change and relevant checks are ready for a human to inspect. List exact commands and results in checks; unrun checks must say unrun. Never equate needs_review with approval or deployment.\n`
    + `Task: ${task.title}\n${task.prompt}\n${reply ? `Developer follow-up: ${reply}` : ''}`;
}
function threadOptions(task, options) {
  return { workingDirectory: task.directory, sandboxMode: 'workspace-write', approvalPolicy: 'never',
    networkAccessEnabled: false, webSearchMode: 'disabled', modelReasoningEffort: 'low', threadSource: 'codex-relay',
    ...(options.model ? { model: options.model } : {}) };
}
async function execute(store, id, options) {
  const release = store.lock(id);
  let task;
  try {
    task = store.read(id);
    if (task.status === 'done') throw new Error('Completed tasks cannot run again; create a new task');
    const client = options.client ?? new Codex(options.codexPath ? { codexPathOverride: options.codexPath } : {});
    const config = threadOptions(task, options);
    const thread = task.threadId ? client.resumeThread(task.threadId, config) : client.startThread(config);
    task = store.save({ ...task, status: 'working', summary: 'Codex is working in the isolated worktree.', question: '' });
    const { events } = await thread.runStreamed(taskPrompt(task, options.reply), { outputSchema: RESULT_SCHEMA, signal: options.signal });
    let finalResponse = '', completed = false;
    for await (const event of events) {
      if (event.type === 'thread.started') task = store.save({ ...task, threadId: event.thread_id });
      if (event.type === 'item.completed' && event.item.type === 'agent_message') finalResponse = event.item.text;
      if (event.type === 'turn.failed' || event.type === 'error') throw new Error(event.error?.message ?? event.message ?? 'Codex turn failed');
      if (event.type === 'turn.completed') { completed = true; task = { ...task, usage: event.usage }; }
      options.onEvent?.({ type: event.type, taskId: id });
    }
    if (!completed) throw new Error('Codex ended without a completed turn');
    const result = parseResult(finalResponse);
    task = store.save({ ...task, ...result, threadId: thread.id ?? task.threadId,
      history: [...task.history, { at: new Date().toISOString(), status: result.status, checks: result.checks }] });
    return task;
  } catch (error) {
    if (task && task.status !== 'done') store.save({ ...task, status: options.signal?.aborted ? 'interrupted' : 'failed', summary: error.message });
    throw error;
  } finally { release(); }
}

/** Run or resume a single exclusive Codex task. */
export function runTask(store, id, options) { return execute(store, id, options ?? {}); }
