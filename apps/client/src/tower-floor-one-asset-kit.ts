import * as pc from "playcanvas";

export const KAYKIT_DUNGEON_BASE_URL = "/assets/kaykit-dungeon";

export const TOWER_FLOOR_ONE_ASSET_FILES = {
  decoratedPillar: `${KAYKIT_DUNGEON_BASE_URL}/pillar_decorated.gltf.glb`,
  archedWall: `${KAYKIT_DUNGEON_BASE_URL}/wall_arched.gltf.glb`,
  brokenWall: `${KAYKIT_DUNGEON_BASE_URL}/wall_broken.gltf.glb`,
  rubbleLarge: `${KAYKIT_DUNGEON_BASE_URL}/rubble_large.gltf.glb`,
  rubbleHalf: `${KAYKIT_DUNGEON_BASE_URL}/rubble_half.gltf.glb`,
  crates: `${KAYKIT_DUNGEON_BASE_URL}/crates_stacked.gltf.glb`,
  barrels: `${KAYKIT_DUNGEON_BASE_URL}/barrel_small_stack.gltf.glb`,
  chest: `${KAYKIT_DUNGEON_BASE_URL}/chest.glb`,
  torch: `${KAYKIT_DUNGEON_BASE_URL}/torch_lit.gltf.glb`,
  blueBanner: `${KAYKIT_DUNGEON_BASE_URL}/banner_patternA_blue.gltf.glb`,
  redBanner: `${KAYKIT_DUNGEON_BASE_URL}/banner_patternA_red.gltf.glb`,
  fortressGate: `${KAYKIT_DUNGEON_BASE_URL}/wall_gated.gltf.glb`,
  fortressCorner: `${KAYKIT_DUNGEON_BASE_URL}/wall_corner_gated.gltf.glb`,
  crackedWall: `${KAYKIT_DUNGEON_BASE_URL}/wall_cracked.gltf.glb`,
  wallPillar: `${KAYKIT_DUNGEON_BASE_URL}/wall_pillar.gltf.glb`,
  battlement: `${KAYKIT_DUNGEON_BASE_URL}/barrier.gltf.glb`,
  battlementCorner: `${KAYKIT_DUNGEON_BASE_URL}/barrier_corner.gltf.glb`,
  throneChair: `${KAYKIT_DUNGEON_BASE_URL}/chair.gltf.glb`,
  royalArms: `${KAYKIT_DUNGEON_BASE_URL}/sword_shield_gold.gltf.glb`,
  royalBanner: `${KAYKIT_DUNGEON_BASE_URL}/banner_triple_yellow.gltf.glb`,
  royalChest: `${KAYKIT_DUNGEON_BASE_URL}/chest_gold.glb`,
  floorTileLarge: `${KAYKIT_DUNGEON_BASE_URL}/floor_tile_large.gltf.glb`,
  floorTileBrokenA: `${KAYKIT_DUNGEON_BASE_URL}/floor_tile_small_broken_A.gltf.glb`,
  floorTileBrokenB: `${KAYKIT_DUNGEON_BASE_URL}/floor_tile_small_broken_B.gltf.glb`,
  floorTileWeedsA: `${KAYKIT_DUNGEON_BASE_URL}/floor_tile_small_weeds_A.gltf.glb`,
  floorTileWeedsB: `${KAYKIT_DUNGEON_BASE_URL}/floor_tile_small_weeds_B.gltf.glb`,
  stairsWide: `${KAYKIT_DUNGEON_BASE_URL}/stairs_wide.gltf.glb`,
  stoneColumn: `${KAYKIT_DUNGEON_BASE_URL}/column.gltf.glb`,
  halfWall: `${KAYKIT_DUNGEON_BASE_URL}/wall_half.gltf.glb`,
  wallEndcap: `${KAYKIT_DUNGEON_BASE_URL}/wall_endcap.gltf.glb`,
  wallCorner: `${KAYKIT_DUNGEON_BASE_URL}/wall_corner.gltf.glb`,
  wallScaffold: `${KAYKIT_DUNGEON_BASE_URL}/wall_scaffold.gltf.glb`,
  brokenRoyalArms: `${KAYKIT_DUNGEON_BASE_URL}/sword_shield_broken.gltf.glb`,
  trunkA: `${KAYKIT_DUNGEON_BASE_URL}/trunk_large_A.gltf.glb`,
  trunkB: `${KAYKIT_DUNGEON_BASE_URL}/trunk_large_B.gltf.glb`,
  trunkC: `${KAYKIT_DUNGEON_BASE_URL}/trunk_large_C.gltf.glb`,
} as const;

export type TowerFloorOneAssetId = keyof typeof TOWER_FLOOR_ONE_ASSET_FILES;

export interface TowerFloorOneAssetPlacement {
  id: TowerFloorOneAssetId;
  name: string;
  position: readonly [number, number, number];
  yaw?: number;
  scale?: number;
}

/** A deliberately small authored-asset pass for the part of Floor 1 every
 * player sees first. Gameplay collision remains server-owned and the existing
 * procedural world stays underneath as a resilient loading fallback. */
export const TOWER_FLOOR_ONE_ASSET_SPIKE: readonly TowerFloorOneAssetPlacement[] = [
  { id: "decoratedPillar", name: "sanctuary-exit-pillar-north", position: [313, 9, 99], yaw: 90, scale: .8 },
  { id: "decoratedPillar", name: "sanctuary-exit-pillar-south", position: [313, 9, 113], yaw: 90, scale: .8 },
  // wall_arched is a solid wall with a recessed arch, not a traversable gate.
  // Keep the open pier-and-lintel arches created by the world at these routes.
  { id: "brokenWall", name: "opening-ruin-north", position: [322, 7.98, 92], yaw: -7, scale: 2.05 },
  { id: "brokenWall", name: "opening-ruin-south", position: [322, 7.98, 120], yaw: 7, scale: 2.05 },
  { id: "brokenWall", name: "court-ruin-north", position: [337, 8.18, 96], yaw: 95, scale: 1.85 },
  { id: "brokenWall", name: "court-ruin-south", position: [337, 8.18, 116], yaw: 85, scale: 1.85 },
  { id: "rubbleLarge", name: "camp-rubble-north", position: [326, 8.2, 96.5], yaw: 18, scale: .72 },
  { id: "rubbleHalf", name: "camp-rubble-south", position: [331, 8.2, 116], yaw: -31, scale: .78 },
  { id: "crates", name: "expedition-crates", position: [326, 8.2, 100], yaw: 19, scale: .82 },
  { id: "barrels", name: "expedition-barrels", position: [330, 8.2, 114], yaw: -14, scale: .9 },
  { id: "chest", name: "expedition-chest", position: [333, 8.2, 101], yaw: 8, scale: 1.05 },
  { id: "redBanner", name: "north-warden-banner-west", position: [344, 8.68, 69.5], yaw: 0, scale: 1.45 },
  { id: "redBanner", name: "north-warden-banner-east", position: [356, 8.68, 69.5], yaw: 180, scale: 1.45 },
  { id: "torch", name: "opening-torch-north", position: [320.3, 10.2, 102.65], yaw: 90, scale: 1.42 },
  { id: "torch", name: "opening-torch-south", position: [320.3, 10.2, 109.35], yaw: 90, scale: 1.42 },
  { id: "wallCorner", name: "opening-ruin-corner-north", position: [323.4, 8.08, 94.4], yaw: 173, scale: 1.75 },
  { id: "wallEndcap", name: "opening-ruin-end-south", position: [323.5, 8.08, 118.1], yaw: 7, scale: 1.75 },
  { id: "wallScaffold", name: "failed-expedition-scaffold", position: [334.2, 8.12, 115.5], yaw: 84, scale: 1.55 },
  { id: "brokenRoyalArms", name: "fallen-crown-arms", position: [333.2, 8.24, 101.7], yaw: 17, scale: 1.2 },
  { id: "trunkA", name: "north-court-trunk-west", position: [340.7, 8.78, 79], yaw: 18, scale: 1.35 },
  { id: "trunkB", name: "north-court-trunk-east", position: [358.7, 8.78, 84], yaw: -22, scale: 1.45 },
  { id: "trunkC", name: "south-court-trunk-west", position: [341.5, 8.78, 132], yaw: 31, scale: 1.42 },
  { id: "trunkA", name: "south-court-trunk-east", position: [359, 8.78, 127.5], yaw: -38, scale: 1.3 },
] as const;

/** Eastern-court models are deferred until the player has crossed the opening
 * court. The western sanctuary can therefore render without downloading boss
 * architecture that is still hidden by fog and ruins. */
export const TOWER_FLOOR_ONE_FORTRESS_ASSETS: readonly TowerFloorOneAssetPlacement[] = [
  { id: "fortressGate", name: "crown-gate", position: [361.5, 9.45, 106], yaw: 90, scale: 1.8 },
  { id: "fortressCorner", name: "fortress-north-corner", position: [384.8, 9.47, 96], yaw: 180, scale: 2.25 },
  { id: "fortressCorner", name: "fortress-south-corner", position: [384.8, 9.47, 116], yaw: 90, scale: 2.25 },
  { id: "crackedWall", name: "fortress-north-wall", position: [385.5, 9.55, 101.5], yaw: 90, scale: 2.25 },
  { id: "crackedWall", name: "fortress-south-wall", position: [385.5, 9.55, 110.5], yaw: 90, scale: 2.25 },
  { id: "wallPillar", name: "fortress-north-pillar", position: [384.5, 9.55, 99], yaw: 90, scale: 2.25 },
  { id: "wallPillar", name: "fortress-south-pillar", position: [384.5, 9.55, 113], yaw: 90, scale: 2.25 },
  { id: "wallPillar", name: "gate-north-pillar", position: [362.1, 9.38, 99.5], yaw: 90, scale: 1.45 },
  { id: "wallPillar", name: "gate-south-pillar", position: [362.1, 9.38, 112.5], yaw: 90, scale: 1.45 },
  // Three 7.6 m modules close each side of the boss court. Their first and
  // last edges overlap the gate pillars and rear fortress wall respectively,
  // so the architecture reads as one enclosure from every camera angle.
  { id: "crackedWall", name: "north-court-wall-west", position: [365.9, 9.55, 99.5], yaw: 0, scale: 1.9 },
  { id: "crackedWall", name: "north-court-wall-mid", position: [373.5, 9.55, 99.5], yaw: 0, scale: 1.9 },
  { id: "crackedWall", name: "north-court-wall-east", position: [381.1, 9.55, 99.5], yaw: 0, scale: 1.9 },
  { id: "crackedWall", name: "south-court-wall-west", position: [365.9, 9.55, 112.5], yaw: 0, scale: 1.9 },
  { id: "crackedWall", name: "south-court-wall-mid", position: [373.5, 9.55, 112.5], yaw: 0, scale: 1.9 },
  { id: "crackedWall", name: "south-court-wall-east", position: [381.1, 9.55, 112.5], yaw: 0, scale: 1.9 },
  { id: "battlementCorner", name: "north-battlement-corner", position: [384.8, 18.55, 96], yaw: 180, scale: 2.25 },
  { id: "battlementCorner", name: "south-battlement-corner", position: [384.8, 18.55, 116], yaw: 90, scale: 2.25 },
  { id: "battlement", name: "north-battlement-west", position: [372, 9.55, 93.8], yaw: 0, scale: 2.15 },
  { id: "battlement", name: "north-battlement-east", position: [380, 9.55, 93.8], yaw: 0, scale: 2.15 },
  { id: "battlement", name: "south-battlement-west", position: [372, 9.55, 118.2], yaw: 180, scale: 2.15 },
  { id: "battlement", name: "south-battlement-east", position: [380, 9.55, 118.2], yaw: 180, scale: 2.15 },
  { id: "throneChair", name: "crownkeeper-throne", position: [384.2, 9.58, 106], yaw: 90, scale: 3.65 },
  { id: "royalArms", name: "crownkeeper-arms", position: [386.05, 14.4, 106], yaw: 90, scale: 2.45 },
  { id: "royalBanner", name: "royal-banner-north", position: [385.8, 12.8, 99.1], yaw: 90, scale: 1.45 },
  { id: "royalBanner", name: "royal-banner-south", position: [385.8, 12.8, 112.9], yaw: 90, scale: 1.45 },
  { id: "royalChest", name: "crownkeeper-cache", position: [387, 9.58, 110.2], yaw: -90, scale: 1.25 },
  ...Array.from({ length: 16 }, (_, index): TowerFloorOneAssetPlacement => {
    const column = index % 4, row = Math.floor(index / 4);
    return {
      id: index === 1 || index === 14 ? "floorTileBrokenB" : index === 4 || index === 11 ? "floorTileWeedsB" : "floorTileLarge",
      name: `crown-court-floor-${index + 1}`,
      position: [366 + column * 6, 9.72, 97 + row * 6],
      yaw: (index % 3) * 90,
      scale: 2.85,
    };
  }),
  ...Array.from({ length: 8 }, (_, index): TowerFloorOneAssetPlacement => {
    const angle = index / 8 * Math.PI * 2;
    return {
      id: "stoneColumn",
      name: `crown-court-column-${index + 1}`,
      position: [375 + Math.cos(angle) * 13, 9.6, 106 + Math.sin(angle) * 13],
      yaw: 45 - index * 45,
      scale: 2.15,
    };
  }),
  { id: "halfWall", name: "throne-dais-north", position: [383, 9.6, 101.2], yaw: 90, scale: 1.65 },
  { id: "halfWall", name: "throne-dais-south", position: [383, 9.6, 110.8], yaw: 90, scale: 1.65 },
  { id: "wallScaffold", name: "crown-wall-scaffold", position: [380.5, 9.6, 116], yaw: 90, scale: 1.65 },
  { id: "brokenRoyalArms", name: "broken-royal-arms", position: [381.5, 9.72, 102], yaw: -42, scale: 1.5 },
] as const;

function towerAssetUrl(id: TowerFloorOneAssetId): string {
  return TOWER_FLOOR_ONE_ASSET_FILES[id];
}

function loadAsset(app: pc.Application, id: TowerFloorOneAssetId): Promise<pc.Asset> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(towerAssetUrl(id), "container", (error, asset) => {
      if (error || !asset) reject(error ?? new Error(`Tower asset ${id} did not return an asset.`));
      else resolve(asset);
    });
  });
}

function hideDirectChildren(parent: pc.Entity, predicate: (name: string) => boolean): void {
  for (const child of parent.children) {
    if (child instanceof pc.Entity && predicate(child.name)) child.enabled = false;
  }
}

const REPLACED_RUINED_WALL_FALLBACKS = new Set([
  "floor1-ruined-wall-322-92", "floor1-wall-moss-322-92",
  "floor1-ruined-wall-322-120", "floor1-wall-moss-322-120",
  "floor1-ruined-wall-337-96", "floor1-wall-moss-337-96",
  "floor1-ruined-wall-337-116", "floor1-wall-moss-337-116",
]);

export interface TowerFloorOneAssetLoadResult {
  loadedIds: ReadonlySet<TowerFloorOneAssetId>;
  failedIds: ReadonlySet<TowerFloorOneAssetId>;
  entities: readonly pc.Entity[];
}

export async function populateTowerFloorOneAssetKit(
  app: pc.Application,
  parent: pc.Entity,
  placements: readonly TowerFloorOneAssetPlacement[] = TOWER_FLOOR_ONE_ASSET_SPIKE,
): Promise<TowerFloorOneAssetLoadResult> {
  const ids = [...new Set(placements.map(placement => placement.id))];
  const loaded = new Map<TowerFloorOneAssetId, pc.Asset>();
  const failedIds = new Set<TowerFloorOneAssetId>();

  await Promise.all(ids.map(async id => {
    try {
      loaded.set(id, await loadAsset(app, id));
    } catch (error) {
      failedIds.add(id);
      console.warn(`[tower-assets] Keeping procedural fallback for ${id}.`, error);
    }
  }));

  const entities: pc.Entity[] = [];
  for (let index = 0; index < placements.length; index++) {
    const placement = placements[index]!;
    const resource = loaded.get(placement.id)?.resource as pc.ContainerResource | undefined;
    if (!resource) continue;
    const entity = resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
    entity.name = `tower-asset:${placement.name}`;
    entity.setLocalPosition(...placement.position);
    entity.setLocalEulerAngles(0, placement.yaw ?? 0, 0);
    const scale = placement.scale ?? 1;
    entity.setLocalScale(scale, scale, scale);
    parent.addChild(entity);
    entities.push(entity);
    if (index > 0 && index % 12 === 0) await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  }

  // Swap only complete visual families. A failed or blocked asset request
  // therefore exposes the original world instead of leaving holes.
  if (loaded.has("decoratedPillar"))
    hideDirectChildren(parent, name => name === "floor1-sanctuary-pillar");
  if (loaded.has("archedWall"))
    hideDirectChildren(parent, name => name.startsWith("floor1-opening-gate")
      || name.startsWith("floor1-north-breach") || name.startsWith("floor1-south-breach"));
  if (loaded.has("brokenWall"))
    hideDirectChildren(parent, name => REPLACED_RUINED_WALL_FALLBACKS.has(name));
  if (loaded.has("fortressGate"))
    hideDirectChildren(parent, name => name.startsWith("floor1-crown-gate"));
  if (["wallPillar", "crackedWall", "fortressCorner", "battlement", "battlementCorner"]
    .every(id => loaded.has(id as TowerFloorOneAssetId)))
    hideDirectChildren(parent, name => name === "floor1-crown-pillar");
  if (loaded.has("throneChair") && loaded.has("royalArms"))
    hideDirectChildren(parent, name => name === "floor1-crown-throne" || name === "floor1-crown-inlay"
      || name === "floor1-throne-crown");
  if (loaded.has("royalBanner"))
    hideDirectChildren(parent, name => name.startsWith("floor1-crown-banner"));
  const names = new Set(placements.map(placement => placement.name));
  if (loaded.has("stoneColumn") && names.has("crown-court-column-1"))
    hideDirectChildren(parent, name => name === "floor1-crown-pillar");

  console.info(`[tower-assets] ${entities.length} authored placements ready; ${failedIds.size} model types kept their procedural fallback.`);
  return { loadedIds: new Set(loaded.keys()), failedIds, entities };
}

const fortressLoads = new WeakMap<pc.Entity, Promise<TowerFloorOneAssetLoadResult>>();

export function requestTowerFloorOneFortressAssets(
  app: pc.Application,
  parent: pc.Entity,
): Promise<TowerFloorOneAssetLoadResult> {
  const existing = fortressLoads.get(parent);
  if (existing) return existing;
  const load = populateTowerFloorOneAssetKit(app, parent, TOWER_FLOOR_ONE_FORTRESS_ASSETS);
  fortressLoads.set(parent, load);
  return load;
}
