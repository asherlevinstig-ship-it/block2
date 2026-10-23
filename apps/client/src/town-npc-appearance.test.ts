import { describe, expect, it } from "vitest";
import type { TownLifeRole } from "./town-life.js";
import { TOWN_NPC_FACE_STYLES, townNpcFaceStyle } from "./town-npc-appearance.js";

const roles: TownLifeRole[] = ["guard", "vendor", "smith", "healer", "resident"];

describe("town NPC facial identities", () => {
  it("gives every fast-mode town role a readable expression and eye colour", () => {
    expect(Object.keys(TOWN_NPC_FACE_STYLES).sort()).toEqual([...roles].sort());
    for (const role of roles) {
      const style = townNpcFaceStyle(role);
      expect(style.iris).toHaveLength(3);
      expect(style.iris.every(channel => channel >= 0 && channel <= 1)).toBe(true);
      expect(["calm", "friendly", "stern"]).toContain(style.mouth);
    }
    expect(new Set(roles.map(role => townNpcFaceStyle(role).iris.join(":"))).size).toBe(roles.length);
  });

  it("reserves distinctive silhouette details for the roles they explain", () => {
    expect(townNpcFaceStyle("guard").scar).toBe(true);
    expect(townNpcFaceStyle("smith").beard).toBe(true);
    expect(townNpcFaceStyle("healer").circlet).toBe(true);
    expect(townNpcFaceStyle("resident").freckles).toBe(true);
    expect(townNpcFaceStyle("vendor").mouth).toBe("friendly");
  });
});
