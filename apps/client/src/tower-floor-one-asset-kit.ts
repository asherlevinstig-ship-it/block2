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
  ...Array.from({ length: 8 }, (_, index): TowerFloorOneAssetPlacement => {
    const angle = index / 8 * Math.PI * 2;
    return {
      id: "decoratedPillar",
      name: `sanctuary-pillar-${index + 1}`,
      position: [306 + Math.cos(angle) * 8.6, 9.02, 106 + Math.sin(angle) * 8.6],
      yaw: 45 - index * 45,
      scale: 1.62,
    };
  }),
  { id: "archedWall", name: "opening-gate", position: [320.5, 8.54, 106], yaw: 90, scale: 1.7 },
  { id: "archedWall", name: "north-breach", position: [339, 8.15, 94], yaw: 49, scale: 1.48 },
  { id: "archedWall", name: "south-breach", position: [339, 8.15, 118], yaw: -49, scale: 1.48 },
  { id: "brokenWall", name: "opening-ruin-north", position: [322, 7.98, 92], yaw: -7, scale: 2.05 },
  { id: "brokenWall", name: "opening-ruin-south", position: [322, 7.98, 120], yaw: 7, scale: 2.05 },
  { id: "brokenWall", name: "court-ruin-north", position: [337, 8.18, 96], yaw: 95, scale: 1.85 },
  { id: "brokenWall", name: "court-ruin-south", position: [337, 8.18, 116], yaw: 85, scale: 1.85 },
  { id: "rubbleLarge", name: "camp-rubble-north", position: [326, 8.2, 96.5], yaw: 18, scale: .72 },
  { id: "rubbleHalf", name: "camp-rubble-south", position: [331, 8.2, 116], yaw: -31, scale: .78 },
  { id: "crates", name: "expedition-crates", position: [326, 8.2, 100], yaw: 19, scale: .82 },
  { id: "barrels", name: "expedition-barrels", position: [330, 8.2, 114], yaw: -14, scale: .9 },
  { id: "chest", name: "expedition-chest", position: [333, 8.2, 101], yaw: 8, scale: 1.05 },
  { id: "blueBanner", name: "sanctuary-banner-north", position: [309.6, 9.02, 97.9], yaw: 0, scale: 1.45 },
  { id: "blueBanner", name: "sanctuary-banner-south", position: [309.6, 9.02, 114.1], yaw: 180, scale: 1.45 },
  { id: "redBanner", name: "north-warden-banner-west", position: [344, 8.68, 69.5], yaw: 0, scale: 1.45 },
  { id: "redBanner", name: "north-warden-banner-east", position: [356, 8.68, 69.5], yaw: 180, scale: 1.45 },
  { id: "torch", name: "opening-torch-north", position: [320.3, 10.2, 102.65], yaw: 90, scale: 1.42 },
  { id: "torch", name: "opening-torch-south", position: [320.3, 10.2, 109.35], yaw: 90, scale: 1.42 },
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
