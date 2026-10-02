import { HUNTERS_MARK } from "@blockcraft/protocol";
import { selectAttackTarget } from "./action-rules.js";

export interface SpecialPosition {
  x: number;
  y: number;
  z: number;
}

export interface SpecialTarget extends SpecialPosition {
  id: string;
  alive: boolean;
}

export interface ActiveSpecialMark {
  mobId: string;
  expiresAt: number;
}

export function selectHuntersMarkTarget(
  origin: SpecialPosition,
  yaw: number,
  targets: readonly SpecialTarget[],
): SpecialTarget | null {
  return selectAttackTarget(
    origin,
    yaw,
    targets,
    HUNTERS_MARK.range,
    HUNTERS_MARK.minimumFacingDot,
  );
}

export function huntersMarkDamageBonus(mark: ActiveSpecialMark | undefined, mobId: string, now: number): number {
  return mark?.mobId === mobId && now < mark.expiresAt ? HUNTERS_MARK.bonusDamage : 0;
}
