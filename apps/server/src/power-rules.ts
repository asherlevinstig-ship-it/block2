import type { PowerDefinition } from "@blockcraft/protocol";

export interface PowerPosition {
  x: number;
  y: number;
  z: number;
}

export interface PowerTarget extends PowerPosition {
  id: string;
  alive: boolean;
}

export function powerDirection(yaw: number): { x: number; z: number } {
  const radians = yaw * Math.PI / 180;
  return { x: Math.sin(radians), z: Math.cos(radians) };
}

export function isPowerCompatible(definition: PowerDefinition, mainHandTag: string): boolean {
  return definition.compatibility.includes("universal")
    || definition.compatibility.includes(mainHandTag as "melee" | "ranged" | "focus" | "tool");
}

export function selectLinePowerTargets(
  origin: PowerPosition,
  yaw: number,
  targets: readonly PowerTarget[],
  range: number,
  width: number,
): PowerTarget[] {
  const direction = powerDirection(yaw);
  const halfWidth = width / 2;
  return targets
    .map(target => {
      const deltaX = target.x - origin.x;
      const deltaZ = target.z - origin.z;
      const forward = deltaX * direction.x + deltaZ * direction.z;
      const lateral = Math.abs(deltaX * direction.z - deltaZ * direction.x);
      return { target, forward, lateral };
    })
    .filter(candidate => candidate.target.alive
      && Math.abs(candidate.target.y - origin.y) <= 1.75
      && candidate.forward >= 0.15
      && candidate.forward <= range
      && candidate.lateral <= halfWidth)
    .sort((left, right) => left.forward - right.forward)
    .map(candidate => candidate.target);
}

export function lineFractureColumns(origin: PowerPosition, yaw: number, range: number): { x: number; z: number }[] {
  const direction = powerDirection(yaw);
  const columns = new Map<string, { x: number; z: number }>();
  for (let distance = 1; distance <= Math.floor(range); distance += 1) {
    const x = Math.floor(origin.x + direction.x * distance);
    const z = Math.floor(origin.z + direction.z * distance);
    columns.set(`${x},${z}`, { x, z });
  }
  return [...columns.values()];
}
