try {
  (() => {
    const entries = [];
    const MAX = 240;
    const clone = value => {
      try { return JSON.parse(JSON.stringify(value)); } catch (e) { return String(value); }
    };
    const compact = value => {
      if (value == null || typeof value !== 'object') return value;
      if (Array.isArray(value)) return value.slice(0, 24).map(compact);
      const out = {};
      for (const [key, raw] of Object.entries(value)) {
        if (/password|token|secret|credential|private/i.test(key)) continue;
        if (typeof raw === 'string') out[key] = raw.length > 160 ? raw.slice(0, 157) + '...' : raw;
        else if (raw && typeof raw === 'object') out[key] = compact(raw);
        else out[key] = raw;
      }
      return out;
    };
    window.BlockcraftDebug = {
      trace(event, data = {}) {
        const state = typeof window.BlockcraftDebugSnapshot === 'function' ? window.BlockcraftDebugSnapshot() : null;
        const entry = {
          at: new Date().toISOString(),
          ms: Math.round(performance.now()),
          event: String(event || 'debug'),
          data: compact(clone(data)),
          state: compact(clone(state)),
        };
        entries.push(entry);
        if (entries.length > MAX) entries.splice(0, entries.length - MAX);
        try {
          if (localStorage.getItem('bc_debug_trace_console') === '1') console.info('[bc-trace]', entry);
        } catch (e) {}
        return entry;
      },
      dump() { return entries.slice(); },
      dumpText() { return JSON.stringify(entries, null, 2); },
      clear() { entries.length = 0; },
    };
    window.BlockcraftTrace = (event, data) => window.BlockcraftDebug.trace(event, data);
    window.BlockcraftTrace('boot.start');
  })();
  const [gameContextModule, authModule, progressionModule, inventoryModule, questJobModule, networkModule, renderingModule, onboardingModule] = await Promise.all([
    import('./game-context.mjs'),
    import('./auth.mjs'),
    import('./progression.mjs'),
    import('./inventory.mjs'),
    import('./quests-jobs.mjs'),
    import('./network.mjs'),
    import('./rendering.mjs'),
    import('./onboarding.mjs?v=3'),
  ]);
  const gameContext = gameContextModule.createGameContext({
    services: {
      auth: authModule,
      progression: progressionModule,
      inventory: inventoryModule,
      quests: questJobModule,
      network: networkModule,
      rendering: renderingModule,
      onboarding: onboardingModule,
    },
    state: { uiShell: { qOpen: false, qMode: '' } },
  });
  window.BlockcraftGameContext = gameContext;
  const uiShellState = gameContext.requireState('uiShell');
  Object.defineProperty(window, 'qOpen', {
    get: () => uiShellState.qOpen,
    set: value => { uiShellState.qOpen = !!value; },
    configurable: true,
  });
  Object.defineProperty(window, 'qMode', {
    get: () => uiShellState.qMode || '',
    set: value => { uiShellState.qMode = typeof value === 'string' ? value : ''; },
    configurable: true,
  });
  for (const src of ['./world.mjs', './dimensions.mjs', './recall.mjs', './combat.mjs', './hud.mjs', './menus.mjs', './networking.mjs']) {
    await import(src);
    gameContext.markModuleLoaded(src.slice(src.lastIndexOf('/') + 1, src.lastIndexOf('.')));
  }
  await import('./frame-loop.mjs');
  gameContext.markModuleLoaded('frame-loop');
  gameContext.setPhase('ready');
  document.documentElement.dataset.gamePhase = 'ready';
  window.BlockcraftTrace && window.BlockcraftTrace('boot.ready', { modules: gameContext.snapshot().loadedModules });
  document.documentElement.dataset.gameModules = gameContext.snapshot().loadedModules.join(',');
  for (const id of ['playbtn', 'registerbtn', 'logoutbtn']) {
    const button = document.getElementById(id);
    if (button) button.disabled = false;
  }
  const authUser = document.getElementById('authuser');
  if (authUser && (document.activeElement === document.body || !document.activeElement)) authUser.focus();
} catch (err) {
  if (window.BlockcraftGameContext) window.BlockcraftGameContext.setPhase('failed');
  document.documentElement.dataset.gamePhase = 'failed';
  console.error('Blockcraft client failed to load', err);
}
