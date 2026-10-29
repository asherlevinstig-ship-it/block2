export type TownTerrainMaterial = "road-edge" | "road" | "plaza-edge" | "plaza" | "forecourt" | "garden";
export type TownTerrainShape = "box" | "cylinder";

export interface TownTerrainPatch {
  id: string;
  shape: TownTerrainShape;
  material: TownTerrainMaterial;
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  yaw?: number;
}

export interface TownTerrainDetail {
  id: string;
  kind: "edge-stone" | "grass" | "flower-red" | "flower-yellow" | "flower-blue";
  position: readonly [number, number, number];
  scale: number;
  yaw: number;
}

/**
 * The speed-lab town used to be one 60 x 70 metre stone rectangle. These
 * overlapping authored paths leave grass between neighbourhoods and make the
 * imported buildings feel attached to a real street plan. Heights are kept
 * below the decorative assets and do not participate in server collision.
 */
export const SPEED_LAB_TOWN_TERRAIN: readonly TownTerrainPatch[] = [
  // Connected civic terraces: keep paving narrow enough to retain planted
  // verges and wide enough for groups to pass each other.
  { id: "founders-landing", shape: "box", material: "plaza", position: [51.5, 8.06, 73], scale: [3, .04, 10] },
  { id: "founders-broad-approach", shape: "box", material: "plaza", position: [58.5, 8.06, 73], scale: [13, .04, 8.6] },
  { id: "north-market-court", shape: "box", material: "plaza", position: [89, 8.06, 92.5], scale: [12, .04, 12] },
  { id: "south-market-court", shape: "box", material: "plaza", position: [89, 8.06, 120], scale: [12, .04, 12] },
  { id: "north-market-approach", shape: "box", material: "forecourt", position: [81, 8.07, 92.5], scale: [12, .04, 5.7] },
  { id: "south-market-approach", shape: "box", material: "forecourt", position: [81, 8.07, 120], scale: [12, .04, 5.7] },
  { id: "force-field-promenade-road", shape: "box", material: "forecourt", position: [103, 8.07, 106], scale: [4, .04, 46] },
  { id: "north-promenade-road", shape: "box", material: "forecourt", position: [97, 8.07, 92.5], scale: [14, .04, 3.8] },
  { id: "south-promenade-road", shape: "box", material: "forecourt", position: [97, 8.07, 120], scale: [14, .04, 3.8] },
  // A circular civic square gives the well and pavilion a deliberate home.
  { id: "civic-square-border", shape: "cylinder", material: "plaza-edge", position: [67, 8.052, 106], scale: [15.4, .052, 15.4] },
  { id: "civic-square", shape: "cylinder", material: "plaza", position: [67, 8.082, 106], scale: [14.65, .055, 14.65] },

  // Road hierarchy: the east gate road is broad, secondary streets are calm.
  { id: "east-gate-road-edge", shape: "box", material: "road-edge", position: [87, 8.047, 106], scale: [38, .05, 7.2] },
  { id: "east-gate-road", shape: "box", material: "road", position: [87, 8.078, 106], scale: [38, .055, 6.25] },
  { id: "high-street-edge", shape: "box", material: "road-edge", position: [67, 8.046, 106], scale: [7.2, .05, 74] },
  { id: "high-street", shape: "box", material: "road", position: [67, 8.077, 106], scale: [6.15, .055, 73.2] },
  { id: "north-cross-street-edge", shape: "box", material: "road-edge", position: [72, 8.047, 82], scale: [61, .05, 5.7] },
  { id: "north-cross-street", shape: "box", material: "road", position: [72, 8.078, 82], scale: [60.2, .055, 4.75] },
  { id: "south-cross-street-edge", shape: "box", material: "road-edge", position: [72, 8.047, 130], scale: [61, .05, 5.7] },
  { id: "south-cross-street", shape: "box", material: "road", position: [72, 8.078, 130], scale: [60.2, .055, 4.75] },

  // Short approaches make every important doorway visibly join the street.
  { id: "founders-approach", shape: "box", material: "forecourt", position: [57.5, 8.09, 73], scale: [13.5, .045, 3.6] },
  { id: "inn-forecourt", shape: "box", material: "forecourt", position: [79, 8.09, 78.7], scale: [8, .045, 3.1], yaw: -4 },
  { id: "weavers-approach", shape: "box", material: "forecourt", position: [58.5, 8.09, 93.5], scale: [15.5, .045, 3.25] },
  { id: "healers-approach", shape: "box", material: "forecourt", position: [58.5, 8.09, 108.5], scale: [15.5, .045, 3.25] },
  { id: "barracks-approach", shape: "box", material: "forecourt", position: [58, 8.09, 130], scale: [14, .045, 3.4] },
  { id: "smithy-forecourt", shape: "box", material: "forecourt", position: [79, 8.09, 133.7], scale: [8.5, .045, 3.2], yaw: 4 },

  // Small cultivated beds create soft transitions beside civic services.
  { id: "weavers-dye-garden", shape: "box", material: "garden", position: [55.5, 8.075, 88.5], scale: [7.5, .04, 3.2], yaw: 3 },
  { id: "healers-herb-garden", shape: "box", material: "garden", position: [55.5, 8.075, 115], scale: [8, .04, 3.5], yaw: -3 },
  { id: "inn-kitchen-garden", shape: "box", material: "garden", position: [82, 8.075, 70.7], scale: [6.5, .04, 3.4], yaw: 5 },
] as const;

const detail = (
  id: string,
  kind: TownTerrainDetail["kind"],
  x: number,
  z: number,
  scale: number,
  yaw: number,
): TownTerrainDetail => ({ id, kind, position: [x, 8.145, z], scale, yaw });

const plazaEdgeStones: TownTerrainDetail[] = Array.from({ length: 18 }, (_, index) => {
  const angle = index / 18 * Math.PI * 2;
  const radius = 15.05 + Math.sin(index * 2.4) * .18;
  return detail(`plaza-edge-${index}`, "edge-stone", 67 + Math.cos(angle) * radius,
    106 + Math.sin(angle) * radius, .62 + index % 3 * .08, -angle * 180 / Math.PI);
});

const roadEdgeStones: TownTerrainDetail[] = [
  [84, 102.55], [91, 109.45], [99, 102.55], [107, 109.45], [116, 102.55], [125, 109.45], [133, 102.55],
  [63.55, 71], [70.45, 76], [63.55, 87], [70.45, 94], [63.55, 119], [70.45, 126], [63.55, 137], [70.45, 141],
  [43, 79.35], [50, 84.65], [87, 79.35], [96, 84.65],
  [43, 127.35], [51, 132.65], [88, 127.35], [97, 132.65],
].map(([x, z], index) => detail(`road-edge-${index}`, "edge-stone", x!, z!, .55 + index % 3 * .09, index * 29 % 90));

const plantedDetails: TownTerrainDetail[] = [
  ["grass", 51.8, 87.7], ["flower-blue", 53.4, 88.2], ["flower-red", 55.1, 88.7], ["flower-yellow", 57, 88.25], ["grass", 59.1, 89.2],
  ["flower-blue", 52.1, 114.6], ["grass", 53.5, 115.3], ["flower-yellow", 55.1, 114.7], ["flower-red", 56.8, 115.3], ["grass", 58.7, 114.6],
  ["grass", 79.6, 70.4], ["flower-yellow", 81, 71], ["flower-red", 82.5, 70.4], ["grass", 84, 71.1],
  ["grass", 43.5, 86], ["grass", 43, 119], ["flower-yellow", 47, 119], ["grass", 77.5, 89], ["grass", 78, 123],
  ["flower-red", 83, 143], ["grass", 87, 139.5], ["grass", 94, 91], ["flower-blue", 95, 121], ["grass", 112, 99],
].map(([kind, x, z], index) => detail(`plant-${index}`, kind as TownTerrainDetail["kind"], x as number, z as number,
  .7 + index % 4 * .08, index * 47 % 180));

export const SPEED_LAB_TOWN_TERRAIN_DETAILS: readonly TownTerrainDetail[] = [
  ...plazaEdgeStones,
  ...roadEdgeStones,
  ...plantedDetails,
] as const;

