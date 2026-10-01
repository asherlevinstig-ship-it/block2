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
  if (currentSliceY !== null) return true;
  return underground || (excavating && playerY < surfaceY - 0.65);
}

export function bootstrapSliceHeight(
  currentSliceY: number | null,
  playerY: number,
  surfaceY: number,
  underground: boolean,
  excavating: boolean,
): number | null {
  return shouldUseDepthSlice(currentSliceY, playerY, surfaceY, underground, excavating)
    ? loweredSliceHeight(currentSliceY, playerY)
    : null;
}

export function shouldReleaseDepthSlice(
  playerY: number,
  surfaceY: number,
  underground: boolean,
  supported: boolean,
  surfaceDurationMs: number,
  releaseDelayMs = 1200,
): boolean {
  return !underground && supported && playerY >= surfaceY - 0.1 && surfaceDurationMs >= releaseDelayMs;
}

export function isAtSurfaceReturnHeight(
  playerY: number,
  surfaceY: number,
  supported: boolean,
  tolerance = 0.15,
): boolean {
  return supported && playerY >= surfaceY - tolerance;
}

export function restoredSliceHeight(
  startingSliceY: number,
  surfaceY: number,
  surfaceDurationMs: number,
  holdMs = 240,
  layerDurationMs = 180,
): number | null {
  if (surfaceDurationMs < holdMs) return startingSliceY;
  const restoredLayers = Math.floor((surfaceDurationMs - holdMs) / layerDurationMs) + 1;
  const nextSliceY = startingSliceY + restoredLayers;
  const surfaceSliceY = Math.ceil(surfaceY);
  return nextSliceY >= surfaceSliceY ? null : nextSliceY;
}

export function isVoxelHiddenForPlayer(_x: number, y: number, _z: number, cutaway: PlayerCutaway): boolean {
  return cutaway.active && y >= cutaway.sliceY;
}

export function isBelowSurroundingSurface(playerY: number, surroundingSurfaceHeights: readonly number[]): boolean {
  const comparableHeights = surroundingSurfaceHeights.filter(height => Number.isFinite(height) && height >= 0);
  const columnsAtOrAboveFeet = comparableHeights.filter(height => height >= Math.floor(playerY)).length;
  return columnsAtOrAboveFeet >= 3;
}
