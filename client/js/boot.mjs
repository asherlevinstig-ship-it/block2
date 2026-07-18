try {
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
