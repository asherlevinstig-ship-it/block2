import type { CallingAbilityId } from "@blockcraft/protocol";

export type CallingTouchAimKind = "line" | "cone" | "ground" | "direction";

export interface CallingTouchAimProfile {
  kind: CallingTouchAimKind;
  range: number;
  width: number;
  needsEnemy: boolean;
  halfConeDegrees: number;
}

const CALLING_TOUCH_AIM_PROFILES: Partial<Record<CallingAbilityId, CallingTouchAimProfile>> = {
  mage_overload: { kind: "ground", range: 14, width: 2.2, needsEnemy: true, halfConeDegrees: 25 },
  assassin_death_mark: { kind: "line", range: 8, width: .65, needsEnemy: true, halfConeDegrees: 49 },
  assassin_blade_dance: { kind: "cone", range: 6, width: 3.5, needsEnemy: true, halfConeDegrees: 98 },
  ranger_disengage: { kind: "direction", range: 3, width: .65, needsEnemy: false, halfConeDegrees: 0 },
  ranger_deadeye: { kind: "line", range: 18, width: .38, needsEnemy: true, halfConeDegrees: 14 },
};

/** Only abilities whose server result changes with yaw receive drag aiming. */
export function callingTouchAimProfile(abilityId: CallingAbilityId | null | undefined): CallingTouchAimProfile | null {
  return abilityId ? CALLING_TOUCH_AIM_PROFILES[abilityId] ?? null : null;
}

/** A drag that returns to its source button is an intentional cancel gesture. */
export function callingAimReleaseCancels(
  dragged: boolean,
  point: { x: number; y: number },
  bounds: { left: number; right: number; top: number; bottom: number },
  padding = 8,
): boolean {
  return dragged && point.x >= bounds.left - padding && point.x <= bounds.right + padding
    && point.y >= bounds.top - padding && point.y <= bounds.bottom + padding;
}
