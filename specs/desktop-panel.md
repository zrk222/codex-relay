# Spec: desktop-panel
Status: approved

## MUST - Functional core
### Description
The developer uses live Codex Relay controls in this Codex desktop app through a loopback page opened by open_in_codex. The existing backend and Codex SDK remain the execution engine. This is an embedded local browser panel, not registration of a native app sidebar plugin.
### User roles
- Developer
### Requirements
- When the developer opens the visual panel, the system shall display `New task`, create isolated tasks, run and resume Codex, stop active runs, submit answers, show the Git diff and reported checks, recover stopped tasks, and complete reviewed tasks without developer terminal commands; all task data actions shall require a secret capability and matching local origin.
### Acceptance criteria
```gherkin
Scenario: Visual task lifecycle
  Given the live panel displays `New task`
  When the developer creates a task, runs Codex, sends an answer and reviews changes
  Then actual persisted task state and the Git diff are displayed
Scenario: Local request boundary
  Given a missing capability or an external origin
  When a task action is requested
  Then the request is rejected before task execution
```
## SHOULD - Technical/structural
- Data model: reuse private task records and exclusive runner locks.
- Verification: node tests, browser interaction and accessibility checks, controlled real Codex run/resume, candidate-bound workflow audit.
## SHOULD NOT - Scope
- No automatic merge, native plugin listing claim, or external-browser-only workflow.
