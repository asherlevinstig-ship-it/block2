import * as pc from "playcanvas";

export const QUATERNIUS_TOWN_ASSET_BASE_URL = "/assets/quaternius-medieval-village";
export const KENNEY_TOWN_ASSET_BASE_URL = "/assets/kenney-fantasy-town";

/** Complete Quaternius buildings form the town silhouette. Kenney is retained
 * only for lightweight nature and lantern pieces that visually support the
 * village without mixing architectural styles. */
export const TOWN_ASSET_FILES = {
  foundersBellTower: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/bell-tower.glb`,
  wayfarerInn: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/fantasy-inn.glb`,
  beginningsSmithy: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/blacksmith.glb`,
  weaversHouse: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/weavers-house.glb`,
  healersHouse: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/healers-house.glb`,
  wardensBarracks: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/wardens-barracks.glb`,
  marketStandA: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/market-stand-a.glb`,
  marketStandB: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/market-stand-b.glb`,
  well: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/well.glb`,
  gazebo: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/gazebo.glb`,
  cart: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/cart.glb`,
  bench: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/bench.glb`,
  barrel: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/barrel.glb`,
  crate: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/crate.glb`,
  hay: `${QUATERNIUS_TOWN_ASSET_BASE_URL}/hay.glb`,
  lantern: `${KENNEY_TOWN_ASSET_BASE_URL}/lantern.glb`,
  hedge: `${KENNEY_TOWN_ASSET_BASE_URL}/hedge.glb`,
  fence: `${KENNEY_TOWN_ASSET_BASE_URL}/fence.glb`,
  treeCrooked: `${KENNEY_TOWN_ASSET_BASE_URL}/tree-crooked.glb`,
  treeHighRound: `${KENNEY_TOWN_ASSET_BASE_URL}/tree-high-round.glb`,
  rockLarge: `${KENNEY_TOWN_ASSET_BASE_URL}/rock-large.glb`,
  rockSmall: `${KENNEY_TOWN_ASSET_BASE_URL}/rock-small.glb`,
} as const;

export type TownAssetId = keyof typeof TOWN_ASSET_FILES;
export type TownFallbackFamily = "complete-buildings" | "market-stalls" | "street-props" | "lamp-posts" | "trees" | "rocks";

export interface TownAssetPlacement {
  id: TownAssetId;
  name: string;
  position: readonly [number, number, number];
  yaw?: number;
  scale?: number;
}

/** The authored buildings sit exactly over the server-owned collision
 * footprints. Keeping the square's middle open produces a readable civic
 * centre and gives the spawn camera a clear landmark view. */
const TOWN_BUILDINGS: readonly TownAssetPlacement[] = [
  { id: "foundersBellTower", name: "founders-hall", position: [46.5, 8.15, 73], yaw: 90, scale: 2.8 },
  { id: "wayfarerInn", name: "wayfarer-inn", position: [74.5, 8.15, 76], yaw: 0, scale: 1.55 },
  { id: "beginningsSmithy", name: "beginnings-smithy", position: [74.5, 8.15, 136.5], yaw: 180, scale: 1.65 },
  { id: "weaversHouse", name: "weavers-row", position: [46.5, 8.15, 93.5], yaw: 90, scale: 3 },
  { id: "healersHouse", name: "healers-house", position: [46.5, 8.15, 108.5], yaw: 90, scale: 2.05 },
  { id: "wardensBarracks", name: "wardens-lodge", position: [46.5, 8.15, 130], yaw: 90, scale: 2.9 },
] as const;

const TOWN_DECORATIONS: readonly TownAssetPlacement[] = [
  // A calm, generous centre with a well, pavilion and seating instead of more buildings.
  { id: "well", name: "founders-well", position: [67, 8.15, 106], yaw: 10, scale: 3.6 },
  { id: "gazebo", name: "calling-pavilion", position: [57, 8.15, 106], yaw: 45, scale: 4 },
  { id: "bench", name: "square-bench-northwest", position: [62, 8.15, 98.5], yaw: 0, scale: 4 },
  { id: "bench", name: "square-bench-southwest", position: [62, 8.15, 113.5], yaw: 180, scale: 4 },
  { id: "bench", name: "square-bench-northeast", position: [72, 8.15, 98.5], yaw: 0, scale: 4 },
  { id: "bench", name: "square-bench-southeast", position: [72, 8.15, 113.5], yaw: 180, scale: 4 },

  // Complete market and transport models make the approaches feel inhabited.
  { id: "marketStandA", name: "north-market", position: [86, 8.15, 92], yaw: 90, scale: 3.4 },
  { id: "marketStandB", name: "south-market", position: [86, 8.15, 120], yaw: 90, scale: 3.4 },
  { id: "cart", name: "inn-supply-cart", position: [82, 8.15, 84], yaw: -18, scale: 3.1 },
  { id: "cart", name: "smithy-supply-cart", position: [82, 8.15, 128], yaw: 198, scale: 3.1 },
  { id: "hay", name: "inn-hay", position: [79.5, 8.15, 82], yaw: 18, scale: 3.2 },
  { id: "hay", name: "smithy-hay", position: [79.5, 8.15, 130], yaw: -24, scale: 3.2 },
  { id: "barrel", name: "inn-barrel", position: [78.5, 8.15, 80.8], yaw: 12, scale: 3.2 },
  { id: "barrel", name: "smithy-barrel", position: [78.5, 8.15, 131.2], yaw: -8, scale: 3.2 },
  { id: "crate", name: "inn-crate", position: [80.1, 8.15, 81], yaw: -12, scale: 3.1 },
  { id: "crate", name: "smithy-crate", position: [80.1, 8.15, 131], yaw: 11, scale: 3.1 },

  // Lightweight foliage remains at the perimeter, away from the civic sightline.
  { id: "lantern", name: "plaza-lamp-northwest", position: [58, 8.15, 96], scale: 1.25 },
  { id: "lantern", name: "plaza-lamp-southwest", position: [58, 8.15, 116], scale: 1.25 },
  { id: "lantern", name: "plaza-lamp-northeast", position: [76, 8.15, 96], scale: 1.25 },
  { id: "lantern", name: "plaza-lamp-southeast", position: [76, 8.15, 116], scale: 1.25 },
  // Low hedges and short fences turn otherwise exposed building edges into small gardens.
  { id: "hedge", name: "weavers-garden-hedge", position: [55.5, 8.15, 86.9], yaw: 0, scale: 1.35 },
  { id: "hedge", name: "healers-garden-hedge", position: [55.5, 8.15, 117], yaw: 0, scale: 1.45 },
  { id: "hedge", name: "inn-garden-hedge", position: [82, 8.15, 68.9], yaw: 0, scale: 1.25 },
  { id: "fence", name: "weavers-garden-fence-west", position: [51.8, 8.15, 88.5], yaw: 90, scale: 1.25 },
  { id: "fence", name: "healers-garden-fence-west", position: [51.5, 8.15, 115], yaw: 90, scale: 1.25 },
  { id: "fence", name: "inn-garden-fence-east", position: [85.2, 8.15, 70.7], yaw: 90, scale: 1.2 },
  { id: "treeCrooked", name: "inn-tree", position: [83, 8.15, 71], yaw: 22, scale: 1.55 },
  { id: "treeHighRound", name: "north-road-tree", position: [98, 8.15, 75], yaw: -14, scale: 1.45 },
  { id: "treeCrooked", name: "east-road-tree", position: [114, 8.15, 92], yaw: 104, scale: 1.38 },
  { id: "treeHighRound", name: "smithy-tree", position: [83, 8.15, 141], yaw: 38, scale: 1.5 },
  { id: "treeCrooked", name: "south-road-tree", position: [110, 8.15, 138], yaw: -72, scale: 1.5 },
  { id: "treeHighRound", name: "weavers-tree", position: [41.5, 8.15, 88], yaw: 18, scale: 1.48 },
  { id: "treeCrooked", name: "healers-tree", position: [41.5, 8.15, 116], yaw: 84, scale: 1.56 },
  { id: "treeHighRound", name: "lodge-tree", position: [41.5, 8.15, 140], yaw: -36, scale: 1.48 },
  { id: "rockLarge", name: "north-gate-rock", position: [104, 8.15, 96], yaw: 18, scale: .86 },
  { id: "rockSmall", name: "east-road-rock", position: [123, 8.15, 97], yaw: -28, scale: .76 },
  { id: "rockLarge", name: "south-gate-rock", position: [124, 8.15, 114], yaw: 56, scale: .8 },
  { id: "rockSmall", name: "south-road-rock", position: [108, 8.15, 116], yaw: 15, scale: .68 },
] as const;

export const SPEED_LAB_TOWN_ASSETS: readonly TownAssetPlacement[] = [
  ...TOWN_BUILDINGS,
  ...TOWN_DECORATIONS,
] as const;

const FALLBACK_REQUIREMENTS: Readonly<Record<TownFallbackFamily, readonly TownAssetId[]>> = {
  "complete-buildings": ["foundersBellTower", "wayfarerInn", "beginningsSmithy", "weaversHouse", "healersHouse", "wardensBarracks"],
  "market-stalls": ["marketStandA", "marketStandB"],
  "street-props": ["bench", "barrel", "crate"],
  "lamp-posts": ["lantern"],
  trees: ["treeCrooked", "treeHighRound"],
  rocks: ["rockLarge", "rockSmall"],
};

export function townAssetUrl(id: TownAssetId): string {
  return TOWN_ASSET_FILES[id];
}

export function readyTownFallbacks(loadedIds: ReadonlySet<TownAssetId>): TownFallbackFamily[] {
  return (Object.entries(FALLBACK_REQUIREMENTS) as [TownFallbackFamily, readonly TownAssetId[]][])
    .filter(([, ids]) => ids.every(id => loadedIds.has(id)))
    .map(([family]) => family);
}

function loadTownAsset(app: pc.Application, id: TownAssetId): Promise<pc.Asset> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(townAssetUrl(id), "container", (error, asset) => {
      if (error || !asset) reject(error ?? new Error(`Town asset ${id} did not return an asset.`));
      else resolve(asset);
    });
  });
}

export interface TownAssetLoadResult {
  loadedIds: ReadonlySet<TownAssetId>;
  failedIds: ReadonlySet<TownAssetId>;
  entities: readonly pc.Entity[];
}

export async function populateTownAssetKit(
  app: pc.Application,
  parent: pc.Entity,
  placements: readonly TownAssetPlacement[],
  namePrefix = "town-asset",
): Promise<TownAssetLoadResult> {
  const ids = [...new Set(placements.map(placement => placement.id))];
  const loaded = new Map<TownAssetId, pc.Asset>();
  const failedIds = new Set<TownAssetId>();

  await Promise.all(ids.map(async id => {
    try {
      loaded.set(id, await loadTownAsset(app, id));
    } catch (error) {
      failedIds.add(id);
      console.warn(`[town-assets] Keeping fallback for ${id}.`, error);
    }
  }));

  const entities: pc.Entity[] = [];
  for (let index = 0; index < placements.length; index++) {
    const placement = placements[index]!;
    const asset = loaded.get(placement.id);
    const resource = asset?.resource as pc.ContainerResource | undefined;
    if (!resource) continue;
    const entity = resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
    entity.name = `${namePrefix}:${placement.name}`;
    entity.setLocalPosition(...placement.position);
    entity.setLocalEulerAngles(0, placement.yaw ?? 0, 0);
    const scale = placement.scale ?? 1;
    entity.setLocalScale(scale, scale, scale);
    parent.addChild(entity);
    entities.push(entity);
    if (index > 0 && index % 16 === 0) await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  }

  return { loadedIds: new Set(loaded.keys()), failedIds, entities };
}
