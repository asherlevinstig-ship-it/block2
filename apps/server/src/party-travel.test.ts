import { describe, expect, it, vi } from "vitest";
import { SILVER_DEPTHS_ROOM } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { Parties } from "./parties.js";
import { PlayerState, WorldState } from "./schema.js";

describe("expedition party travel", () => {
  it("restores members as they arrive, without overriding a different party", () => {
    const parties = new Parties();
    parties.restore(["leader"]);
    expect(parties.cohort("leader").members).toEqual(["leader"]);
    parties.restore(["leader", "ally"]);
    expect(parties.cohort("leader").members).toEqual(["leader", "ally"]);
    parties.restore(["leader", "ally", "third"]);
    expect(parties.cohort("third").members).toEqual(["leader", "ally", "third"]);
    parties.leave("ally");
    expect(parties.cohort("leader").members).toEqual(["leader", "third"]);
  });

  it("binds the return ticket to the party's saved profiles and original town room", async () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    (room as any).roomId = "town-a";
    const leader = { sessionId: "leader", send: vi.fn() };
    const ally = { sessionId: "ally", send: vi.fn() };
    (room as any).clients.push(leader, ally);
    room.state.players.set("leader", new PlayerState());
    room.state.players.set("ally", new PlayerState());
    const internal = room as any;
    internal.profileTokens.set("leader", "profile-leader");
    internal.profileTokens.set("ally", "profile-ally");
    internal.parties.restore(["leader", "ally"]);
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const records = new Map<string, string>();
    (room as any).presence = {
      setex: vi.fn((key: string, value: string) => { records.set(key, value); }),
      get: vi.fn((key: string) => records.get(key)),
    };

    await internal.transferPartyToSilverDepths(leader);
    const transfer = leader.send.mock.calls.find(([kind]) => kind === "room:transfer")?.[1];
    expect(transfer).toMatchObject({ room: SILVER_DEPTHS_ROOM, partySize: 2,
      partyTicket: expect.any(String) });
    expect(ally.send).toHaveBeenCalledWith("room:transfer", transfer);
    const record = JSON.parse(records.get(`blockcraft:expedition-party:${transfer.partyTicket}`)!);
    expect(record).toEqual({ instanceKey: transfer.instanceKey, worldRoomId: "town-a",
      profiles: ["profile-leader", "profile-ally"] });

    const dungeon = new WorldRoom(); dungeon.setState(new WorldState());
    const dungeonInternal = dungeon as any;
    dungeonInternal.silverInstanceKey = transfer.instanceKey;
    dungeonInternal.expeditionTicketBySession.set("leader", transfer.partyTicket);
    dungeonInternal.presence = (room as any).presence;
    expect(await dungeonInternal.expeditionReturnTicket("leader")).toEqual({
      partyTicket: transfer.partyTicket, worldRoomId: "town-a" });
    dungeonInternal.silverInstanceKey = "different-instance";
    expect(await dungeonInternal.expeditionReturnTicket("leader")).toEqual({});
  });

  it("regroups only returning sessions with the same validated ticket", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    room.state.players.set("leader", new PlayerState());
    room.state.players.set("ally", new PlayerState());
    room.state.players.set("stranger", new PlayerState());
    internal.expeditionTicketBySession.set("leader", "ticket-a");
    internal.expeditionTicketBySession.set("ally", "ticket-a");
    internal.expeditionTicketBySession.set("stranger", "ticket-b");
    internal.profileTokens.set("leader", "profile-leader");
    internal.profileTokens.set("ally", "profile-ally");
    internal.profileTokens.set("stranger", "profile-stranger");
    internal.restoreExpeditionParty("ticket-a");
    expect(internal.parties.cohort("leader").members).toEqual(["leader", "ally"]);
    expect(internal.parties.cohort("stranger").members).toEqual(["stranger"]);
    expect(internal.parties.cohort("leader").key).not.toBe(`return:ticket-a`);
  });

  it("rejects a copied return ticket from a different player profile", async () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    const ticket = "11111111-1111-4111-8111-111111111111";
    const leaderProfile = `guest_${"a".repeat(32)}`;
    const allyProfile = `guest_${"b".repeat(32)}`;
    const strangerProfile = `guest_${"c".repeat(32)}`;
    internal.presence = {
      hget: vi.fn().mockResolvedValue(null),
      get: vi.fn().mockResolvedValue(JSON.stringify({ instanceKey: "depths-a", worldRoomId: "town-a",
        profiles: [leaderProfile, allyProfile] })),
    };
    vi.spyOn(internal, "resolveAdminAccess").mockResolvedValue(false);
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const clients = ["leader", "stranger", "ally"].map(sessionId => ({ sessionId, send: vi.fn() }));
    internal.clients.push(...clients);
    await room.onJoin(clients[0] as any, { profileToken: leaderProfile, returnFrom: "silver-depths", partyTicket: ticket });
    await room.onJoin(clients[1] as any, { profileToken: strangerProfile, returnFrom: "silver-depths", partyTicket: ticket });
    expect(internal.parties.cohort("leader").members).toEqual(["leader"]);
    expect(internal.expeditionTicketBySession.has("stranger")).toBe(false);
    await room.onJoin(clients[2] as any, { profileToken: allyProfile, returnFrom: "silver-depths", partyTicket: ticket });
    expect(internal.parties.cohort("leader").members).toEqual(["leader", "ally"]);
  });
});
