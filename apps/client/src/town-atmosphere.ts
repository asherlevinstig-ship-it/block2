import type { PaintedGroundStyle } from "./fast-world-texture.js";

export const TOWN_TEXTURE_STYLES: Readonly<Record<
  "meadow" | "verge" | "road" | "roadEdge" | "plaza" | "forecourt" | "garden",
  PaintedGroundStyle
>> = {
  meadow: {
    name: "beginnings-meadow",
    base: "#315c35",
    mottles: ["#294f30", "#3d6b3b", "#25482d", "#4a7240"],
    litter: ["#77834a", "#615c35", "#9b8f50", "#294a2d"],
    seed: 7_103,
  },
  verge: {
    name: "beginnings-verge",
    base: "#3c693b",
    mottles: ["#315a34", "#527b45", "#284b30", "#486d39"],
    litter: ["#a99d59", "#7d6339", "#5d753b", "#2c4c2e"],
    seed: 11_927,
  },
  road: {
    name: "beginnings-packed-road",
    base: "#8e7a5a",
    mottles: ["#756448", "#a08a66", "#665941", "#b29b75"],
    litter: ["#514b3d", "#c2ad83", "#7a684b", "#9f8e70"],
    seed: 18_431,
  },
  roadEdge: {
    name: "beginnings-road-edge",
    base: "#585044",
    mottles: ["#413d36", "#70665a", "#4c493f", "#817568"],
    litter: ["#9c8d70", "#35342f", "#6a604e", "#b4a080"],
    seed: 23_417,
  },
  plaza: {
    name: "beginnings-plaza-stone",
    base: "#8a8978",
    mottles: ["#747568", "#a3a18a", "#696b60", "#b0aa91"],
    litter: ["#575a52", "#c1b99b", "#77796c", "#99947e"],
    seed: 31_909,
  },
  forecourt: {
    name: "beginnings-forecourt",
    base: "#9c8561",
    mottles: ["#806e52", "#b19970", "#705f49", "#c1a77b"],
    litter: ["#5a5142", "#d0ba91", "#8c7556", "#a99472"],
    seed: 40_271,
  },
  garden: {
    name: "beginnings-garden-soil",
    base: "#4f3421",
    mottles: ["#38271c", "#68442a", "#412d20", "#765139"],
    litter: ["#8d6f3e", "#2e3c21", "#b08c50", "#513a25"],
    seed: 55_603,
  },
} as const;

export type TownAtmospherePatchMaterial = "meadow" | "verge" | "roadWear" | "moss" | "leafLitter";

export interface TownAtmospherePatch {
  id: string;
  region: "town" | "greenwood";
  material: TownAtmospherePatchMaterial;
  position: readonly [number, number];
  scale: readonly [number, number];
  yaw: number;
}

/** Broad, overlapping patches break up the old flat lawn and blend the east
 * road into Greenwood without creating visual-only collision obstacles. */
export const TOWN_ATMOSPHERE_PATCHES: readonly TownAtmospherePatch[] = [
  { id: "founders-north-meadow", region: "town", material: "meadow", position: [59, 84.5], scale: [12, 5.5], yaw: 8 },
  { id: "founders-south-meadow", region: "town", material: "meadow", position: [58, 126.5], scale: [12.5, 5.8], yaw: -7 },
  { id: "market-verge", region: "town", material: "verge", position: [87.5, 106], scale: [5.8, 13.2], yaw: 2 },
  { id: "gate-verge-north", region: "town", material: "verge", position: [101.5, 97.8], scale: [8.2, 3.1], yaw: -5 },
  { id: "gate-verge-south", region: "town", material: "verge", position: [101.5, 114.2], scale: [8.2, 3.1], yaw: 5 },
  { id: "gate-road-wear-a", region: "town", material: "roadWear", position: [99, 105.5], scale: [4.2, 1.45], yaw: 4 },
  { id: "gate-road-wear-b", region: "greenwood", material: "roadWear", position: [109, 106.45], scale: [4.8, 1.35], yaw: -4 },
  { id: "greenwood-threshold-moss-north", region: "greenwood", material: "moss", position: [111.5, 100.2], scale: [5.4, 2.5], yaw: 18 },
  { id: "greenwood-threshold-moss-south", region: "greenwood", material: "moss", position: [112.5, 112.4], scale: [5.8, 2.7], yaw: -14 },
  { id: "greenwood-road-leaves-a", region: "greenwood", material: "leafLitter", position: [116.5, 104.1], scale: [4.2, 1.45], yaw: 12 },
  { id: "greenwood-road-leaves-b", region: "greenwood", material: "leafLitter", position: [122.5, 108.2], scale: [5.1, 1.5], yaw: -9 },
  { id: "greenwood-road-leaves-c", region: "greenwood", material: "leafLitter", position: [129.5, 105], scale: [4.8, 1.35], yaw: 7 },
] as const;

export interface TownGateEmbankment {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  yaw: number;
}

/** Low side banks frame the adventure road while leaving the playable lane
 * entirely clear. Their shallow height keeps server collision visually honest. */
export const TOWN_GATE_EMBANKMENTS: readonly TownGateEmbankment[] = [
  { id: "north-bank-a", x: 108.5, z: 98.1, width: 5.7, depth: 2.5, height: .18, yaw: 8 },
  { id: "south-bank-a", x: 109.5, z: 113.9, width: 6.2, depth: 2.6, height: .2, yaw: -7 },
  { id: "north-bank-b", x: 119, z: 97.2, width: 7.2, depth: 2.8, height: .26, yaw: -5 },
  { id: "south-bank-b", x: 120, z: 115.1, width: 7.5, depth: 2.9, height: .28, yaw: 6 },
] as const;

export interface TownAtmosphereParticle {
  kind: "leaf" | "pollen";
  x: number;
  y: number;
  z: number;
  phase: number;
}

export const TOWN_ATMOSPHERE_PARTICLES: readonly TownAtmosphereParticle[] = [
  ...Array.from({ length: 8 }, (_, index) => ({
    kind: "pollen" as const,
    x: 64 + index % 4 * 2.1,
    y: 9 + index % 3 * .45,
    z: 101 + Math.floor(index / 4) * 9.8,
    phase: index * .73,
  })),
  ...Array.from({ length: 14 }, (_, index) => ({
    kind: "leaf" as const,
    x: 105 + index % 7 * 3.4,
    y: 9.2 + index % 4 * .55,
    z: index % 2 ? 100.2 + index % 3 : 111.8 - index % 3,
    phase: index * .61,
  })),
] as const;

