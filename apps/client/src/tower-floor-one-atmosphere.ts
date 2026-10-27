export interface TowerFloorOneAtmosphere {
  ambient: readonly [number, number, number];
  fog: readonly [number, number, number];
  sun: number;
  fill: number;
  fogStart: number;
  fogEnd: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(from: number, to: number, value: number): number {
  const amount = clamp01((value - from) / (to - from));
  return amount * amount * (3 - 2 * amount);
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function mixColour(a: readonly [number, number, number], b: readonly [number, number, number], amount: number): [number, number, number] {
  return [mix(a[0], b[0], amount), mix(a[1], b[1], amount), mix(a[2], b[2], amount)];
}

function mixGrade(a: TowerFloorOneAtmosphere, b: TowerFloorOneAtmosphere, amount: number): TowerFloorOneAtmosphere {
  return {
    ambient: mixColour(a.ambient, b.ambient, amount),
    fog: mixColour(a.fog, b.fog, amount),
    sun: mix(a.sun, b.sun, amount),
    fill: mix(a.fill, b.fill, amount),
    fogStart: mix(a.fogStart, b.fogStart, amount),
    fogEnd: mix(a.fogEnd, b.fogEnd, amount),
  };
}

const SANCTUARY: TowerFloorOneAtmosphere = {
  ambient: [.2, .28, .27], fog: [.085, .15, .145], sun: .82, fill: .25, fogStart: 26, fogEnd: 72,
};
const OVERGROWN_COURT: TowerFloorOneAtmosphere = {
  ambient: [.15, .225, .17], fog: [.065, .13, .085], sun: .7, fill: .18, fogStart: 21, fogEnd: 62,
};
const NORTH_WARDEN: TowerFloorOneAtmosphere = {
  ambient: [.235, .17, .13], fog: [.13, .085, .055], sun: .68, fill: .15, fogStart: 19, fogEnd: 55,
};
const SOUTH_WARDEN: TowerFloorOneAtmosphere = {
  ambient: [.105, .22, .12], fog: [.045, .13, .065], sun: .64, fill: .16, fogStart: 18, fogEnd: 54,
};
const CROWN_COURT: TowerFloorOneAtmosphere = {
  ambient: [.205, .135, .225], fog: [.105, .055, .13], sun: .6, fill: .135, fogStart: 17, fogEnd: 50,
};

/** Authored lighting journey for Floor 1. It starts legible and cool in the
 * sanctuary, grows sickly around each Warden, then compresses into the dark
 * purple-and-gold Crownkeeper court. Transitions are spatial and continuous so
 * crossing a causeway never produces a visible lighting pop. */
export function towerFloorOneAtmosphere(x: number, z: number): TowerFloorOneAtmosphere {
  const leavingSanctuary = smoothstep(316, 332, x);
  let grade = mixGrade(SANCTUARY, OVERGROWN_COURT, leavingSanctuary);

  const wardenInfluence = smoothstep(334, 345, x) * (1 - smoothstep(358, 365, x));
  const northSouth = smoothstep(101, 111, z);
  const wardenGrade = mixGrade(NORTH_WARDEN, SOUTH_WARDEN, northSouth);
  grade = mixGrade(grade, wardenGrade, wardenInfluence);

  const crownApproach = smoothstep(348, 367, x);
  return mixGrade(grade, CROWN_COURT, crownApproach);
}
