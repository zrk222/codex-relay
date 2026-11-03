# Codex Relay

**Every task has a next step.**

A local task inbox and resumable coding adapter for Codex. Give each task its own Git worktree, keep its Codex thread, and see what needs your answer or review.

## Use visually inside Codex desktop (v0.2.0)

Install the bundled `skills/codex-relay` launcher into your Codex skills directory. Then ask **“Open Codex Relay.”** Codex starts the local service and opens its live controls in the current chat's right-side browser panel. The initial implementation did not include these controls; v0.2.0 adds them.

Use **New task**, enter a repository folder and request, then choose **Run with Codex**. Answer questions with **Send & continue**, stop work with **Stop run**, inspect **Review changes**, and choose **Mark reviewed & done** after inspection. State updates automatically. Normal use requires no terminal commands or external browser.

This is an embedded local browser panel, not a registered native sidebar extension. The service runs on your machine and must remain running. The launcher skill restarts it when needed; tasks persist across restarts. Codex runs in saved SDK threads, separate from the current conversation. The public website remains a sample-only preview.

[Explore the interactive preview](https://zrk222.github.io/codex-relay/) · [Integration design](docs/INTEGRATION.md) · [Verification scope](docs/VERIFICATION.md)

The public preview uses **sample data**. It does not run agents or connect to your machine. Real coding runs locally through your existing Codex authentication.

![Codex Relay task inbox preview](docs/preview-desktop.png)

## Quickstart

Requires Node.js 22.19+, Git, and local Codex authentication. This source release includes a pinned `@openai/codex-sdk` dependency; it has not been published to npm.

```sh
git clone https://github.com/zrk222/codex-relay.git
cd codex-relay
npm ci
node src/relay/cli.mjs preview
```

Open the printed local URL to explore the sample inbox. To install the CLI command locally, run `npm link`. Authenticate with `codex login` if your machine is not already signed in.

Create a task from a **clean repository root**. Keep Relay's state directory outside that repository.

```sh
codex-relay create --repo /path/to/project --title "Fix form validation" --prompt "Reject an empty name and run the relevant tests."
codex-relay run TASK_ID
codex-relay serve
```

The create command prints a full UUID. Use that UUID as `TASK_ID`. Windows paths can be quoted, for example `--repo "C:\Projects\my-app"`.

When a task needs your decision, resume the same saved Codex thread:

```sh
codex-relay run TASK_ID --reply "Empty names should show a required-name message."
codex-relay show TASK_ID
codex-relay done TASK_ID
```

`done` is a manual acknowledgement and is allowed only from `needs_review`. It does not approve a pull request, merge code, or deploy anything. Review the worktree and the actual test outputs first.

## What happens to a task

```mermaid
flowchart LR
  Q[Queued] --> W[Working in its own worktree]
  W --> A[Needs your answer]
  A --> W
  W --> R[Needs your review]
  R --> D[Manually marked done]
  W --> F[Failed or interrupted]
  F --> W
```

- **Persistence:** private JSON records retain task scope, branch, worktree, thread ID, result, and reported checks.
- **Resumption:** `run` starts a thread once and resumes its saved ID on subsequent turns.
- **Exclusive execution:** a task lock refuses simultaneous runs. A crash leaves a lock; `recover TASK_ID` refuses to release it while the recorded process is alive.
- **Local supervision:** the dashboard binds to `127.0.0.1` and accepts read requests only. Run and reply through the CLI. Refresh the page to update its status.
- **Explicit results:** Codex returns a structured `needs_answer` or `needs_review` result. Agent-reported checks are labelled; they are not independently verified receipts.

State defaults to `~/.codex-relay`. Override it with `CODEX_RELAY_HOME` or `--state PATH` on every command. Worktrees remain on disk until you deliberately remove them with Git after preserving their work; Relay never automatically deletes them.

## Permissions and limits

The adapter requests `workspace-write`, `approvalPolicy: never`, disabled sandbox network access, and disabled web search. Permission-requiring operations fail rather than prompting. Repository instructions and your configured Codex tools still apply. A Git worktree is **not an OS security boundary**; use a dedicated account or container for untrusted repositories. The adapter inherits your Codex configuration and does not disable or audit every configured MCP tool.

The first release does not include automatic GitHub intake, a continuously running worker queue, a hosted agent, automatic merging, or an in-app chat. `run` stays in the foreground until the turn ends. Ctrl+C requests cancellation. After a crash, inspect the worktree and use `recover` before resuming. Local task text and model output may contain private data; keep the state directory private and out of Git.

Codex usage follows your account's access and limits. No productivity or cost improvement has been measured. The preview is a demonstration of the interface, not a recording of a real coding run.

## Development

```sh
npm ci
npm test
npm run check
npm run smoke
```

`npm test` uses deterministic adapter fixtures and temporary Git repositories without a provider call. `npm run smoke` runs one real local Codex coding turn in a temporary repository and requires your authentication; it consumes normal account usage. See [verification](docs/VERIFICATION.md) for the exact scope and remaining limits.

## Inspiration and license

Inspired by [DeepSeek's dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype), reviewed at commit `6337fc823ce20251c8de8085948165c81aaa701e`. Relay adapts its supervision ideas into a smaller Codex-native workflow; it is not a DSH plugin or a claim of full behavioral parity. [MIT licensed](LICENSE). Independent project; not affiliated with OpenAI or DeepSeek.
