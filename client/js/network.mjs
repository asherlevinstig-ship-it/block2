import { reconnectWithBackoff } from './reconnect.mjs';

export function createNetworkController(options) {
  const state = { on: false, room: null, tod: null, remotes: {}, lastMove: 0, lastMeta: '', lastSave: 0, lastSnap: '', pending: [], dgn: '', pendingDungeonStatus: null, reconnecting: false, attachCount: 0, tried: false };
  let stopped = false;

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
    reconnectWithBackoff(() => client.reconnect(room.reconnectionToken), {
      attempts: 4, baseDelay: 250, onAttempt: options.onReconnectAttempt,
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
    const joinFresh = () => client.joinOrCreate(options.roomName, { name });
    const joining = resumeToken
      ? client.reconnect(resumeToken).catch(() => { try { options.sessionStorage.removeItem(options.tokenKey); } catch (_) {} return joinFresh(); })
      : joinFresh();
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

  return { state, connect, reconnect, shutdown };
}
