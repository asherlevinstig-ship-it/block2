import { describe, expect, it } from "vitest";
import { GUILD_LICENSE_GOLD_COST, parseGuildMembership } from "@blockcraft/protocol";
import { Guilds } from "./guilds.js";

type TestPlayer = { x: number; y: number; z: number; name: string; coins: number; huntLoadoutsJson: string };

const player = (name: string, x = 0, coins = GUILD_LICENSE_GOLD_COST): TestPlayer => ({
  x, y: 8, z: 0, name, coins, huntLoadoutsJson: "{}",
});

describe("guild progression", () => {
  it("persists a newly founded guild in the player's authoritative profile", () => {
    const guilds = new Guilds();
    const founder = player("Aria");
    const players = new Map([["aria", founder]]);

    const result = guilds.handle("aria", { action: "create", name: "Dawn Ward" }, players, 1_000,
      () => "fixed-id");

    expect(result.changed).toEqual(["aria"]);
    expect(founder.coins).toBe(0);
    expect(parseGuildMembership(founder.huntLoadoutsJson)).toEqual({
      id: "guild-fixed-id",
      name: "Dawn Ward",
    });
    expect(guilds.snapshot("aria", players, 1_000).members).toEqual([
      { id: "aria", name: "Aria", online: true, distance: 0 },
    ]);
  });

  it("refuses a guild licence without enough gold and does not partially create or charge it", () => {
    const guilds = new Guilds();
    const founder = player("Aria", 0, GUILD_LICENSE_GOLD_COST - 1);
    const players = new Map([["aria", founder]]);

    const result = guilds.handle("aria", { action: "create", name: "Dawn Ward" }, players, 1_000,
      () => "fixed-id");

    expect(result.changed).toEqual([]);
    expect(result.message).toContain("need 1 more gold");
    expect(founder.coins).toBe(GUILD_LICENSE_GOLD_COST - 1);
    expect(parseGuildMembership(founder.huntLoadoutsJson)).toBeNull();
  });

  it("charges the licence exactly once when a repeated create request arrives", () => {
    const guilds = new Guilds();
    const founder = player("Aria", 0, GUILD_LICENSE_GOLD_COST * 2);
    const players = new Map([["aria", founder]]);

    guilds.handle("aria", { action: "create", name: "Dawn Ward" }, players, 1_000, () => "fixed-id");
    const repeated = guilds.handle("aria", { action: "create", name: "Second Ward" }, players, 1_400, () => "second-id");

    expect(founder.coins).toBe(GUILD_LICENSE_GOLD_COST);
    expect(repeated.changed).toEqual([]);
    expect(parseGuildMembership(founder.huntLoadoutsJson)?.name).toBe("Dawn Ward");
  });

  it("requires a nearby invitation and explicit acceptance before another player joins", () => {
    const guilds = new Guilds();
    const founder = player("Aria");
    const recruit = player("Bryn", 2);
    const players = new Map([
      ["aria", founder],
      ["bryn", recruit],
    ]);
    guilds.handle("aria", { action: "create", name: "Dawn Ward" }, players, 1_000,
      () => "fixed-id");

    const invitation = guilds.handle("aria", { action: "invite", targetId: "bryn" }, players, 4_000,
      () => "unused");
    expect(invitation.message).toContain("sent to Bryn");
    expect(parseGuildMembership(recruit.huntLoadoutsJson)).toBeNull();

    const pending = guilds.snapshot("bryn", players, 4_000).invite;
    expect(pending?.guildName).toBe("Dawn Ward");
    const accepted = guilds.handle("bryn", { action: "respond", inviteId: pending!.id, accept: true },
      players, 4_100, () => "unused");

    expect(accepted.changed).toEqual(["bryn"]);
    expect(parseGuildMembership(recruit.huntLoadoutsJson)).toEqual({
      id: "guild-fixed-id",
      name: "Dawn Ward",
    });
    expect(guilds.snapshot("aria", players, 4_100).members.map((member) => member.name))
      .toEqual(["Aria", "Bryn"]);
  });
});
