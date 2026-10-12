import { SILVER_DEPTHS } from "@blockcraft/voxel-world";

export type SilverDepthsZone = "entrance" | "gallery" | "iron" | "silver" | "checkpoint" | "arena";
export type Colour = readonly [number, number, number];
export type SilverDepthsAtmosphere = {
  name: string;
  detail: string;
  ambient: Colour;
  fog: Colour;
  fogStart: number;
  fogEnd: number;
  cue: "depthsEntrance" | "depthsWing" | "depthsArena";
};

export const SILVER_DEPTHS_ATMOSPHERES: Record<SilverDepthsZone, SilverDepthsAtmosphere> = {
  entrance: { name: "THE SILVER DEPTHS", detail: "Follow the warm lanterns to the Moonstone seal",
    ambient: [.18, .16, .18], fog: [.065, .055, .095], fogStart: 20, fogEnd: 40, cue: "depthsEntrance" },
  gallery: { name: "SPITTER GALLERY", detail: "Crystal-lit cover breaks the spitter volleys",
    ambient: [.105, .105, .19], fog: [.04, .04, .11], fogStart: 19, fogEnd: 39, cue: "depthsEntrance" },
  iron: { name: "IRON BASTION", detail: "Amber ore lights the northern mining wing",
    ambient: [.18, .105, .07], fog: [.095, .045, .025], fogStart: 18, fogEnd: 37, cue: "depthsWing" },
  silver: { name: "SILVER ECHO", detail: "Cold silver light reveals the southern mining wing",
    ambient: [.075, .17, .21], fog: [.025, .075, .105], fogStart: 19, fogEnd: 38, cue: "depthsWing" },
  checkpoint: { name: "CRYSTAL CHECKPOINT", detail: "Regroup before opening the Matriarch gate",
    ambient: [.13, .11, .2], fog: [.055, .04, .11], fogStart: 19, fogEnd: 39, cue: "depthsEntrance" },
  arena: { name: "MATRIARCH ARENA", detail: "Read crystal bursts and counter during recovery",
    ambient: [.14, .065, .17], fog: [.07, .018, .08], fogStart: 18, fogEnd: 39, cue: "depthsArena" },
};

export function silverDepthsZone(position: { x: number; y: number; z: number }): SilverDepthsZone | null {
  if (position.y >= 6 || position.x < SILVER_DEPTHS.minX - .5 || position.x > SILVER_DEPTHS.maxX + 1.5
    || position.z < SILVER_DEPTHS.minZ - 1 || position.z > SILVER_DEPTHS.maxZ + 1) return null;
  if (position.x >= 124) return "arena";
  if (position.x >= 108 && position.z >= 7 && position.z <= 22) return "checkpoint";
  if (position.x >= 88 && position.z < 3.5) return "iron";
  if (position.x >= 88 && position.z > 26.5) return "silver";
  if (position.x >= 83) return "gallery";
  return "entrance";
}

export function silverDepthsLightColour(x: number, z: number): Colour {
  const zone = silverDepthsZone({ x, y: 1, z });
  if (zone === "iron") return [1, .43, .15];
  if (zone === "silver") return [.36, .83, 1];
  if (zone === "entrance") return [1, .72, .42];
  if (zone === "arena") return [.85, .24, .68];
  return [.5, .37, 1];
}
