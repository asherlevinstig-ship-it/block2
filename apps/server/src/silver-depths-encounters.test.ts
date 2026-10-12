import { describe, expect, it } from "vitest";
import { SILVER_DEPTHS_ANTECHAMBER_IDS, SILVER_DEPTHS_ENCOUNTERS, SILVER_DEPTHS_GALLERY_IDS, silverDepthsScaledStats, silverDepthsStageSpawns } from "./silver-depths-encounters.js";

describe("staged Silver Depths encounters", () => {
  it("builds two gallery waves, an antechamber group, and a final boss", () => {
    expect(silverDepthsStageSpawns(1)).toHaveLength(3);
    expect(silverDepthsStageSpawns(2, "iron")).toHaveLength(3);
    expect(silverDepthsStageSpawns(2, "silver")).toHaveLength(3);
    expect(silverDepthsStageSpawns(2)).toHaveLength(0);
    expect(silverDepthsStageSpawns(3)).toHaveLength(3);
    expect(silverDepthsStageSpawns(4).map(entry => entry.id)).toEqual(["crystal-matriarch"]);
    expect(SILVER_DEPTHS_GALLERY_IDS).toHaveLength(9);
    expect(SILVER_DEPTHS_ANTECHAMBER_IDS).toHaveLength(3);
    expect(new Set(SILVER_DEPTHS_ENCOUNTERS.map(entry => entry.id)).size).toBe(SILVER_DEPTHS_ENCOUNTERS.length);
  });

  it("scales health steadily for parties while keeping damage increases deliberate", () => {
    const boss = silverDepthsStageSpawns(4)[0]!;
    expect([1, 2, 3, 4].map(size => silverDepthsScaledStats(boss, size).health)).toEqual([28, 40, 51, 62]);
    expect([1, 2, 3, 4].map(size => silverDepthsScaledStats(boss, size).damageBonus)).toEqual([0, 0, 1, 1]);
    expect(silverDepthsScaledStats(boss, 99)).toEqual(silverDepthsScaledStats(boss, 4));
  });
});
