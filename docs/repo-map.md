# repo-map.md -- pm-zero v9.5 Repository Map

## Read Policy
- Session start: read Summary only.
- Before editing: read the section for the target area when target files are unclear.
- When navigation is unclear: read Entry Points and Directory Map.
- After structural changes: update only the affected section.

## Summary
- App type: Next.js 16 App Router web application for Odim Reality Intelligence OS.
- Main runtime: Node.js 20.9+ target, React 19.2, TypeScript strict mode.
- Package manager: pnpm.
- Primary source directory: app/, components/, lib/.
- Primary test directory: tests/; scripts/verify.mjs is current structural gate.
- Main entry points: app/layout.tsx, app/(dashboard)/*/page.tsx, app/api/*/route.ts.
- Verification command: pnpm verify.

## Directory Map
| Path | Purpose | Edit Frequency | Notes |
|---|---|---|---|
| app/ | Routes, layout, API handlers | high | 8 dashboard screens and route handlers. |
| components/ | Reusable UI, chart, map, globe components | high | Follow styles/tokens.css and context/source-07-design.md. |
| lib/ | AI, Huginn, Munin, ontology, pipeline, resolvers | high | Keep source-backed confidence and org isolation. |
| supabase/ | Database migrations | medium | RLS, raw signal tenant visibility, and ontology schema live here. |
| scrapers/ | Public data collection scripts | medium | Respect robots/rate limits and write audit logs. |
| tests/ | Node test suite | medium | Covers parser, idempotency, and ingestion evidence behavior. |
| config/ | Replaceable source definitions | medium | Paid sources should be added by config. |
| docs/ | pm-zero project memory | medium | Do not mix task status into vision. |
| context/ | Canonical product source material | low | source-* files are inputs, not implementation output. |
| scripts/ | Setup and verification automation | medium | Keep deterministic and low-log. |

## Entry Points
| Area | File | Purpose |
|---|---|---|
| App shell | app/layout.tsx | Global metadata, fonts, shell. |
| Dashboard home | app/page.tsx | Redirects to Reality Map. |
| API | app/api/huginn/route.ts | Huginn natural-language query. |
| API admin | app/api/settings/route.ts | Org settings, members, alert rules, and redacted API key metadata. |
| API keys | app/api/api-keys/route.ts | One-time API key issue and revocation. |
| Admin repository | lib/repositories/admin.ts | Supabase-backed admin settings with deterministic non-production fallback when schema/env is unavailable. |
| API key auth | lib/auth/api-keys.ts | API key issue, hashing, verification, redaction, and revocation helpers. |
| API request auth | lib/auth/request.ts | Env-gated route authorization with scoped API keys, org context resolution, and failed-auth rate limiting. |
| Org filters | lib/api/org.ts | Org context parsing and app-layer public-or-org isolation helpers. |
| API repository | lib/repositories/reality.ts | Supabase reads with source-backed non-production fallback for alerts, signals, entities, and audit events. |
| Huginn | lib/huginn/query.ts | Org-scoped query orchestration, context assembly, reasoning trace, and Munin recall draft/write path. |
| Munin | lib/munin/memory.ts | Org-scoped memory search, scoring, fixtures, and DB row mapping. |
| Fallback data | lib/data.ts | Source-backed fixture data derived through the ingestion pipeline. |
| i18n | lib/i18n/messages.ts | Typed English/Japanese UI message catalog. |
| Scrape runner | scrapers/run.ts | Dry-run/live scrape entry point for all Reality Layer adapters and narrative triggers. |
| Configured source adapter | scrapers/configured-source.ts | Generic JSON/CSV source adapter for paid feeds added through config; paid feeds require orgIdEnv. |
| AI provider | lib/ai/provider.ts | Mock/Gemini-compatible generation abstraction. |
| AI rate limits | lib/ai/rate-limit.ts | Org-and-model-scoped Gemini free-tier RPM/RPD/TPM guard. |
| Ontology | lib/ontology/types.ts | Core object/link types. |
| Verification | scripts/verify.mjs | Repository structural gate. |
| Release audit | scripts/release-audit.mjs | Phase F launch-readiness control gate. |
| Bootstrap API key | scripts/issue-bootstrap-api-key.mjs | One-time Supabase-backed admin API key issuance for launch setup. |
| Commercial readiness | docs/commercial-readiness.md | Phase F Section 4 requirement-to-evidence matrix and human-only launch gates. |

## Common Workflows
| Workflow | Read First | Edit Usually | Verify |
|---|---|---|---|
| Add dashboard screen | context/source-06-screens.md | app/(dashboard)/, components/ui/ | pnpm verify; pnpm typecheck |
| Change design | context/source-07-design.md | styles/tokens.css, app/globals.css | pnpm verify |
| Add resolver | context/source-03-ontology.md | lib/resolvers/ | pnpm test; pnpm verify |
| Add scraper | context/source-04-data-pipeline.md | scrapers/, config/sources.json | pnpm test; pnpm verify |
| Add paid source | context/source-08-roadmap.md | config/sources.json, .env.example | pnpm test; pnpm scrape:dry-run; pnpm release:audit; set orgIdEnv |
| Change memory | context/source-05-huginn-munin.md | lib/munin/, supabase/migrations/ | pnpm test; pnpm verify |
| Change admin/auth | context/source-08-roadmap.md | app/api/settings/, app/api/api-keys/, lib/auth/, lib/repositories/admin.ts, supabase/migrations/ | pnpm test; pnpm typecheck; pnpm release:audit; pnpm build |

## Generated / External Files
| Path | Rule |
|---|---|
| node_modules/ | ignored; never edit. |
| .next/ | ignored; build output. |
| .env* | ignored except .env.example. |
| playwright-report/ | ignored test output. |
| context/source-*.md | canonical source material; edit only when product source changes. |

## Update Rules
- Keep Summary under 20 lines.
- Keep each directory note concrete.
- Move rationale to docs/decisions.md.
