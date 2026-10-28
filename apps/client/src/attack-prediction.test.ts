import { describe, expect, it } from "vitest";
import { AttackPredictionJournal } from "./attack-prediction.js";
import type { WeaponAttackState } from "@blockcraft/protocol";

const prediction = (requestId: string, startedAt: number, beforeStep: number) => ({ requestId, startedAt, beforeStep,
  mainHandId: "forged_sword" as const, combo: true, comboWindowMs: 520, durations: [266, 287, 392], beforeExpiresAt: 2000 });
const rejected: WeaponAttackState = { requestId: "attack-2", accepted: false, serverTime: 1400,
  mainHandId: "forged_sword", comboStep: 1, comboExpiresAt: 1900, recoveryUntil: 1380 };

describe("authoritative weapon combo reconciliation", () => {
  it("rolls a rejected second swing back to the first and retains authoritative recovery", () => {
    const journal = new AttackPredictionJournal(); journal.record(prediction("attack-2", 1300, 1));
    expect(journal.reconcile(rejected, 1000)).toMatchObject({ step: 1, recoveryUntil: 380, expiresAt: 900, active: null });
  });
  it("rebases a newer predicted finisher into the second swing after an older rejection", () => {
    const journal = new AttackPredictionJournal();
    journal.record(prediction("attack-2", 300, 1)); journal.record(prediction("attack-3", 590, 2));
    expect(journal.reconcile(rejected, 1000)).toMatchObject({ step: 2, recoveryUntil: 877,
      active: { requestId: "attack-3", step: 2, startedAt: 590 } });
    expect(journal.reconcile({ ...rejected, requestId: "attack-1" }, 1000)).toBeNull();
  });
  it("does not let delayed responses after equipment changes resurrect attacks", () => {
    const journal = new AttackPredictionJournal(); journal.record(prediction("attack-2", 300, 1)); journal.clear();
    expect(journal.reconcile(rejected, 1000)).toBeNull();
  });
  it("rolls back a rejection from an older backend once, without rewinding twice", () => {
    const journal = new AttackPredictionJournal(); journal.record(prediction("attack-2", 300, 1));
    expect(journal.rejectLegacy("attack-2")).toMatchObject({ step: 1, active: null });
    expect(journal.rejectLegacy("attack-2")).toBeNull();
  });
});
