const $ = selector => document.querySelector(selector);
const labels = { queued: 'Queued', working: 'Working', needs_answer: 'Needs answer', needs_review: 'Needs review', failed: 'Failed', interrupted: 'Interrupted', done: 'Done' };
let data, selected, filter = 'attention', storyStep = -1;
const story = [
  ['queued', 'Start with one task.', 'Fix the settings form validation. The example task is now queued.'],
  ['working', 'Give the task its own space.', 'The sample task moves into its own Git worktree. No agent is running.'],
  ['needs_answer', 'Keep the decision with you.', 'Should empty names be allowed? This example pauses for your choice.'],
  ['needs_review', 'Make the result inspectable.', 'The sample validation change is ready for review, with illustrative checks.'],
  ['done', 'A clear end to this example.', 'Sample task complete. No local files were changed and no agent was run.']
];
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function attention(task) { return ['needs_answer', 'needs_review', 'failed', 'interrupted'].includes(task.status); }
function visibleTasks() { if (filter === 'attention') return data.tasks.filter(attention); if (filter === 'working') return data.tasks.filter(task => ['working', 'queued'].includes(task.status)); return data.tasks; }
function status(task) { return element('span', `status ${task.status}`, labels[task.status] ?? 'Unknown'); }
function card(task) {
  const button = element('button', 'task-card'); button.type = 'button'; button.setAttribute('aria-pressed', String(task.id === selected));
  button.append(status(task), element('h3', '', task.title));
  const bottom = element('div', 'task-card-bottom'); bottom.append(element('span', '', data.mode === 'sample' ? task.repo : task.repo.split(/[\\/]/).pop()), element('span', 'arrow', '↗')); button.append(bottom);
  button.addEventListener('click', () => { selected = task.id; render(); }); return button;
}
function nextAction(task) {
  const actions = { needs_answer: task.question, needs_review: 'Inspect the worktree diff and recorded checks. You decide when this task is done.', working: 'Let the local turn continue. Its saved thread keeps the task together.', queued: 'Run this task locally when you are ready.', failed: 'Read the failure, inspect the worktree, then retry the saved thread.', interrupted: 'Inspect the worktree before resuming the saved thread.', done: 'This task is marked done. Create a new task for the next piece of work.' };
  return actions[task.status] ?? 'Inspect this task before continuing.';
}
function detail(task) {
  const pane = $('#task-detail'); pane.replaceChildren();
  if (!task) { pane.append(element('p', 'empty', 'No tasks match this filter. Choose All to see the rest of the inbox.')); return; }
  const top = element('div', 'detail-top'); top.append(status(task), element('span', 'task-ref', data.mode === 'sample' ? 'SAMPLE / 01' : task.id.slice(0, 8))); pane.append(top, element('h2', '', task.title), element('p', 'task-summary', task.summary));
  const meta = element('div', 'detail-meta'); meta.append(element('span', '', task.branch), element('span', '', task.threadId ? 'Thread saved' : 'Thread not started')); pane.append(meta);
  const action = element('div', `action-box ${task.status}`); action.append(element('div', 'action-label', task.status === 'needs_answer' ? 'YOUR DECISION' : 'NEXT ACTION'), element('p', '', nextAction(task))); pane.append(action);
  const checks = element('section', 'detail-section'); checks.append(element('h3', '', data.mode === 'sample' ? 'ILLUSTRATIVE CHECKS' : 'AGENT-REPORTED CHECKS'));
  const list = element('ul', 'checks'); for (const check of task.checks ?? []) list.append(element('li', '', check));
  if (!list.childNodes.length) list.append(element('li', '', 'No checks recorded yet.')); checks.append(list); pane.append(checks);
  if (data.mode === 'sample') pane.append(element('p', 'sample-warning', 'Sample data only. These checks demonstrate the interface; they are not test receipts.'));
  else { pane.append(element('p', 'sample-warning', 'Reported by the coding agent. Inspect actual outputs before approval.')); pane.append(element('code', 'detail-command', `codex-relay ${task.status === 'needs_review' ? 'show' : 'run'} ${task.id}`)); }
}
function render() {
  const tasks = visibleTasks(); if (!tasks.some(task => task.id === selected)) selected = tasks[0]?.id;
  $('#task-list').replaceChildren(...tasks.map(card)); if (!tasks.length) $('#task-list').append(element('p', 'empty', 'Nothing here needs you right now.'));
  $('#task-count').textContent = `${data.tasks.length} tasks`; $('#attention-count').textContent = data.tasks.filter(attention).length;
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
  detail(data.tasks.find(task => task.id === selected));
}
function advanceStory() {
  storyStep = (storyStep + 1) % story.length;
  const [state, title, caption] = story[storyStep]; const task = data.tasks[0];
  task.status = state; task.summary = caption; task.question = state === 'needs_answer' ? 'Should empty names be allowed?' : '';
  task.checks = ['needs_review', 'done'].includes(state) ? ['Illustrative check: required-name validation', 'Illustrative check: saved value preserved'] : [];
  filter = 'all'; selected = task.id; $('#story-caption').textContent = `${storyStep + 1}/5 · ${title} ${caption}`;
  $('#story-next').textContent = storyStep === 4 ? 'Replay the sample →' : 'Next step →'; render();
}
async function load() {
  const local = new URLSearchParams(location.search).get('mode') === 'local';
  const response = await fetch(local ? './api/tasks' : './sample.json', { cache: 'no-store' }); if (!response.ok) throw new Error('Unable to load inbox');
  data = await response.json(); if (!Array.isArray(data.tasks)) throw new Error('Invalid inbox data');
  if (local) { $('#mode-badge').textContent = 'LOCAL · READ ONLY'; $('#mode-description').textContent = 'Your local tasks · refresh to update · coding runs through the CLI'; $('#story-bar').hidden = true; $('#footer-state').textContent = 'Local state on this machine'; }
  selected = data.tasks[0]?.id; render();
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; render(); }));
$('#story-next').addEventListener('click', advanceStory);
load().catch(() => { $('#task-detail').replaceChildren(element('p', 'empty', 'The inbox could not load. Refresh to try again. Local tasks remain on disk.')); });
