import type { MapEntity } from "./types";

export const DEMO_ENTITIES: MapEntity[] = [
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
    id: "e3",
    name: "Laidley LLC / NV Land Acquisition",
    score: 71,
    confidence: 0.72,
    lat: 36.2,
    lng: -115.1,
    layer: "land",
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
    connectionIds: []
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
    id: "e6",
    name: "Saudi Aramco / NEOM Pipeline",
    score: 66,
    confidence: 0.62,
    lat: 27.5,
    lng: 36.5,
    layer: "cash",
    connectionIds: []
  },
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
    id: "e9",
    name: "Rio Tinto / QLD Lithium Mine",
    score: 65,
    confidence: 0.64,
    lat: -20.7,
    lng: 139.5,
    layer: "raw_materials",
    connectionIds: ["c2", "c3"]
  },
  {
    id: "e10",
    name: "TSMC / Kumamoto Fab",
    score: 80,
    confidence: 0.86,
    lat: 32.8,
    lng: 130.7,
    layer: "compute",
    connectionIds: ["c5"]
  }
];
