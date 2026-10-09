import { describe, expect, it } from "vitest";
import { PartyRequestSchema } from "@blockcraft/protocol";
import { Parties } from "../src/parties.js";
function fixture() {
  const parties = new Parties(); const players = new Map("abcdef".split("").map((id, index) => [id, { name: `Explorer ${id}`, x: index, y: 8, z: 0, health: 5, maxHealth: 5 }]));
  let now = 10000;
  const invite = (from: string, to: string) => parties.handle(from, { action: "invite", targetId: to }, players, now += 2000);
  const respond = (to: string, accept = true) => parties.handle(to, { action: "respond", inviteId: parties.snapshot(to, players, now).invite?.id ?? "missing", accept }, players, now);
  const group = () => { invite("a", "b"); respond("b"); };
  return { parties, players, invite, respond, group, snapshot: (id: string) => parties.snapshot(id, players, now), advance: (ms: number) => { now += ms; parties.expire(now); } };
}
describe("consent-based four-player parties", () => {
  it("does not join until consent, then shares roster health and distance", () => {
    const f = fixture(); f.invite("a", "b"); expect(f.snapshot("a").members).toHaveLength(0);
    expect(f.snapshot("b").invite?.name).toBe("Explorer a"); f.respond("b");
    f.players.get("a")!.health = 2;
    expect(f.snapshot("b").members).toEqual([{ id: "a", name: "Explorer a", health: 2, maxHealth: 5, distance: 1, leader: true }, { id: "b", name: "Explorer b", health: 5, maxHealth: 5, distance: 0, leader: false }]);
  });
  it("declines and expires invitations without changing membership", () => {
    const f = fixture(); f.invite("a", "b"); f.respond("b", false); expect(f.snapshot("b").invite).toBeNull();
    f.invite("a", "b"); f.advance(30000); expect(f.snapshot("b").invite).toBeNull(); expect(f.respond("b")).toContain("expired");
  });
  it("enforces range, floor and identity validation", () => {
    const f = fixture(); f.players.get("b")!.x = 30; expect(f.invite("a", "b")).toContain("nearby");
    f.players.get("b")!.x = 1; f.players.get("b")!.y = 3; expect(f.invite("a", "b")).toContain("nearby");
    expect(f.invite("a", "a")).toContain("nearby"); expect(f.invite("a", "missing")).toContain("nearby");
  });
  it("checks capacity again when concurrent pending invitations are accepted", () => {
    const f = fixture(); f.group(); f.invite("a", "c"); f.respond("c");
    f.invite("a", "d"); f.invite("b", "e"); f.respond("d"); expect(f.respond("e")).toContain("full");
    expect(f.snapshot("a").members).toHaveLength(4); expect(f.snapshot("e").partyId).toBeNull();
  });
  it("reassigns the leader on disconnect and disbands singleton groups", () => {
    const f = fixture(); f.group(); f.invite("b", "c"); f.respond("c"); f.parties.disconnect("a");
    expect(f.snapshot("b").members[0]?.leader).toBe(true); expect(f.snapshot("b").members).toHaveLength(2);
    f.parties.disconnect("c"); expect(f.snapshot("b").partyId).toBeNull();
  });
  it("rejects stale or replayed consent and clears invitations on leave", () => {
    const f = fixture(); f.invite("a", "b"); const id = f.snapshot("b").invite!.id; f.respond("b");
    expect(f.parties.handle("b", { action: "respond", inviteId: id, accept: true }, f.players, 12000)).toContain("expired");
    f.invite("a", "c"); f.parties.leave("a"); expect(f.snapshot("c").invite).toBeNull();
  });
  it("limits outgoing invitations and prevents invitation spam", () => {
    const f = fixture(); f.invite("a", "b");
    expect(f.parties.handle("a", { action: "invite", targetId: "c" }, f.players, 12001)).toContain("Wait");
    f.invite("a", "c"); expect(f.snapshot("b").invite).toBeNull(); expect(f.snapshot("c").invite).not.toBeNull();
  });
  it("excludes party members from nearby invitations and validates payloads", () => {
    const f = fixture(); f.group(); expect(f.snapshot("a").nearby.some(player => player.id === "b")).toBe(false);
    for (const payload of [null, { action: "join", partyId: "fake" }, { action: "respond", inviteId: "x", accept: "yes" }]) expect(PartyRequestSchema.safeParse(payload).success).toBe(false);
  });
});
