# Odim — Reality Intelligence OS

**"No fakes. No noise. Just truth, and profit."**

Odim is a Reality Intelligence platform that detects the real decisions of corporations and states from substrate-layer signals — before official announcements.

---

## What it does

While the market watches press releases and earnings calls, Odim monitors the physical and financial substrate: energy permits, land acquisitions, water rights, capital flows, compute buildouts, raw material procurement, and logistics contracts. When the substrate moves in a pattern that doesn't match the public narrative, Odim surfaces the divergence and quantifies the lead time — the information asymmetry window.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router · TypeScript · Tailwind CSS |
| Map | MapLibre GL v5 · OpenFreeMap vector tiles |
| AI | Google Gemini (Huginn query cascade + Munin memory) |
| Database | Supabase (PostgreSQL + Row-Level Security) |
| Ingestion | Custom scrapers — SEC/EDGAR, EIA, FERC, PatentsView, USGS, port statistics, building permits |
| Auth | API key + org-scoped sessions |
| CI | GitHub Actions (lint · typecheck · test · build · release audit) |

---

## Screens

| Screen | Purpose |
|---|---|
| Reality Map | MapLibre substrate map — 7 layers, clustering, hover tooltips, ontology connection lines |
| Entity Intelligence | Entity scoring, narrative–reality gap analysis, evidence modal with divergence chart |
| Signal Alerts | Alert feed with chain evidence and confidence scoring |
| Huginn | Interactive AI query with reasoning trace, web search toggle, file attachment |
| Settings | API keys, audit trail, Huginn Custom Knowledge (seed memory) |

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
pnpm test         # Vitest (78 tests)
pnpm build        # production build
pnpm verify       # full pre-release check
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
