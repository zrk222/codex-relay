# Spec: codex-adapter
Status: approved
SpecFactor-target: 0.75-2.5

## MUST - Functional core
### Description
Codex Relay gives a developer a local task inbox, resumable Codex execution, and a public sample preview. The operator authorized implementation and publication on 2026-11-03.

### User roles
- A developer creates and runs local coding tasks and reviews their results.

### Requirements (EARS)
- When a developer creates a task, the system shall store status `queued` in exactly 1 task record with a UUID, title, prompt, repository, and isolated Git worktree path.
- When a developer runs or resumes a task, the system shall invoke Codex with `workspace-write` isolation and approval policy never, retain its thread ID, and classify its structured result as needs_answer or needs_review.
- If a Codex turn is cancelled, the system shall store status `interrupted`; if the turn fails, the system shall store failed status; both outcomes shall release the task lock and a simultaneous second run shall fail without invoking Codex.
- When the local dashboard receives a request, the system shall bind to `127.0.0.1`, accept only GET requests with a matching local Host, reject POST with 405 and external Host with 403, and expose task status without executing a coding task.
- When a visitor opens the public preview, the system shall display `sample data`, display 3 queue filters for changing the task list and detail selection, and replay 5 explicitly simulated story steps without calling Codex.
- When release verification runs, the system shall return `Invalid task id` for invalid task identifiers before filesystem access, reject paths outside the intended workspace, preserve upstream MIT attribution, and include a working local CLI smoke receipt.

### Acceptance criteria (Gherkin)
```gherkin
Scenario: R1 persistent isolation
  Given a temporary Git repository with 1 initial commit
  When a task is created and its record is read from a new store instance
  Then exactly 1 task exists with status `queued` and its worktree has a distinct branch
Scenario: R2 resumable result
  Given a recorded adapter fixture with thread ID relay-fixture-1
  When 2 turns run on the same task
  Then the second turn resumes relay-fixture-1 with `workspace-write` isolation and reports needs_review
Scenario: R3 exclusive failure recovery
  Given 1 active task lock
  When a second turn starts
  Then it fails before the runner is called
  And cancellation stores `interrupted`
Scenario: R4 read-only dashboard
  Given the server listens on `127.0.0.1`
  When a POST request or a request with an external Host arrives
  Then the response status is 405 or 403 respectively
Scenario: R5 public sample narrative
  Given 3 visible queue filters and 5 story steps
  When the visitor changes filters and advances the story
  Then task detail updates and `sample data` remains visible
Scenario: R6 input validation
  Given an invalid task identifier containing ../
  When a task record is requested
  Then the operation returns `Invalid task id` before reading another directory
```

## SHOULD - Technical/structural
- ADR references: adr/001-codex-sdk.md
- Data model: one private JSON record per task; exclusive directory lock per active run.
- API contract: local GET /api/tasks returns task summaries; all writes occur through the CLI.

## SHOULD NOT - Implementation details
- No autonomous GitHub intake, auto-merge, provider billing estimate, or hosted Codex execution.
- No claim of parity with DeepSeek Harness or complete REA semantic coverage.

## Decision logic (factory candidates)
Task result statuses are a finite validated enumeration, not inferred from transcript prose.
