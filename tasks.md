# tasks.md -- pm-zero v9.5 Execution Ledger

## Goal Binding
- Vision source: docs/vision.md
- Active goal: Build Odim repository from context and pm-zero v9.5.
- Planning owner: Codex CLI
- Implementation owner: Codex CLI
- Review owner: Codex CLI

## Status Vocabulary
- proposed: idea exists, not ready
- ready: owner, dependencies, write scope, acceptance, verification, and expected evidence are clear
- doing: one owner is actively working
- blocked: needs decision, dependency, credential, environment, or human action
- review: implementation complete, review pending
- done: accepted by reviewer
- verified: evidence recorded

## Parallelization Rules
- CEO Agent owns tasks.md as the default coordinator.
- CEO Agent decides whether to parallelize based on Write Scope separation.
- Worker agents own only their assigned Write Scope.
- Parallel implementation requires disjoint Write Scopes or isolated worktrees.
- same file -> serialize. separate scope -> parallelize.
- Maximum 3 concurrent agents including CEO.

## Tasks
| ID | Status | Owner | Depends On | Write Scope | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| T001 | verified | Codex | none | AGENTS.md, CLAUDE.md, HANDOFF-JA.md, docs/**, tasks.md, scripts/**, .env.example, .gitignore | pm-zero v9.5 project memory exists and responsibilities are separated | pnpm verify | scripts/verify.mjs passes structural checks |
| T002 | verified | Codex | T001 | app/**, components/**, styles/**, lib/**, config/**, scrapers/**, supabase/**, .github/** | Odim skeleton contains 8 routes, design tokens, ontology schema, AI/provider abstraction, pipeline/resolver foundations, and mock API data | pnpm verify | scripts/verify.mjs passes structural checks |
| T003 | verified | Codex | T002 | package lock and installed dependencies | Install dependencies and run typecheck/build in the target environment | pnpm install; pnpm typecheck; pnpm build | pnpm install completed; pnpm typecheck passed; pnpm build passed |
| T004 | ready | Codex | T003 | lib/pipeline/**, scrapers/**, supabase/** | Replace demo ingestion with first real FERC/SEC/building-permit sources while preserving idempotency and audit logs | pnpm test; pnpm verify | pending |

## Blockers
| ID | Task | Blocker | Needed decision | Owner |
|---|---|---|---|---|
| B001 | T003 | Dependencies may not be installed in this sandbox and network is restricted | Resolved by pnpm install | Codex |

## Review Notes
| Task | Reviewer | Result | Follow-up |
|---|---|---|---|
| T001 | Codex | pass | Keep context/source-* as canonical product source material. |
| T002 | Codex | pass | Full production data integrations remain T004+. |
| T003 | Codex | pass | package versions were verified with npm registry on 2026-05-24. |
