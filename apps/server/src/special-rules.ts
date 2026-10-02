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
  stacks: number;
}

export interface HuntersMarkPowerPayoff {
  bonusDamage: number;
  staggerBonusMs: number;
  consumed: boolean;
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

export function progressHuntersMark(
  mark: ActiveSpecialMark | undefined,
  mobId: string,
  now: number,
): ActiveSpecialMark | null {
  if (!mark || mark.mobId !== mobId || now >= mark.expiresAt) return null;
  return { ...mark, stacks: Math.min(HUNTERS_MARK.maxStacks, mark.stacks + 1) };
}

export function huntersMarkPowerPayoff(
  mark: ActiveSpecialMark | undefined,
  mobId: string,
  now: number,
): HuntersMarkPowerPayoff {
  const marked = Boolean(mark && mark.mobId === mobId && now < mark.expiresAt);
  const consumed = Boolean(marked && mark!.stacks >= HUNTERS_MARK.maxStacks);
  return {
    bonusDamage: marked
      ? HUNTERS_MARK.bonusDamage + (consumed ? HUNTERS_MARK.exposedPowerBonusDamage : 0)
      : 0,
    staggerBonusMs: consumed ? HUNTERS_MARK.exposedStaggerBonusMs : 0,
    consumed,
  };
}
