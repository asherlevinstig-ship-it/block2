export const SPITTER_PATTERN = { range: 10, travelMs: 1250, fanOffsets: [-30, -12, 12, 30], laneHalfWidth: .42 } as const;
export const spitterShotOffsets = (pattern: string): readonly number[] => pattern === "fan" || pattern === "double-fan" ? SPITTER_PATTERN.fanOffsets : [0];
export const MATRIARCH_PHASE = { volleyGapMs: 500, recoveryMs: 2600 } as const;
export const matriarchEnraged = (health: number, maxHealth: number) => health > 0 && health * 2 < maxHealth;
export const matriarchPattern = (sequence: number, enraged: boolean) => enraged && sequence % 2 === 1 ? "double-fan" : spitterPattern(sequence);
export const spitterPattern = (sequence: number): "aimed" | "fan" => sequence % 2 === 0 ? "aimed" : "fan";
export function spitterShotEndpoints(start: { x: number; y: number; z: number }, yaw: number, pattern: string) {
  return spitterShotOffsets(pattern).map(offset => {
    const angle = (yaw + offset) * Math.PI / 180;
    return { x: start.x + Math.sin(angle) * SPITTER_PATTERN.range, y: start.y + .97, z: start.z + Math.cos(angle) * SPITTER_PATTERN.range };
  });
}
/** Independent warning strips, leaving the same open gaps as the actual volley. */
export function spitterWarningLanes(yaw: number, pattern: string, lengths?: readonly number[]) {
  return spitterShotOffsets(pattern).map((offset, index) => {
    const angle = (yaw + offset) * Math.PI / 180;
    const dx = Math.sin(angle), dz = Math.cos(angle), w = SPITTER_PATTERN.laneHalfWidth;
    const length = Math.max(0, Math.min(SPITTER_PATTERN.range, lengths?.[index] ?? SPITTER_PATTERN.range));
    return [{ x: dz * w, z: -dx * w }, { x: -dz * w, z: dx * w },
      { x: dx * length - dz * w, z: dz * length + dx * w }, { x: dx * length + dz * w, z: dz * length - dx * w }];
  });
}
