// Same-process handoff of a just-saved profile from a DungeonRoom back to
// GameRoom (Phase 2c). Both room types run in one Node process
// (server/index.js registers them on one gameServer), so this is a plain
// in-memory registry rather than Colyseus presence/pub-sub — mirrors the
// existing claimGlobalWorld/releaseGlobalWorld singleton-lease idiom.
//
// GameRoom.onJoin trusts its own in-memory profile cache indefinitely once
// populated (load-bearing for offline-token lookups elsewhere — gate
// refunds, egg-breeding rewards, guild fellowship names), so a player
// returning from a DungeonRoom needs an explicit, targeted way to override
// that stale cache with what DungeonRoom actually saved.
//
// The TTL guards one specific race: an abrupt disconnect (not a clean
// switchRoom leave) can let a client reconnect straight into GameRoom
// before DungeonRoom's own onLeave/flush ever runs. If that late handoff
// were applied on some future, unrelated join for the same token, it would
// silently clobber newer progress with dungeon leftovers. Past the TTL the
// entry is just discarded — GameRoom's normal cache-or-store-load path is
// still correct, since DungeonRoom already persisted to the store.
const HANDOFF_TTL_MS = 120000;

const handoffs = new Map(); // token -> { prof, at }

function handOff(token, prof) {
  if (!token || !prof) return;
  handoffs.set(token, { prof, at: Date.now() });
}

function takeHandoff(token) {
  const entry = handoffs.get(token);
  if (!entry) return null;
  handoffs.delete(token);
  if (Date.now() - entry.at > HANDOFF_TTL_MS) return null;
  return entry.prof;
}

// The other direction of the same in-process seam: a DungeonRoom that has run
// its course (raid cleared or the party has all left) records the overworld
// gate id it was hosting so the overworld GameRoom can retire that gate. The
// flag-gated client entry (dimensions.mjs enterDungeon -> NETWORK.switchRoom)
// bypasses the overworld 'enterGate' handler entirely, so without this the gate
// the hunter walked into stays active in the shared world until its TTL lapses.
//
// expireGate() is overworld-room machinery (it touches gate lobbies, the mirror
// of the primary gate, and dirty-gate persistence a DungeonRoom structurally
// lacks), so the DungeonRoom cannot call it directly. It only leaves the id
// here; the overworld room drains and expires on its own gate-lifecycle tick,
// keeping every mutation of overworld state inside the overworld room.
//
// This registry deliberately outlives any single overworld room. A solo hunter's
// dungeon trip empties and disposes the overworld room, and fleeing back creates
// a fresh one — the consume notice the DungeonRoom leaves on disposal has to
// survive that recreation to be drained. It's safe to persist because gate ids
// never recycle within a process: gateSeq is seeded from the highest restored id
// and only increments, so a drained id can only ever match the same gate. Across
// a real process restart this module starts empty, so no stale ids carry over.
const consumedGates = new Set(); // overworld gate ids awaiting expiry
const hostedGates = new Set(); // overworld gate ids currently owned by a DungeonRoom
const breachedGates = []; // serialized DungeonRoom breach payloads awaiting overworld spawn
const requestedPublicGateRanks = new Set(); // public rank backfills requested by DungeonRooms

function hostGate(gateId) {
  if (gateId) hostedGates.add(String(gateId));
}

function unhostGate(gateId) {
  if (gateId) hostedGates.delete(String(gateId));
}

function isHostedGate(gateId) {
  return gateId ? hostedGates.has(String(gateId)) : false;
}

function consumeGate(gateId) {
  if (gateId) consumedGates.add(String(gateId));
}

function drainConsumedGates() {
  if (!consumedGates.size) return [];
  const ids = [...consumedGates];
  consumedGates.clear();
  return ids;
}

function recordGateBreach(payload) {
  if (!payload || !payload.gateId) return;
  breachedGates.push({ ...payload, gateId: String(payload.gateId), at: payload.at || Date.now() });
}

function drainGateBreaches() {
  if (!breachedGates.length) return [];
  return breachedGates.splice(0, breachedGates.length);
}

function requestPublicGateRank(rank) {
  if (!Number.isFinite(rank)) return;
  requestedPublicGateRanks.add(Math.max(0, Math.min(4, rank | 0)));
}

function drainRequestedPublicGateRanks() {
  if (!requestedPublicGateRanks.size) return [];
  const ranks = [...requestedPublicGateRanks];
  requestedPublicGateRanks.clear();
  return ranks;
}

module.exports = {
  handOff, takeHandoff,
  hostGate, unhostGate, isHostedGate,
  consumeGate, drainConsumedGates,
  recordGateBreach, drainGateBreaches,
  requestPublicGateRank, drainRequestedPublicGateRanks,
};
