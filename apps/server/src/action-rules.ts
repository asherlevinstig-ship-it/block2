import type { ActionRejected, MineBlockRequest, MoveRequest } from "@blockcraft/protocol";
import { Block, isProtectedVoxel, type BlockId } from "@blockcraft/voxel-world";

type RejectionReason = ActionRejected["reason"];

export interface Position {
  x: number;
  y: number;
  z: number;
}

export function movementRejectionReason(player: Position, request: MoveRequest): RejectionReason | null {
  void player;
  return Math.hypot(request.strafe, request.forward) > 1.01 ? "range" : null;
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
