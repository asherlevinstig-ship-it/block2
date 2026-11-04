import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

describe("tower floor streaming", () => {
  it("constructs floors through destination-scoped lazy factories", () => {
    expect(source).toContain("function ensureTowerFloorOneWorld()");
    expect(source).toContain("function ensureTowerFloorTwoWorld()");
    expect(source).toContain("if (floorOneActive) ensureTowerFloorOneWorld();");
    expect(source).toContain("if (floorTwoActive) ensureTowerFloorTwoWorld();");
  });

  it("does not eagerly construct both floors with the Town landmarks", () => {
    const townLandmarkBlock = source.slice(source.indexOf("if (FAST_WORLD_TOWN_ONLY)"),
      source.indexOf("const badge = document.createElement", source.indexOf("if (FAST_WORLD_TOWN_ONLY)")));
    expect(townLandmarkBlock).toContain("createTownPortalLandmarks");
    expect(townLandmarkBlock).not.toContain("createTowerFloorOneWorld");
    expect(townLandmarkBlock).not.toContain("createTowerFloorTwoWorld");
  });
});
