import { describe, expect, it } from "vitest";
import { ashenSentryTacticalPattern, ashenWarpackCooldownMultiplier, ashenWarpackGoal, ashenWarpackSpeedMultiplier, ashenWarpackTactic } from "./ashen-warpack.js";

describe("Ashen warpack tactics", () => {
  it("rotates from ram pressure into crossfire and collapses around an exposed ram", () => {
    expect(ashenWarpackTactic(1_000, 2_000, true, false, 2, 2)).toBe("ram-advance");
    expect(ashenWarpackTactic(1_000, 8_100, true, false, 2, 2)).toBe("ashglass-crossfire");
    expect(ashenWarpackTactic(1_000, 8_100, true, true, 2, 2)).toBe("pack-collapse");
  });

  it("gives each role distinct timing pressure", () => {
    expect(ashenWarpackCooldownMultiplier("ashen-cinder-ram", "ram-advance")).toBeLessThan(1);
    expect(ashenWarpackSpeedMultiplier("ashen-ember-hound-west", "pack-collapse")).toBeGreaterThan(1);
    expect(ashenSentryTacticalPattern(0, "ashglass-crossfire")).toBe("aimed");
    expect(ashenSentryTacticalPattern(0, "pack-collapse")).toBe("fan");
  });

  it("places hounds on opposite flanks and sentries on separated crossfire sites", () => {
    const target = { x: 10, y: 8, z: 10 }, ram = { x: 10, y: 8, z: 4 };
    const westHound = ashenWarpackGoal("ashen-ember-hound-west", "ram-advance", target, ram)!;
    const eastHound = ashenWarpackGoal("ashen-ember-hound-east", "ram-advance", target, ram)!;
    expect(Math.sign(westHound.x - target.x)).not.toBe(Math.sign(eastHound.x - target.x));
    const westSentry = ashenWarpackGoal("ashglass-sentry-west", "ashglass-crossfire", target, ram)!;
    const eastSentry = ashenWarpackGoal("ashglass-sentry-east", "ashglass-crossfire", target, ram)!;
    expect(Math.hypot(westSentry.x - eastSentry.x, westSentry.z - eastSentry.z)).toBeGreaterThan(10);
  });
});
