import { POWER_DEFINITIONS, type MainHandTag, type PowerDefinition, type PowerId } from "@blockcraft/protocol";

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
    || definition.compatibility.includes(mainHandTag as MainHandTag);
}

export function compatiblePowerOrFallback(powerId: string, mainHandTag: MainHandTag): PowerId {
  const definition = POWER_DEFINITIONS[powerId as PowerId];
  return definition && isPowerCompatible(definition, mainHandTag) ? definition.id as PowerId : "shockwave";
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

export function selectBurstPowerTargets(
  origin: PowerPosition,
  targets: readonly PowerTarget[],
  radius: number,
): PowerTarget[] {
  return targets
    .map(target => ({
      target,
      distance: Math.hypot(target.x - origin.x, target.z - origin.z),
    }))
    .filter(candidate => candidate.target.alive
      && Math.abs(candidate.target.y - origin.y) <= 1.75
      && candidate.distance <= radius)
    .sort((left, right) => left.distance - right.distance)
    .map(candidate => candidate.target);
}

export function selectGroundPowerTargets(
  center: PowerPosition,
  targets: readonly PowerTarget[],
  radius: number,
): PowerTarget[] {
  return selectBurstPowerTargets(center, targets, radius);
}

export function isGroundPowerTargetInRange(
  origin: PowerPosition,
  target: PowerPosition,
  range: number,
): boolean {
  return Math.hypot(target.x - origin.x, target.z - origin.z) <= range + 0.05
    && Math.abs(target.y - origin.y) <= 1.75;
}

export function selectMobilityPowerTarget(
  origin: PowerPosition,
  yaw: number,
  targets: readonly PowerTarget[],
  range: number,
  width: number,
): PowerTarget | null {
  return selectLinePowerTargets(origin, yaw, targets, range, width)[0] ?? null;
}

export function mobilityAdvanceDistance(
  origin: PowerPosition,
  yaw: number,
  target: PowerPosition | null,
  maximumDistance: number,
  standoffDistance = 0.8,
): number {
  if (!target) return maximumDistance;
  const direction = powerDirection(yaw);
  const forward = (target.x - origin.x) * direction.x + (target.z - origin.z) * direction.z;
  return Math.min(maximumDistance, Math.max(0, forward - standoffDistance));
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

export function powerEvadeDirection(origin: PowerPosition, yaw: number, target: PowerPosition): { x: number; z: number } {
  const direction = powerDirection(yaw);
  const deltaX = target.x - origin.x;
  const deltaZ = target.z - origin.z;
  const side = deltaX * direction.z - deltaZ * direction.x >= 0 ? 1 : -1;
  return { x: direction.z * side, z: -direction.x * side };
}
