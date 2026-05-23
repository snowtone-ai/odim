export function triangulate(layerCount: number, maxLayers = 7) {
  if (layerCount < 0 || maxLayers <= 0) throw new Error("Invalid triangulation inputs");
  const ratio = Math.min(layerCount, maxLayers) / maxLayers;
  return Math.round((0.25 + ratio * 0.7) * 100) / 100;
}
