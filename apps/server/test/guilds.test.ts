import { describe, expect, it } from "vitest";
import { GuildRequestSchema, parseGuildMembership } from "@blockcraft/protocol";
import { Guilds } from "../src/guilds.js";

function fixture() {
  const guilds = new Guilds();
  const players = new Map("abc".split("").map((id, index) => [id,
    { name: `Explorer ${id}`, x: index, y: 8, z: 0, huntLoadoutsJson: JSON.stringify({ loadouts: [] }) }]));
  let now = 10_000, sequence = 0;
  const handle = (id: string, request: Parameters<Guilds["handle"]>[1]) => guilds.handle(id, request, players, now, () => `${++sequence}-12345678`);
  return { guilds, players, handle, tick: (ms: number) => { now += ms; }, snapshot: (id: string) => guilds.snapshot(id, players, now) };
}

describe("persistent guild membership", () => {
  it("creates a guild without discarding profile data", () => {
    const f = fixture();
    expect(f.handle("a", { action: "create", name: "Dawn Guard" }).message).toContain("founded");
    expect(parseGuildMembership(f.players.get("a")!.huntLoadoutsJson)?.name).toBe("Dawn Guard");
    expect(JSON.parse(f.players.get("a")!.huntLoadoutsJson).loadouts).toEqual([]);
  });
  it("requires nearby consent before joining and exposes the connected roster", () => {
    const f = fixture(); f.handle("a", { action: "create", name: "Dawn Guard" });
    f.tick(2_000); expect(f.handle("a", { action: "invite", targetId: "b" }).message).toContain("sent");
    expect(f.snapshot("b").invite?.guildName).toBe("Dawn Guard");
    const inviteId = f.snapshot("b").invite!.id;
    f.handle("b", { action: "respond", inviteId, accept: true });
    expect(f.snapshot("a").members.map(member => member.id)).toEqual(["a", "b"]);
  });
  it("rejects distant invitations and lets members leave", () => {
    const f = fixture(); f.handle("a", { action: "create", name: "Dawn Guard" });
    f.players.get("b")!.x = 20; expect(f.handle("a", { action: "invite", targetId: "b" }).message).toContain("4m");
    expect(f.handle("a", { action: "leave" }).message).toContain("left");
    expect(parseGuildMembership(f.players.get("a")!.huntLoadoutsJson)).toBeNull();
  });
  it("validates names and cannot replay an accepted invitation", () => {
    expect(GuildRequestSchema.safeParse({ action: "create", name: "!!" }).success).toBe(false);
    const f = fixture(); f.handle("a", { action: "create", name: "Dawn Guard" }); f.tick(2_000);
    f.handle("a", { action: "invite", targetId: "b" }); const id = f.snapshot("b").invite!.id;
    f.handle("b", { action: "respond", inviteId: id, accept: true });
    expect(f.handle("b", { action: "respond", inviteId: id, accept: true }).message).toContain("expired");
  });
});
