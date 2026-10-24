import { describe, expect, it } from "vitest";
import { gameExperience, usesFastWorld } from "./game-experience.js";

describe("canonical game experience", () => {
  it("opens the fast low-poly world by default", () => {
    expect(gameExperience(new URLSearchParams())).toBe("fast-world");
    expect(usesFastWorld(new URLSearchParams())).toBe(true);
  });

  it("keeps the former prototype URL as a fast-world compatibility link", () => {
    expect(gameExperience(new URLSearchParams("room=practice&prototype=2d"))).toBe("fast-world");
  });

  it("requires an explicit route for the archived voxel world", () => {
    expect(gameExperience(new URLSearchParams("legacy=voxel"))).toBe("legacy-voxel");
    expect(gameExperience(new URLSearchParams("room=world"))).toBe("legacy-voxel");
  });

  it("does not confuse legacy ability practice or Silver Depths with the fast world", () => {
    expect(gameExperience(new URLSearchParams("room=practice"))).toBe("legacy-practice");
    expect(gameExperience(new URLSearchParams("room=silver-depths"))).toBe("silver-depths");
  });

  it("carries an explicit fast-world return marker through instanced rooms", () => {
    expect(gameExperience(new URLSearchParams("room=silver-depths&mode=fast"))).toBe("silver-depths");
    expect(gameExperience(new URLSearchParams("mode=fast&returnFrom=silver-depths"))).toBe("fast-world");
  });
});
