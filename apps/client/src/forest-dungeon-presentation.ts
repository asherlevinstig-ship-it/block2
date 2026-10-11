export type ForestDungeonRoom = 0 | 1 | 2 | 3;

export interface ForestDungeonAtmosphere {
  room: ForestDungeonRoom;
  name: string;
  ambient: readonly [number, number, number];
  fog: readonly [number, number, number];
  fogStart: number;
  fogEnd: number;
}

const OUTSIDE: ForestDungeonAtmosphere = {
  room: 0, name: "", ambient: [0.43, 0.48, 0.54], fog: [0.21, 0.3, 0.32], fogStart: 34, fogEnd: 58,
};

const ROOMS: readonly ForestDungeonAtmosphere[] = [
  { room: 1, name: "ROOTBOUND APPROACH", ambient: [0.2, 0.31, 0.22], fog: [0.075, 0.17, 0.105], fogStart: 25, fogEnd: 47 },
  { room: 2, name: "VENOM CROSSING", ambient: [0.18, 0.27, 0.2], fog: [0.065, 0.135, 0.09], fogStart: 23, fogEnd: 44 },
  { room: 3, name: "GUARDIAN'S HEART", ambient: [0.23, 0.24, 0.16], fog: [0.12, 0.105, 0.065], fogStart: 21, fogEnd: 42 },
];

export function forestDungeonAtmosphere(x: number, z: number): ForestDungeonAtmosphere {
  if (x < 156 || x > 193 || z < 156 || z > 175) return OUTSIDE;
  return ROOMS[x < 168 ? 0 : x < 180 ? 1 : 2]!;
}

export type ForestDungeonNotice = { kind: "gate" | "victory"; x: number; z: number; title: string } | null;

export function forestDungeonNotice(message: string): ForestDungeonNotice {
  if (/Room 1 cleared/i.test(message)) return { kind: "gate", x: 168.5, z: 165.5, title: "ROOT GATE OPEN" };
  if (/Room 2 cleared/i.test(message)) return { kind: "gate", x: 180.5, z: 165.5, title: "HEART GATE OPEN" };
  if (/Guardian defeated/i.test(message)) return { kind: "victory", x: 189.5, z: 165.5, title: "GUARDIAN DEFEATED" };
  return null;
}

export interface PortalNoticeFeedback { title: string; cue: "hit" | "dodge" }

export function portalNoticeFeedback(message: string): PortalNoticeFeedback | null {
  if (/Ember Vault entered/i.test(message)) return { title: "EMBER VAULT", cue: "dodge" };
  if (/Ember Vault cleared/i.test(message)) return { title: "VAULT CLEARED", cue: "dodge" };
  if (/Silver Depths entered/i.test(message)) return { title: "SILVER DEPTHS", cue: "dodge" };
  if (/Expedition complete/i.test(message)) return { title: "EXPEDITION COMPLETE", cue: "dodge" };
  if (/portal opened/i.test(message)) return { title: "EXPEDITION PORTAL OPEN", cue: "dodge" };
  if (/requires|unlock|complete the first|before extracting|still active|occupied|recovering|late entry|claim your/i.test(message)) {
    return { title: "PORTAL LOCKED", cue: "hit" };
  }
  return null;
}
