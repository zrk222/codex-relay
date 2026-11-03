---
name: relay
description: Open the native Codex Relay workspace to create, run, answer and review isolated coding tasks.
---
Call this plugin's relay_open tool to render the MCP App workspace. Do not launch a localhost browser or present shell commands as the native workflow. The plugin declares global and thread entrypoints. If the host does not render the app, report that host capability/reload boundary and link the native entrypoint: codex://plugins/codex-relay@relay-local/app/relay_open . Never claim a browser fallback is native. Runs use the installed Codex executable and existing local authentication. Review completion does not authorize merging or publishing.
