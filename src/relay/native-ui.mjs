import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'Codex Relay', version: '0.3.0' });
function theme(context) {
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
}
let connected;
globalThis.relayNative = {
  async request(path, method = 'GET', data = {}) {
    await connected;
    let name, args = data;
    if (path === '/api/tasks') name = method === 'POST' ? 'relay_create' : 'relay_list';
    else { const match = /^\/api\/tasks\/([^/]+)\/(run|stop|done|recover|diff)$/.exec(path); if (!match) throw new Error('Unknown Relay action'); name = `relay_${match[2]}`; args = { ...data, id: match[1] }; }
    const result = await app.callServerTool({ name, arguments: args });
    if (result.isError) throw new Error(result.content?.find(c => c.type === 'text')?.text ?? 'Relay action failed');
    return result.structuredContent;
  }
};
app.ontoolresult = () => {};
app.addEventListener('hostcontextchanged', event => theme(event));
try {
  document.querySelector('.badge').textContent = 'CONNECTING';
  document.querySelector('#notice').textContent = 'Connecting to the Codex plugin bridge…';
  let timer;
  connected = Promise.race([app.connect(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The host bridge did not respond. Close this panel and reopen the installed Relay plugin.')), 12000); })]).then(() => {
    clearTimeout(timer); theme(app.getHostContext());
    document.querySelector('.badge').textContent = 'CODEX PLUGIN';
    document.body.dataset.relayTransport = 'mcp';
    document.querySelector('#notice').textContent = '';
    document.querySelector('footer').textContent = 'Connected through the host plugin bridge. Codex runs locally in isolated worktrees. Review never merges or deploys.';
  });
  connected.catch(() => {});
  await import('../../docs/panel.js');
} catch (error) {
  document.querySelector('#notice').textContent = `Relay could not connect to the host plugin bridge: ${error.message}. Reopen Relay from the installed plugin.`;
  document.querySelector('#notice').className = 'error';
}
