export const defeatDuration = (kind: string) => kind === "stone_brute" ? 920 : kind === "cave_spitter" ? 680 : 520;
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function mobDefeatPose(kind: string, elapsed: number) {
  const progress = Math.max(0, Math.min(1, elapsed / defeatDuration(kind)));
  const brute = kind === "stone_brute", spitter = kind === "cave_spitter";
  const collapse = smooth(brute ? (progress - .12) / .7 : progress / .78);
  return { progress, collapse, visible: progress < 1, width: 1 + collapse * (brute ? .12 : .18),
    height: 1 - collapse * (brute ? .6 : spitter ? .76 : .72), length: 1 + collapse * .12,
    pitch: collapse * (brute ? 48 : spitter ? -12 : 8), roll: collapse * (brute ? -12 : spitter ? 32 : 22),
    y: -collapse * .05 };
}
/** Mob IDs can contain colons (roaming packs), so strip only the timestamp and sequence. */
export function lootSourceMob(dropId: string): string | null { return /^(.*):\d+:\d+$/.exec(dropId)?.[1] ?? null; }
export function lootMarkerScale(now: number, revealAt: number) { return .65 + smooth((now - revealAt) / 180) * .35; }
