import type { BuildPathId } from "./index.js";

export interface FloorAttemptSummary {
  id: string;
  floor: 1;
  calling: BuildPathId | null;
  wardensDefeated: number;
  picked: string[];
  unusedChoices: number;
  boss: { health: number; maxHealth: number; lastSeen?: boolean } | null;
  kept: { level: number; experience: number; gold: number; crownFragments: number };
  cause: { name: string; pattern: string; kind: string };
  tip: string;
}

/** One action-focused tip; do not infer a melee move from a projectile or ground hazard. */
export function floorDefeatTip(pattern: string, kind: string): string {
  if (kind === "hazard") return "Leave the marked ground before impact; keep an escape route clear.";
  if (pattern === "smash" && kind === "melee") return "Parry the cleave as it lands to create a party opening; holding guard early will not earn it.";
  if (pattern === "slam" || pattern === "root-slam") return "Interrupt the slam during its windup, or move outside its marked area before it lands.";
  if (pattern === "charge" || pattern === "bog-charge") return "Step out of the charge lane, or face the charge with enough stamina to guard.";
  if (pattern === "warden-barrage") return "Keep moving through the gaps between falling-rock markers instead of backing into an edge.";
  if (pattern === "venom-ring") return "Find a gap in the ring and move through it before the shots arrive.";
  if (kind === "projectile" || pattern === "rocks") return "Move sideways across incoming shots and use cover rather than retreating straight back.";
  return "Watch the enemy's windup, keep room to move, and dodge before the hit connects.";
}
