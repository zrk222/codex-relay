# Verification scope

This release is a local Codex adapter with a static sample preview. It does not reproduce every behavior of dsh-superagent.

## Desktop visual interface, v0.2.0

The live local service can now be opened in a Codex desktop browser panel. Its controls create tasks, run or resume Codex, send answers, cancel turns, recover stopped work, display the actual Git diff, and mark reviewed work done. The installed launcher opens this surface in Codex; it is not a registered native sidebar plugin.

16 tests pass, including capability/Origin rejection, visual action dispatch, cancellation, exclusive execution and recovery-state projection. A separate test-owned browser exercised a real two-turn Codex read-only fixture using create, run, answer/resume, diff and completion controls, then verified reload persistence. Automated axe and overflow checks passed at 375, 768 and 1200 pixels. The tests do not modify the browser-use permissions in Codex.

The current Codex host returned an open-panel receipt and the operator's ambient browser context showed the local URL. In-app UI automation is disabled in Work settings, so no automated click inside that host is claimed. The same live interface was verified in a separate browser. The panel-specific hash-bound verification summary is [panel-verification.json](panel-verification.json).

The following original v0.1 evidence remains scoped to that release and its controlled coding fixture.

## Observed locally on Windows

- 13 Node tests passed: persisted isolated worktrees, saved-thread resumption, explicit questions, provider failures, cancellation, locks, path validation, clean-source preservation, and read-only HTTP boundaries.
- A real authenticated Codex turn changed a greeting in a temporary worktree. The host ran the resulting test directly and it passed. The original source file remained unchanged. A second real turn resumed the same thread ID and returned needs_review.
- The first live attempt correctly returned needs_answer because the worker could not execute the operator's required Code Factory tool from its sandbox. The successful attempt used a genuine host-executed doctor receipt at the fixture repository root. The gate was not waived; the host owns post-turn checks and the hash-bound workflow audit. This is an execution-environment limitation to consider for local tools installed under a user's home directory.
- Browser checks exercised all 3 filters, task selection, the 5-step Nanna/Content Creator sample story, and keyboard activation. Screens at 375, 768, and 1440 pixels had no horizontal overflow and no automated axe violations. No page errors or failed requests were observed in that run.
- Prestige checks include source audit, strict seven-lens critique, rendered desktop/mobile checks, and design mutation challenges. The single-file challenge input composes the unchanged HTML and CSS and records their source hashes.

The browser QA uses ECC's Playwright fallback in a fresh browser. The shared Chrome connector was already using its profile; it was left running. These initial screenshots establish a baseline. Comparison with a previous visual baseline is not available.

## Truth boundaries

Agent-reported task checks are model output. The separate host-run tests and receipts provide independent evidence for this controlled fixture. A needs_review result is not human approval, a merged PR, or a production deployment.

REA's source analysis parsed 177 upstream source files with zero parse failures, but its semantic coverage was partial. It did not execute the original system or prove behavioral parity.

Automated axe checks and keyboard activation do not prove full WCAG conformance. Local lab LCP/CLS observations are not field Core Web Vitals or measured user outcomes. INP and productivity/cost improvements are unmeasured.

## Reproduce

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run preview
```

In a second terminal, run `npm run browser:check` with Edge available on Windows. On Linux, install the Playwright Chromium browser first. `npm run smoke` requires local Codex authentication and makes two normal provider turns. It retains its temporary fixture under ignored `artifacts/` for inspection.

The workflow audit binds the candidate source hashes to the observed checks. Raw local receipts stay outside the public package; the public verification summary contains no credentials, private prompts, or Codex session IDs.
