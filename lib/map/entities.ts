import type { MapEntity, LayerKey } from "./types";

export const DEMO_ENTITIES: MapEntity[] = [
  // ── Compute (6) ───────────────────────────────────────────────
  {
    id: "e1",
    name: "Microsoft / Iowa Data Center",
    description: "Hyperscale Azure cloud campus — AI training and Midwest regional expansion",
    score: 82,
    confidence: 0.88,
    lat: 41.6,
    lng: -93.6,
    layer: "compute",
    connectionIds: ["c1", "c5"]
  },
  {
    id: "e5",
    name: "Equinix / SG3 Expansion",
    description: "Carrier-neutral colocation expansion serving Southeast Asia cloud demand",
    score: 74,
    confidence: 0.82,
    lat: 1.3,
    lng: 103.8,
    layer: "compute",
    connectionIds: ["c1"]
  },
  {
    id: "e10",
    name: "TSMC / Kumamoto Fab",
    description: "Advanced 12/16nm fab for automotive and IoT chips in southern Japan",
    score: 80,
    confidence: 0.86,
    lat: 32.8,
    lng: 130.7,
    layer: "compute",
    connectionIds: ["c5", "c12"]
  },
  {
    id: "e11",
    name: "Google / Columbus OH DC",
    description: "Hyperscale AI workload data center anchoring Google's Midwest footprint",
    score: 78,
    confidence: 0.84,
    lat: 39.96,
    lng: -82.99,
    layer: "compute",
    connectionIds: []
  },
  {
    id: "e12",
    name: "AWS / Hyderabad Region",
    description: "New AWS availability zone targeting South Asian enterprise cloud demand",
    score: 73,
    confidence: 0.76,
    lat: 17.4,
    lng: 78.5,
    layer: "compute",
    connectionIds: ["c16"]
  },
  {
    id: "e13",
    name: "Meta / Richland Parish DC",
    description: "AI inference and social media compute expansion in northern Louisiana",
    score: 75,
    confidence: 0.80,
    lat: 32.42,
    lng: -91.75,
    layer: "compute",
    connectionIds: ["c9"]
  },

  // ── Energy (7) ────────────────────────────────────────────────
  {
    id: "e2",
    name: "NextEra / TX Solar Farm",
    description: "Utility-scale photovoltaic installation in West Texas, supplying ERCOT grid",
    score: 76,
    confidence: 0.78,
    lat: 31.9,
    lng: -99.9,
    layer: "energy",
    connectionIds: []
  },
  {
    id: "e4",
    name: "Brookfield / UK Wind Farm",
    description: "Onshore wind portfolio across northern England; grid-connected under CfD",
    score: 68,
    confidence: 0.66,
    lat: 53.4,
    lng: -2.2,
    layer: "energy",
    connectionIds: ["c4"]
  },
  {
    id: "e14",
    name: "Vistra / Odessa Solar+Storage",
    description: "Hybrid solar-battery storage project supporting Texas grid resilience",
    score: 72,
    confidence: 0.74,
    lat: 31.8,
    lng: -102.3,
    layer: "energy",
    connectionIds: ["c10"]
  },
  {
    id: "e15",
    name: "Ørsted / Hornsea 4 Offshore Wind",
    description: "2.6 GW offshore wind farm in the North Sea, largest single project in planning",
    score: 77,
    confidence: 0.81,
    lat: 53.9,
    lng: 0.8,
    layer: "energy",
    connectionIds: ["c15"]
  },
  {
    id: "e16",
    name: "EDF / Flamanville EPR",
    description: "Next-generation pressurized water reactor approaching first criticality in France",
    score: 69,
    confidence: 0.68,
    lat: 49.5,
    lng: -1.9,
    layer: "energy",
    connectionIds: ["c15"]
  },
  {
    id: "e17",
    name: "NTPC / Kudgi Thermal",
    description: "Coal-based supercritical thermal plant in Karnataka supporting southern India grid",
    score: 61,
    confidence: 0.56,
    lat: 16.0,
    lng: 76.1,
    layer: "energy",
    connectionIds: []
  },
  {
    id: "e18",
    name: "Enel / Villanueva Solar",
    description: "Utility-scale solar complex in Durango, Mexico; among largest in Latin America",
    score: 70,
    confidence: 0.72,
    lat: 24.6,
    lng: -103.4,
    layer: "energy",
    connectionIds: []
  },

  // ── Cash (6) ──────────────────────────────────────────────────
  {
    id: "e6",
    name: "Saudi Aramco / NEOM Pipeline",
    description: "Sovereign capital deployment into NEOM energy corridor infrastructure",
    score: 66,
    confidence: 0.62,
    lat: 27.5,
    lng: 36.5,
    layer: "cash",
    connectionIds: ["c4"]
  },
  {
    id: "e19",
    name: "SoftBank / Vision Fund III",
    description: "Late-stage AI and robotics venture fund targeting $30B+ deployment",
    score: 74,
    confidence: 0.76,
    lat: 35.7,
    lng: 139.7,
    layer: "cash",
    connectionIds: ["c16"]
  },
  {
    id: "e20",
    name: "Temasek / Infrastructure Fund",
    description: "Singapore state fund allocating to global infrastructure and transition assets",
    score: 71,
    confidence: 0.70,
    lat: 1.3,
    lng: 103.9,
    layer: "cash",
    connectionIds: []
  },
  {
    id: "e21",
    name: "BlackRock / Climate Infrastructure",
    description: "Multi-billion private equity fund targeting renewable energy and climate assets",
    score: 79,
    confidence: 0.85,
    lat: 40.7,
    lng: -74.0,
    layer: "cash",
    connectionIds: ["c10"]
  },
  {
    id: "e22",
    name: "Brookfield / Renewable Partners VI",
    description: "Global renewable energy private equity; hydropower, wind, and solar focus",
    score: 67,
    confidence: 0.64,
    lat: 43.7,
    lng: -79.4,
    layer: "cash",
    connectionIds: []
  },
  {
    id: "e23",
    name: "PIF / NEOM Hydrogen",
    description: "Saudi Public Investment Fund green hydrogen joint venture at NEOM",
    score: 64,
    confidence: 0.60,
    lat: 28.0,
    lng: 35.0,
    layer: "cash",
    connectionIds: []
  },

  // ── Land (5) ──────────────────────────────────────────────────
  {
    id: "e3",
    name: "Laidley LLC / NV Land Acquisition",
    description: "Strategic land banking near Las Vegas for hyperscale data center development",
    score: 71,
    confidence: 0.72,
    lat: 36.2,
    lng: -115.1,
    layer: "land",
    connectionIds: ["c9"]
  },
  {
    id: "e24",
    name: "Prologis / Inland Empire Warehouse",
    description: "Last-mile logistics warehouse in Southern California serving e-commerce demand",
    score: 68,
    confidence: 0.66,
    lat: 34.0,
    lng: -117.3,
    layer: "land",
    connectionIds: []
  },
  {
    id: "e25",
    name: "NEOM / The Line Construction",
    description: "Linear smart city megaproject in Saudi Arabia; 170 km zero-carbon corridor",
    score: 73,
    confidence: 0.70,
    lat: 26.5,
    lng: 36.1,
    layer: "land",
    connectionIds: []
  },
  {
    id: "e26",
    name: "Amazon / VA Data Center Campus",
    description: "Large AWS campus in Northern Virginia anchoring US East Coast cloud operations",
    score: 77,
    confidence: 0.80,
    lat: 39.0,
    lng: -77.5,
    layer: "land",
    connectionIds: []
  },
  {
    id: "e27",
    name: "CK Infrastructure / Sydney Metro West",
    description: "Urban metro rail tunnel PPP; 24 km underground connection in Greater Sydney",
    score: 65,
    confidence: 0.62,
    lat: -33.8,
    lng: 151.1,
    layer: "land",
    connectionIds: []
  },

  // ── Water (4) ─────────────────────────────────────────────────
  {
    id: "e7",
    name: "BHP / Pilbara Water Rights",
    description: "Water allocation secured for iron ore processing in Western Australia's Pilbara",
    score: 63,
    confidence: 0.58,
    lat: -22.3,
    lng: 118.6,
    layer: "water",
    connectionIds: ["c3"]
  },
  {
    id: "e28",
    name: "Posco / Gwangyang Desalination",
    description: "Industrial reverse-osmosis plant providing process water to steel operations",
    score: 60,
    confidence: 0.55,
    lat: 34.9,
    lng: 127.7,
    layer: "water",
    connectionIds: []
  },
  {
    id: "e29",
    name: "Intel / Chandler AZ Water Reclaim",
    description: "Semiconductor fab water recycling and reclamation project in Arizona",
    score: 67,
    confidence: 0.64,
    lat: 33.3,
    lng: -111.8,
    layer: "water",
    connectionIds: ["c12"]
  },
  {
    id: "e30",
    name: "Saudi / Jubail RO Plant",
    description: "Large-scale seawater reverse osmosis plant on the Arabian Gulf coast",
    score: 62,
    confidence: 0.58,
    lat: 27.0,
    lng: 49.7,
    layer: "water",
    connectionIds: []
  },

  // ── Raw Materials (5) ─────────────────────────────────────────
  {
    id: "e9",
    name: "Rio Tinto / QLD Lithium Mine",
    description: "Hard rock spodumene lithium extraction in Queensland for EV battery supply",
    score: 65,
    confidence: 0.64,
    lat: -20.7,
    lng: 139.5,
    layer: "raw_materials",
    connectionIds: ["c2", "c3", "c14"]
  },
  {
    id: "e31",
    name: "Albemarle / Kings Mountain Li",
    description: "Restart of historic lithium mine in North Carolina to diversify US supply",
    score: 69,
    confidence: 0.68,
    lat: 35.2,
    lng: -81.3,
    layer: "raw_materials",
    connectionIds: ["c13"]
  },
  {
    id: "e32",
    name: "BHP / Olympic Dam Copper",
    description: "Polymetallic copper-uranium-gold mine in South Australia; major expansion study",
    score: 72,
    confidence: 0.70,
    lat: -30.4,
    lng: 136.9,
    layer: "raw_materials",
    connectionIds: ["c14"]
  },
  {
    id: "e33",
    name: "Codelco / Chuquicamata",
    description: "World's largest open-pit copper mine in Chile's Atacama; underground transition",
    score: 66,
    confidence: 0.62,
    lat: -22.3,
    lng: -68.9,
    layer: "raw_materials",
    connectionIds: []
  },
  {
    id: "e34",
    name: "CATL / Kibo Nickel",
    description: "Nickel sulfide project in Indonesia securing battery cathode material supply",
    score: 64,
    confidence: 0.60,
    lat: -2.5,
    lng: 121.5,
    layer: "raw_materials",
    connectionIds: ["c13"]
  },

  // ── Logistics (5) ─────────────────────────────────────────────
  {
    id: "e8",
    name: "Maersk / Rotterdam Logistics Hub",
    description: "Integrated container port and inland logistics hub at Europe's largest port",
    score: 70,
    confidence: 0.74,
    lat: 51.9,
    lng: 4.5,
    layer: "logistics",
    connectionIds: ["c2"]
  },
  {
    id: "e35",
    name: "CMA CGM / Port Klang Terminal",
    description: "Deepwater container terminal expansion serving Malaysia and ASEAN trade lanes",
    score: 68,
    confidence: 0.70,
    lat: 3.0,
    lng: 101.4,
    layer: "logistics",
    connectionIds: ["c11"]
  },
  {
    id: "e36",
    name: "DP World / Jebel Ali Expansion",
    description: "Capacity expansion at the world's largest man-made harbor in Dubai",
    score: 72,
    confidence: 0.74,
    lat: 25.0,
    lng: 55.1,
    layer: "logistics",
    connectionIds: ["c11"]
  },
  {
    id: "e37",
    name: "COSCO / Piraeus Gateway",
    description: "Chinese-operated Mediterranean hub port serving Belt and Road trade routes",
    score: 66,
    confidence: 0.64,
    lat: 37.9,
    lng: 23.6,
    layer: "logistics",
    connectionIds: []
  },
  {
    id: "e38",
    name: "FedEx / Memphis SuperHub",
    description: "World's largest air cargo sort facility; global overnight network anchor",
    score: 71,
    confidence: 0.72,
    lat: 35.0,
    lng: -89.9,
    layer: "logistics",
    connectionIds: []
  }
];

export type TimeRange = "7d" | "30d" | "90d" | "1y" | "all";

export type EntityFilterOptions = {
  timeRange: TimeRange;
  minConfidence: number;
};

function timeRangeCutoff(range: TimeRange): number | null {
  const now = Date.now();
  if (range === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (range === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  if (range === "90d") return now - 90 * 24 * 60 * 60 * 1000;
  if (range === "1y") return now - 365 * 24 * 60 * 60 * 1000;
  return null;
}

export function filterEntities(
  entities: MapEntity[],
  options: EntityFilterOptions
): MapEntity[] {
  const cutoff = timeRangeCutoff(options.timeRange);
  const minConf = options.minConfidence / 100;
  return entities.filter((entity) => {
    if (entity.confidence < minConf) return false;
    if (cutoff !== null && entity.observedAt) {
      const t = Date.parse(entity.observedAt);
      if (!Number.isNaN(t) && t < cutoff) return false;
    }
    return true;
  });
}

export function isNewEntity(entity: MapEntity): boolean {
  if (!entity.observedAt) return false;
  const t = Date.parse(entity.observedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= 48 * 60 * 60 * 1000;
}

export { type LayerKey };
