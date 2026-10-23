import * as pc from "playcanvas";
import type { TownLifeRole } from "./town-life.js";

export const TOWN_NPC_ASSET_BASE_URL = "/assets/kaykit-town-npcs";

export const TOWN_NPC_MODEL_FILES: Readonly<Record<TownLifeRole, string>> = {
  guard: `${TOWN_NPC_ASSET_BASE_URL}/guard.glb`,
  vendor: `${TOWN_NPC_ASSET_BASE_URL}/vendor.glb`,
  smith: `${TOWN_NPC_ASSET_BASE_URL}/smith.glb`,
  healer: `${TOWN_NPC_ASSET_BASE_URL}/healer.glb`,
  resident: `${TOWN_NPC_ASSET_BASE_URL}/resident.glb`,
};

export interface TownNpcAssetLoadResult {
  loaded: ReadonlyMap<TownLifeRole, pc.Asset>;
  failed: ReadonlySet<TownLifeRole>;
}

function loadTownNpcAsset(app: pc.Application, role: TownLifeRole): Promise<pc.Asset> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(TOWN_NPC_MODEL_FILES[role], "container", (error, asset) => {
      if (error || !asset) reject(error ?? new Error(`Town NPC model ${role} did not return an asset.`));
      else resolve(asset);
    });
  });
}

export async function loadTownNpcAssets(app: pc.Application): Promise<TownNpcAssetLoadResult> {
  const roles = Object.keys(TOWN_NPC_MODEL_FILES) as TownLifeRole[];
  const loaded = new Map<TownLifeRole, pc.Asset>();
  const failed = new Set<TownLifeRole>();
  await Promise.all(roles.map(async role => {
    try {
      loaded.set(role, await loadTownNpcAsset(app, role));
    } catch (error) {
      failed.add(role);
      console.warn(`[town-npcs] Keeping procedural ${role} fallback.`, error);
    }
  }));
  return { loaded, failed };
}

