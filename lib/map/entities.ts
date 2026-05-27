import type { MapEntity } from "./types";

export const DEMO_ENTITIES: MapEntity[] = [
  // ── Compute (6) ───────────────────────────────────────────────
  {
    id: "e1",
    name: "Microsoft / Iowa Data Center",
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
    score: 71,
    confidence: 0.72,
    lat: 35.0,
    lng: -89.9,
    layer: "logistics",
    connectionIds: []
  }
];
