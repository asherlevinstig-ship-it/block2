import { describe, expect, it } from "vitest";
import { executionerDamageBonus, gainMomentum, guardStaminaCost, momentumAfterDefense, movementSpeedWithMomentum, parryStaminaRestore, staminaRecoveryWithMomentum } from "../src/trait-rules.js";

describe("Momentum trait", () => {
  it("builds on successful attacks and caps at three stacks", () => {
    expect(gainMomentum(0)).toBe(1);
    expect(gainMomentum(2)).toBe(3);
    expect(gainMomentum(3)).toBe(3);
  });

  it("fills on a parry and clears only when damage is taken", () => {
    expect(momentumAfterDefense(1, 0, true)).toBe(3);
    expect(momentumAfterDefense(2, 1, false)).toBe(0);
    expect(momentumAfterDefense(2, 0, false)).toBe(2);
  });

  it("increases movement and stamina recovery per stack", () => {
    expect(movementSpeedWithMomentum(4.2, 3)).toBeCloseTo(4.704);
    expect(staminaRecoveryWithMomentum(18, 3)).toBe(24);
  });

  it("turns Momentum off when another Trait is equipped", () => {
    expect(gainMomentum(2, "bulwark")).toBe(0);
    expect(movementSpeedWithMomentum(4.2, 3, "executioner")).toBe(4.2);
  });

  it("makes Bulwark guard cheaper and restores stamina on parry", () => {
    expect(guardStaminaCost(14, "bulwark")).toBeCloseTo(9.1);
    expect(guardStaminaCost(14, "momentum")).toBe(14);
    expect(parryStaminaRestore("bulwark")).toBe(18);
  });

  it("gives Executioner bonus damage only to finishers and Powers against vulnerable enemies", () => {
    const staggered = { health: 8, maxHealth: 8, combatState: "stagger" };
    const lowHealth = { health: 2, maxHealth: 8, combatState: "idle" };
    const healthy = { health: 8, maxHealth: 8, combatState: "idle" };
    expect(executionerDamageBonus("executioner", staggered, { comboStep: 3 })).toBe(1);
    expect(executionerDamageBonus("executioner", lowHealth, { power: true })).toBe(1);
    expect(executionerDamageBonus("executioner", healthy, { power: true })).toBe(0);
    expect(executionerDamageBonus("executioner", staggered, { comboStep: 2 })).toBe(0);
  });
});
