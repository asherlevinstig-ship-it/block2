import { reconnectWithBackoff } from './reconnect.mjs';

export function createNetworkController(options) {
  const state = { on: false, room: null, tod: null, remotes: {}, lastMove: 0, lastMeta: '', lastSave: 0, lastSnap: '', pending: [], dgn: '', pendingDungeonStatus: null, pendingDungeonPartyStatus: null, reconnecting: false, attachCount: 0, tried: false, roomName: options.roomName, shardId: '' };
  let stopped = false;
  // Multi-room (DungeonRoom 2c): the live client and player name are retained so the controller
  // can leave the primary room and join a secondary one (the dungeon) and back, reusing the same
  // connection. `switching` suppresses the onLeave->reconnect path while we intentionally swap.
  let activeClient = null;
  let currentName = '';
  const primaryRoomName = options.roomName;
  let primaryJoinOptions = {};
  let switching = false;
  // These guard against a genuinely hung connection, not a slow-but-fine one. A fresh join can
  // legitimately take a few seconds when matchmaking recreates the room (cold onCreate:
  // deterministic world-gen + persistence restore), so the ceilings must clear that with margin
  // or a reconnect-after-reload abandons itself and never reaches `connected`. A successful
  // connect still resolves in ~1-2s regardless of these ceilings.
  const resumeTimeout = Math.max(1, options.resumeTimeout | 0 || 7000);
  const joinTimeout = Math.max(1, options.joinTimeout | 0 || 10000);
  const joinAttempts = Math.max(1, options.joinAttempts | 0 || 2);
  const liveReconnectTimeout = Math.max(1, options.liveReconnectTimeout | 0 || 4000);
  const reconnectAttempts = Math.max(1, options.reconnectAttempts | 0 || 2);

  function roomWithTimeout(start, timeoutMs, message) {
    let expired = false;
    let timer;
    const pending = Promise.resolve().then(start);
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        reject(new Error(message));
      }, timeoutMs);
    });
    pending.then(room => {
      if (expired && room && typeof room.leave === 'function') {
        try { room.leave(); } catch (_) {}
      }
    }).catch(() => {});
    return Promise.race([pending, timeout]).finally(() => {
      clearTimeout(timer);
    });
  }

  function resumeOrJoin(client, token, joinFresh) {
    return roomWithTimeout(
      () => client.reconnect(token),
      resumeTimeout,
      'Session resume timed out',
    ).catch(() => {
      try { options.sessionStorage.removeItem(options.tokenKey); } catch (_) {}
      return joinFresh();
    });
  }

  async function joinFresh(client, name) {
    const shardAttempts = Math.max(1, options.shardAttempts | 0 || 8);
    let lastError = null;
    for (let shardAttempt = 0; shardAttempt < shardAttempts; shardAttempt++) {
      const joinOptions = options.primaryJoinOptions ? options.primaryJoinOptions({ name, attempt: shardAttempt }) : {};
      try {
        const room = await reconnectWithBackoff(
          () => roomWithTimeout(
            () => client.joinOrCreate(options.roomName, { name, ...joinOptions }),
            joinTimeout,
            'Room join timed out',
          ),
          { attempts: joinAttempts, baseDelay: 250 },
        );
        primaryJoinOptions = { ...joinOptions };
        state.shardId = String(joinOptions.shardId || 'main');
        if (options.onPrimaryJoinOptions) options.onPrimaryJoinOptions(primaryJoinOptions);
        return room;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('No Blockcraft shard was available');
  }

  function attach(room, name, client) {
    if (stopped) {
      try { room.leave(); } catch (_) {}
      return;
    }
    state.on = true;
    state.room = room;
    state.reconnecting = false;
    state.attachCount++;
    // Colyseus 0.17 added automatic Room reconnection. Blockcraft already owns a
    // bounded reconnect/fresh-join policy here, including UI state and room-switch
    // recovery, so running both layers prevents our attach hooks from firing.
    if (room.reconnection) room.reconnection.enabled = false;
    try { if (room.reconnectionToken) options.sessionStorage.setItem(options.tokenKey, room.reconnectionToken); } catch (_) {}
    room.onLeave(() => reconnect(room, name, client));
    options.onAttach(room, name, client);
  }

  function reconnect(room, name, client) {
    if (stopped || switching || state.room !== room || state.reconnecting) return;
    state.on = false;
    state.reconnecting = true;
    options.onInterrupted();
    reconnectWithBackoff(
      () => roomWithTimeout(
        () => client.reconnect(room.reconnectionToken),
        liveReconnectTimeout,
        'Live reconnect timed out',
      ),
      { attempts: reconnectAttempts, baseDelay: 250, onAttempt: options.onReconnectAttempt },
    ).catch(() => {
      try { options.sessionStorage.removeItem(options.tokenKey); } catch (_) {}
      return joinFresh(client, name);
    }).then(next => {
      if (stopped) {
        try { next.leave(); } catch (_) {}
        return;
      }
      attach(next, name, client);
      options.onRestored();
    }).catch(error => {
      state.reconnecting = false;
      fail(error);
    });
  }

  function fail(error) {
    state.tried = false;
    state.on = false;
    options.onFailure(error);
  }

  function connect(name) {
    if (state.tried) return;
    stopped = false;
    state.tried = true;
    currentName = name;
    if (!options.Client) return options.onUnavailable();
    const client = new options.Client(options.endpoint());
    activeClient = client;
    let resumeToken = '';
    try { resumeToken = options.sessionStorage.getItem(options.tokenKey) || ''; } catch (_) {}
    const freshJoin = () => joinFresh(client, name);
    const joining = resumeToken ? resumeOrJoin(client, resumeToken, freshJoin) : freshJoin();
    joining.then(room => attach(room, name, client)).catch(fail);
  }

  async function shutdown() {
    stopped = true;
    state.on = false;
    state.reconnecting = false;
    state.tried = false;
    const room = state.room;
    state.room = null;
    if (room) {
      try { await room.leave(); } catch (_) {}
    }
  }

  function pauseReconnect() {
    stopped = true;
    state.reconnecting = false;
  }

  // Leave the current room (consented, no auto-reconnect) and join `roomName` with `joinOptions`,
  // reusing the live client and re-attaching all handlers/state via options.onAttach. Used by the
  // DungeonRoom flow to move a hunter from `blockcraft` into a `dungeon` room and back. On failure
  // it falls back to the primary room so a hunter is never left disconnected.
  async function switchRoom(roomName, joinOptions = {}) {
    const client = activeClient;
    if (stopped || !client) return null;
    switching = true;
    const cur = state.room;
    state.room = null;            // so the leaving room's onLeave->reconnect short-circuits
    state.on = false;
    if (cur) { try { await cur.leave(); } catch (_) {} }
    try {
      const room = await client.joinOrCreate(roomName, { name: currentName, ...joinOptions });
      switching = false;
      state.roomName = roomName;
      attach(room, currentName, client);
      return room;
    } catch (e) {
      switching = false;
      if (roomName === primaryRoomName) { fail(e); return null; }
      return returnToPrimary();   // couldn't reach the dungeon room — go back to the overworld
    }
  }

  function returnToPrimary() {
    return switchRoom(primaryRoomName, { ...primaryJoinOptions, shardId: state.shardId || primaryJoinOptions.shardId || 'main' });
  }

  return { state, connect, reconnect, pauseReconnect, shutdown, switchRoom, returnToPrimary };
}
