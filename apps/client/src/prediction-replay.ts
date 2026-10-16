export interface PredictionPose { x: number; y: number; z: number }
export interface PredictionFrame {
  sequence: number; x: number; z: number;
  kind?: "dodge";
  requestId?: string;
  confirmed?: boolean;
}

/** An acknowledgement names a held input, not a fixed simulation timestep.
 * Replay only later inputs, leaving the boundary interval to the reconciliation
 * tolerance. Preserve frame order so turns and collisions are not vector-summed.
 */
export function replayPendingMovement(
  authority: PredictionPose,
  acknowledged: number,
  frames: readonly PredictionFrame[],
  resolve: (pose: PredictionPose, delta: PredictionPose) => PredictionPose,
  resolveDodge: (pose: PredictionPose, delta: PredictionPose) => PredictionPose = resolve,
): PredictionPose {
  let pose = { ...authority };
  for (const frame of frames) {
    if (frame.kind === "dodge") {
      // A movement acknowledgement does not imply that a separately sent dodge
      // has appeared in the same authoritative position snapshot.
      if (!frame.confirmed) pose = resolveDodge(pose, { x: frame.x, y: 0, z: frame.z });
    } else if (frame.sequence > acknowledged) pose = resolve(pose, { x: frame.x, y: 0, z: frame.z });
  }
  return pose;
}

/** The schema's dodgeSequence is the authoritative acknowledgement for a dash. */
export function confirmPredictedDodges(frames: PredictionFrame[], count: number): void {
  for (const frame of frames) {
    if (count <= 0) break;
    if (frame.kind !== "dodge" || frame.confirmed) continue;
    frame.confirmed = true;
    count -= 1;
  }
}

export function removeRejectedDodge(frames: PredictionFrame[], requestId: string | undefined): PredictionFrame | null {
  if (!requestId) return null;
  const index = frames.findIndex(frame => frame.kind === "dodge" && frame.requestId === requestId && !frame.confirmed);
  return index < 0 ? null : frames.splice(index, 1)[0] ?? null;
}
