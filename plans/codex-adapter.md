# Plan: codex-adapter
Spec: specs/codex-adapter.md
Architect verdict: PASS

## Logical decomposition (phases)
1. Persist isolated tasks and enforce exclusive execution.
2. Connect resumable Codex turns with structured results.
3. Expose a local read-only inbox and a public sample narrative.
4. Verify source, runtime behavior, design, and hash-bound evidence before publication.

## Tasks (atomic)
- [x] T1 | slice=src/relay | files=src/relay/store.mjs,tests/store.test.mjs,tests/helpers.mjs | verify=`node --test tests/store.test.mjs` | Persist task records and isolated worktrees with validated identifiers and run locks.
- [x] T2 | slice=src/relay | files=src/relay/runner.mjs,src/relay/cli.mjs,tests/runner.test.mjs | verify=`node --test tests/runner.test.mjs` | Run and resume Codex turns with explicit result states and cancellation handling.
- [x] T3 | slice=src/relay | files=src/relay/server.mjs,tests/server.test.mjs | verify=`node --test tests/server.test.mjs` | Expose the loopback read-only inbox.
- [x] T4 | slice=docs | files=docs/index.html,docs/style.css,docs/app.js,docs/sample.json | verify=`node --check docs/app.js` | Present the labelled interactive sample narrative.
- [x] T5 | slice=package.json | files=package.json | verify=`npm test` | Declare the CLI package and pinned SDK dependency.
- [x] T6 | slice=README.md | files=README.md | verify=`npm test` | Document installation and the real execution boundary.
- [x] T7 | slice=LICENSE | files=LICENSE | verify=`npm test` | Retain MIT attribution.
- [x] T8 | slice=.github | files=.github/workflows/ci.yml | verify=`npm test` | Verify the package on Windows and Linux in CI.
- [x] T9 | slice=scripts | files=scripts/check.mjs,scripts/smoke.mjs,scripts/browser-check.mjs,scripts/design-check.mjs | verify=`npm run check` | Record reproducible local, browser, and live-provider checks.
- [x] T10 | slice=docs | files=docs/INTEGRATION.md,docs/VERIFICATION.md | verify=`npm run check` | Publish sourced integration guidance and scoped verification evidence.
- [x] T11 | slice=package-lock.json | files=package-lock.json | verify=`npm ci --ignore-scripts` | Lock runtime and development dependencies.
- [x] T12 | slice=smoke | files=smoke/codex-adapter.json | verify=`forge verify-tests codex-adapter codex-adapter.ssat.yaml --root .` | Prove self-contained runtime checks reject empty implementations.
- [x] T13 | slice=scripts | files=scripts/record-verification.mjs | verify=`npm run check` | Bind reviewed workflow observations to source hashes.
