const $ = s => document.querySelector(s);
const token = globalThis.relayNative ? '' : location.hash.slice(1) || sessionStorage.getItem('relay-panel-token') || '';
if (token) sessionStorage.setItem('relay-panel-token', token);
if (!globalThis.relayNative) history.replaceState(null, '', location.pathname);
let tasks = [], selected, filter = 'all', busy = false;
const labels = { queued: 'Queued', working: 'Codex is working', needs_answer: 'Needs your answer', needs_review: 'Ready for your review', failed: 'Run failed', interrupted: 'Interrupted', done: 'Completed' };
function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
function notice(text, error = false) { $('#notice').textContent = text; $('#notice').className = error ? 'error' : ''; }
async function api(path, method = 'GET', data) {
  if (globalThis.relayNative) return globalThis.relayNative.request(path, method, data);
  const response = await fetch(path, { method, headers: { 'x-relay-token': token, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const value = await response.json(); if (!response.ok) throw new Error(value.error ?? 'Request failed'); return value;
}
function button(text, action, primary = false) {
  const b = el('button', text, primary ? 'primary' : ''); b.type = 'button';
  b.onclick = async () => { b.disabled = true; try { await action(); } catch (e) { notice(e.message, true); } finally { b.disabled = false; } }; return b;
}
async function act(task, action, data = {}) { await api(`/api/tasks/${task.id}/${action}`, 'POST', data); notice(action === 'stop' ? 'Stopping this Codex turn…' : action === 'done' ? 'Task marked complete. Changes remain in its worktree.' : 'Task updated.'); await refresh(true); }
function renderDetail(task) {
  const pane = $('#detail'); pane.replaceChildren();
  if (!task) { const empty = el('div', undefined, 'empty'); empty.append(el('h2', 'Give your next task a home.'), el('p', 'Create a task to see its progress, questions, checks, and changes here.')); pane.append(empty); return; }
  pane.append(el('span', labels[task.status] ?? task.status, 'state'), el('h2', task.title), el('p', task.summary), el('p', task.directory, 'path'));
  if (task.question) { const q = el('div', undefined, 'question'); q.append(el('strong', 'Your decision'), el('p', task.question)); pane.append(q); }
  const actions = el('div', undefined, 'actions');
  if (task.status === 'working') actions.append(button('Stop run', () => act(task, 'stop')));
  else if (task.status !== 'done') actions.append(button(task.threadId ? 'Continue with Codex' : 'Run with Codex', () => act(task, 'run'), true));
  if (task.status === 'needs_review') actions.append(button('Mark reviewed & done', () => act(task, 'done')));
  if (['failed', 'interrupted'].includes(task.status)) actions.append(button('Recover stopped run', () => act(task, 'recover')));
  actions.append(button('Review changes', async () => { const value = await api(`/api/tasks/${task.id}/diff`); $('#diff').textContent = `${value.status || 'No pending changes.'}\n${value.diff}\n${value.note}`; $('#changes').open = true; })); pane.append(actions);
  if (!['working', 'done'].includes(task.status)) {
    const form = el('form'); const label = el('label', 'Answer or follow-up'); const input = el('textarea'); input.name = 'reply'; input.rows = 3; input.required = true; input.maxLength = 16000; label.append(input);
    const submit = el('button', 'Send & continue', 'primary'); submit.type = 'submit'; form.append(label, submit);
    form.onsubmit = async e => { e.preventDefault(); submit.disabled = true; try { await act(task, 'run', { reply: input.value }); } catch (error) { notice(error.message, true); submit.disabled = false; } }; pane.append(form);
  }
  pane.append(el('h3', 'Agent-reported checks')); const checks = el('ul', undefined, 'checks'); for (const check of task.checks ?? []) checks.append(el('li', check)); if (!checks.childNodes.length) checks.append(el('li', 'No checks recorded yet.')); pane.append(checks, el('p', 'Inspect the actual changes and test outputs before marking the task complete.', 'muted'));
  const changes = el('details'); changes.id = 'changes'; changes.append(el('summary', 'Worktree changes')); const pre = el('pre', 'Choose Review changes to load the actual Git diff.'); pre.id = 'diff'; changes.append(pre); pane.append(changes);
}
function render(force = false) {
  const visible = tasks.filter(t => filter === 'all' || (filter === 'working' ? ['working', 'queued'].includes(t.status) : ['needs_answer', 'needs_review', 'failed', 'interrupted'].includes(t.status)));
  if (!selected || !tasks.some(t => t.id === selected)) selected = visible[0]?.id;
  $('#tasks').replaceChildren(...visible.map(task => { const b = el('button', undefined, 'task'); b.setAttribute('aria-pressed', String(task.id === selected)); b.append(el('span', labels[task.status], 'state'), el('strong', task.title)); b.onclick = () => { selected = task.id; render(true); }; return b; }));
  if (!visible.length) $('#tasks').append(el('p', tasks.length ? 'No tasks match this filter.' : 'Your inbox is ready for its first task.', 'muted'));
  document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  if (force || !$('#detail').contains(document.activeElement)) renderDetail(tasks.find(t => t.id === selected));
}
async function refresh(force = false) { if (busy) return; busy = true; try { const data = await api('/api/tasks'); const changed = JSON.stringify(data.tasks) !== JSON.stringify(tasks); tasks = data.tasks; if (changed || force) render(force); } catch (error) { notice(error.message, true); } finally { busy = false; } }
$('#new-task').onclick = () => { $('#create-form').hidden = !$('#create-form').hidden; if (!$('#create-form').hidden) $('#repo').focus(); };
$('#create-form').onsubmit = async event => { event.preventDefault(); const form = event.currentTarget, b = form.querySelector('button'); b.disabled = true; try { const task = await api('/api/tasks', 'POST', Object.fromEntries(new FormData(form))); selected = task.id; form.reset(); form.hidden = true; filter = 'all'; notice('Task created in its own worktree. Choose Run with Codex when you are ready.'); await refresh(true); } catch (error) { notice(error.message, true); } finally { b.disabled = false; } };
document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filter = b.dataset.filter; render(); });
await refresh(true); setInterval(() => refresh(), 1500);
