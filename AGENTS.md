# Codex adapter — pm-zero v12.1

`CLAUDE.md` is the canonical shared project ruleset. Read it first.

## Startup

- After `CLAUDE.md`, read `docs/state.md`, `docs/issues.md`, and the Summary of `docs/repo-map.md`.
- Resolve the active task and relevant decision IDs from those pointers; read only the matching rows or sections in `tasks.md` and `docs/decisions.md`.
- Before editing a governed path, read every matching `.claude/rules/*.md` file explicitly. Codex does not load path-scoped Claude rules automatically.

## Codex-specific mechanics

- Use the model and reasoning configuration already provided by Codex. Do not copy Claude-specific model names, effort controls, prompt-cache claims, or slash commands into this file.
- Use a fresh-context reviewer for large, cross-cutting, contract-changing, or hard-to-undo diffs. Use worker agents only for disjoint write scopes; keep small fixes in the main context.
- Use PowerShell on Windows and keep command output limited to safe, relevant values.
- Code identifiers remain English. Completion reports, error reports, and manual confirmation requests are Japanese.
- Keep `.codex/config.toml` empty except for a genuinely project-specific, non-security override. Global permissions, hooks, sandbox, model, and connected-tool policy do not belong there.

## Scope

- The main agent owns `tasks.md` and `docs/state.md` as the coordinator.
- Preserve unrelated user changes. Never read, stage, or modify secret files such as `.env.local`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
