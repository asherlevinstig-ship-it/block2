import type { ActionRejected, MineBlockRequest, MoveRequest } from "@blockcraft/protocol";
import { Block, isProtectedVoxel, type BlockId } from "@blockcraft/voxel-world";

type RejectionReason = ActionRejected["reason"];

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface AttackTarget extends Position {
  id: string;
  alive: boolean;
}

export function movementRejectionReason(player: Position, request: MoveRequest): RejectionReason | null {
  void player;
  return Math.hypot(request.strafe, request.forward) > 1.01 ? "range" : null;
}

export function attackRejectionReason(lastAttackAt: number | undefined, now: number, cooldownMs = 300): RejectionReason | null {
  return lastAttackAt !== undefined && now - lastAttackAt < cooldownMs ? "rate" : null;
}

export function nextComboStep(previousStep: number, comboExpiresAt: number, now: number): 1 | 2 | 3 {
  if (now > comboExpiresAt) return 1;
  return (previousStep >= 3 ? 1 : previousStep + 1) as 1 | 2 | 3;
}

export function selectAttackTarget(
  player: Position,
  yaw: number,
  targets: readonly AttackTarget[],
  maximumRange = 2.6,
  minimumFacingDot = 0.35,
): AttackTarget | null {
  const radians = yaw * Math.PI / 180;
  const facingX = Math.sin(radians);
  const facingZ = Math.cos(radians);
  let closest: AttackTarget | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    if (!target.alive || Math.abs(target.y - player.y) > 1.75) continue;
    const deltaX = target.x - player.x;
    const deltaZ = target.z - player.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance > maximumRange || distance < 0.001) continue;
    const facingDot = (deltaX * facingX + deltaZ * facingZ) / distance;
    if (facingDot < minimumFacingDot || distance >= closestDistance) continue;
    closest = target;
    closestDistance = distance;
  }
  return closest;
}

export function miningRejectionReason(
  player: Position,
  request: MineBlockRequest,
  currentBlock: BlockId,
  currentRevision: number,
): RejectionReason | null {
  const distance = Math.hypot(request.x + 0.5 - player.x, request.y + 0.5 - player.y, request.z + 0.5 - player.z);
  if (distance > 4.5) return "range";
  if (isProtectedVoxel(request.x, request.z)) return "protected";
  if (request.expectedRevision !== currentRevision) return "stale";
  if (currentBlock === Block.Air || currentBlock === Block.Bedrock) return "missing";
  return null;
}
