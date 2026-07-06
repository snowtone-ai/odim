# issues.md

| Date | Area | Issue | Resolution | Status |
|---|---|---|---|---|
| 2026-05-24 | RTK | Referenced RTK.md was absent from repository root. | Followed provided RTK rules from user prompt. | open |
| 2026-05-24 | Verification | Full Next.js build may require dependency installation from registry. | Resolved by pnpm install, pnpm typecheck, pnpm build. | closed |
| 2026-07-06 | Database | `pnpm db:migrate:{staging,production}` fails: pooler reports `tenant/user postgres.xyvioekqwmbgrwlinzxe not found` for both env URLs — the Supabase project was deleted or paused. psql itself works (`C:\Program Files\PostgreSQL\17\bin`, not on PATH). | (1) Added `resolvePsql()` fallback in `scripts/apply-db-migrations.mjs` for Windows PATH; (2) Wrapped `CREATE POLICY` in 0008 with idempotent DO block; (3) Operator restored Supabase project in dashboard; all 0001–0013 applied successfully 2026-07-06. | closed |
