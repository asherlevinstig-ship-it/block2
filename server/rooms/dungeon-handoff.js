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

module.exports = { handOff, takeHandoff };
