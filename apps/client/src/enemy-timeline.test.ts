import { describe, expect, it } from "vitest";
import { createServerClock, sampleServerClock, enemyAttackPresentation, type EnemyTimeline } from "./enemy-timeline.js";

const mob: EnemyTimeline = { alive: true, combatState: "windup", aimCommitted: false,
  attackStartedAt: 10_000, attackReleaseAt: 11_150, attackContactAt: 11_430,
  attackContactEndAt: 11_530, attackRecoveryEndAt: 12_380 };
describe("authoritative enemy presentation", () => {
  it("shows the brute's early aim-lock cue, without changing other enemies", () => {
    expect(enemyAttackPresentation({ ...mob, archetype: "stone_brute" }, 10_550).aimLocked).toBe(true);
    expect(enemyAttackPresentation({ ...mob, archetype: "moss_crawler" }, 10_550).aimLocked).toBe(false);
  });
  it("estimates the server clock from 300 ms RTT without relying on client wall-clock accuracy", () => {
    const clock = sampleServerClock(createServerClock(100, 999999), 100, 400, 10_150);
    expect(clock.synchronized).toBe(true); expect(clock.offset).toBe(9900);
    expect(400 + clock.offset).toBe(10_300);
    expect(sampleServerClock(clock, 500, 1400, 11_300)).toEqual(clock);
  });
  it("shows crawler commitment 550 ms before release and keeps its warning until contact ends", () => {
    for (const archetype of ["moss_crawler", "briar_crawler"]) {
      expect(enemyAttackPresentation({ ...mob, archetype }, 10_599).aimLocked).toBe(false);
      expect(enemyAttackPresentation({ ...mob, archetype }, 10_600).aimLocked).toBe(true);
      expect(enemyAttackPresentation({ ...mob, archetype }, 11_530).warning).toBe(true);
      expect(enemyAttackPresentation({ ...mob, archetype }, 11_531).warning).toBe(false);
    }
  });
  it("rejects invalid and excessively delayed clock samples", () => {
    const clock = createServerClock(100, 10000);
    expect(sampleServerClock(clock, 100, 99, 10000)).toEqual(clock);
    expect(sampleServerClock(clock, 100, 7000, 10000)).toEqual(clock);
    expect(sampleServerClock(clock, 100, 400, NaN)).toEqual(clock);
  });
  it("keeps the warning through strike, not harmless recovery", () => {
    expect(enemyAttackPresentation(mob, 11_000)).toMatchObject({ phase: "windup", warning: true, aimLocked: true, impactDue: false });
    expect(enemyAttackPresentation(mob, 11_300)).toMatchObject({ phase: "strike", warning: true, impactDue: false });
    expect(enemyAttackPresentation(mob, 11_430)).toMatchObject({ phase: "strike", warning: true, impactDue: true, elapsed: 280 });
    expect(enemyAttackPresentation(mob, 11_531)).toMatchObject({ phase: "recover", warning: false });
    expect(enemyAttackPresentation(mob, 12_400)).toMatchObject({ phase: "idle", impactDue: false });
  });
  it("advances a known windup timeline despite a delayed release patch", () => {
    const clock = sampleServerClock(createServerClock(100, 0), 100, 400, 10_150);
    expect(enemyAttackPresentation(mob, 1320 + clock.offset)).toMatchObject({ phase: "strike", elapsed: 70 });
    expect(enemyAttackPresentation({ ...mob, combatState: "strike" }, 1450 + clock.offset)).toMatchObject({ elapsed: 200 });
  });
  it("never triggers release-time, cancelled, dead, or old impact effects", () => {
    expect(enemyAttackPresentation(mob, 11_150).impactDue).toBe(false);
    expect(enemyAttackPresentation({ ...mob, combatState: "stagger" }, 11_430)).toMatchObject({ warning: false, impactDue: false, elapsed: -1 });
    expect(enemyAttackPresentation({ ...mob, alive: false }, 11_430).impactDue).toBe(false);
    expect(enemyAttackPresentation(mob, 12_000).impactDue).toBe(false);
  });
});
