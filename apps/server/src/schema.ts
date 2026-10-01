import { schema, t, type SchemaType } from "@colyseus/schema";

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
  invulnerableUntil: t.float64().default(0),
  name: t.string().default("Explorer"),
}, "PlayerState");
export type PlayerState = SchemaType<typeof PlayerState>;

export const MobState = schema({
  x: t.float32().default(13.5),
  y: t.float32().default(8),
  z: t.float32().default(11.5),
  health: t.int8().default(3),
  maxHealth: t.int8().default(3),
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
}, "MobState");
export type MobState = SchemaType<typeof MobState>;

export const WorldState = schema({
  players: t.map(PlayerState),
  mobs: t.map(MobState),
}, "WorldState");
export type WorldState = SchemaType<typeof WorldState>;
