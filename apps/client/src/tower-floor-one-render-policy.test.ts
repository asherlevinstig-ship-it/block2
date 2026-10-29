import { describe, expect, it } from "vitest";
import { towerFloorOneRenderPolicy } from "./tower-floor-one-render-policy.js";

describe("towerFloorOneRenderPolicy", () => {
  it("keeps substantial static architecture batched with readable shadows", () => {
    expect(towerFloorOneRenderPolicy("floor1-ruined-wall-322-92")).toEqual({
      dynamic: false, castShadows: true, receiveShadows: true,
    });
    expect(towerFloorOneRenderPolicy("floor1-ancient-trunk").castShadows).toBe(true);
  });

  it("removes tiny surface details from the expensive shadow pass", () => {
    expect(towerFloorOneRenderPolicy("floor1-ivy-leaf")).toEqual({
      dynamic: false, castShadows: false, receiveShadows: true,
    });
    expect(towerFloorOneRenderPolicy("floor1-north-route-flagstone").castShadows).toBe(false);
    expect(towerFloorOneRenderPolicy("floor1-wall-moss-322-92").castShadows).toBe(false);
  });

  it("does not batch animated or fading encounter visuals", () => {
    for (const name of ["floor1-ground-mist", "floor1-spore", "floor1-falling-leaf",
      "floor1-north-warden-seal", "floor1-north-seal-chain-link-top", "floor1-crown-seal-barrier"])
      expect(towerFloorOneRenderPolicy(name).dynamic).toBe(true);
  });
});
