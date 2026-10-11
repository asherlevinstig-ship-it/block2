import { describe, expect, it } from "vitest";
import { forestDungeonAtmosphere, forestDungeonNotice, portalNoticeFeedback } from "./forest-dungeon-presentation.js";

describe("Forest Dungeon presentation", () => {
  it("gives every room a distinct, darker atmosphere", () => {
    const rooms = [forestDungeonAtmosphere(160, 165), forestDungeonAtmosphere(174, 165), forestDungeonAtmosphere(187, 165)];
    expect(rooms.map(room => room.room)).toEqual([1, 2, 3]);
    expect(new Set(rooms.map(room => room.name)).size).toBe(3);
    expect(rooms.every(room => room.fogEnd < 50 && room.ambient[0] < .3)).toBe(true);
    expect(forestDungeonAtmosphere(100, 100).room).toBe(0);
  });

  it("maps authoritative clear notices to the correct gate and victory altar", () => {
    expect(forestDungeonNotice("Room 1 cleared · the next root gate has opened.")).toMatchObject({ kind: "gate", x: 168.5 });
    expect(forestDungeonNotice("Room 2 cleared · the next root gate has opened.")).toMatchObject({ kind: "gate", x: 180.5 });
    expect(forestDungeonNotice("Guardian defeated! Collect your equipment bag, then use the return portal.")).toMatchObject({ kind: "victory", x: 189.5 });
    expect(forestDungeonNotice("Something else")).toBeNull();
  });

  it("distinguishes locked portals, arrivals, and real completions", () => {
    expect(portalNoticeFeedback("The Ember Vault requires two Silver Depths attunements.")).toEqual({ title: "PORTAL LOCKED", cue: "hit" });
    expect(portalNoticeFeedback("The Ember Vault is occupied by another expedition.")).toEqual({ title: "PORTAL LOCKED", cue: "hit" });
    expect(portalNoticeFeedback("Ember Vault entered · cross the heat lanes and defeat the Forge Colossus.")).toEqual({ title: "EMBER VAULT", cue: "dodge" });
    expect(portalNoticeFeedback("Ember Vault cleared · returned to the frontier.")).toEqual({ title: "VAULT CLEARED", cue: "dodge" });
    expect(portalNoticeFeedback("An unrelated status message")).toBeNull();
  });
});
