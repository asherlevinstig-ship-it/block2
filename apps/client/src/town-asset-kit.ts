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
  chimney: "chimney.glb",
  overhang: "overhang.glb",
  pillarStone: "pillar-stone.glb",
  roof: "roof.glb",
  roofGableEnd: "roof-gable-end.glb",
  roofHigh: "roof-high.glb",
  stairsWideStone: "stairs-wide-stone.glb",
  wallWood: "wall-wood.glb",
  wallWoodCorner: "wall-wood-corner.glb",
  wallWoodDoor: "wall-wood-door.glb",
  wallWoodWindow: "wall-wood-window-shutters.glb",
  rockLarge: "rock-large.glb",
  rockSmall: "rock-small.glb",
  stallGreen: "stall-green.glb",
  stallRed: "stall-red.glb",
  treeCrooked: "tree-crooked.glb",
  treeHighRound: "tree-high-round.glb",
} as const;

export type TownAssetId = keyof typeof TOWN_ASSET_FILES;
export type TownFallbackFamily = "modular-buildings" | "market-stalls" | "lamp-posts" | "trees" | "rocks";

export interface TownAssetPlacement {
  id: TownAssetId;
  name: string;
  position: readonly [number, number, number];
  yaw?: number;
  scale?: number;
}

const TOWN_DECORATIONS: readonly TownAssetPlacement[] = [
  { id: "stallGreen", name: "north-market", position: [88, 8.15, 91], yaw: 90, scale: 2.2 },
  { id: "stallRed", name: "south-market", position: [88, 8.15, 121], yaw: 90, scale: 2.2 },
  { id: "cart", name: "inn-supply-cart", position: [82, 8.15, 84], yaw: -18, scale: 1.8 },
  { id: "cart", name: "smithy-supply-cart", position: [82, 8.15, 128], yaw: 198, scale: 1.75 },
  { id: "lantern", name: "plaza-lamp-northwest", position: [62, 8.15, 90], scale: 1.25 },
  { id: "lantern", name: "plaza-lamp-southwest", position: [62, 8.15, 122], scale: 1.25 },
  { id: "lantern", name: "plaza-lamp-northeast", position: [94, 8.15, 90], scale: 1.25 },
  { id: "lantern", name: "plaza-lamp-southeast", position: [94, 8.15, 122], scale: 1.25 },
  { id: "lantern", name: "west-square-lamp-north", position: [54, 8.15, 96], scale: 1.2 },
  { id: "lantern", name: "west-square-lamp-south", position: [54, 8.15, 116], scale: 1.2 },
  { id: "fountainRound", name: "founders-fountain", position: [76, 8.15, 106], scale: 2.15 },
  { id: "treeCrooked", name: "inn-tree", position: [83, 8.15, 71], yaw: 22, scale: 1.55 },
  { id: "treeHighRound", name: "north-road-tree", position: [98, 8.15, 75], yaw: -14, scale: 1.45 },
  { id: "treeCrooked", name: "east-road-tree", position: [114, 8.15, 92], yaw: 104, scale: 1.38 },
  { id: "treeHighRound", name: "smithy-tree", position: [83, 8.15, 141], yaw: 38, scale: 1.5 },
  { id: "treeCrooked", name: "south-road-tree", position: [110, 8.15, 138], yaw: -72, scale: 1.5 },
  { id: "treeHighRound", name: "weavers-tree", position: [41.5, 8.15, 88], yaw: 18, scale: 1.48 },
  { id: "treeCrooked", name: "healers-tree", position: [41.5, 8.15, 106], yaw: 84, scale: 1.56 },
  { id: "treeHighRound", name: "lodge-tree", position: [41.5, 8.15, 137], yaw: -36, scale: 1.48 },
  { id: "treeCrooked", name: "northwest-grove", position: [55, 8.15, 70], yaw: 142, scale: 1.5 },
  { id: "treeHighRound", name: "southwest-grove", position: [58, 8.15, 142], yaw: -92, scale: 1.55 },
  { id: "rockLarge", name: "north-gate-rock", position: [104, 8.15, 96], yaw: 18, scale: .86 },
  { id: "rockSmall", name: "east-road-rock", position: [123, 8.15, 97], yaw: -28, scale: .76 },
  { id: "rockLarge", name: "south-gate-rock", position: [124, 8.15, 114], yaw: 56, scale: .8 },
  { id: "rockSmall", name: "south-road-rock", position: [108, 8.15, 116], yaw: 15, scale: .68 },
  { id: "hedge", name: "inn-hedge", position: [83, 8.15, 82], yaw: 90, scale: 3.6 },
  { id: "hedge", name: "smithy-hedge", position: [83, 8.15, 130], yaw: 90, scale: 3.6 },
  { id: "fence", name: "west-fence-north-1", position: [41.5, 8.15, 78], scale: 2.5 },
  { id: "fence", name: "west-fence-north-2", position: [41.5, 8.15, 83], scale: 2.5 },
  { id: "fenceGate", name: "west-fence-gate", position: [41.5, 8.15, 101], scale: 2.5 },
  { id: "fence", name: "west-fence-south-1", position: [41.5, 8.15, 129], scale: 2.5 },
  { id: "fence", name: "west-fence-south-2", position: [41.5, 8.15, 134], scale: 2.5 },
  { id: "bannerGreen", name: "founders-banner", position: [50, 9.65, 73], yaw: 180, scale: 1.65 },
  { id: "bannerRed", name: "smithy-banner", position: [79, 9.15, 137], yaw: 90, scale: 1.5 },
] as const;

type ModularBuildingSpec = {
  name: string;
  x: number;
  z: number;
  scale?: number;
  floors?: number;
  redRoof?: boolean;
  chimney?: boolean;
};

/** Build complete houses from Kenney's authored wall, window, door, roof and
 * stone modules. The original pilot only imported small props; these shells
 * make the asset kit define the town's dominant silhouette as well. */
function modularBuilding(spec: ModularBuildingSpec): TownAssetPlacement[] {
  const scale = spec.scale ?? 2;
  const floors = spec.floors ?? 2;
  const half = scale * 1.5;
  const wallOffset = half - scale * .4;
  const placements: TownAssetPlacement[] = [];
  const add = (id: TownAssetId, part: string, position: readonly [number, number, number], yaw = 0,
    partScale = scale): void => {
    placements.push({ id, name: `${spec.name}-${part}`, position, yaw, scale: partScale });
  };

  for (let floor = 0; floor < floors; floor++) {
    const y = 8.15 + floor * scale;
    for (let index = 0; index < 3; index++) {
      const offset = (index - 1) * scale;
      const front = floor === 0 && index === 1 ? "wallWoodDoor" : "wallWoodWindow";
      add(front, `east-${floor}-${index}`, [spec.x + wallOffset, y, spec.z + offset]);
      add("wallWoodWindow", `west-${floor}-${index}`, [spec.x - wallOffset, y, spec.z - offset], 180);
      add("wallWoodWindow", `north-${floor}-${index}`, [spec.x + offset, y, spec.z - wallOffset], 90);
      add("wallWoodWindow", `south-${floor}-${index}`, [spec.x - offset, y, spec.z + wallOffset], -90);
    }
  }

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add("wallWoodCorner", `corner-${sx}-${sz}`, [spec.x + sx * wallOffset, 8.15, spec.z + sz * wallOffset],
      sx < 0 ? 180 : 0, scale);
  }

  const roofId: TownAssetId = spec.redRoof ? "roofHigh" : "roof";
  const roofY = 8.15 + floors * scale;
  for (const zOffset of [-scale * .75, scale * .75]) {
    add(roofId, `roof-east-${zOffset}`, [spec.x + scale * .74, roofY, spec.z + zOffset], 0, scale * 1.5);
    add(roofId, `roof-west-${zOffset}`, [spec.x - scale * .74, roofY, spec.z - zOffset], 180, scale * 1.5);
  }
  add("roofGableEnd", "gable-north", [spec.x, roofY, spec.z - half], 90, scale * 1.5);
  add("roofGableEnd", "gable-south", [spec.x, roofY, spec.z + half], -90, scale * 1.5);
  add("stairsWideStone", "front-steps", [spec.x + half + scale * .05, 8.15, spec.z], 90, scale * 1.25);
  add("overhang", "door-awning", [spec.x + half + scale * .04, 9.65, spec.z], 90, scale * 1.15);
  if (spec.chimney) add("chimney", "chimney", [spec.x - scale * .65, roofY + scale * .25, spec.z - scale * .55], 0, scale * 1.15);
  return placements;
}

const TOWN_BUILDINGS: readonly TownAssetPlacement[] = [
  ...modularBuilding({ name: "founders-hall", x: 46.5, z: 73, scale: 2.25, floors: 2 }),
  ...modularBuilding({ name: "wayfarer-inn", x: 74.5, z: 76, scale: 2.15, floors: 2, redRoof: true, chimney: true }),
  ...modularBuilding({ name: "beginnings-smithy", x: 74.5, z: 136.5, scale: 2.15, floors: 1, redRoof: true, chimney: true }),
  ...modularBuilding({ name: "weavers-row", x: 46.5, z: 93, scale: 2, floors: 1 }),
  ...modularBuilding({ name: "healers-house", x: 46.5, z: 108, scale: 2, floors: 1, redRoof: true }),
  ...modularBuilding({ name: "wardens-lodge", x: 46.5, z: 130, scale: 2.1, floors: 2 }),
] as const;

export const SPEED_LAB_TOWN_ASSETS: readonly TownAssetPlacement[] = [
  ...TOWN_BUILDINGS,
  ...TOWN_DECORATIONS,
] as const;

const FALLBACK_REQUIREMENTS: Readonly<Record<TownFallbackFamily, readonly TownAssetId[]>> = {
  "modular-buildings": ["wallWood", "wallWoodCorner", "wallWoodDoor", "wallWoodWindow", "roof", "roofHigh",
    "roofGableEnd", "stairsWideStone", "overhang", "chimney"],
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
  for (let index = 0; index < placements.length; index++) {
    const placement = placements[index]!;
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
    // Large modular towns must not monopolise the main thread. Let input,
    // rendering and network reconciliation run between small placement batches.
    if (index > 0 && index % 24 === 0) await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  }

  return { loadedIds: new Set(loaded.keys()), failedIds, entities };
}
