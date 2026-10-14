export const GREENWOOD_MATRIARCH_ID = "greenwood-venom-matriarch";
export const STONEHEART_LORD_ID = "stoneheart-siege-lord";
export const ASHGLASS_ORACLE_ID = "ashglass-oracle";
export const REALM_WARDEN_ID = "realm-stone-warden";

export type RealmBossPhase = 1 | 2 | 3;

export function realmBossPhase(health: number, maxHealth: number): RealmBossPhase {
  if (maxHealth <= 0 || health * 3 <= maxHealth) return 3;
  if (health * 3 <= maxHealth * 2) return 2;
  return 1;
}

/** Deterministic rotations keep every cast learnable while health thresholds raise the pressure. */
export function realmBossPattern(id: string, sequence: number, health: number, maxHealth: number): string | null {
  const phase = realmBossPhase(health, maxHealth);
  if (id === GREENWOOD_MATRIARCH_ID) {
    const rotation = phase === 1 ? ["aimed", "fan"] : phase === 2 ? ["fan", "double-fan", "aimed"] : ["double-fan", "venom-ring"];
    return rotation[sequence % rotation.length]!;
  }
  if (id === STONEHEART_LORD_ID) {
    const rotation = phase === 1 ? ["rocks", "slam"] : phase === 2 ? ["rocks", "smash", "slam"] : ["falling-rocks", "smash", "rocks"];
    return rotation[sequence % rotation.length]!;
  }
  if (id === ASHGLASS_ORACLE_ID) {
    const rotation = phase === 1 ? ["aimed", "fan"] : phase === 2 ? ["crystal-burst", "aimed", "fan"] : ["teleport-burst", "double-fan", "crystal-burst"];
    return rotation[sequence % rotation.length]!;
  }
  if (id === REALM_WARDEN_ID) {
    const rotation = phase === 1 ? ["rocks", "slam", "smash"] : phase === 2 ? ["falling-rocks", "rocks", "smash"] : ["warden-barrage", "smash", "falling-rocks", "rocks"];
    return rotation[sequence % rotation.length]!;
  }
  return null;
}

export function usesRockVolley(pattern: string): boolean {
  return pattern === "rocks" || pattern === "falling-rocks" || pattern === "warden-barrage" || pattern === "fault-line"
    || pattern === "toxic-eruption" || pattern === "mirestorm";
}

export function usesFallingRockZones(pattern: string): boolean {
  return pattern === "falling-rocks" || pattern === "warden-barrage" || pattern === "fault-line" || pattern === "mirestorm";
}

export function usesDoubleVolley(pattern: string): boolean {
  return pattern === "double-fan" || pattern === "teleport-burst" || pattern === "warden-barrage" || pattern === "mirestorm";
}

export function isRealmSpitterBoss(id: string): boolean {
  return id === GREENWOOD_MATRIARCH_ID || id === ASHGLASS_ORACLE_ID;
}

export function isRealmBruteBoss(id: string): boolean {
  return id === STONEHEART_LORD_ID || id === REALM_WARDEN_ID;
}

export function fallingRockSites(target: { x: number; y: number; z: number }, sequence: number, count = 3) {
  const start = sequence % 2 === 0 ? 0 : 45;
  const satellites = Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return { ...target, radius: 1.65 };
    const angle = (start + (index - 1) * 360 / satellites) * Math.PI / 180;
    return { x: target.x + Math.sin(angle) * 2.8, y: target.y, z: target.z + Math.cos(angle) * 2.8, radius: 1.45 };
  });
}

