import { schema, t, type SchemaType } from "@colyseus/schema";

export const InventoryItemState = schema({
  quantity: t.uint16().default(0),
}, "InventoryItemState");
export type InventoryItemState = SchemaType<typeof InventoryItemState>;

export const PlayerState = schema({
  x: t.float32().default(8.5),
  y: t.float32().default(11),
  z: t.float32().default(8.5),
  yaw: t.float32().default(0),
  lastProcessedInput: t.int32().default(0),
  actionSequence: t.int32().default(0),
  attackStep: t.int8().default(0),
  health: t.int8().default(5),
  maxHealth: t.int8().default(5),
  stamina: t.float32().default(100),
  maxStamina: t.float32().default(100),
  dodgeSequence: t.int32().default(0),
  defending: t.boolean().default(false),
  defenseStartedAt: t.float64().default(0),
  momentumStacks: t.int8().default(0),
  equippedTrait: t.string().default("momentum"),
  inventory: t.map(InventoryItemState),
  invulnerableUntil: t.float64().default(0),
  mainHandId: t.string().default("longsword"),
  mainHandTag: t.string().default("melee"),
  equippedPower: t.string().default(""),
  seismicMastery: t.string().default("advancing_fault"),
  powerCooldownUntil: t.float64().default(0),
  powerSequence: t.int32().default(0),
  powerCastStartedAt: t.float64().default(0),
  specialCooldownUntil: t.float64().default(0),
  equippedSpecial: t.string().default(""),
  dangerTier: t.int8().default(0),
  name: t.string().default("Explorer"),
}, "PlayerState");
export type PlayerState = SchemaType<typeof PlayerState>;

export const LootDropState = schema({
  itemId: t.string(),
  quantity: t.uint8().default(1),
  x: t.float32(),
  y: t.float32(),
  z: t.float32(),
  expiresAt: t.float64(),
}, "LootDropState");
export type LootDropState = SchemaType<typeof LootDropState>;

export const MobState = schema({
  x: t.float32().default(24.5),
  y: t.float32().default(8),
  z: t.float32().default(14.5),
  health: t.int8().default(8),
  maxHealth: t.int8().default(8),
  alive: t.boolean().default(true),
  hitSequence: t.int32().default(0),
  actionSequence: t.int32().default(0),
  yaw: t.float32().default(0),
  combatState: t.string().default("idle"),
  stateUntil: t.float64().default(0),
  targetId: t.string().default(""),
  staggerSequence: t.int32().default(0),
  respawnAt: t.float64().default(0),
  name: t.string().default("Moss Crawler"),
  archetype: t.string().default("moss_crawler"),
  armor: t.int8().default(0),
  difficultyTier: t.int8().default(1),
  attackDamage: t.int8().default(1),
  speedMultiplier: t.float32().default(1),
  rewardMultiplier: t.float32().default(1),
}, "MobState");
export type MobState = SchemaType<typeof MobState>;

export const WorldState = schema({
  players: t.map(PlayerState),
  mobs: t.map(MobState),
  lootDrops: t.map(LootDropState),
}, "WorldState");
export type WorldState = SchemaType<typeof WorldState>;
