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
- Primary test directory: tests/ when added; scripts/verify.mjs is current structural gate.
- Main entry points: app/layout.tsx, app/(dashboard)/*/page.tsx, app/api/*/route.ts.
- Verification command: pnpm verify.

## Directory Map
| Path | Purpose | Edit Frequency | Notes |
|---|---|---|---|
| app/ | Routes, layout, API handlers | high | 8 dashboard screens and route handlers. |
| components/ | Reusable UI, chart, map, globe components | high | Follow styles/tokens.css and context/source-07-design.md. |
| lib/ | AI, Huginn, Munin, ontology, pipeline, resolvers | high | Keep source-backed confidence and org isolation. |
| supabase/ | Database migrations | medium | RLS and ontology schema live here. |
| scrapers/ | Public data collection scripts | medium | Respect robots/rate limits and write audit logs. |
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
| Mock data | lib/data.ts | Demo entities, signals, alerts, flows. |
| AI provider | lib/ai/provider.ts | Mock/Gemini-compatible generation abstraction. |
| Ontology | lib/ontology/types.ts | Core object/link types. |
| Verification | scripts/verify.mjs | Repository structural gate. |

## Common Workflows
| Workflow | Read First | Edit Usually | Verify |
|---|---|---|---|
| Add dashboard screen | context/source-06-screens.md | app/(dashboard)/, components/ui/ | pnpm verify; pnpm typecheck |
| Change design | context/source-07-design.md | styles/tokens.css, app/globals.css | pnpm verify |
| Add resolver | context/source-03-ontology.md | lib/resolvers/ | pnpm test; pnpm verify |
| Add scraper | context/source-04-data-pipeline.md | scrapers/, config/sources.json | pnpm test; pnpm verify |
| Change memory | context/source-05-huginn-munin.md | lib/munin/, supabase/migrations/ | pnpm test; pnpm verify |

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
