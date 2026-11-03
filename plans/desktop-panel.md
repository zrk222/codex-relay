# Plan: desktop-panel
Spec: specs/desktop-panel.md
Architect verdict: PASS
## Tasks
- [ ] T1 | slice=src/relay | files=src/relay/panel.mjs,src/relay/cli.mjs,tests/panel.test.mjs | verify=`node --test tests/panel.test.mjs` | Add the authenticated local visual control service using the existing runner.
- [ ] T2 | slice=docs | files=docs/panel.html,docs/panel.js,docs/panel.css | verify=`npm run check` | Render task creation, run, answer, cancellation and Git review controls.
- [ ] T3 | slice=scripts | files=scripts/panel-browser.mjs | verify=`node --check scripts/panel-browser.mjs` | Exercise visual controls against a controlled local backend and real Codex where declared.
- [ ] T4 | slice=skills/codex-relay | files=skills/codex-relay/SKILL.md | verify=`npm run check` | Provide a launcher that opens the live panel inside Codex.
- [ ] T5 | slice=README.md | files=README.md | verify=`npm run check` | Explain visual use and the embedded browser boundary.
- [ ] T6 | slice=package.json | files=package.json | verify=`npm test` | Release version 0.2.0.
- [ ] T7 | slice=package-lock.json | files=package-lock.json | verify=`npm run check` | Keep the dependency lock synchronized.
