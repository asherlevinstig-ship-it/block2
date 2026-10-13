import { describe, expect, it } from "vitest";
import { cavernRespawnIndicator } from "./cavern-respawn-indicator.js";

describe("cavern respawn indicator", () => {
  it("counts down a defeated cavern enemy using the server timestamp", () => {
    expect(cavernRespawnIndicator("deep-cave-spitter", false, 50_000, 8_200)).toEqual({ seconds: 42, phase: "waiting" });
  });

  it("warns during the final five seconds", () => {
    expect(cavernRespawnIndicator("deep-cave-spitter", false, 50_000, 45_001)).toEqual({ seconds: 5, phase: "warning" });
  });

  it("stays hidden for living, expired, and non-cavern enemies", () => {
    expect(cavernRespawnIndicator("deep-cave-spitter", true, 50_000, 8_000)).toBeNull();
    expect(cavernRespawnIndicator("deep-cave-spitter", false, 50_000, 50_000)).toBeNull();
    expect(cavernRespawnIndicator("frontier-brute", false, 50_000, 8_000)).toBeNull();
  });
});
