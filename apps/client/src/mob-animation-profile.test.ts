import { describe, expect, it } from "vitest";
import { mobBodyMotionProfile } from "./mob-animation-profile.js";

describe("mob animation profiles", () => {
  it("gives the ram a compressed launch instead of a generic walk pose", () => {
    const windup = mobBodyMotionProfile("cinder_ram", "ram", 1, 1, 1, 1, 0, 0, 1);
    const strike = mobBodyMotionProfile("cinder_ram", "ram", 1, 1, 1, 0, 1, 0, 1);
    expect(windup.scaleY).toBeLessThan(1);
    expect(strike.scaleZ).toBeGreaterThan(1.1);
    expect(strike.z).toBeGreaterThan(0.3);
  });

  it("makes hounds bound, sentries hover and bloaters swell", () => {
    expect(mobBodyMotionProfile("ember_hound", "hound", Math.PI, 1, 1, 0, 0, 0, 1).y).toBeGreaterThan(.08);
    expect(Math.abs(mobBodyMotionProfile("shard_sentry", "sentry", 0, 0, 0, 0, 0, 0, 1).y)).toBeGreaterThan(.01);
    expect(mobBodyMotionProfile("fen_bloater", "bloater", 0, 0, 0, 1, 0, 0, 1).scaleX).toBeGreaterThan(1.1);
  });

  it("gives each tower boss a bespoke weighted strike", () => {
    const crown = mobBodyMotionProfile("stone_brute", "floor1-crownkeeper", 0, 0, 1, 0, 1, 0, 0);
    const forge = mobBodyMotionProfile("stone_brute", "floor2-forgeheart", 0, 0, 1, 0, 1, 0, 0);
    expect(crown.z).toBeGreaterThan(.4);
    expect(forge.z).toBeGreaterThan(crown.z);
    expect(forge.scaleY).toBeLessThan(crown.scaleY);
  });
});
