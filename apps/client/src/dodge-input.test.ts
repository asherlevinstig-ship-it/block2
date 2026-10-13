import { describe, expect, it } from "vitest";
import {
  advanceDodgeVisualOffset,
  advancePredictedDodgeStamina,
  beginDodgeVisualOffset,
  canRequestPredictedDodge,
  canSpendPredictedDodgeStamina,
  DODGE_REQUEST_INTERVAL_MS,
  DODGE_STAMINA_COST,
  predictedDodgeRecoveryElapsed,
} from "./dodge-input.js";

describe("dodge input prediction", () => {
  it("blocks rapid repeat predictions until the server dodge interval has elapsed", () => {
    expect(DODGE_REQUEST_INTERVAL_MS).toBe(350);
    expect(canRequestPredictedDodge(1_000, Number.NEGATIVE_INFINITY)).toBe(true);
    expect(canRequestPredictedDodge(1_349, 1_000)).toBe(false);
    expect(canRequestPredictedDodge(1_350, 1_000)).toBe(true);
  });

  it("presents a predicted dodge without teleporting and settles at its destination", () => {
    let offset = beginDodgeVisualOffset({ x: 0, z: 0 }, { x: 2, z: 3 }, { x: 3.8, z: 3 });
    expect(offset.x).toBeCloseTo(-1.8);
    expect(offset.z).toBe(0);
    const next = advanceDodgeVisualOffset(offset, 0.05);
    expect(Math.abs(next.x - offset.x)).toBeLessThanOrEqual(0.400001);
    for (let index = 0; index < 120; index += 1) offset = advanceDodgeVisualOffset(offset, 1 / 60);
    expect(offset).toEqual({ x: 0, z: 0 });
  });

  it("conservatively budgets stamina before predicting another dodge", () => {
    expect(DODGE_STAMINA_COST).toBe(35);
    expect(canSpendPredictedDodgeStamina(34.99)).toBe(false);
    expect(canSpendPredictedDodgeStamina(35)).toBe(true);
    expect(advancePredictedDodgeStamina(30, 250, 100)).toBeCloseTo(34.5);
    expect(advancePredictedDodgeStamina(30, 2_000, 100)).toBeCloseTo(66);
    expect(advancePredictedDodgeStamina(95, 1_000, 100)).toBe(100);
  });

  it("blocks the fourth rapid dodge instead of predicting a server rejection", () => {
    let stamina = 100;
    for (let dodge = 0; dodge < 3; dodge += 1) {
      expect(canSpendPredictedDodgeStamina(stamina)).toBe(true);
      stamina -= DODGE_STAMINA_COST;
      stamina = advancePredictedDodgeStamina(stamina, 350, 100);
    }
    expect(stamina).toBeCloseTo(13.9);
    expect(canSpendPredictedDodgeStamina(stamina)).toBe(false);
  });

  it("accepts the authoritative escalating cost", () => {
    expect(canSpendPredictedDodgeStamina(44.99, 45)).toBe(false);
    expect(canSpendPredictedDodgeStamina(45, 45)).toBe(true);
  });

  it("does not predict stamina recovery during exhaustion", () => {
    expect(predictedDodgeRecoveryElapsed(1_000, 1_700, 1_900)).toBe(0);
    expect(predictedDodgeRecoveryElapsed(1_000, 2_100, 1_900)).toBe(200);
    expect(predictedDodgeRecoveryElapsed(2_000, 2_500, 1_900)).toBe(500);
  });
});
