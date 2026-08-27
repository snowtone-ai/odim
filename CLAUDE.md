# Odim project rules — pm-zero v12.1

This is the canonical shared ruleset for Claude Code and Codex. The product ledgers are the system of record; the transcript is disposable.

## Source of truth and startup

- Product intent: `docs/vision.md`
- Execution ledger: `tasks.md`
- Current state: `docs/state.md`
- Current blockers only: `docs/issues.md`
- Decisions: `docs/decisions.md`
- Navigation: `docs/repo-map.md`
- Completion report: `HANDOFF-JA.md`

At session start, read `docs/state.md`, `docs/issues.md`, and the Summary of `docs/repo-map.md`. Follow their pointers to the relevant task and decision rows only. Read `context/source-*.md` only for a specific product or domain question that the ledgers cannot answer.

Before editing a governed path, read every matching `.claude/rules/*.md` file. Add a path-scoped rule only when a prevention step cannot be made executable; remove rules that have not been needed for six months.

## Intent and change discipline

- Translate non-engineer requests into the intended product outcome before implementing. State an assumption when ambiguity could materially change the product.
- Prefer the smallest cohesive change with clear boundaries. Do not add abstraction, infrastructure, or generality before a concrete need exists.
- Preserve unrelated user changes. The main agent is the only writer of `tasks.md` and `docs/state.md`.
- Use PowerShell for project operations on Windows. Never read, stage, or modify `.env*` files other than `.env.example`.

## Verification

- `pnpm verify` is the standard product check and runs structural checks, lint, typecheck, tests, and build.
- During implementation, run the narrowest affected check. After the candidate is stable, run `pnpm verify` once; after a failure, iterate on the failing layer before the final run.
- A bug fix requires the smallest deterministic failing reproduction before the fix, preferably as a focused automated test.
- Before completing a UI change, run the app in a fresh browser context with the existing browser harness at the affected breakpoints and confirm there are no console or runtime errors. Code reading is not a substitute.
- Run `gitleaks git --no-banner` before pushing when the command is available.
- Complete `HANDOFF-JA.md` in Japanese.

## Review

- Tier 0 is deterministic verification and CI.
- Tier 1 is a fresh-context review for large diffs, cross-route or cross-subsystem changes, persistence/auth/integration contract changes, hard-to-undo changes, and material shared UI or design-token changes.
- Do not use a self-assessed prose gate as evidence. Report the command, exit result, and artifact instead.

## Learning loop

When an unexpected failure occurs, first ask whether a cheap, stable machine check can prevent recurrence. Add it at the narrowest executable layer. If not, record a durable path-specific procedure in `.claude/rules/<zone>.md` with its origin. `docs/issues.md` contains only currently blocked work; resolved issues leave that file.

## Git workflow

- Work on a dedicated `<type>/<short-description>` branch; never commit directly to `main`.
- Commit after each logical unit with a conventional type (`feat`, `fix`, `docs`, `refactor`, `security`, `chore`, or `test`). Never stage secrets.
- Push each commit and open a PR when the branch is complete. CI must be green before merge.
- Force-push, history rewrites, and commands that destroy uncommitted work are prohibited.

## Commands

- Install: `pnpm install`
- Verify: `pnpm verify`
- Setup: `node scripts/setup.mjs`
- Browser smoke: `pnpm browser:smoke`
