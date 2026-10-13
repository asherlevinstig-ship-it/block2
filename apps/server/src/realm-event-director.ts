import type { ItemId } from "@blockcraft/protocol";
import { ASHEN_SPIRE_POSITION, STONE_BRUTE_ARENA_HOME } from "@blockcraft/voxel-world";
import type { MobArchetypeId } from "./mob-archetypes.js";

export type RealmEventKey = "greenwood" | "stoneheart" | "ashglass" | "realm-warden";
export type RealmEventPhase = "idle" | "warning" | "active" | "cooldown";
export type RealmEventDefinition = {
  key: RealmEventKey;
  id: string;
  name: string;
  title: string;
  detail: string;
  archetype: MobArchetypeId;
  position: { x: number; y: number; z: number };
  triggerIds: readonly string[];
  tier: number;
  baseHealth: number;
  healthPerPlayer: number;
  baseDamage: number;
  rewardMultiplier: number;
  rewards: readonly { itemId: ItemId; quantity: number }[];
  opensForestPortal?: boolean;
  realmBoss?: boolean;
};

export const REALM_EVENT_REQUIRED = 3;
export const REALM_EVENT_TRACKING_RADIUS = 160;
export const REALM_EVENT_SCALING_RADIUS = 30;
export const REALM_EVENT_MAX_PLAYERS = 6;
export const REALM_EVENT_WARNING_MS = 8_000;
export const REALM_EVENT_COOLDOWN_MS = 45_000;
const TRIGGER_WINDOW_MS = 60_000;

export const REALM_EVENT_DEFINITIONS: readonly RealmEventDefinition[] = [
  {
    key: "greenwood", id: "greenwood-venom-matriarch", name: "Greenwood Venom Matriarch",
    title: "Venom Matriarch · Public Event",
    detail: "Dodge aimed shots and fan gaps. Deal damage to qualify for personal loot and open the Forest Dungeon.",
    archetype: "cave_spitter", position: { x: 43.5, y: 8, z: 18.5 },
    triggerIds: ["wild-crawler", "greenwood-briar", "greenwood-briar-north"], tier: 1,
    baseHealth: 24, healthPerPlayer: 12, baseDamage: 1, rewardMultiplier: 1.5,
    rewards: [{ itemId: "acid_gland", quantity: 3 }], opensForestPortal: true,
  },
  {
    key: "stoneheart", id: "stoneheart-siege-lord", name: "Stoneheart Siege Lord",
    title: "Stoneheart Siege · Public Event",
    detail: "Use the arena pillars against rock volleys, escape the marked slam, then punish its recovery.",
    archetype: "stone_brute", position: STONE_BRUTE_ARENA_HOME,
    triggerIds: ["stone-brute", "frontier-brute"], tier: 2,
    baseHealth: 32, healthPerPlayer: 14, baseDamage: 2, rewardMultiplier: 1.75,
    rewards: [{ itemId: "stone_core", quantity: 4 }, { itemId: "rootbound_hammer", quantity: 1 }],
  },
  {
    key: "ashglass", id: "ashglass-oracle", name: "Ashglass Oracle",
    title: "Ashglass Oracle · Public Event",
    detail: "Cross the fan-fire gaps, break the Oracle's firing rhythm, and claim its crystal equipment.",
    archetype: "cave_spitter", position: ASHEN_SPIRE_POSITION,
    triggerIds: ["ashglass-sentry-west", "ashglass-sentry-east"], tier: 3,
    baseHealth: 36, healthPerPlayer: 16, baseDamage: 2, rewardMultiplier: 2,
    rewards: [{ itemId: "silver_ore", quantity: 5 }, { itemId: "echo_prism", quantity: 1 }],
  },
  {
    key: "realm-warden", id: "realm-stone-warden", name: "Realm Stone Warden",
    title: "Realm Stone Warden · Realm Boss",
    detail: "The realm threat has peaked. Rally nearby players, survive the Warden's volleys and slams, and reset the realm cycle.",
    archetype: "stone_brute", position: { x: 68.5, y: 8, z: 34.5 },
    triggerIds: [], tier: 3,
    baseHealth: 54, healthPerPlayer: 22, baseDamage: 3, rewardMultiplier: 2.5,
    rewards: [{ itemId: "moonstone", quantity: 1 }, { itemId: "rootguard_armour", quantity: 1 }, { itemId: "healing_potion", quantity: 2 }],
    realmBoss: true,
  },
] as const;

export const REALM_EVENT_IDS = REALM_EVENT_DEFINITIONS.map(event => event.id);

export type RealmEventStatus = {
  phase: RealmEventPhase;
  eventId: string | null;
  eventName: string | null;
  eventTitle: string | null;
  targetX: number;
  targetY: number;
  targetZ: number;
  warningUntil: number;
  completed: number;
  required: number;
  realmBoss: boolean;
};

export function realmEventDefinition(value: string | RealmEventKey | null): RealmEventDefinition | null {
  return REALM_EVENT_DEFINITIONS.find(event => event.id === value || event.key === value) ?? null;
}

export function isRealmEventId(id: string): boolean {
  return REALM_EVENT_IDS.includes(id);
}

export function realmEventScale(nearbyPlayers: number, definition: RealmEventDefinition): { players: number; maxHealth: number; attackDamage: number; rewardMultiplier: number } {
  const players = Math.max(1, Math.min(REALM_EVENT_MAX_PLAYERS, Math.floor(nearbyPlayers)));
  return {
    players,
    maxHealth: definition.baseHealth + (players - 1) * definition.healthPerPlayer,
    attackDamage: Math.max(definition.baseDamage, players >= 4 ? 2 : 1),
    rewardMultiplier: definition.rewardMultiplier + (players - 1) * .25,
  };
}

/** Drives one public encounter at a time and escalates three regional victories into a realm boss. */
export class RealmEventDirector {
  private currentPhase: RealmEventPhase = "idle";
  private currentKey: RealmEventKey | null = null;
  private warningEndsAt = 0;
  private nextAt = 0;
  private readonly defeated = new Map<string, number>();
  private readonly completed = new Set<RealmEventKey>();

  get phase(): RealmEventPhase { return this.currentPhase; }
  get definition(): RealmEventDefinition | null { return realmEventDefinition(this.currentKey); }

  private tick(now: number): void {
    if (this.currentPhase === "cooldown" && now >= this.nextAt) {
      this.currentPhase = "idle";
      this.currentKey = null;
    }
  }

  private arm(definition: RealmEventDefinition, now: number): RealmEventDefinition {
    this.currentKey = definition.key;
    this.currentPhase = "warning";
    this.warningEndsAt = now + REALM_EVENT_WARNING_MS;
    this.nextAt = 0;
    for (const id of definition.triggerIds) this.defeated.delete(id);
    return definition;
  }

  recordTrigger(id: string, now: number, eventActive: boolean | Iterable<string> = false): RealmEventDefinition | null {
    this.tick(now);
    const active = typeof eventActive === "boolean" ? eventActive : [...eventActive].some(candidate => isRealmEventId(candidate));
    if (active || this.currentPhase !== "idle") return null;
    for (const definition of REALM_EVENT_DEFINITIONS) {
      if (definition.realmBoss || this.completed.has(definition.key) || !definition.triggerIds.includes(id)) continue;
      this.defeated.set(id, now);
      if (definition.triggerIds.every(member => now - (this.defeated.get(member) ?? -Infinity) <= TRIGGER_WINDOW_MS)) return this.arm(definition, now);
    }
    return null;
  }

  release(now: number): RealmEventDefinition | null {
    if (this.currentPhase !== "warning" || now < this.warningEndsAt) return null;
    this.currentPhase = "active";
    this.warningEndsAt = 0;
    return this.definition;
  }

  complete(mobId: string, now: number): { definition: RealmEventDefinition; realmBossArmed: boolean; realmCleared: boolean } | null {
    const definition = this.definition;
    if (this.currentPhase !== "active" || !definition || definition.id !== mobId) return null;
    if (definition.realmBoss) {
      this.completed.clear();
      this.currentPhase = "cooldown";
      this.currentKey = null;
      this.nextAt = now + REALM_EVENT_COOLDOWN_MS;
      return { definition, realmBossArmed: false, realmCleared: true };
    }
    this.completed.add(definition.key);
    if (this.completed.size >= REALM_EVENT_REQUIRED) {
      this.arm(REALM_EVENT_DEFINITIONS.find(event => event.realmBoss)!, now);
      return { definition, realmBossArmed: true, realmCleared: false };
    }
    this.currentPhase = "cooldown";
    this.currentKey = null;
    this.nextAt = now + REALM_EVENT_COOLDOWN_MS;
    return { definition, realmBossArmed: false, realmCleared: false };
  }

  status(now: number): RealmEventStatus {
    this.tick(now);
    const definition = this.definition;
    return {
      phase: this.currentPhase,
      eventId: definition?.id ?? null,
      eventName: definition?.name ?? null,
      eventTitle: definition?.title ?? null,
      targetX: definition?.position.x ?? 0,
      targetY: definition?.position.y ?? 0,
      targetZ: definition?.position.z ?? 0,
      warningUntil: this.warningEndsAt,
      completed: this.completed.size,
      required: REALM_EVENT_REQUIRED,
      realmBoss: definition?.realmBoss === true,
    };
  }
}
