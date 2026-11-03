# Plan: native-plugin
Spec: specs/native-plugin.md
Architect verdict: PASS
## Tasks
- [ ] T1 | slice=src/relay | files=src/relay/controller.mjs,src/relay/panel.mjs,src/relay/native-server.mjs,src/relay/native-ui.mjs | verify=`npm test` | Share task control and add stdio MCP and app bridge.
- [ ] T2 | slice=docs | files=docs/panel.js,docs/native.css,docs/NATIVE.md | verify=`npm run check` | Share visual controls with native transport and document the host boundary.
- [ ] T3 | slice=scripts | files=scripts/build-native.mjs,scripts/native-browser.mjs,scripts/native-audit.mjs | verify=`npm run build:native` | Bundle the plugin and verify protocol and visual workflows.
- [ ] T4 | slice=tests | files=tests/native.test.mjs | verify=`npm test` | Exercise actual MCP resource and lifecycle APIs.
- [ ] T5 | slice=plugin | files=plugin/.codex-plugin/plugin.json,plugin/.mcp.json,plugin/skills/relay/SKILL.md | verify=`npm run build:native` | Install a Codex plugin with native entrypoints.
- [ ] T6 | slice=.agents | files=.agents/plugins/marketplace.json | verify=`npm run check` | Provide a marketplace for supported plugin installation.
- [ ] T7 | slice=package.json | files=package.json | verify=`npm run check` | Pin build and protocol dependencies for version 0.3.0.
- [ ] T8 | slice=package-lock.json | files=package-lock.json | verify=`npm run check` | Lock runtime dependencies.
- [ ] T9 | slice=.gitignore | files=.gitignore | verify=`npm run check` | Keep test artifacts private.
- [ ] T10 | slice=README.md | files=README.md | verify=`npm run check` | Describe native installation and fallback accurately.
- [ ] T11 | slice=skills/codex-relay | files=skills/codex-relay/SKILL.md | verify=`npm run check` | Prefer the native plugin when installed.
- [ ] T12 | slice=native-plugin.ssat.yaml | files=native-plugin.ssat.yaml | verify=`forge arch-gate native-plugin native-plugin.ssat.yaml --root .` | Bind the native modules to the Forge architecture gate.
- [ ] T13 | slice=smoke | files=smoke/native-plugin.json,smoke/native-release.json | verify=`forge smoke native-release --root .` | Verify non-hollow native registration and controller smoke contracts in a fresh final-candidate run.
