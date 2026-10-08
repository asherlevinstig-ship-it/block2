export interface PredictionPose { x: number; y: number; z: number }
export interface PredictionFrame { sequence: number; x: number; z: number }

/** An acknowledgement names a held input, not a fixed simulation timestep.
 * Replay only later inputs, leaving the boundary interval to the reconciliation
 * tolerance. Preserve frame order so turns and collisions are not vector-summed.
 */
export function replayPendingMovement(
  authority: PredictionPose,
  acknowledged: number,
  frames: readonly PredictionFrame[],
  resolve: (pose: PredictionPose, delta: PredictionPose) => PredictionPose,
): PredictionPose {
  let pose = { ...authority };
  for (const frame of frames) {
    if (frame.sequence > acknowledged) pose = resolve(pose, { x: frame.x, y: 0, z: frame.z });
  }
  return pose;
}
