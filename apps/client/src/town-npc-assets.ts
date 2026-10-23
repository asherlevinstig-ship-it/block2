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

type TownNpcAnimationAsset = Pick<pc.Asset, "name" | "resource">;

const townNpcAnimationLoops = (name: string): boolean => name === "Idle" || name.startsWith("Walking_");

/** Bind GLB AnimTracks to the instantiated character's actual bone hierarchy.
 * Container animations are modern AnimTracks, so the legacy `animation`
 * component can load without ever moving the joints. */
export function bindTownNpcRig(entity: pc.Entity, animationAssets: readonly TownNpcAnimationAsset[],
  initialState: string, normalizedStart = 0): boolean {
  const tracks = animationAssets.filter((asset): asset is TownNpcAnimationAsset & { resource: pc.AnimTrack } =>
    asset.resource instanceof pc.AnimTrack);
  if (!tracks.some(asset => asset.name === initialState)) return false;

  entity.addComponent("anim", { activate: false, speed: 1 });
  if (!entity.anim) return false;
  for (const asset of tracks)
    entity.anim.assignAnimation(asset.name, asset.resource, undefined, 1, townNpcAnimationLoops(asset.name));

  const layer = entity.anim.baseLayer;
  if (!layer?.states.includes(initialState)) return false;
  layer.play(initialState);
  entity.anim.playing = true;
  if (layer.activeStateDuration > 0)
    layer.activeStateCurrentTime = Math.max(0, Math.min(1, normalizedStart)) * layer.activeStateDuration;
  return true;
}

export function transitionTownNpcRig(entity: pc.Entity, state: string, blendSeconds = .18): boolean {
  const layer = entity.anim?.baseLayer;
  if (!layer?.states.includes(state)) return false;
  layer.transition(state, blendSeconds);
  entity.anim!.playing = true;
  return true;
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

