import * as pc from "playcanvas";

export const TOWN_ASSET_BASE_URL = "/assets/kenney-fantasy-town";

export const TOWN_ASSET_FILES = {
  bannerGreen: "banner-green.glb",
  bannerRed: "banner-red.glb",
  cart: "cart.glb",
  fence: "fence.glb",
  fenceGate: "fence-gate.glb",
  fountainRound: "fountain-round.glb",
  hedge: "hedge.glb",
  lantern: "lantern.glb",
  rockLarge: "rock-large.glb",
  rockSmall: "rock-small.glb",
  stallGreen: "stall-green.glb",
  stallRed: "stall-red.glb",
  treeCrooked: "tree-crooked.glb",
  treeHighRound: "tree-high-round.glb",
} as const;

export type TownAssetId = keyof typeof TOWN_ASSET_FILES;
export type TownFallbackFamily = "market-stalls" | "lamp-posts" | "trees" | "rocks";

export interface TownAssetPlacement {
  id: TownAssetId;
  name: string;
  position: readonly [number, number, number];
  yaw?: number;
  scale?: number;
}

export const SPEED_LAB_TOWN_ASSETS: readonly TownAssetPlacement[] = [
  { id: "stallGreen", name: "north-market", position: [98.15, 8.15, 98.2], yaw: 90, scale: 2.05 },
  { id: "stallRed", name: "south-market", position: [98.15, 8.15, 113.8], yaw: 90, scale: 2.05 },
  { id: "cart", name: "inn-supply-cart", position: [96.1, 8.15, 101.2], yaw: -18, scale: 1.65 },
  { id: "cart", name: "smithy-supply-cart", position: [96.2, 8.15, 110.85], yaw: 198, scale: 1.55 },
  { id: "lantern", name: "plaza-lamp-northwest", position: [96.4, 8.15, 102.8], scale: 1.12 },
  { id: "lantern", name: "plaza-lamp-southwest", position: [96.4, 8.15, 109.2], scale: 1.12 },
  { id: "lantern", name: "plaza-lamp-northeast", position: [100, 8.15, 103.1], scale: 1.12 },
  { id: "lantern", name: "plaza-lamp-southeast", position: [100, 8.15, 108.9], scale: 1.12 },
  { id: "lantern", name: "west-square-lamp-north", position: [85.2, 8.15, 102.2], scale: 1.12 },
  { id: "lantern", name: "west-square-lamp-south", position: [85.2, 8.15, 109.8], scale: 1.12 },
  { id: "fountainRound", name: "founders-fountain", position: [87.2, 8.15, 106], scale: 1.45 },
  { id: "treeCrooked", name: "inn-tree", position: [91, 8.15, 93], yaw: 22, scale: 1.45 },
  { id: "treeHighRound", name: "north-road-tree", position: [102, 8.15, 93], yaw: -14, scale: 1.35 },
  { id: "treeCrooked", name: "east-road-tree", position: [114, 8.15, 92], yaw: 104, scale: 1.38 },
  { id: "treeHighRound", name: "smithy-tree", position: [96, 8.15, 120], yaw: 38, scale: 1.32 },
  { id: "treeCrooked", name: "south-road-tree", position: [112, 8.15, 120], yaw: -72, scale: 1.42 },
  { id: "treeHighRound", name: "weavers-tree", position: [76.8, 8.15, 90], yaw: 18, scale: 1.38 },
  { id: "treeCrooked", name: "healers-tree", position: [76.7, 8.15, 105.5], yaw: 84, scale: 1.46 },
  { id: "treeHighRound", name: "lodge-tree", position: [76.8, 8.15, 122], yaw: -36, scale: 1.34 },
  { id: "treeCrooked", name: "northwest-grove", position: [84.5, 8.15, 87.5], yaw: 142, scale: 1.36 },
  { id: "treeHighRound", name: "southwest-grove", position: [86, 8.15, 124.4], yaw: -92, scale: 1.4 },
  { id: "rockLarge", name: "north-gate-rock", position: [104, 8.15, 96], yaw: 18, scale: .86 },
  { id: "rockSmall", name: "east-road-rock", position: [123, 8.15, 97], yaw: -28, scale: .76 },
  { id: "rockLarge", name: "south-gate-rock", position: [124, 8.15, 114], yaw: 56, scale: .8 },
  { id: "rockSmall", name: "south-road-rock", position: [108, 8.15, 116], yaw: 15, scale: .68 },
  { id: "hedge", name: "inn-hedge", position: [97.2, 8.15, 93.1], yaw: 90, scale: 3.1 },
  { id: "hedge", name: "smithy-hedge", position: [97.2, 8.15, 118.9], yaw: 90, scale: 3.1 },
  { id: "fence", name: "west-fence-north-1", position: [76.2, 8.15, 94], scale: 2.2 },
  { id: "fence", name: "west-fence-north-2", position: [76.2, 8.15, 97.8], scale: 2.2 },
  { id: "fenceGate", name: "west-fence-gate", position: [76.2, 8.15, 101.7], scale: 2.2 },
  { id: "fence", name: "west-fence-south-1", position: [76.2, 8.15, 114.2], scale: 2.2 },
  { id: "fence", name: "west-fence-south-2", position: [76.2, 8.15, 118], scale: 2.2 },
  { id: "bannerGreen", name: "founders-banner", position: [94.33, 9.65, 106], yaw: 180, scale: 1.5 },
  { id: "bannerRed", name: "smithy-banner", position: [95.4, 9.15, 116.9], yaw: 90, scale: 1.35 },
] as const;

const FALLBACK_REQUIREMENTS: Readonly<Record<TownFallbackFamily, readonly TownAssetId[]>> = {
  "market-stalls": ["stallGreen", "stallRed"],
  "lamp-posts": ["lantern"],
  trees: ["treeCrooked", "treeHighRound"],
  rocks: ["rockLarge", "rockSmall"],
};

export function townAssetUrl(id: TownAssetId): string {
  return `${TOWN_ASSET_BASE_URL}/${TOWN_ASSET_FILES[id]}`;
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
  for (const placement of placements) {
    const asset = loaded.get(placement.id);
    const resource = asset?.resource as pc.ContainerResource | undefined;
    if (!resource) continue;
    const entity = resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
    entity.name = `town-asset:${placement.name}`;
    entity.setLocalPosition(...placement.position);
    entity.setLocalEulerAngles(0, placement.yaw ?? 0, 0);
    const scale = placement.scale ?? 1;
    entity.setLocalScale(scale, scale, scale);
    parent.addChild(entity);
    entities.push(entity);
  }

  return { loadedIds: new Set(loaded.keys()), failedIds, entities };
}
