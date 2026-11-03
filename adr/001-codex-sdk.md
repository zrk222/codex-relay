# ADR 001: Local Codex SDK adapter

Use @openai/codex-sdk pinned to 0.166.0 as the single runtime dependency. The operator requested a released Codex adapter; this dependency supplies the supported local Codex runtime and resumable thread interface. Native Node modules provide persistence, Git subprocesses, tests, and a read-only HTTP dashboard. No provider credential is copied into the repository. Existing local Codex authentication remains on the operator's machine.

Use workspace-write with approvalPolicy never for noninteractive turns. Unsupported operations fail instead of silently expanding permissions. A task starts from a clean source repository and a new worktree. GitHub publication and merging remain outside the adapter.

The public preview uses the same viewer with static sample records. It has no server-side executor, local-state connection, or provider call. DeepSeek's MIT prototype supplied the lifecycle and supervision ideas; its DSH executor, credential wrappers, and full-access presets are not reused.

Development verification pins @playwright/test 1.64.1 and axe-core 4.14.0. They run the ECC Browser QA fallback in an isolated browser because the shared Chrome connector profile is already in use. They are not runtime dependencies or loaded by the public preview.
