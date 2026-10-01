export interface PlayerCutaway {
  active: boolean;
  sliceY: number;
}

export function loweredSliceHeight(currentSliceY: number | null, playerY: number): number {
  const requestedSliceY = Math.floor(playerY + 1.5);
  return currentSliceY === null ? requestedSliceY : Math.min(currentSliceY, requestedSliceY);
}

export function shouldUseDepthSlice(
  currentSliceY: number | null,
  playerY: number,
  surfaceY: number,
  underground: boolean,
  excavating: boolean,
): boolean {
  if (currentSliceY !== null) return underground || playerY < surfaceY - 0.25;
  return underground || (excavating && playerY < surfaceY - 0.65);
}

export function isVoxelHiddenForPlayer(_x: number, y: number, _z: number, cutaway: PlayerCutaway): boolean {
  return cutaway.active && y >= cutaway.sliceY;
}

export function isBelowSurroundingSurface(playerY: number, surroundingSurfaceHeights: readonly number[]): boolean {
  const comparableHeights = surroundingSurfaceHeights.filter(height => Number.isFinite(height) && height >= 0);
  const columnsAtOrAboveFeet = comparableHeights.filter(height => height >= Math.floor(playerY)).length;
  return columnsAtOrAboveFeet >= 3;
}
