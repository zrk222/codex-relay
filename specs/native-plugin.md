# Spec: native-plugin
Status: approved
## MUST - Functional core
### Description
Relay is installed as a local Codex plugin with a host-rendered MCP App. Its existing task/worktree engine remains the executor. Host rendering is a separate acceptance boundary from protocol and installation tests.
### User roles
- Developer
### Requirements
- When the developer opens Relay, the system shall serve `ui://codex-relay/workspace-v0.3.0.html` through MCP with global and thread entrypoints, expose task creation, run, answer, stop, diff, recovery and reviewed completion through validated tools, and bundle the visual controls without a localhost server or external asset requests; a release shall distinguish protocol tests, plugin installation and observed host rendering.
### Acceptance criteria
```gherkin
Scenario: Native resource and task lifecycle
  Given the plugin registers `ui://codex-relay/workspace-v0.3.0.html`
  When an MCP client opens Relay and creates, runs and reviews a task
  Then the actual persisted task state and Git diff are returned through MCP
Scenario: Invalid state and input
  Given an invalid task identifier or an active runner
  When the client requests an invalid transition
  Then the tool returns an error and preserves the task state
```
## SHOULD - Technical/structural
- Git diff subprocess parameter `timeout` is 10000 milliseconds and `maxBuffer` is 2097152 bytes; oversized output or a timeout returns a tool error.
- Reuse the runner, store and visual controls. Keep local stdio transport, exclusive locks, persistent state and no automatic publication.
- Package a self-contained MCP server and UI; require an installed Codex binary for execution. Test the bridge in a controlled host and separately record installed host evidence.
## SHOULD NOT - Scope
- No modification of Codex binaries, fabricated native screenshots, or claim that a browser panel proves native host rendering.

## Authorized parameters
- timeout = 10000
- maxBuffer = 2097152
