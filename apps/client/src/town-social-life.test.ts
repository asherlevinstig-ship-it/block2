import { describe, expect, it } from "vitest";
import { townSocialBeat } from "./town-social-life.js";

describe("ambient town social life", () => {
  it("alternates a real two-person plaza conversation with silent breathing room", () => {
    const context = { highestFloorCleared: 0, localPlayerIsMurderer: false };
    expect(townSocialBeat(0, context)).toMatchObject({ speakerId: "plaza-patron-a", listenerId: "plaza-patron-b" });
    expect(townSocialBeat(6_000, context)).toMatchObject({ speakerId: "plaza-patron-b", listenerId: "plaza-patron-a" });
    expect(townSocialBeat(4_500, context)).toBeNull();
  });

  it("reacts to Chronicle progress without creating objectives", () => {
    const beat = townSocialBeat(0, { highestFloorCleared: 2, localPlayerIsMurderer: false });
    expect(beat?.line).toContain("Floor 2");
    expect(beat?.tone).toBe("victory");
  });

  it("makes guards recognise a notorious PvP player", () => {
    const beat = townSocialBeat(12_000, { highestFloorCleared: 0, localPlayerIsMurderer: true });
    expect(beat).toMatchObject({ speakerId: "north-warden", tone: "warning" });
    expect(beat?.line).toContain("Red name");
  });
});
