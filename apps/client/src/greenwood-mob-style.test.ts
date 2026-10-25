import { describe, expect, it } from "vitest";
import { greenwoodEmergence, greenwoodMobStyle } from "./greenwood-mob-style.js";

describe("Greenwood mob presentation", () => {
  it("only styles Fast World Greenwood enemies", () => {
    expect(greenwoodMobStyle("greenwood-mosswatch-crawler", "moss_crawler")).toBe("moss");
    expect(greenwoodMobStyle("greenwood-mosswatch-briar", "briar_crawler")).toBe("briar");
    expect(greenwoodMobStyle("greenwood-elderthorn", "thornbinder")).toBe("elderthorn");
    expect(greenwoodMobStyle("mistfen-reed-briar", "briar_crawler")).toBeNull();
  });

  it("raises a respawned enemy smoothly from below ground", () => {
    expect(greenwoodEmergence(0)).toEqual({ y: -.62, scaleY: .58 });
    expect(greenwoodEmergence(260).y).toBeCloseTo(-.31);
    expect(greenwoodEmergence(520)).toEqual({ y: 0, scaleY: 1 });
    expect(greenwoodEmergence(2_000)).toEqual({ y: 0, scaleY: 1 });
  });
});
