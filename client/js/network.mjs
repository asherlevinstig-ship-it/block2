import { reconnectWithBackoff } from './reconnect.mjs';

export function createNetworkController(options) {
  const state = { on: false, room: null, tod: null, remotes: {}, lastMove: 0, lastMeta: '', lastSave: 0, lastSnap: '', pending: [], dgn: '', pendingDungeonStatus: null, reconnecting: false, attachCount: 0, tried: false };
  let stopped = false;
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

  function joinFresh(client, name) {
    return reconnectWithBackoff(
      () => roomWithTimeout(
        () => client.joinOrCreate(options.roomName, { name }),
        joinTimeout,
        'Room join timed out',
      ),
      { attempts: joinAttempts, baseDelay: 250 },
    );
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
    try { if (room.reconnectionToken) options.sessionStorage.setItem(options.tokenKey, room.reconnectionToken); } catch (_) {}
    room.onLeave(() => reconnect(room, name, client));
    options.onAttach(room, name, client);
  }

  function reconnect(room, name, client) {
    if (stopped || state.room !== room || state.reconnecting) return;
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
    if (!options.Client) return options.onUnavailable();
    const client = new options.Client(options.endpoint());
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

  return { state, connect, reconnect, pauseReconnect, shutdown };
}
