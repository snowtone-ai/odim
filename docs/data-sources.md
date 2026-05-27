# Data Sources Reference — Odim Reality Intelligence OS

## Overview

Odim ingests signals from two distinct layers:
- **Substrate Layer (Reality)**: Source-backed evidence of capital fixation — permits, filings, registrations, production data
- **Narrative Layer**: Public communications — press releases, earnings calls, analyst coverage, social media

The key insight: Substrate signals precede Narrative by days to months. The gap between them is Odim's alpha.

---

## Substrate Layer Sources

### Energy

| Source | ID | API/Feed | Auth | Region | Confidence | Status |
|---|---|---|---|---|---|---|
| FERC eLibrary | `ferc-elibrary` | https://elibrary.ferc.gov/eLibrary/search | None | US | 0.80 | ✅ Implemented |
| EIA Electricity | `eia-electricity` | https://api.eia.gov/v2/electricity/ | Free API key | US | 0.82 | ✅ Implemented |
| State PUC Filings | `state-puc-filings` | Varies by state | None | US | 0.78 | ✅ Implemented |
| ERCOT Interconnection Queue | `ercot-queue` | http://www.ercot.com/gridinfo/resource | None | US-TX | 0.75 | 🔧 Configured |
| PJM Interconnection Queue | `pjm-queue` | https://www.pjm.com/planning/services-requests/interconnection-queues | None | US-East | 0.75 | 🔧 Configured |
| MISO Generator Queue | `miso-queue` | https://www.misoenergy.org/planning/generator-interconnection/ | None | US-Central | 0.75 | 🔧 Configured |
| AEMO Generation Info | `aemo-generation` | https://aemo.com.au/energy-systems/electricity/national-electricity-market-nem | None | AU | 0.76 | 🔧 Configured |
| IRENA Capacity Stats | `irena-capacity` | https://pxweb.irena.org/pxweb/en/IRENASTAT | None | Global | 0.72 | 📋 Planned |

**Use cases:**
- Detect power plant capacity additions before construction announcements
- Track grid interconnection requests (lead indicator for data centers, industrial loads)
- Monitor regulatory approvals as construction gate signals
- Compare planned vs operational capacity for execution tracking

### Cash (Capital Fixation)

| Source | ID | API/Feed | Auth | Region | Confidence | Status |
|---|---|---|---|---|---|---|
| SEC EDGAR (8-K/S-1) | `sec-edgar` | https://data.sec.gov/submissions/ | User-Agent header | US | 0.72 | ✅ Implemented |
| USPTO PatentsView | `uspto-patents` | https://search.patentsview.org/api/v1/ | None | US | 0.58 | ✅ Implemented |
| SEC EDGAR Form D | `sec-form-d` | https://efts.sec.gov/LATEST/search-index?q=formType:"D"&dateRange=custom | User-Agent | US | 0.68 | 🔧 Configured |
| FINRA TRACE (Bond) | `finra-trace` | https://www.finra.org/finra-data/fixed-income/trace | None | US | 0.70 | 🔧 Configured |
| Companies House | `uk-companies-house` | https://api.company-information.service.gov.uk/ | Free API key | UK | 0.66 | 🔧 Configured |
| EDINET (Japan SEC) | `edinet-filings` | https://api.edinet-fsa.go.jp/api/v2/ | None | JP | 0.70 | 🔧 Configured |
| OpenCorporates | `opencorporates` | https://api.opencorporates.com/ | Free (rate limited) | Global | 0.55 | 📋 Planned |

**Use cases:**
- Detect private placement fundraising (Form D) before product announcements
- Track patent clustering to identify R&D investment direction
- Monitor bond issuances as capex financing signals
- Cross-reference corporate registrations for shell company detection

### Land (Physical Infrastructure)

| Source | ID | API/Feed | Auth | Region | Confidence | Status |
|---|---|---|---|---|---|---|
| County Building Permits | `county-building-permits` | Varies by county | None | US | 0.76 | ✅ Implemented |
| FAA Obstruction Assessment | `faa-oas` | https://oeaaa.faa.gov/ | None | US | 0.74 | ✅ Implemented |
| EPA Facility Registry | `epa-frs` | https://frs-public.epa.gov/ords/frs_public2/ | None | US | 0.68 | 🔧 Configured |
| NEPA Environmental Reviews | `nepa-reviews` | https://cdxapps.epa.gov/cdx-enepa-II/public/action/eis/search | None | US | 0.72 | 🔧 Configured |
| Army Corps Section 404 | `usace-404` | Per district | None | US | 0.74 | 🔧 Configured |
| UK Planning Portal | `uk-planning` | https://www.planningportal.co.uk/ | None | UK | 0.70 | 📋 Planned |

**Use cases:**
- Detect construction permits for data centers, factories, warehouses
- Track FAA obstruction filings (tall structures = wind farms, data centers, cell towers)
- Monitor environmental review status as construction gate signal
- Cross-reference land permits with FERC/PUC filings for corroboration

### Compute (Digital Infrastructure)

| Source | ID | API/Feed | Auth | Region | Confidence | Status |
|---|---|---|---|---|---|---|
| Cloud Region Announcements | `public-cloud-regions` | Provider-specific | None | Global | 0.74 | ✅ Implemented |
| FCC License Search | `fcc-licenses` | https://www.fcc.gov/developers/oet/cf/block-api | None | US | 0.70 | 🔧 Configured |
| Submarine Cable Map | `submarine-cables` | https://www.submarinecablemap.com/api/v3/ | None | Global | 0.62 | 🔧 Configured |
| PeeringDB | `peeringdb` | https://www.peeringdb.com/api/ | Free account | Global | 0.56 | 🔧 Configured |
| Cloudflare Radar | `cloudflare-radar` | https://radar.cloudflare.com/ | API key | Global | 0.52 | 📋 Planned |

**Use cases:**
- Track cloud region expansion as demand signal for power/land/water
- Monitor FCC spectrum licenses for telco infrastructure buildout
- Detect submarine cable landings as international compute routing signal
- Cross-reference peering changes with data center construction

### Water

| Source | ID | API/Feed | Auth | Region | Confidence | Status |
|---|---|---|---|---|---|---|
| Water District Permits | `water-district-permits` | Varies by district | None | US | 0.76 | ✅ Implemented |
| EPA ECHO/NPDES | `epa-echo-npdes` | https://echodata.epa.gov/echo/ | None | US | 0.80 | ✅ Implemented |
| USGS Water Resources | `usgs-water` | https://waterservices.usgs.gov/rest/ | None | US | 0.78 | 🔧 Configured |
| State Water Rights DBs | `state-water-rights` | Varies by state | None | US | 0.74 | 🔧 Configured |
| Global Water Intelligence | `gwi` | https://www.globalwaterintel.com/ | Paid | Global | 0.72 | 📋 Planned |

**Use cases:**
- Track industrial water permit applications as construction lead indicator
- Monitor NPDES discharge permits for facility scale estimation
- Cross-reference water withdrawals with data center/industrial builds
- Detect desalination/reclamation projects for water-stressed regions

### Raw Materials

| Source | ID | API/Feed | Auth | Region | Confidence | Status |
|---|---|---|---|---|---|---|
| USGS Mineral Commodities | `usgs-minerals` | https://www.usgs.gov/centers/national-minerals-information-center | None | US | 0.74 | ✅ Implemented |
| BLM Mining Claims | `blm-mining` | https://reports.blm.gov/reports/LR2000 | None | US | 0.72 | 🔧 Configured |
| BLS Commodity Prices | `bls-commodities` | https://api.bls.gov/publicAPI/v2/timeseries/data/ | Free API key | US | 0.68 | 🔧 Configured |
| USITC Trade Data | `usitc-trade` | https://dataweb.usitc.gov/trade/search | None | US | 0.66 | 🔧 Configured |
| London Metal Exchange | `lme-prices` | https://www.lme.com/en/market-data | None | Global | 0.64 | 📋 Planned |
| S&P Global Platts | `platts` | Paid API | Paid | Global | 0.82 | 📋 Planned |

**Use cases:**
- Track mine production data vs stated reserves for execution verification
- Monitor critical mineral stockpile changes (DLA/strategic reserves)
- Cross-reference commodity prices with capex filings for margin signals
- Detect mining lease applications as exploration-to-production pipeline

### Logistics

| Source | ID | API/Feed | Auth | Region | Confidence | Status |
|---|---|---|---|---|---|---|
| Port Statistics | `port-statistics` | Varies by port | None | US | 0.72 | ✅ Implemented |
| BTS Freight Data | `bts-freight` | https://www.bts.gov/topics/freight-transportation | None | US | 0.70 | 🔧 Configured |
| Army Corps Waterway Stats | `usace-waterway` | https://publibrary.planusace.us/ | None | US | 0.68 | 🔧 Configured |
| AAR Rail Traffic | `aar-rail` | https://www.aar.org/data-research/rail-traffic-data/ | None | US | 0.66 | 🔧 Configured |
| Census Trade (FT-900) | `census-trade` | https://api.census.gov/data/timeseries/intltrade/ | Free API key | US | 0.70 | 🔧 Configured |
| Marine Traffic AIS | `marine-ais` | https://www.marinetraffic.com/en/ais-api-services | Paid | Global | 0.64 | 📋 Planned |
| FlightAware Cargo | `flightaware-cargo` | https://flightaware.com/commercial/aeroapi/ | Paid | Global | 0.60 | 📋 Planned |

**Use cases:**
- Track container throughput as trade demand signal
- Monitor rail traffic for commodity flow patterns
- Detect shipping route changes for supply chain disruption signals
- Cross-reference logistics data with production and capital flow

---

## Narrative Layer Sources

| Source | ID | API/Feed | Auth | Region | Confidence | Status |
|---|---|---|---|---|---|---|
| Narrative RSS | `narrative-rss` | Configured RSS/JSON | None | Global | 0.45 | ✅ Implemented |
| PR Newswire | `pr-newswire` | https://www.prnewswire.com/apidoc/ | API key | Global | 0.40 | 🔧 Configured |
| Business Wire | `business-wire` | https://www.businesswire.com/portal/site/home/ | API key | Global | 0.40 | 🔧 Configured |
| Earnings Transcripts | `earnings-transcripts` | https://www.sec.gov/cgi-bin/browse-edgar?type=8-K&action=getcompany | None | US | 0.42 | 🔧 Configured |
| GDELT Project | `gdelt` | https://api.gdeltproject.org/api/v2/ | None | Global | 0.35 | 🔧 Configured |
| Congressional Hearings | `congress-hearings` | https://api.congress.gov/v3/ | Free API key | US | 0.50 | 🔧 Configured |
| Twitter/X Financial | `twitter-financial` | API access | Paid | Global | 0.25 | 📋 Planned |
| Analyst Consensus | `analyst-consensus` | Various | Paid | Global | 0.38 | 📋 Planned |

**Narrative confidence is always lower** — these sources reflect stated intent, not verified action.

**Use cases:**
- Compare PR timing vs permit filing timing (Reality–Narrative gap)
- Detect contradictions between earnings guidance and actual capital deployment
- Track media coverage timing relative to regulatory filings
- Monitor congressional/regulatory hearings for policy signal

---

## Signal Layer Architecture

```
Substrate Layer (Reality)          Narrative Layer
━━━━━━━━━━━━━━━━━━━━━━━         ━━━━━━━━━━━━━━━━━━━
FERC / EIA / State PUC    ←→    Earnings Transcripts
SEC EDGAR / USPTO          ←→    Press Releases
Building Permits / FAA     ←→    PR Newswire
Cloud Regions / FCC        ←→    GDELT / News RSS
Water / EPA ECHO           ←→    Congressional Hearings
USGS / BLM                 ←→    Analyst Consensus
Port / BTS / Census        ←→    Twitter / Social
       ↓                              ↓
  Capital Fixation Ontology     Narrative Contrast
  (high confidence, sourced)    (low confidence, contrast)
       ↓                              ↓
              Reality–Narrative Gap
              (Odim's core alpha)
```

---

## Implementation Status Legend

- ✅ **Implemented**: Dedicated scraper with parser + fetcher + fixture data + ontologize handler
- 🔧 **Configured**: Entry in `config/sources.json` — works with `configured-json-csv` adapter when feed URL is provided
- 📋 **Planned**: Documented for future implementation — requires paid API or custom integration

---

## Source Tiers

### Free / Public (No Key)
SEC EDGAR, FERC, Building Permits, USGS, Port Statistics, FAA, EPA ECHO, State PUC, PatentsView, PeeringDB, GDELT, Congress API

### Free / API Key Required
EIA, BLS, Census, Companies House, FCC, Congress API (enhanced), Cloudflare Radar

### Paid
Marine Traffic, FlightAware, S&P Platts, Global Water Intelligence, OpenCorporates (bulk), Twitter/X, Analyst data providers

---

## Environment Variables

### Core (Implemented Scrapers)
```
SCRAPE_ENABLED=true
SCRAPE_LIMIT=50
SEC_EDGAR_CIKS=1326801,789019,1018724
SEC_EDGAR_USER_AGENT=OdimBot/1.0 (admin@example.com)
FERC_FEED_URL=https://...
BUILDING_PERMITS_URL=https://...
BUILDING_PERMITS_JURISDICTION=Richland Parish, LA
CLOUD_REGION_FEED_URL=https://...
WATER_DISTRICT_FEED_URL=https://...
WATER_DISTRICT_JURISDICTION=Richland Parish Water District
USGS_MINERALS_FEED_URL=https://...
PORT_STATISTICS_FEED_URL=https://...
NARRATIVE_FEED_URL=https://...
EIA_API_KEY=your_eia_api_key
EIA_FEED_URL=https://api.eia.gov/v2/electricity/...
STATE_PUC_FEED_URL=https://...
USPTO_PATENTS_FEED_URL=https://search.patentsview.org/api/v1/patent/
EPA_ECHO_FEED_URL=https://echodata.epa.gov/echo/...
FAA_OAS_FEED_URL=https://oeaaa.faa.gov/...
```

### Configured Sources (via config/sources.json)
```
ERCOT_QUEUE_URL=https://...
PJM_QUEUE_URL=https://...
BLM_MINING_URL=https://...
BLS_API_KEY=your_bls_key
BLS_COMMODITIES_URL=https://...
CENSUS_TRADE_URL=https://...
```
