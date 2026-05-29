export type LayerKey =
  | "energy"
  | "cash"
  | "land"
  | "compute"
  | "water"
  | "raw_materials"
  | "logistics";

export type MapEntity = {
  id: string;
  name: string;
  description?: string;
  score: number;
  confidence: number;
  lat: number;
  lng: number;
  layer: LayerKey;
  connectionIds?: string[];
  observedAt?: string;
};

export type MapConnection = {
  id: string;
  fromId: string;
  toId: string;
  confidence: number;
  active: boolean; // animated dash if true
};

export type MapAlert = {
  id: string;
  lat: number;
  lng: number;
  priority: string;
  title: string;
  entityId: string;
};
