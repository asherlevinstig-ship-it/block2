import { describe, expect, it } from "vitest";
import { TOWN_NPC_MODEL_FILES } from "./town-npc-assets.js";

describe("town NPC assets", () => {
  it("provides an optimized role model for every town occupation", () => {
    expect(Object.keys(TOWN_NPC_MODEL_FILES).sort()).toEqual(["guard", "healer", "resident", "smith", "vendor"]);
    for (const url of Object.values(TOWN_NPC_MODEL_FILES)) {
      expect(url).toMatch(/^\/assets\/kaykit-town-npcs\/[a-z-]+\.glb$/);
    }
  });
});
