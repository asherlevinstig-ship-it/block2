import { BUILD_PATHS, EMPTY_FLOOR_RUN_STATE, FLOOR_RUN_UPGRADES, type FloorRunUpgradeUpdate } from "@blockcraft/protocol";

export function floorUpgradeTick(state: FloorRunUpgradeUpdate, panelOpen: boolean, canPresent: boolean) {
  const validChoice = state.active && state.pending > 0 && state.canChoose && state.choices.length > 0;
  return {
    closePanel: panelOpen && !validChoice,
    readyVisible: !panelOpen && validChoice && canPresent,
  };
}

export function createFloorRunUpgradeUI(options: {
  send: (offerId: string, upgradeId: string) => void;
  changed: (state: FloorRunUpgradeUpdate, open: () => void) => void;
}) {
  let state: FloorRunUpgradeUpdate = { ...EMPTY_FLOOR_RUN_STATE, canChoose: false };
  let sending = false;
  const panel = document.createElement("section"); panel.id = "floor-run-upgrade"; panel.hidden = true;
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "floor-run-upgrade-title");
  panel.innerHTML = '<div class="floor-upgrade-shell"><small>WARDEN REWARD · FLOOR 1</small><h2 id="floor-run-upgrade-title"></h2><p class="floor-upgrade-intro"></p><div class="floor-upgrade-choices"></div><p class="floor-upgrade-expiry">Lasts until death or leaving Floor 1. Your permanent progression is separate.</p><button type="button" aria-label="Close upgrade choices" class="floor-upgrade-later">CHOOSE LATER</button></div>';
  const ready = document.createElement("button"); ready.type = "button"; ready.id = "floor-upgrade-ready"; ready.hidden = true;
  ready.setAttribute("aria-label", "Open Warden upgrade choices");
  const open = () => { if (!state.canChoose || !state.pending || !state.choices.length) return; panel.hidden = false; };
  const close = () => { panel.hidden = true; };
  ready.addEventListener("click", open);
  panel.querySelector(".floor-upgrade-later")!.addEventListener("click", close);
  panel.addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-floor-upgrade]");
    if (!button || sending || !state.offerId || !state.canChoose) return;
    sending = true;
    panel.querySelectorAll<HTMLButtonElement>("button[data-floor-upgrade]").forEach(candidate => candidate.disabled = true);
    options.send(state.offerId, button.dataset.floorUpgrade!);
  });
  document.body.append(panel, ready);
  function update(next: FloorRunUpgradeUpdate): void {
    state = next; sending = false;
    ready.disabled = !state.canChoose || !state.choices.length;
    ready.textContent = state.canChoose
      ? `UPGRADE READY · CHOOSE${state.pending > 1 ? ` (${state.pending})` : ""}`
      : state.path ? "UPGRADE BANKED · FINISH COMBAT" : "UPGRADE BANKED · CHOOSE A CALLING";
    panel.querySelector("h2")!.textContent = state.path ? `Shape your ${BUILD_PATHS[state.path].name}` : "Choose your Calling first";
    panel.querySelector(".floor-upgrade-intro")!.textContent = `Choose one effect for this attempt. ${state.picked.length}/2 upgrades chosen.`;
    const choices = panel.querySelector(".floor-upgrade-choices")!; choices.replaceChildren();
    for (const id of state.choices) {
      const definition = FLOOR_RUN_UPGRADES.find(upgrade => upgrade.id === id);
      if (!definition) continue;
      const button = document.createElement("button"); button.type = "button"; button.dataset.floorUpgrade = id;
      const branch = document.createElement("small"); branch.textContent = definition.branch;
      const name = document.createElement("strong"); name.textContent = definition.name;
      const detail = document.createElement("span"); detail.textContent = definition.detail;
      button.append(branch, name, detail); choices.append(button);
    }
    if (!state.active || !state.pending || !state.canChoose) panel.hidden = true;
    options.changed(state, open);
  }
  return {
    update, close,
    tick(canPresent: boolean): void {
      // Warden rewards are banked in the Kit. Never open a choice over combat
      // or immediately after the killing blow; a deliberate HUD/Kit click opens it.
      // Once deliberately opened, the modal itself becomes the active protected
      // popup. Do not treat that as a reason to close it on the following frame.
      const presentation = floorUpgradeTick(state, !panel.hidden, canPresent);
      if (presentation.closePanel) close();
      ready.hidden = !presentation.readyVisible;
    },
  };
}
