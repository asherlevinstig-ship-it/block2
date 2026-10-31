import type { BuildPathId, MainHandId } from "@blockcraft/protocol";
import * as pc from "playcanvas";

export const KAYKIT_WEAPON_BASE_URL = "/assets/kaykit-fantasy-weapons";

export const KAYKIT_WEAPON_ASSET_FILES = {
  swordBasic: `${KAYKIT_WEAPON_BASE_URL}/sword_A.gltf`,
  swordForged: `${KAYKIT_WEAPON_BASE_URL}/sword_B.gltf`,
  bowBasic: `${KAYKIT_WEAPON_BASE_URL}/bow_A_withString.gltf`,
  bowForged: `${KAYKIT_WEAPON_BASE_URL}/bow_B_withString.gltf`,
  daggerThief: `${KAYKIT_WEAPON_BASE_URL}/dagger_A.gltf`,
  daggerAssassin: `${KAYKIT_WEAPON_BASE_URL}/dagger_B.gltf`,
  wandMage: `${KAYKIT_WEAPON_BASE_URL}/wand_A.gltf`,
  staffHealer: `${KAYKIT_WEAPON_BASE_URL}/staff_A.gltf`,
  shieldTank: `${KAYKIT_WEAPON_BASE_URL}/shield_C.gltf`,
  hammerStone: `${KAYKIT_WEAPON_BASE_URL}/hammer_A.gltf`,
} as const;

export type KayKitWeaponAssetId = keyof typeof KAYKIT_WEAPON_ASSET_FILES;

export function kayKitWeaponAssetForMainHand(mainHandId: MainHandId,
  pathId: BuildPathId | null = null): KayKitWeaponAssetId | null {
  if (mainHandId === "longsword") return "swordBasic";
  if (mainHandId === "forged_sword") return "swordForged";
  if (mainHandId === "bow") return "bowBasic";
  if (mainHandId === "forged_bow") return "bowForged";
  if (mainHandId === "fang_dagger") return pathId === "assassin" ? "daggerAssassin" : "daggerThief";
  if (mainHandId === "forged_focus") return pathId === "healer" ? "staffHealer" : "wandMage";
  if (mainHandId === "stone_core_hammer") return "hammerStone";
  return null;
}

export function kayKitTankShieldAsset(mainHandId: MainHandId,
  pathId: BuildPathId | null): KayKitWeaponAssetId | null {
  return mainHandId === "forged_sword" && pathId === "tank" ? "shieldTank" : null;
}

const assetLoads = new Map<KayKitWeaponAssetId, Promise<pc.Asset>>();
const entityInstalls = new WeakMap<pc.Entity, Map<KayKitWeaponAssetId, Promise<pc.Entity>>>();

function loadWeaponAsset(app: pc.Application, id: KayKitWeaponAssetId): Promise<pc.Asset> {
  const existing = assetLoads.get(id);
  if (existing) return existing;
  const load = new Promise<pc.Asset>((resolve, reject) => {
    app.assets.loadFromUrl(KAYKIT_WEAPON_ASSET_FILES[id], "container", (error, asset) => {
      if (error || !asset) reject(error ?? new Error(`KayKit weapon ${id} did not return an asset.`));
      else resolve(asset);
    });
  });
  assetLoads.set(id, load);
  return load;
}

export interface KayKitWeaponTransform {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: number;
  layers?: readonly number[];
}

/** Installs one authored model per parent/asset pair. The caller retains its
 * procedural model until this promise resolves, providing a resilient loading
 * fallback on slow or blocked school networks. */
export function ensureKayKitWeaponModel(
  app: pc.Application,
  parent: pc.Entity,
  id: KayKitWeaponAssetId,
  transform: KayKitWeaponTransform,
): Promise<pc.Entity> {
  let installs = entityInstalls.get(parent);
  if (!installs) { installs = new Map(); entityInstalls.set(parent, installs); }
  const existing = installs.get(id);
  if (existing) return existing;
  const install = loadWeaponAsset(app, id).then(asset => {
    const resource = asset.resource as pc.ContainerResource | undefined;
    if (!resource) throw new Error(`KayKit weapon ${id} has no container resource.`);
    const entity = resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
    entity.name = `kaykit-weapon:${id}`;
    entity.setLocalPosition(...transform.position);
    entity.setLocalEulerAngles(...transform.rotation);
    entity.setLocalScale(transform.scale, transform.scale, transform.scale);
    if (transform.layers) for (const component of entity.findComponents("render"))
      (component as pc.RenderComponent).layers = [...transform.layers];
    parent.addChild(entity);
    return entity;
  });
  installs.set(id, install);
  return install;
}

