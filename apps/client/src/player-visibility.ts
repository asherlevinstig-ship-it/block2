export interface PlayerCutaway {
  active: boolean;
  playerX: number;
  playerY: number;
  playerZ: number;
  cameraOffsetX: number;
  cameraOffsetZ: number;
}

export interface CutawayAnchor {
  x: number;
  y: number;
  z: number;
}

export function stableCutawayAnchor(
  current: CutawayAnchor | null,
  player: CutawayAnchor,
  horizontalDeadZone = 2,
): CutawayAnchor {
  const roundedPlayer = {
    x: Math.round(player.x),
    y: Math.round(player.y * 2) / 2,
    z: Math.round(player.z),
  };
  if (!current) return roundedPlayer;
  if (roundedPlayer.y !== current.y) return roundedPlayer;
  if (Math.hypot(player.x - current.x, player.z - current.z) > horizontalDeadZone) return roundedPlayer;
  return current;
}

export function isVoxelHiddenForPlayer(x: number, y: number, z: number, cutaway: PlayerCutaway): boolean {
  if (!cutaway.active) return false;

  const blockX = x + 0.5;
  const blockZ = z + 0.5;
  const dx = blockX - cutaway.playerX;
  const dz = blockZ - cutaway.playerZ;
  const playerFloorY = Math.floor(cutaway.playerY);
  const roofY = Math.floor(cutaway.playerY + 1.45);

  // Never remove the block layer supporting the player's feet.
  if (y < playerFloorY) return false;

  const roofOpening = y >= roofY && Math.hypot(dx, dz) < 7;
  if (roofOpening) return true;

  const cameraLength = Math.hypot(cutaway.cameraOffsetX, cutaway.cameraOffsetZ) || 1;
  const cameraDirectionX = cutaway.cameraOffsetX / cameraLength;
  const cameraDirectionZ = cutaway.cameraOffsetZ / cameraLength;
  const distanceTowardCamera = dx * cameraDirectionX + dz * cameraDirectionZ;
  const distanceFromSightline = Math.abs(dx * cameraDirectionZ - dz * cameraDirectionX);
  return distanceTowardCamera > 0.25 && distanceTowardCamera < 10 && distanceFromSightline < 2.25;
}

export function isBelowSurroundingSurface(playerY: number, surroundingSurfaceHeights: readonly number[]): boolean {
  const comparableHeights = surroundingSurfaceHeights.filter(height => Number.isFinite(height) && height >= 0);
  const columnsAtOrAboveFeet = comparableHeights.filter(height => height >= Math.floor(playerY)).length;
  return columnsAtOrAboveFeet >= 3;
}
