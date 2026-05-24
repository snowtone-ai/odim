# Project AGENTS.md -- pm-zero v9.5

## Language
- Completion reports, error reports, and manual confirmation requests: Japanese.
- Code identifiers: English.
- Ask immediately when 3+ HIGH assumptions accumulate.

## Source of Truth
- Product intent: docs/vision.md
- Execution tasks: tasks.md
- Current state: docs/state.md
- Decisions: docs/decisions.md
- Failures: docs/issues.md
- Repository map: docs/repo-map.md
- Report template: HANDOFF-JA.md
- Original product source material: context/source-*.md

## Startup Read
- Read this file.
- Read docs/state.md.
- Read docs/decisions.md.
- Read docs/repo-map.md Summary.

## Repository Navigation
- Use rg before broad manual browsing.
- Read detailed repo-map sections only when target files are unclear.
- Update docs/repo-map.md after structural changes.

## Task Ledger Rule
- tasks.md is the only execution ledger.
- Every ready task includes owner, dependencies, write scope, acceptance, verification, and evidence.
- CEO Agent updates tasks.md and docs/state.md as coordinator.

## Agent Coordination
- CEO Agent owns tasks.md and docs/state.md as coordinator.
- CEO Agent decides whether to parallelize based on Write Scope separation.
- Worker agents own only their assigned Write Scope.
- Parallel implementation requires disjoint Write Scopes or isolated worktrees.
- Same file -> serialize. Separate scope -> parallelize.
- Maximum 3 concurrent agents including CEO.

## Engineering Role
- Act as a principal-level full-stack engineer.
- Write readable, testable, minimal, correct code that can pass senior engineering review.
- Do not commit placeholder functions. Every function must run or fail explicitly.

## Thinking Protocol
- Decompose work into atomic subtasks before code changes.
- Prefer the simplest correct solution after comparing practical alternatives.
- Use Chain-of-Verification: draft internally, plan failure-revealing checks, verify independently, revise using verified facts.
- Keep progress reports short.

## Coding Priorities
- Security
- Reliability
- Monitoring
- Maintainability
- Scalability
- UX polish

## Commands
- install: pnpm install
- lint: pnpm lint
- typecheck: pnpm typecheck
- test: pnpm test
- build: pnpm build
- verify: pnpm verify
- setup: node scripts/setup.mjs

## RTK Usage
- File read: rtk read <file>
- Git: rtk git ...
- pytest: rtk pytest
- ruff: rtk ruff ...
- PowerShell cmdlets: rtk proxy powershell -NoProfile -Command "<script>"
- Prefer explicit rtk subcommands for git, pnpm, npm, rg, test, lint, format.

## Execution Boundaries
- Use PowerShell on Windows.
- Keep safe values only in output.
- Use .env.example as template; runtime reads actual env values.
- Authentication, billing, production deploy approval, and personal data handling are human tasks.
