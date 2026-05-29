export type SectorEntity = {
  id: string;
  name: string;
  score: number;
  confidence: number;
  sector?: string;
  scoreHistory?: number[];
};

export type SectorRotation = {
  fromSector: string;
  toSector: string;
  magnitude: number;
  evidence: string[];
  confidence: number;
};

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function stddev(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
}

function inferSector(name: string) {
  const lower = name.toLowerCase();
  if (/(solar|wind|power|nuclear|battery|grid|hydrogen|thermal)/.test(lower)) return "energy";
  if (/(data center|cloud|fab|chip|semiconductor|ai|aws|google|microsoft|meta)/.test(lower)) return "compute";
  if (/(port|terminal|logistics|warehouse|hub|metro|pipeline)/.test(lower)) return "logistics";
  if (/(water|desal|reclaim|rights)/.test(lower)) return "water";
  if (/(mine|lithium|copper|nickel|ore)/.test(lower)) return "raw_materials";
  if (/(fund|capital|partners|vision|infrastructure)/.test(lower)) return "cash";
  if (/(land|campus|construction|acquisition|city)/.test(lower)) return "land";
  return "general";
}

export function detectSectorRotation(entities: SectorEntity[], window = 30): SectorRotation[] {
  const grouped = new Map<string, SectorEntity[]>();
  for (const entity of entities) {
    const sector = entity.sector || inferSector(entity.name);
    const current = grouped.get(sector) ?? [];
    current.push({ ...entity, sector });
    grouped.set(sector, current);
  }

  const metrics = Array.from(grouped.entries()).map(([sector, members]) => {
    const score = mean(members.map((member) => member.score));
    const delta = mean(
      members.map((member) => {
        const history = member.scoreHistory?.slice(-window) ?? [member.score - 4, member.score - 2, member.score];
        return history.at(-1)! - history[0]!;
      })
    );
    return { sector, score, delta, confidence: mean(members.map((member) => member.confidence)) };
  });

  const deltas = metrics.map((metric) => metric.delta);
  const average = mean(deltas);
  const deviation = stddev(deltas) || 1;
  const rising = metrics.filter((metric) => metric.delta > average + deviation).sort((a, b) => b.delta - a.delta);
  const falling = metrics.filter((metric) => metric.delta < average - deviation / 2).sort((a, b) => a.delta - b.delta);

  const rotations: SectorRotation[] = [];
  for (const toSector of rising) {
    for (const fromSector of falling) {
      rotations.push({
        fromSector: fromSector.sector,
        toSector: toSector.sector,
        magnitude: Math.round((toSector.delta - fromSector.delta) * 100) / 100,
        evidence: [
          `${toSector.sector} avg delta ${Math.round(toSector.delta * 100) / 100}`,
          `${fromSector.sector} avg delta ${Math.round(fromSector.delta * 100) / 100}`
        ],
        confidence: Math.round(((toSector.confidence + fromSector.confidence) / 2) * 100) / 100
      });
    }
  }

  return rotations.sort((left, right) => right.magnitude - left.magnitude);
}
