import { describe, expect, it } from "vitest";
import { AttackBuffer, attackReadiness, attackOutcomeAllowed } from "./attack-buffer.js";

describe("one-attack recovery buffer", () => {
  it("accepts a late press once and releases it only when recovery ends", () => {
    const buffer = new AttackBuffer<string>();
    expect(buffer.offer("early", "sword", 100, 400)).toBe(false);
    expect(buffer.offer("first", "sword", 290, 400)).toBe(true);
    expect(buffer.offer("spam", "sword", 300, 400)).toBe(false);
    expect(buffer.take("sword", 399, 400, true)).toBeNull();
    expect(buffer.take("sword", 400, 400, true)).toBe("first");
    expect(buffer.take("sword", 401, 400, true)).toBeNull();
  });
  it("discards stale input, changed weapons and input blocked by menus or travel", () => {
    for (const [weapon, now, allowed] of [["bow", 400, true], ["sword", 1000, true], ["sword", 400, false]] as const) {
      const buffer = new AttackBuffer<string>();
      buffer.offer("attack", "sword", 300, 400);
      expect(buffer.take(weapon, now, 400, allowed)).toBeNull();
      expect(buffer.hasQueued()).toBe(false);
    }
  });
  it("distinguishes swing, recovery, queued input and readiness without claiming a hit", () => {
    expect(attackReadiness(100, 0, 400, 135, false).label).toBe("SWING");
    expect(attackReadiness(200, 0, 400, 135, false)).toEqual({ progress: .5, label: "RECOVERING" });
    expect(attackReadiness(300, 0, 400, 135, true).label).toBe("NEXT QUEUED");
    expect(attackReadiness(400, 0, 400, 135, false).label).toBe("READY");
  });
  it("does not let a trailing miss erase a wall block or confirmed enemy hit", () => {
    expect(attackOutcomeAllowed({ kind: "hit", at: 100 }, "miss", 150)).toBe(false);
    expect(attackOutcomeAllowed({ kind: "blocked", at: 100 }, "miss", 110)).toBe(false);
    expect(attackOutcomeAllowed({ kind: "blocked", at: 100 }, "hit", 110)).toBe(true);
    expect(attackOutcomeAllowed({ kind: "hit", at: 100 }, "miss", 400)).toBe(true);
  });
});
