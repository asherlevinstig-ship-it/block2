import { describe, expect, it } from "vitest";
import { CombatSyncRecorder } from "./combat-sync.js";

describe("combat sync diagnostics", () => {
  it("correlates a 300ms round-trip melee swing through acceptance and impact", () => {
    const log = new CombatSyncRecorder();
    log.start("attack", "attack-1", 1_000);
    const offset = 1_000_000;
    log.receive({ requestId: "attack-1", action: "attack", phase: "accepted",
      serverTime: offset + 1_150, scheduledAt: offset + 1_285 }, 1_300);
    log.receive({ requestId: "attack-1", action: "attack", phase: "resolved",
      serverTime: offset + 1_285, outcome: "hit" }, 1_435);
    expect(log.snapshot()).toContain("ACCEPTED receive=300ms due=135ms");
    expect(log.snapshot()).toContain("RESOLVED HIT receive=435ms server=135ms");
  });

  it("keeps two players' 100ms and 600ms RTT action histories separate", () => {
    const fast = new CombatSyncRecorder();
    const slow = new CombatSyncRecorder();
    fast.start("dodge", "fast-1", 0);
    slow.start("dodge", "slow-1", 0);
    fast.receive({ requestId: "fast-1", action: "dodge", phase: "accepted", serverTime: 50 }, 100);
    slow.receive({ requestId: "slow-1", action: "dodge", phase: "accepted", serverTime: 300 }, 600);
    expect(fast.snapshot()).toContain("receive=100ms");
    expect(slow.snapshot()).toContain("receive=600ms");
    expect(fast.snapshot()).not.toContain("up=");
    expect(fast.snapshot()).not.toContain("slow-1");
  });

  it("records late visible warnings once and bounds the log", () => {
    const log = new CombatSyncRecorder();
    log.warning("warden", 4, 1_000, 1_450, 1_320, 50);
    log.warning("warden", 4, 1_000, 1_450, 1_400, 50);
    expect(log.snapshot().split("\n")).toHaveLength(1);
    expect(log.snapshot()).toContain("first-visible≈320ms lead≈130ms clock-uncertainty≈±50ms");
    for (let i = 0; i < 150; i += 1) log.reject(`attack-${i}`, "attack", "rate", i);
    expect(log.snapshot().split("\n")).toHaveLength(128);
  });
});
