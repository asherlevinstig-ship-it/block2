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
  { id: "brokenWall", name: "opening-ruin-north", position: [322, 8.18, 92], yaw: -7, scale: 2.05 },
  { id: "brokenWall", name: "opening-ruin-south", position: [322, 8.18, 120], yaw: 7, scale: 2.05 },
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
    hideDirectChildren(parent, name => name === "floor1-ruined-wall" || name === "floor1-wall-moss");

  console.info(`[tower-assets] ${entities.length} authored placements ready; ${failedIds.size} model types kept their procedural fallback.`);
  return { loadedIds: new Set(loaded.keys()), failedIds, entities };
}
