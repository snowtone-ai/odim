import type { MapEntity } from "./types";

export type GeoLevel = "country" | "state" | "county" | "site";

export type GeoNode = {
  level: GeoLevel;
  name: string;
  lat: number;
  lng: number;
  signalCount: number;
  layers: Record<string, number>;
  children: GeoNode[];
  entityId?: string;
  parentPath?: string[];
};

export type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: string;
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
    properties: {
      id: string;
      level: GeoLevel;
      name: string;
      signalCount: number;
      childCount: number;
      entityId: string;
      path: string;
    };
  }>;
};

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function countryForEntity(entity: MapEntity) {
  const { lat, lng } = entity;
  if (lat > 24 && lat < 49 && lng > -125 && lng < -66) return "United States";
  if (lat > 49 && lat < 61 && lng > -8 && lng < 2) return "United Kingdom";
  if (lat > 30 && lat < 46 && lng > 129 && lng < 146) return "Japan";
  if (lat > -39 && lat < -10 && lng > 112 && lng < 154) return "Australia";
  if (lat > -5 && lat < 10 && lng > 95 && lng < 120) return "Southeast Asia";
  if (lat > 35 && lat < 60 && lng > -10 && lng < 35) return "Europe";
  return "Global";
}

function stateForEntity(entity: MapEntity) {
  if (countryForEntity(entity) !== "United States") return countryForEntity(entity);
  if (entity.lng < -112) return "US Pacific";
  if (entity.lng < -96) return "US Mountain";
  if (entity.lng < -84) return "US Central";
  return "US East";
}

function countyForEntity(entity: MapEntity) {
  const latBand = Math.round(entity.lat * 2) / 2;
  const lngBand = Math.round(entity.lng * 2) / 2;
  return `${stateForEntity(entity)} ${latBand}/${lngBand}`;
}

function aggregateLevel(level: GeoLevel, name: string, entities: MapEntity[], parentPath: string[] = []): GeoNode {
  return {
    level,
    name,
    lat: mean(entities.map((entity) => entity.lat)),
    lng: mean(entities.map((entity) => entity.lng)),
    signalCount: entities.length,
    layers: entities.reduce<Record<string, number>>((acc, entity) => {
      acc[entity.layer] = (acc[entity.layer] ?? 0) + 1;
      return acc;
    }, {}),
    children: [],
    parentPath
  };
}

export function aggregateByGeo(entities: MapEntity[]): GeoNode[] {
  const countryGroups = new Map<string, MapEntity[]>();
  for (const entity of entities) {
    const key = countryForEntity(entity);
    const current = countryGroups.get(key) ?? [];
    current.push(entity);
    countryGroups.set(key, current);
  }

  return Array.from(countryGroups.entries()).map(([country, countryEntities]) => {
    const countryNode = aggregateLevel("country", country, countryEntities);
    const stateGroups = new Map<string, MapEntity[]>();
    for (const entity of countryEntities) {
      const key = stateForEntity(entity);
      const current = stateGroups.get(key) ?? [];
      current.push(entity);
      stateGroups.set(key, current);
    }
    countryNode.children = Array.from(stateGroups.entries()).map(([state, stateEntities]) => {
      const stateNode = aggregateLevel("state", state, stateEntities, [country]);
      const countyGroups = new Map<string, MapEntity[]>();
      for (const entity of stateEntities) {
        const key = countyForEntity(entity);
        const current = countyGroups.get(key) ?? [];
        current.push(entity);
        countyGroups.set(key, current);
      }
      stateNode.children = Array.from(countyGroups.entries()).map(([county, countyEntities]) => {
        const countyNode = aggregateLevel("county", county, countyEntities, [country, state]);
        countyNode.children = countyEntities.map((entity) => ({
          level: "site",
          name: entity.name,
          lat: entity.lat,
          lng: entity.lng,
          signalCount: 1,
          layers: { [entity.layer]: 1 },
          children: [],
          entityId: entity.id,
          parentPath: [country, state, county]
        }));
        return countyNode;
      });
      return stateNode;
    });
    return countryNode;
  });
}

export function flattenGeoNodes(nodes: GeoNode[]): GeoNode[] {
  const flat: GeoNode[] = [];
  for (const node of nodes) {
    flat.push(node);
    flat.push(...flattenGeoNodes(node.children));
  }
  return flat;
}

export function levelForZoom(zoom: number): GeoLevel {
  if (zoom < 4.5) return "country";
  if (zoom < 7.5) return "state";
  if (zoom < 10.5) return "county";
  return "site";
}

export function zoomForLevel(level: GeoLevel) {
  switch (level) {
    case "country":
      return 3;
    case "state":
      return 6;
    case "county":
      return 9;
    case "site":
    default:
      return 11.5;
  }
}

export function buildGeoFeatureCollections(nodes: GeoNode[]): Record<GeoLevel, GeoFeatureCollection> {
  const flat = flattenGeoNodes(nodes);
  const build = (level: GeoLevel): GeoFeatureCollection => ({
    type: "FeatureCollection",
    features: flat
      .filter((node) => node.level === level)
      .map((node) => ({
        type: "Feature",
        id: `${node.level}:${[...(node.parentPath ?? []), node.name].join(">")}`,
        geometry: {
          type: "Point",
          coordinates: [node.lng, node.lat]
        },
        properties: {
          id: `${node.level}:${[...(node.parentPath ?? []), node.name].join(">")}`,
          level: node.level,
          name: node.name,
          signalCount: node.signalCount,
          childCount: node.children.length,
          entityId: node.entityId ?? "",
          path: JSON.stringify([...(node.parentPath ?? []), node.name])
        }
      }))
  });
  return {
    country: build("country"),
    state: build("state"),
    county: build("county"),
    site: build("site")
  };
}
