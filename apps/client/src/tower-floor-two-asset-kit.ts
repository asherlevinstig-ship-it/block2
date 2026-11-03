import * as pc from "playcanvas";
import { TOWER_FLOOR_ONE_ASSET_FILES, type TowerFloorOneAssetId } from "./tower-floor-one-asset-kit.js";

export interface TowerFloorTwoAssetPlacement {
  id: TowerFloorOneAssetId;
  name: string;
  position: readonly [number, number, number];
  yaw?: number;
  scale?: number;
}

/** Authored dungeon modules replace the most visible greybox silhouettes.
 * They are presentation-only: the canonical Floor 2 manifest continues to
 * own collision, encounters and ground height. */
export const TOWER_FLOOR_TWO_ASSET_PLACEMENTS: readonly TowerFloorTwoAssetPlacement[] = [
  { id: "wallPillar", name: "entry-pillar-north", position: [423, 8.05, 101.6], yaw: 90, scale: 1.8 },
  { id: "wallPillar", name: "entry-pillar-south", position: [423, 8.05, 110.4], yaw: 90, scale: 1.8 },
  { id: "torch", name: "entry-torch-north", position: [422.5, 11.1, 101.8], yaw: 90, scale: 1.5 },
  { id: "torch", name: "entry-torch-south", position: [422.5, 11.1, 110.2], yaw: 90, scale: 1.5 },
  { id: "floorTileLarge", name: "entry-floor-a", position: [418, 8.08, 103], scale: 2.65 },
  { id: "floorTileBrokenA", name: "entry-floor-b", position: [418, 8.08, 109], yaw: 90, scale: 2.65 },
  { id: "floorTileLarge", name: "intake-floor-a", position: [430, 8.08, 102], scale: 2.85 },
  { id: "floorTileBrokenB", name: "intake-floor-b", position: [436, 8.08, 110], yaw: 90, scale: 2.85 },
  { id: "floorTileLarge", name: "intake-floor-c", position: [442, 8.08, 102], yaw: 180, scale: 2.85 },
  { id: "crates", name: "intake-crates", position: [428, 8.12, 114.2], yaw: 17, scale: 1.1 },
  { id: "barrels", name: "intake-barrels", position: [443.5, 8.12, 97], yaw: -18, scale: 1.1 },

  { id: "stoneColumn", name: "hub-column-nw", position: [450.5, 8.35, 98.5], yaw: 45, scale: 1.65 },
  { id: "stoneColumn", name: "hub-column-sw", position: [450.5, 8.35, 113.5], yaw: 135, scale: 1.65 },
  { id: "stoneColumn", name: "hub-column-ne", position: [465.5, 8.35, 98.5], yaw: -45, scale: 1.65 },
  { id: "stoneColumn", name: "hub-column-se", position: [465.5, 8.35, 113.5], yaw: -135, scale: 1.65 },
  { id: "wallScaffold", name: "bellows-scaffold", position: [454.2, 8.2, 84], yaw: 90, scale: 1.55 },
  { id: "wallScaffold", name: "quench-scaffold", position: [454.2, 8.2, 128], yaw: 90, scale: 1.55 },
  { id: "battlement", name: "furnace-rail", position: [470, 8.68, 65.5], yaw: 0, scale: 1.45 },
  { id: "battlement", name: "quench-rail", position: [470, 8.68, 146.5], yaw: 180, scale: 1.45 },
  { id: "rubbleHalf", name: "furnace-rubble", position: [487, 8.72, 76], yaw: 28, scale: .95 },
  { id: "rubbleLarge", name: "quench-rubble", position: [486, 8.72, 136], yaw: -31, scale: .9 },

  { id: "fortressGate", name: "crucible-gate", position: [505, 9.25, 106], yaw: 90, scale: 1.9 },
  { id: "wallPillar", name: "crucible-pillar-north", position: [504.8, 9.25, 98.5], yaw: 90, scale: 2.05 },
  { id: "wallPillar", name: "crucible-pillar-south", position: [504.8, 9.25, 113.5], yaw: 90, scale: 2.05 },
  { id: "redBanner", name: "crucible-banner-north", position: [505.2, 12.3, 98.8], yaw: 90, scale: 1.45 },
  { id: "blueBanner", name: "crucible-banner-south", position: [505.2, 12.3, 113.2], yaw: 90, scale: 1.45 },
  { id: "stoneColumn", name: "boss-column-nw", position: [516, 9.25, 96], yaw: 30, scale: 2.1 },
  { id: "stoneColumn", name: "boss-column-sw", position: [516, 9.25, 116], yaw: 150, scale: 2.1 },
  { id: "stoneColumn", name: "boss-column-ne", position: [534, 9.25, 96], yaw: -30, scale: 2.1 },
  { id: "stoneColumn", name: "boss-column-se", position: [534, 9.25, 116], yaw: -150, scale: 2.1 },
  { id: "royalArms", name: "forgeheart-mark", position: [537.2, 13.3, 106], yaw: 90, scale: 2.5 },
];

function loadAsset(app: pc.Application, id: TowerFloorOneAssetId): Promise<pc.Asset> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(TOWER_FLOOR_ONE_ASSET_FILES[id], "container", (error, asset) => {
      if (error || !asset) reject(error ?? new Error(`Floor 2 asset ${id} did not return an asset.`));
      else resolve(asset);
    });
  });
}

export interface TowerFloorTwoAssetLoadResult {
  loadedIds: ReadonlySet<TowerFloorOneAssetId>;
  failedIds: ReadonlySet<TowerFloorOneAssetId>;
  entities: readonly pc.Entity[];
}

const loads = new WeakMap<pc.Entity, Promise<TowerFloorTwoAssetLoadResult>>();

export function requestTowerFloorTwoAssets(app: pc.Application, parent: pc.Entity): Promise<TowerFloorTwoAssetLoadResult> {
  const existing = loads.get(parent);
  if (existing) return existing;
  const load = (async () => {
    const ids = [...new Set(TOWER_FLOOR_TWO_ASSET_PLACEMENTS.map(placement => placement.id))];
    const loaded = new Map<TowerFloorOneAssetId, pc.Asset>();
    const failedIds = new Set<TowerFloorOneAssetId>();
    await Promise.all(ids.map(async id => {
      try { loaded.set(id, await loadAsset(app, id)); }
      catch (error) {
        failedIds.add(id);
        console.warn(`[floor2-assets] Keeping procedural fallback for ${id}.`, error);
      }
    }));
    const staticBatch = app.batcher.addGroup("tower-floor-two-authored", false, 36);
    const entities: pc.Entity[] = [];
    for (let index = 0; index < TOWER_FLOOR_TWO_ASSET_PLACEMENTS.length; index++) {
      const placement = TOWER_FLOOR_TWO_ASSET_PLACEMENTS[index]!;
      const resource = loaded.get(placement.id)?.resource as pc.ContainerResource | undefined;
      if (!resource) continue;
      const entity = resource.instantiateRenderEntity({ castShadows: false, receiveShadows: true });
      entity.name = `floor2-asset:${placement.name}`;
      entity.setLocalPosition(...placement.position);
      entity.setLocalEulerAngles(0, placement.yaw ?? 0, 0);
      const scale = placement.scale ?? 1;
      entity.setLocalScale(scale, scale, scale);
      parent.addChild(entity);
      for (const node of entity.find(candidate => Boolean((candidate as pc.Entity).render))) {
        const render = (node as pc.Entity).render;
        if (render) render.batchGroupId = staticBatch.id;
      }
      entities.push(entity);
      if (index > 0 && index % 10 === 0) await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    }
    if (entities.length) app.batcher.generate([staticBatch.id]);
    console.info(`[floor2-assets] ${entities.length} authored placements ready; `
      + `${failedIds.size} model types retained their procedural fallback.`);
    return { loadedIds: new Set(loaded.keys()), failedIds, entities };
  })();
  loads.set(parent, load);
  return load;
}
