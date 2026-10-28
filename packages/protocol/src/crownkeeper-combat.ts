export type CrownkeeperCounter = "parry" | "interrupt" | "evade" | "guard";
export const CROWNKEEPER_OPENINGS: Readonly<Record<CrownkeeperCounter, number>> = {
  parry: 2_000, interrupt: 2_500, evade: 2_500, guard: 3_500,
};
export const CROWNKEEPER_OPENING_WEAPON_BONUS = 1;
export function crownkeeperCounterDuration(pattern: string, state: string, response: CrownkeeperCounter): number {
  if (pattern === "slam" && state === "windup" && response === "interrupt") return CROWNKEEPER_OPENINGS.interrupt;
  if (pattern === "smash" && (state === "strike" || state === "recover") && response === "parry") return CROWNKEEPER_OPENINGS.parry;
  if (pattern === "charge" && (state === "strike" || state === "recover") && (response === "evade" || response === "guard"))
    return CROWNKEEPER_OPENINGS[response];
  return 0;
}
export function crownkeeperAttackCue(pattern: string, state: string, touch = false): {
  label: string; response: "parry" | "interrupt" | "evade" | "guard" | "none"; color: readonly [number, number, number];
} {
  const name = pattern === "smash" ? "ROYAL CLEAVE" : pattern === "slam" ? "CROWN SLAM"
    : pattern === "charge" ? "ROYAL CHARGE" : pattern === "warden-barrage" ? "LAST DECREE" : "STONE VOLLEY";
  if (state !== "windup" && state !== "strike") return { label: name + (state === "recover" || state === "stagger" ? " · RECOVERING" : " · READY"), response: "none", color: [1, .72, .25] };
  if (pattern === "smash") return { label: name + " · PARRY" + (touch ? "" : " [C]"), response: "parry", color: [.3, .78, 1] };
  if (pattern === "slam" && state === "windup") return { label: name + " · INTERRUPT NOW", response: "interrupt", color: [.8, .4, 1] };
  if (pattern === "charge") return { label: name + " · DODGE / GUARD" + (touch ? "" : " [SPACE / C]"), response: "evade", color: [1, .55, .15] };
  if (pattern === "rocks") return { label: name + " · GUARD / DODGE" + (touch ? "" : " [C / SPACE]"), response: "guard", color: [1, .8, .24] };
  return { label: name + (pattern === "warden-barrage" ? " · DODGE · FIND GAPS" : " · DODGE NOW") + (touch ? "" : " [SPACE]"), response: "evade", color: [1, .45, .2] };
}
