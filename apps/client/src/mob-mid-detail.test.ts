import { describe, expect, it } from "vitest";
import { mobMidDetailParts } from "./mob-mid-detail.js";

describe("middle-distance mob silhouettes", () => {
  it("uses three readable masses for every creature family", () => {
    for (const archetype of ["moss_crawler", "stone_brute", "cave_spitter", "ridge_stalker",
      "ember_hound", "shard_sentry", "thornbinder", "fen_bloater", "cinder_ram"]) {
      expect(mobMidDetailParts(archetype)).toHaveLength(3);
    }
  });

  it("preserves distinct tall and horizontal profiles", () => {
    const thornTop = Math.max(...mobMidDetailParts("thornbinder").map(part => part.at[1] + part.size[1] / 2));
    const ramLength = Math.max(...mobMidDetailParts("cinder_ram").map(part => part.size[2]));
    expect(thornTop).toBeGreaterThan(2);
    expect(ramLength).toBeGreaterThan(1.5);
  });
});
