# Relay inside Codex

Open [Codex Relay](codex://plugins/codex-relay@relay-local/app/relay_open) after installing it. Choose **New task**, enter a clean Git repository folder and request, and select **Run with Codex**. If Codex asks a question, answer with **Send & continue**. Inspect **Review changes** and the reported checks before choosing **Mark reviewed & done**. Work remains in the task's isolated worktree for you to integrate.

## Installation

The repository includes a local marketplace and plugin. Build and install once:

```sh
npm ci
npm run build:native
codex plugin marketplace add .
codex plugin add codex-relay@relay-local
```

The release ZIP also contains the already-bundled plugin and marketplace. Extract it, add that folder as the marketplace, and install the same plugin. No npm install is needed to run the prebuilt plugin. Node.js 22.19+, Git and a native Codex executable must be available on PATH. A `.cmd` wrapper alone is insufficient on Windows; set `CODEX_RELAY_CODEX_PATH` to the absolute `codex.exe` path if needed. Execution uses existing local Codex authentication and account usage. Restart Codex if the plugin list has not refreshed.

The host loads the plugin's stdio MCP server. `relay_open` registers `ui://codex-relay/workspace-v0.3.0.html` with global and thread entrypoints. The bundled iframe communicates through the MCP App SDK's host bridge. It does not fetch localhost task endpoints, download scripts, or hold an API key. Native here means a host-integrated MCP App panel; the UI is HTML in the host's app sandbox. Codex binaries are unchanged.

State defaults to `~/.codex-relay`, shared with the CLI. `CODEX_RELAY_HOME` overrides it; `CODEX_RELAY_STATE` is a higher-priority explicit override used by isolated verification. Only one service should run a particular task. Exclusive task locks preserve cross-process ownership. A closed/restarted host interrupts its service-owned turns; inspect and recover before continuing.

## Evidence boundary

On November 3, 2026, the plugin CLI reported `codex-relay@relay-local` version 0.3.0 installed and enabled. After a launch-path correction and reopening its native deep link, the user confirmed that **New task** opened the repository and task form inside Codex. This is user-observed host interaction; it is not an automated recording or a host end-to-end coding test. The compatibility manifest uses a plugin-relative working directory and launch path because this installed host did not expand plugin-root placeholders in MCP arguments.

Protocol tests exercise actual MCP tools and the packaged stdio process using its exact launch manifest from an isolated directory without adjacent `node_modules`. Controlled browser checks use the official MCP App SDK and AppBridge, actual tools, three widths and light/dark themes. An earlier packaged-server check completed two real Codex turns in a read-only fixture. A later repeat reached the account usage limit; it is retained as a failure and is not counted as a current full provider pass. The execution engine is unchanged; the current transport and launch manifest pass separate checks. See [the machine-readable verification record](native-verification.json) for results. Controlled-host screenshots are labelled and never presented as Codex screenshots.

OpenAI's [extension specification](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#global-entrypoint) defines the desktop deep link and global/thread entrypoints. Host availability can vary with installed version and rollout. Metadata alone does not prove rendering on another machine. This release is public on GitHub; official plugin-directory publication is separate.
