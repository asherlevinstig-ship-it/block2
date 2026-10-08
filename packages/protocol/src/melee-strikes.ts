import type { MainHandId } from "./index.js";

export interface StrikePoint { x: number; y: number; z: number }
export interface MeleeStrikeProfile {
  reach: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  startHeight: number;
  endHeight: number;
  beforeImpactMs: number;
  afterImpactMs: number;
  weaponLength: number;
}

export function playerMeleeStrike(mainHandId: MainHandId, step: number): MeleeStrikeProfile | null {
  if (mainHandId !== "longsword" && mainHandId !== "fang_dagger" && mainHandId !== "stone_core_hammer") return null;
  const dagger = mainHandId === "fang_dagger";
  const overhead = step === 3 || mainHandId === "stone_core_hammer";
  const reverse = step === 2;
  return {
    reach: dagger ? 1.25 : mainHandId === "stone_core_hammer" ? 1.65 : 1.7,
    radius: mainHandId === "stone_core_hammer" ? 0.22 : dagger ? 0.08 : 0.09,
    startAngle: overhead ? 5 : reverse ? -58 : 58,
    endAngle: overhead ? -5 : reverse ? 58 : -58,
    startHeight: overhead ? 1.8 : 0.95,
    endHeight: overhead ? 0.35 : 0.8,
    beforeImpactMs: overhead ? 50 : 40,
    afterImpactMs: dagger ? 65 : 90,
    weaponLength: mainHandId === "stone_core_hammer" ? 0.57 : dagger ? 0.61 : 0.63,
  };
}

export function mobMeleeStrike(archetype: string): MeleeStrikeProfile {
  const brute = archetype === "stone_brute";
  return {
    reach: brute ? 2.05 : 1.55,
    radius: brute ? 0.25 : 0.16,
    startAngle: brute ? 8 : 38,
    endAngle: brute ? -8 : -38,
    startHeight: brute ? 1.95 : 0.9,
    endHeight: brute ? 0.25 : 0.65,
    beforeImpactMs: brute ? 70 : 50,
    afterImpactMs: brute ? 100 : 85,
    weaponLength: 1,
  };
}

export const mobMeleeImpactMs = (archetype: string): number => archetype === "stone_brute" ? 280 : 150;

export function sampleMeleeStrike(origin: StrikePoint, yaw: number, profile: MeleeStrikeProfile, progress: number):
  { base: StrikePoint; tip: StrikePoint } {
  const t = Math.max(0, Math.min(1, progress));
  const facing = yaw * Math.PI / 180;
  const angle = (yaw + profile.startAngle + (profile.endAngle - profile.startAngle) * t) * Math.PI / 180;
  return {
    base: { x: origin.x + Math.sin(facing) * 0.35 + Math.cos(facing) * 0.22,
      y: origin.y + 0.95, z: origin.z + Math.cos(facing) * 0.35 - Math.sin(facing) * 0.22 },
    tip: { x: origin.x + Math.sin(angle) * profile.reach,
      y: origin.y + profile.startHeight + (profile.endHeight - profile.startHeight) * t,
      z: origin.z + Math.cos(angle) * profile.reach },
  };
}
