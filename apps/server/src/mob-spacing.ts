import type { Position } from "./action-rules.js";
export const mobPersonalSpace = (a?: string, b?: string) => a === "stone_brute" || b === "stone_brute" ? 1.15 : .75;

/** Soft steering only; the navigation sweep still decides what terrain permits. */
export function spacedMobDesired(id: string, start: Position, desired: { x: number; z: number },
  peers: readonly (Position & { id: string; archetype?: string })[], archetype?: string): { x: number; z: number } {
  const travel = Math.hypot(desired.x - start.x, desired.z - start.z);
  if (travel < .00001) return desired;
  let rx = 0; let rz = 0;
  for (const peer of peers) {
    if (peer.id === id || Math.abs(peer.y - start.y) > 1) continue;
    const dx = start.x - peer.x; const dz = start.z - peer.z;
    const distance = Math.hypot(dx, dz);
    const radius = mobPersonalSpace(archetype, peer.archetype) + .65;
    if (distance >= radius) continue;
    // Smaller allies yield sooner; the brute keeps a steady centre lane, without pushing anyone.
    const priority = archetype === "stone_brute" && peer.archetype !== "stone_brute" ? .6
      : peer.archetype === "stone_brute" && archetype !== "stone_brute" ? 1.3 : 1;
    const strength = (radius - distance) / radius * priority;
    if (distance < .001) rx += id < peer.id ? -strength : strength;
    else { rx += dx / distance * strength; rz += dz / distance * strength; }
  }
  const magnitude = Math.hypot(rx, rz);
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  // At touching distance repulsion can stop inward movement, not teleport either mob.
  const dx = desired.x - start.x + rx * scale * travel * 2;
  const dz = desired.z - start.z + rz * scale * travel * 2;
  const length = Math.hypot(dx, dz);
  const limit = length > travel ? travel / length : 1;
  return { x: start.x + dx * limit, z: start.z + dz * limit };
}
