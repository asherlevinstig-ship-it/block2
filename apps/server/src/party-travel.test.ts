import { describe, expect, it, vi } from "vitest";
import { SILVER_DEPTHS_ROOM } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { Parties } from "./parties.js";
import { ForestPortalState, PlayerState, WorldState } from "./schema.js";
import { TOWN_SILVER_DEPTHS_PORTAL_POSITION } from "@blockcraft/voxel-world";

describe("expedition party travel", () => {
  function partyAtSilverPortal() {
    const room = new WorldRoom(); room.setState(new WorldState());
    const portal = new ForestPortalState();
    Object.assign(portal, TOWN_SILVER_DEPTHS_PORTAL_POSITION, { kind: "entry" });
    room.state.portals.set("depths-entry", portal);
    const leader = { sessionId: "leader", send: vi.fn() };
    const ally = { sessionId: "ally", send: vi.fn() };
    (room as any).clients.push(leader, ally);
    for (const id of ["leader", "ally"]) {
      const player = new PlayerState(); Object.assign(player, TOWN_SILVER_DEPTHS_PORTAL_POSITION);
      room.state.players.set(id, player);
    }
    (room as any).parties.restore(["leader", "ally"]);
    const transfer = vi.spyOn(room as any, "transferPartyToSilverDepths").mockResolvedValue(undefined);
    return { room, leader, ally, transfer, internal: room as any };
  }

  it("waits for every teammate before entering and only the leader can open assembly", async () => {
    const { internal, leader, ally, transfer } = partyAtSilverPortal();
    internal.useSilverDepthsPortal(ally, { id: "depths-entry" });
    expect(internal.silverDepthsLobbies.size).toBe(0);
    internal.useSilverDepthsPortal(leader, { id: "depths-entry" });
    expect(internal.silverDepthsLobbies.size).toBe(1);
    expect(leader.send).toHaveBeenCalledWith("depths:lobby", expect.objectContaining({ phase: "assembling" }));
    expect(ally.send).toHaveBeenCalledWith("depths:lobby", expect.objectContaining({ phase: "assembling" }));
    internal.handleSilverDepthsLobby(leader, { action: "ready" });
    expect(transfer).not.toHaveBeenCalled();
    internal.handleSilverDepthsLobby(ally, { action: "ready" });
    expect(transfer).toHaveBeenCalledTimes(1);
    expect(transfer).toHaveBeenCalledWith(leader);
    expect(internal.silverDepthsLobbies.size).toBe(0);
  });

  it("lets either member cancel, and expires an abandoned assembly", () => {
    const { internal, leader, ally, transfer } = partyAtSilverPortal();
    internal.useSilverDepthsPortal(leader, { id: "depths-entry" });
    internal.handleSilverDepthsLobby(ally, { action: "cancel" });
    expect(transfer).not.toHaveBeenCalled();
    expect(internal.silverDepthsLobbies.size).toBe(0);
    expect(leader.send).toHaveBeenCalledWith("depths:lobby", expect.objectContaining({ phase: "closed" }));
    internal.useSilverDepthsPortal(leader, { id: "depths-entry" });
    const lobby = [...internal.silverDepthsLobbies.values()][0] as { expiresAt: number };
    internal.validateSilverDepthsLobbies(lobby.expiresAt);
    expect(internal.silverDepthsLobbies.size).toBe(0);
    expect(transfer).not.toHaveBeenCalled();
  });

  it("cancels the ready check if the party changes", () => {
    const { internal, leader, ally, transfer } = partyAtSilverPortal();
    internal.useSilverDepthsPortal(leader, { id: "depths-entry" });
    internal.parties.leave("ally");
    internal.validateSilverDepthsLobbies(Date.now());
    expect(internal.silverDepthsLobbies.size).toBe(0);
    internal.handleSilverDepthsLobby(leader, { action: "ready" });
    expect(transfer).not.toHaveBeenCalled();
  });

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
