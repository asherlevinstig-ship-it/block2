export interface LoadingScreenStage {
  progress: number;
  label: string;
  detail: string;
}

export function nextLoadingProgress(previous: number, requested: number): number {
  return Math.max(Math.min(100, previous), Math.min(100, Math.max(0, requested)));
}

export interface GameLoadingScreen {
  begin(stage?: Partial<LoadingScreenStage>): void;
  stage(stage: LoadingScreenStage): void;
  complete(detail?: string): void;
  fail(detail: string): void;
  dismiss(): void;
  readonly progress: number;
}

export function createGameLoadingScreen(documentRoot: Document): GameLoadingScreen {
  const root = documentRoot.querySelector<HTMLElement>("#game-loading-screen");
  const fill = documentRoot.querySelector<HTMLElement>("#game-loading-fill");
  const label = documentRoot.querySelector<HTMLElement>("#game-loading-label");
  const detail = documentRoot.querySelector<HTMLElement>("#game-loading-detail");
  const percent = documentRoot.querySelector<HTMLElement>("#game-loading-percent");
  const track = documentRoot.querySelector<HTMLElement>("#game-loading-track");
  const retry = documentRoot.querySelector<HTMLButtonElement>("#game-loading-retry");
  let value = 8;
  let departureTimer: number | undefined;

  const render = (stage: LoadingScreenStage): void => {
    if (stage.progress < value) return;
    value = nextLoadingProgress(value, stage.progress);
    if (fill) fill.style.transform = `scaleX(${value / 100})`;
    if (label) label.textContent = stage.label;
    if (detail) detail.textContent = stage.detail;
    if (percent) percent.textContent = `${Math.round(value)}%`;
    if (track) track.setAttribute("aria-valuenow", String(Math.round(value)));
  };
  const clearDeparture = (): void => {
    if (departureTimer !== undefined) window.clearTimeout(departureTimer);
    departureTimer = undefined;
  };
  retry?.addEventListener("click", () => window.location.reload());

  return {
    get progress() { return value; },
    begin(stage = {}) {
      clearDeparture();
      if (root) { root.hidden = false; root.dataset.state = "loading"; root.ariaBusy = "true"; root.removeAttribute("inert"); }
      if (retry) retry.hidden = true;
      render({ progress: stage.progress ?? value, label: stage.label ?? "Preparing your ascent",
        detail: stage.detail ?? "Gathering everything needed for the Town of Beginnings…" });
    },
    stage(next) { render(next); },
    complete(message = "The Town of Beginnings is ready.") {
      clearDeparture();
      render({ progress: 100, label: "Welcome, Explorer", detail: message });
      if (root) { root.dataset.state = "departing"; root.ariaBusy = "false"; }
      departureTimer = window.setTimeout(() => {
        if (root) { root.hidden = true; root.dataset.state = "ready"; root.setAttribute("inert", ""); }
      }, 650);
    },
    fail(message) {
      clearDeparture();
      if (root) { root.hidden = false; root.dataset.state = "error"; root.ariaBusy = "false"; root.removeAttribute("inert"); }
      if (label) label.textContent = "The realm did not answer";
      if (detail) detail.textContent = message;
      if (retry) retry.hidden = false;
    },
    dismiss() {
      clearDeparture();
      if (root) { root.hidden = true; root.dataset.state = "ready"; root.setAttribute("inert", ""); }
    },
  };
}
