import { describe, expect, it } from "vitest";
import { towerFloorTwoRenderPolicy } from "./tower-floor-two-render-policy.js";

describe("Floor 2 render policy", () => {
  it("batches structural scenery but leaves stateful effects dynamic", () => {
    expect(towerFloorTwoRenderPolicy("floor2-wall:intake").dynamic).toBe(false);
    expect(towerFloorTwoRenderPolicy("floor2-route:entry-intake").dynamic).toBe(false);
    expect(towerFloorTwoRenderPolicy("floor2-vent-jet:intake").dynamic).toBe(true);
    expect(towerFloorTwoRenderPolicy("floor2-furnace-regulator-core").dynamic).toBe(true);
  });

  it("limits shadow casters to major silhouettes", () => {
    expect(towerFloorTwoRenderPolicy("floor2-wall:intake").castShadows).toBe(false);
    expect(towerFloorTwoRenderPolicy("floor2-chimney").castShadows).toBe(true);
    expect(towerFloorTwoRenderPolicy("floor2-crucible-gate:lintel").castShadows).toBe(true);
  });
});
