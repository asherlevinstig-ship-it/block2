import {
  ITEM_DEFINITIONS,
  HEALING_POTION,
  MAIN_HAND_DEFINITIONS,
  POWER_DEFINITIONS,
  SEISMIC_CLEAVE_UPGRADES,
  SPECIAL_DEFINITIONS,
  TRAIT_DEFINITIONS,
  TAVERN_QUIZ_STARTING_COINS,
  type ItemId,
  type MainHandId,
  type PowerId,
  type SeismicMasteryId,
  type SpecialId,
  type TraitId,
  type EquipmentReforgeRanks,
  resolveAppearance,
  type Appearance,
  type HuntLoadoutSlot,
} from "@blockcraft/protocol";
import { canEquipMainHand } from "./equipment-rules.js";
import { ArmourEquipSchema, type ArmourId } from "@blockcraft/protocol";
import { compatiblePowerOrFallback } from "./power-rules.js";
import { InventoryItemState, type PlayerState } from "./schema.js";
import { parseRecoveryBags, restoreRecoveryBags, snapshotRecoveryBags, type RecoveryBagData } from "./death-recovery.js";
import { parseReforgeRanks, serializeReforgeRanks } from "./equipment-reforge.js";
import { parseSignaturePity, serializeSignaturePity, type SignaturePity } from "./signature-loot.js";
import { parseHuntMastery, serializeHuntMastery, type HuntMasteryProgress } from "./hunt-mastery.js";

export const PLAYER_SAVE_VERSION = 1;
export const PLAYER_SAVE_HASH = "blockcraft:player-saves:v1";

export interface PlayerSaveData {
  version: typeof PLAYER_SAVE_VERSION;
  savedAt: number;
  name: string;
  appearance?: Appearance;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  level?: number;
  experience?: number;
  unspentStatPoints?: number;
  powerPoints?: number;
  vitalityPoints?: number;
  agilityPoints?: number;
  miningPoints?: number;
  coins: number;
  potionCooldownUntil?: number;
  blacksmithUpgrades: number;
  reforgeRanks?: EquipmentReforgeRanks;
  signaturePity?: SignaturePity;
  huntMastery?: HuntMasteryProgress;
  huntLoadouts?: HuntLoadoutSlot[];
  huntCollectionRewardClaimed?: boolean;
  forestBestTimeMs?: number;
  silverDepthsBestTimeMs?: number;
  miningExpeditionStage?: number;
  silverDepthsStage?: number;
  realmWardenCleared?: boolean;
  inventory: Partial<Record<ItemId, number>>;
  storage?: Partial<Record<ItemId, number>>;
  recoveryBags?: RecoveryBagData[];
  mainHandId: MainHandId;
  armourId?: ArmourId;
  equippedPower: PowerId;
  equippedPowerSecondary?: PowerId;
  seismicMastery: SeismicMasteryId;
  equippedSpecial: SpecialId;
  equippedTrait: TraitId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function isKeyOf<T extends object>(value: unknown, record: T): value is Extract<keyof T, string> {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(record, value);
}

function parseHuntLoadouts(value: unknown): HuntLoadoutSlot[] {
  let source = value;
  if (typeof source === "string") try { source = JSON.parse(source); } catch { source = []; }
  if (!Array.isArray(source)) return [];
  const slots: HuntLoadoutSlot[] = [];
  for (const raw of source) {
    if (!isRecord(raw) || ![1, 2, 3].includes(Number(raw.slot))) continue;
    if (!isKeyOf(raw.mainHandId, MAIN_HAND_DEFINITIONS)) continue;
    const armour = ArmourEquipSchema.safeParse({ armourId: raw.armourId });
    if (!armour.success || !isKeyOf(raw.equippedPower, POWER_DEFINITIONS)
      || !isKeyOf(raw.equippedPowerSecondary, POWER_DEFINITIONS)
      || !isKeyOf(raw.equippedSpecial, SPECIAL_DEFINITIONS)
      || !isKeyOf(raw.equippedTrait, TRAIT_DEFINITIONS)
      || !isKeyOf(raw.seismicMastery, SEISMIC_CLEAVE_UPGRADES.masteries)) continue;
    const slot = Number(raw.slot) as 1 | 2 | 3;
    slots.push({ slot, name: typeof raw.name === "string" ? raw.name.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 18) || `Loadout ${slot}` : `Loadout ${slot}`,
      mainHandId: raw.mainHandId, armourId: armour.data.armourId, equippedPower: raw.equippedPower,
      equippedPowerSecondary: raw.equippedPowerSecondary, equippedSpecial: raw.equippedSpecial,
      equippedTrait: raw.equippedTrait, seismicMastery: raw.seismicMastery });
  }
  return slots.sort((a, b) => a.slot - b.slot).slice(0, 3);
}

export function snapshotPlayerSave(player: PlayerState, now = Date.now()): PlayerSaveData {
  const inventory: Partial<Record<ItemId, number>> = {};
  const storage: Partial<Record<ItemId, number>> = {};
  for (const itemId of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
    const quantity = player.inventory.get(itemId)?.quantity ?? 0;
    if (quantity > 0) inventory[itemId] = Math.min(65_535, Math.floor(quantity));
    const stored = player.storage.get(itemId)?.quantity ?? 0;
    if (stored > 0) storage[itemId] = Math.min(65_535, Math.floor(stored));
  }
  return {
    version: PLAYER_SAVE_VERSION,
    savedAt: now,
    name: player.name,
    appearance: resolveAppearance({ skin: player.appearanceSkin, hair: player.appearanceHair, coat: player.appearanceCoat,
      hairStyle: player.appearanceHairStyle, coatStyle: player.appearanceCoatStyle }),
    health: player.health,
    maxHealth: player.maxHealth,
    stamina: player.stamina,
    maxStamina: player.maxStamina,
    level: player.level,
    experience: player.experience,
    unspentStatPoints: player.unspentStatPoints,
    powerPoints: player.powerPoints,
    vitalityPoints: player.vitalityPoints,
    agilityPoints: player.agilityPoints,
    miningPoints: player.miningPoints,
    coins: player.coins,
    potionCooldownUntil: player.potionCooldownUntil,
    blacksmithUpgrades: player.blacksmithUpgrades,
    reforgeRanks: parseReforgeRanks(player.reforgeRanksJson),
    signaturePity: parseSignaturePity(player.signaturePityJson),
    huntMastery: parseHuntMastery(player.huntMasteryJson),
    huntLoadouts: parseHuntLoadouts(player.huntLoadoutsJson),
    huntCollectionRewardClaimed: player.huntCollectionRewardClaimed,
    forestBestTimeMs: player.forestBestTimeMs,
    silverDepthsBestTimeMs: player.silverDepthsBestTimeMs,
    miningExpeditionStage: player.miningExpeditionStage,
    silverDepthsStage: player.silverDepthsStage,
    realmWardenCleared: player.realmWardenCleared,
    inventory,
    storage,
    recoveryBags: snapshotRecoveryBags(player),
    mainHandId: player.mainHandId as MainHandId,
    armourId: ArmourEquipSchema.safeParse({ armourId: player.armourId }).data?.armourId ?? "none",
    equippedPower: player.equippedPower as PowerId,
    equippedPowerSecondary: player.equippedPowerSecondary as PowerId,
    seismicMastery: player.seismicMastery as SeismicMasteryId,
    equippedSpecial: player.equippedSpecial as SpecialId,
    equippedTrait: player.equippedTrait as TraitId,
  };
}

export function serializePlayerSave(player: PlayerState, now = Date.now()): string {
  return JSON.stringify(snapshotPlayerSave(player, now));
}

export function parsePlayerSave(raw: string | null): PlayerSaveData | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || value.version !== PLAYER_SAVE_VERSION) return null;

  const inventory: Partial<Record<ItemId, number>> = {};
  if (isRecord(value.inventory)) {
    for (const itemId of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
      const quantity = value.inventory[itemId];
      if (typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0) {
        inventory[itemId] = Math.min(itemId === "healing_potion" ? HEALING_POTION.capacity : 65_535, quantity);
      }
    }
  }
  const maxHealth = Math.floor(finiteNumber(value.maxHealth, 5, 1, 127));
  const storage: Partial<Record<ItemId, number>> = {};
  if (isRecord(value.storage)) {
    for (const itemId of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
      const quantity = value.storage[itemId];
      if (typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0) storage[itemId] = Math.min(65_535, quantity);
    }
  }
  const maxStamina = finiteNumber(value.maxStamina, 100, 1, 10_000);
  const mainHandId = isKeyOf(value.mainHandId, MAIN_HAND_DEFINITIONS) ? value.mainHandId : "longsword";
  const mainHand = MAIN_HAND_DEFINITIONS[mainHandId];
  const equippedPower = isKeyOf(value.equippedPower, POWER_DEFINITIONS)
    ? compatiblePowerOrFallback(value.equippedPower, mainHand.tag)
    : "shockwave";
  const equippedPowerSecondary = isKeyOf(value.equippedPowerSecondary, POWER_DEFINITIONS)
    ? compatiblePowerOrFallback(value.equippedPowerSecondary, mainHand.tag)
    : "eruption";

  return {
    version: PLAYER_SAVE_VERSION,
    savedAt: finiteNumber(value.savedAt, 0, 0, Number.MAX_SAFE_INTEGER),
    name: typeof value.name === "string" ? value.name.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 20) || "Explorer" : "Explorer",
    appearance: resolveAppearance(value.appearance),
    health: Math.floor(finiteNumber(value.health, maxHealth, 1, maxHealth)),
    maxHealth,
    stamina: finiteNumber(value.stamina, maxStamina, 0, maxStamina),
    maxStamina,
    level: Math.floor(finiteNumber(value.level, 1, 1, 20)),
    experience: Math.floor(finiteNumber(value.experience, 0, 0, 1_000_000)),
    unspentStatPoints: Math.floor(finiteNumber(value.unspentStatPoints, 0, 0, 19)),
    powerPoints: Math.floor(finiteNumber(value.powerPoints, 0, 0, 5)),
    vitalityPoints: Math.floor(finiteNumber(value.vitalityPoints, 0, 0, 5)),
    agilityPoints: Math.floor(finiteNumber(value.agilityPoints, 0, 0, 5)),
    miningPoints: Math.floor(finiteNumber(value.miningPoints, 0, 0, 5)),
    coins: Math.floor(finiteNumber(value.coins, TAVERN_QUIZ_STARTING_COINS, 0, 1_000_000)),
    potionCooldownUntil: finiteNumber(value.potionCooldownUntil, 0, 0, Number.MAX_SAFE_INTEGER),
    blacksmithUpgrades: Math.floor(finiteNumber(value.blacksmithUpgrades, 0, 0, 511)),
    reforgeRanks: parseReforgeRanks(value.reforgeRanks),
    signaturePity: parseSignaturePity(value.signaturePity),
    huntMastery: parseHuntMastery(value.huntMastery),
    huntLoadouts: parseHuntLoadouts(value.huntLoadouts),
    huntCollectionRewardClaimed: value.huntCollectionRewardClaimed === true,
    forestBestTimeMs: Math.floor(finiteNumber(value.forestBestTimeMs, 0, 0, 86_400_000)),
    silverDepthsBestTimeMs: Math.floor(finiteNumber(value.silverDepthsBestTimeMs, 0, 0, 86_400_000)),
    miningExpeditionStage: Math.floor(finiteNumber(value.miningExpeditionStage,
      (inventory.miners_lantern ?? 0) + (storage.miners_lantern ?? 0) > 0 ? 7 : 0, 0, 8)),
    silverDepthsStage: Math.floor(finiteNumber(value.silverDepthsStage, 0, 0, 7)),
    realmWardenCleared: value.realmWardenCleared === true,
    inventory,
    storage,
    mainHandId,
    recoveryBags: parseRecoveryBags(value.recoveryBags),
    armourId: ArmourEquipSchema.safeParse({ armourId: value.armourId }).data?.armourId ?? "none",
    equippedPower,
    equippedPowerSecondary,
    seismicMastery: isKeyOf(value.seismicMastery, SEISMIC_CLEAVE_UPGRADES.masteries) ? value.seismicMastery : "advancing_fault",
    equippedSpecial: isKeyOf(value.equippedSpecial, SPECIAL_DEFINITIONS) ? value.equippedSpecial : "hunters_mark",
    equippedTrait: isKeyOf(value.equippedTrait, TRAIT_DEFINITIONS) ? value.equippedTrait : "momentum",
  };
}

export function applyPlayerSave(player: PlayerState, save: PlayerSaveData): void {
  player.name = save.name;
  const appearance = resolveAppearance(save.appearance);
  player.appearanceSkin = appearance.skin;
  player.appearanceHair = appearance.hair;
  player.appearanceCoat = appearance.coat;
  player.appearanceHairStyle = appearance.hairStyle;
  player.appearanceCoatStyle = appearance.coatStyle;
  player.maxHealth = save.maxHealth;
  player.health = save.health;
  player.maxStamina = save.maxStamina;
  player.level = save.level ?? 1;
  player.experience = save.experience ?? 0;
  player.unspentStatPoints = save.unspentStatPoints ?? 0;
  player.powerPoints = save.powerPoints ?? 0;
  player.vitalityPoints = save.vitalityPoints ?? 0;
  player.agilityPoints = save.agilityPoints ?? 0;
  player.miningPoints = save.miningPoints ?? 0;
  player.coins = save.coins;
  player.potionCooldownUntil = save.potionCooldownUntil ?? 0;
  player.blacksmithUpgrades = save.blacksmithUpgrades;
  player.reforgeRanksJson = serializeReforgeRanks(save.reforgeRanks ?? {});
  player.signaturePityJson = serializeSignaturePity(save.signaturePity ?? {});
  player.huntMasteryJson = serializeHuntMastery(save.huntMastery ?? {});
  player.huntLoadoutsJson = JSON.stringify(save.huntLoadouts ?? []);
  player.huntCollectionRewardClaimed = save.huntCollectionRewardClaimed === true;
  player.forestBestTimeMs = save.forestBestTimeMs ?? 0;
  player.silverDepthsBestTimeMs = save.silverDepthsBestTimeMs ?? 0;
  player.miningExpeditionStage = save.miningExpeditionStage ?? 0;
  player.silverDepthsStage = save.silverDepthsStage ?? 0;
  player.realmWardenCleared = save.realmWardenCleared === true;
  player.stamina = save.stamina;
  restoreRecoveryBags(player, save.recoveryBags ?? []);
  for (const [itemId, quantity] of Object.entries(save.inventory) as [ItemId, number][]) {
    const item = new InventoryItemState();
    item.quantity = quantity;
    player.inventory.set(itemId, item);
  }
  const mainHandId = canEquipMainHand(save.mainHandId, itemId => player.inventory.get(itemId)?.quantity ?? 0)
    ? save.mainHandId
    : "longsword";
  for (const [itemId, quantity] of Object.entries(save.storage ?? {}) as [ItemId, number][]) {
    const item = new InventoryItemState(); item.quantity = quantity; player.storage.set(itemId, item);
  }
  const mainHand = MAIN_HAND_DEFINITIONS[mainHandId];
  player.mainHandId = mainHandId;
  player.mainHandTag = mainHand.tag;
  player.armourId = save.armourId && (save.armourId === "none" || (player.inventory.get(save.armourId)?.quantity ?? 0) > 0) ? save.armourId : "none";
  player.equippedPower = compatiblePowerOrFallback(save.equippedPower, mainHand.tag);
  player.equippedPowerSecondary = compatiblePowerOrFallback(save.equippedPowerSecondary ?? "eruption", mainHand.tag);
  player.seismicMastery = save.seismicMastery;
  player.equippedSpecial = save.equippedSpecial;
  player.equippedTrait = save.equippedTrait;
}
