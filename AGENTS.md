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

## On-Demand Only
- Original product source material: context/source-*.md — read only when a specific screen, feature, or domain question cannot be answered from the sources above.

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

## Release-Critical Coding Rules
- Keep each change focused on one concern. Do not mix refactors, behavior changes, tests, and documentation beyond what the active task requires.
- Security hardening is additive: tighten validation, auth, rate limits, env gates, and error handling without removing existing protections.
- Tests travel with risky code. Add or update focused tests in the same change when touching auth, tenant isolation, AI prompts, ingestion, parsers, migrations, or API routes.
- Migrations are append-only unless explicitly directed. Never edit applied migrations; add a new numbered migration and update the migration runner when it should apply by default.
- API routes must authorize first, validate input before domain work, avoid trusting request body org IDs over authenticated context, and return JSON errors without leaking stack traces.
- External calls and scheduled jobs must fail visibly: use timeouts, bounded retries or concurrency, source-level reports, and logged errors that can be traced from CI or operations output.
- Frontend resilience changes must preserve accessibility: visible page headings, loading/error states, reduced-motion support, and no background animation loops while the tab is hidden.
- Verification is part of the work. Run the narrowest useful check after each focused change, then run the repository-level command required by the task or group before declaring completion.

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

## Git Workflow

### Branches
- Never commit directly to `main`. Always work on a dedicated branch.
- Naming: `<type>/<short-description>` — e.g. `feat/add-auth`, `fix/null-check`, `docs/update-readme`, `security/harden-gitignore`.
- Create the branch at the start of the task, not after implementation.

### Commits
- Commit after each logically complete unit of work. Do not accumulate changes and commit at session end.
- Format: `<type>: <short description>` — types: `feat` / `fix` / `docs` / `refactor` / `security` / `chore` / `test`.
- Stage only files within the task's Write Scope. Never stage `.env*`, secrets, or credential files.
- Every committed function must work. No placeholder code.

### Push
- Push after every commit. Do not leave commits local-only.
- First push: `git push -u origin <branch>`. Subsequent: `git push`.

### Pull Requests
- Open a PR to `main` when the branch is complete. Do not wait for the user to ask.
- PR title: conventional commit format matching the branch type.
- PR body: what changed and why.

### Pre-push Security Check
- Confirm `.gitignore` covers secret and credential patterns before the first push on any branch.
- Run `gitleaks git --no-banner` if gitleaks is available.
- If secrets are staged, untrack them and update `.gitignore` before pushing.
