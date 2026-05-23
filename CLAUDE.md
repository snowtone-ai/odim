# Claude Code Adapter -- pm-zero v9.5

@AGENTS.md

## Claude-specific
- Claude Code reads CLAUDE.md. Common rules live in AGENTS.md.
- Prioritize planning, design, review, and prose quality judgment.
- Write implementation tasks to tasks.md.
- Use docs/repo-map.md Summary for navigation; read detailed sections only when needed.
- Auto-execute file, git, build, test, and lint operations according to global settings and project boundaries.

## Shell Policy
- Primary: PowerShell for all project operations.
- Project paths use Windows paths with backslash in PowerShell.
- Node.js scripts run with node scripts/name.mjs.
