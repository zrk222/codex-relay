---
name: codex-relay
description: Open and use Codex Relay's live visual task workspace inside this Codex desktop app. Use when the user asks to open Relay or manage its coding tasks visually.
---

# Open Codex Relay inside Codex

The user should interact with task controls in the Codex app panel, without shell commands or an external browser.

1. Locate this repository's `src/relay/cli.mjs`. If `local-install.json` exists beside this SKILL.md, read its repositoryRoot as the local checkout location. Otherwise use the current attached Codex Relay checkout, or prepare a local checkout of https://github.com/zrk222/codex-relay under the task's work directory and install its locked dependencies. Check that the entry file exists; never substitute the public sample site for the live workspace.
2. Start `node src/relay/cli.mjs gui` from the repository using exec_command with plain pipes. This local process must remain running. Read the first JSON output containing `panelUrl`. If the process is still running, retain its session ID. Do not print the capability URL or token into the chat, publish it, or write it into source.
3. Call the Codex app `open_in_codex` tool with target `{type:"browser",url:panelUrl}` and placement `right`. This opens the live interface inside the current Codex desktop chat. Use the app's browser tooling to verify the displayed page. Do not launch an external browser or claim native plugin/sidebar registration.
4. The UI supports New task, Run with Codex, Stop run, Send & continue, Review changes, Recover stopped run, and Mark reviewed & done. Its data is private local state. Code runs in separate saved Codex threads and Git worktrees; it does not become the current chat's own execution context. Preserve repository instructions and permissions.
5. Report the visible result briefly. Routine use is through the open panel. The public GitHub Pages site is sample data and never controls local coding tasks.

If the panel service has stopped, start it again and open the new capability URL. Tasks persist in `~/.codex-relay`; never delete them to repair a panel error. A local worktree is not an OS security sandbox. Publishing, pushing and merging remain outside the panel's task runner.
