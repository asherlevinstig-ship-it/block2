import { describe, expect, it } from "vitest";
import { TOWER_CHRONICLE_MONUMENT_PLACEMENT, TOWER_CHRONICLE_MONUMENT_URL } from "./tower-chronicle-asset.js";

describe("Tower Chronicle authored monument", () => {
  it("uses the curated Quaternius GLB in the centre of the Town plaza", () => {
    expect(TOWER_CHRONICLE_MONUMENT_URL).toBe("/assets/quaternius-wooden-monument/wooden-monument.glb");
    expect(TOWER_CHRONICLE_MONUMENT_PLACEMENT.position).toEqual([67, 8.69, 106]);
    expect(TOWER_CHRONICLE_MONUMENT_PLACEMENT.scale).toBeGreaterThan(4);
  });
});
