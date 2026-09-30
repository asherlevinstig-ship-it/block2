import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema({
  x: t.float32().default(8.5),
  y: t.float32().default(11),
  z: t.float32().default(8.5),
  yaw: t.float32().default(0),
  lastProcessedInput: t.int32().default(0),
  name: t.string().default("Explorer"),
}, "PlayerState");
export type PlayerState = SchemaType<typeof PlayerState>;

export const WorldState = schema({
  players: t.map(PlayerState),
}, "WorldState");
export type WorldState = SchemaType<typeof WorldState>;
