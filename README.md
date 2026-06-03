# Odim - Reality Intelligence OS

**No fakes. No noise. Just truth, and profit.**

Odim is a Reality Intelligence platform that detects the real decisions of corporations and states from substrate-layer signals before official announcements.

---

## What it does

While the market watches press releases and earnings calls, Odim monitors the physical and financial substrate: energy permits, land acquisitions, water rights, capital flows, compute buildouts, raw material procurement, and logistics contracts. When the substrate moves in a pattern that does not match the public narrative, Odim surfaces the divergence, links the supporting evidence, and quantifies the lead-time window.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router · TypeScript · Tailwind CSS |
| Map | MapLibre GL v5 · OpenFreeMap vector tiles |
| AI | Google Gemini / provider adapters (Huginn cascade + Munin memory + Evidence GraphRAG) |
| Database | Supabase (PostgreSQL + Row-Level Security) |
| Ingestion | Custom scrapers — SEC/EDGAR, FERC, EIA, FRED, Federal Register, EDINET, Companies House, USAspending, OpenSanctions, FEMA, SAM.gov, NRC, PatentsView, USGS, port statistics, building permits |
| Auth | API key + SSO + org-scoped sessions |
| CI | GitHub Actions (lint · typecheck · test · build · release audit) |

---

## Current Capabilities

- **Evidence GraphRAG** - source-backed graph paths across entities, signals, alerts, audits, sources, and ontology links.
- **Huginn analyst cascade** - precomputed answers, Munin memory, live signal retrieval, Evidence GraphRAG context, and optional web augmentation.
- **Agentic Watchtower** - approval-gated workflows for data-center buildouts, water-rights stress, and subsidy/incentive monitoring.
- **Institutional API surface** - scoped REST endpoints, rate limits, pagination, audit trails, and production fail-closed environment checks.
- **Operational ingestion** - daily and backfill scrapers with source-level reports, freshness checks, durable upserts, and visible run state.
- **Enterprise controls** - Supabase RLS, API keys, SSO plumbing, tenant-scoped memory, security headers, and release audit checks.

---

## Screens

| Screen | Purpose |
|---|---|
| Reality Map | MapLibre substrate map with 7 layers, clustering, hover tooltips, geographic drill-down, and ontology connection lines |
| Entity Intelligence | Entity scoring, narrative-reality gap analysis, evidence graph paths, citation coverage, and comparison tools |
| Signal Alerts | Alert feed with chain evidence, confidence scoring, and Watchtower approval actions |
| Huginn | Interactive AI query with reasoning trace, Evidence GraphRAG context, web search toggle, and file attachment |
| Settings | API keys, audit trail, ingestion visibility, calibration/attribution controls, and Huginn Custom Knowledge |
| Custom Dashboard | Drag-and-drop builder, persistent layouts, org-scoped panel config |

---

## Signal Layers

- **Energy** — power purchase agreements, grid connections, utility permits  
- **Capital** — sovereign fund deployments, private equity commitments, project financing  
- **Land** — site acquisitions, zoning filings, construction permits  
- **Compute** — data center leases, GPU procurement, colocation contracts  
- **Water** — water rights, industrial allocation, desalination projects  
- **Raw Materials** — mining licenses, offtake agreements, mineral extraction permits  
- **Logistics** — port capacity, terminal expansion, freight contracts  

---

## Setup

```bash
cp .env.example .env        # fill in Supabase + Gemini credentials
pnpm install
node scripts/setup.mjs      # apply DB migrations + create default org
pnpm dev
```

Required environment variables: see `.env.example`.

---

## Development

```bash
pnpm dev          # start dev server
pnpm typecheck    # TypeScript check
pnpm lint         # ESLint
pnpm test         # Node test suite (100 tests)
pnpm build        # production build
pnpm verify       # full pre-release check
pnpm browser:smoke # production server smoke test for pages, APIs, and CSS assets
```

---

## Ingestion

```bash
pnpm scrape:dry-run         # verify sources without writing
pnpm scrape                 # run full daily scrape
pnpm scrape:backfill        # historical backfill (set SCRAPE_BACKFILL_START/END)
```

---

## AI — Huginn / Munin

**Huginn** (thought) answers analyst queries through a multi-layer cascade:
1. Precomputed answer cache
2. Munin long-term memory
3. Live substrate signal retrieval
4. Optional web search augmentation

**Munin** (memory) maintains org-scoped persistent memory, updated nightly by the Dream synthesis job. Anti-sycophancy detection runs on every response.

---

## License

Private. All rights reserved.
