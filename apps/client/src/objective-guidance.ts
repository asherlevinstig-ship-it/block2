export function objectiveIcon(kind?: string): string {
  return kind === "portal" ? "◉" : kind === "loot" ? "▣" : kind === "hub" ? "⌂" : "⚔";
}

/** Keep the edge arrow on the ray toward the target, including behind-camera targets. */
export function objectiveGuidance(screen: { x: number; y: number; z: number }, width: number, height: number, distance: number, wasHidden: boolean) {
  const left = width > 820 ? Math.min(410, width * .32) : 44;
  const right = Math.max(left + 1, width - 52);
  const top = Math.min(130, height * .25);
  const bottom = Math.max(top + 1, height - 70);
  const onScreen = screen.z > 0 && screen.x >= left && screen.x <= right && screen.y >= top && screen.y <= bottom;
  const hidden = onScreen && distance <= (wasHidden ? 10 : 8);
  const cx = (left + right) / 2, cy = (top + bottom) / 2;
  const direction = screen.z > 0 ? 1 : -1;
  let dx = (screen.x - cx) * direction, dy = (screen.y - cy) * direction;
  if (Math.abs(dx) + Math.abs(dy) < .001) dy = 1;
  const scale = Math.min((right - left) / 2 / Math.max(.001, Math.abs(dx)), (bottom - top) / 2 / Math.max(.001, Math.abs(dy)));
  return { hidden, onScreen, x: onScreen ? screen.x : cx + dx * scale, y: onScreen ? screen.y : cy + dy * scale, angle: Math.atan2(dy, dx) * 180 / Math.PI + 90 };
}
