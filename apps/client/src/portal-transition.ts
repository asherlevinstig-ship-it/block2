type Phase = "idle" | "charging" | "travelling" | "arriving";
export interface PortalTransitionState { phase: Phase; startedAt: number; charge: number; arrived: boolean }
export function portalTravelUsesVeil(fromRoom: string, toRoom: string): boolean {
  // Transfers contain authoritative room IDs (for example
  // "hearth-and-hammer-v4"), not the short `?room=tavern` URL alias.
  // Treat both forms as the Tavern so its door remains an immediate cut.
  const isTavern = (room: string) => room === "tavern" || room.startsWith("hearth-and-hammer-");
  return !isTavern(fromRoom) && !isTavern(toRoom);
}
export function portalTransitionFrame(state: PortalTransitionState, now: number, ready: boolean) {
  const elapsed = Math.max(0, now - state.startedAt);
  if (state.phase === "travelling" && (state.arrived && ready && elapsed >= 350 || elapsed > 8000))
    return { state: { ...state, phase: "arriving" as const, startedAt: now }, opacity: .94 };
  if (state.phase === "arriving") {
    const amount = Math.min(1, elapsed / 650);
    return { state: amount >= 1 ? { ...state, phase: "idle" as const } : state, opacity: .94 * (1 - amount) };
  }
  return { state, opacity: state.phase === "travelling" ? .94 : state.phase === "charging" ? state.charge * .4 : 0 };
}

/** Screen-space effect only: never moves the camera or intercepts input. */
export function createPortalTransition() {
  const overlay = document.createElement("div");
  overlay.id = "portal-transition";
  overlay.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  document.body.appendChild(overlay);
  let state: PortalTransitionState = { phase: "idle", startedAt: 0, charge: 0, arrived: false };
  let latestReady = false;
  const carryKey = "blockcraft-portal-transition-v1";
  try {
    const carried = Number(sessionStorage.getItem(carryKey));
    sessionStorage.removeItem(carryKey);
    if (carried > 0 && Date.now() - carried < 15000)
      state = { phase: "travelling", startedAt: performance.now(), charge: 1, arrived: true };
  } catch { /* Page travel also works when browser storage is unavailable. */ }
  let animationFrame = 0;
  function render(now: number): void {
    const next = portalTransitionFrame(state, now, latestReady);
    state = next.state;
    overlay.hidden = state.phase === "idle";
    overlay.dataset.phase = state.phase;
    overlay.style.setProperty("--portal-opacity", String(next.opacity));
    if (state.phase !== "idle") animationFrame = requestAnimationFrame(render);
    else animationFrame = 0;
  }
  function schedule(): void { if (!animationFrame) animationFrame = requestAnimationFrame(render); }
  schedule();
  return {
    isActive() { return state.phase !== "idle"; },
    charge(amount: number) {
      if (state.phase === "travelling" || state.phase === "arriving") return;
      state = { phase: "charging", startedAt: performance.now(), charge: Math.max(0, Math.min(1, amount)), arrived: false };
      schedule();
    },
    cancel() {
      if (state.phase !== "charging") return;
      state = { ...state, phase: "idle", charge: 0 };
      overlay.hidden = true;
    },
    depart() {
      state = { phase: "travelling", startedAt: performance.now(), charge: 1, arrived: false };
      schedule();
    },
    arrive() {
      if (state.phase !== "travelling") this.depart();
      state.arrived = true;
    },
    reject() {
      if (state.phase === "travelling" && !state.arrived)
        state = { ...state, phase: "arriving", startedAt: performance.now() };
    },
    ready(ready: boolean) { latestReady = ready; },
    carry() {
      try { sessionStorage.setItem(carryKey, String(Date.now())); } catch { /* Optional continuity only. */ }
    },
  };
}
