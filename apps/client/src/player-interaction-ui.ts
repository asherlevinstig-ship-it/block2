import type * as pc from "playcanvas";
import type { ArmourId, MainHandId } from "@blockcraft/protocol";
import { createCharacterPortrait } from "./character-portrait.js";

export type PlayerInteractionView = {
  id: string;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  state: string;
  stateTone: "ready" | "busy" | "down";
  weapon: string;
  armour: string;
  trait: string;
  appearance: string;
  handId: MainHandId;
  armourId: ArmourId;
  appearanceKey: string;
  characterRoot: pc.Entity;
  distance: number;
  partyState: "invite" | "member" | "full" | "far";
};

export function createPlayerInteractionUI(actions: {
  stop: () => void;
  trade: (targetId: string) => void;
  party: (targetId: string) => boolean;
}) {
  const root = document.createElement("section");
  root.id = "player-interaction";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "player-interaction-name");
  root.innerHTML = [
    '<div class="player-interaction-card">',
    '<header><div><span>NEARBY EXPLORER</span><h2 id="player-interaction-name">Explorer</h2><p class="player-interaction-level">LEVEL 1</p></div><button class="player-interaction-close" type="button" aria-label="Close player panel">×</button></header>',
    '<div class="player-interaction-body">',
    '<section class="player-interaction-portrait"><canvas width="220" height="260" aria-label="Player character preview"></canvas><b class="player-interaction-state">EXPLORING</b><small class="player-interaction-distance">0m away</small></section>',
    '<section class="player-interaction-details">',
    '<div class="player-interaction-health"><span>HEALTH</span><strong></strong><i><b></b></i></div>',
    '<dl><div><dt>MAIN HAND</dt><dd data-player-field="weapon"></dd></div><div><dt>ARMOUR</dt><dd data-player-field="armour"></dd></div><div><dt>TRAIT</dt><dd data-player-field="trait"></dd></div><div><dt>STYLE</dt><dd data-player-field="appearance"></dd></div></dl>',
    '<p class="player-interaction-note">Equipment and combat status are public. Pack contents, gold and private progression remain hidden.</p>',
    '</section></div>',
    '<div class="player-interaction-actions"><button class="player-interaction-party" type="button">INVITE TO PARTY</button><button class="player-interaction-trade" type="button">TRADE</button><button class="player-interaction-dismiss" type="button">CLOSE</button></div>',
    '</div>',
  ].join("");
  document.body.append(root);

  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const name = root.querySelector<HTMLElement>("#player-interaction-name")!;
  const level = root.querySelector<HTMLElement>(".player-interaction-level")!;
  const state = root.querySelector<HTMLElement>(".player-interaction-state")!;
  const distance = root.querySelector<HTMLElement>(".player-interaction-distance")!;
  const health = root.querySelector<HTMLElement>(".player-interaction-health strong")!;
  const healthFill = root.querySelector<HTMLElement>(".player-interaction-health i b")!;
  const party = root.querySelector<HTMLButtonElement>(".player-interaction-party")!;
  const trade = root.querySelector<HTMLButtonElement>(".player-interaction-trade")!;
  const closeButtons = [...root.querySelectorAll<HTMLButtonElement>(".player-interaction-close, .player-interaction-dismiss")];
  let current: PlayerInteractionView | null = null;
  let portrait: ReturnType<typeof createCharacterPortrait> | null = null;
  let portraitTarget = "";

  const close = () => {
    root.hidden = true;
    portrait?.hide();
    current = null;
  };
  for (const button of closeButtons) button.addEventListener("click", close);
  trade.addEventListener("click", () => {
    if (!current || current.distance > 4 || current.health <= 0) return;
    const id = current.id;
    close();
    actions.trade(id);
  });
  party.addEventListener("click", () => {
    if (!current || current.partyState !== "invite") return;
    const id = current.id;
    if (actions.party(id)) close();
  });
  root.addEventListener("keydown", event => {
    event.stopPropagation();
    if (event.code === "Escape") { event.preventDefault(); close(); }
    if (event.code === "Tab") {
      const controls = [...root.querySelectorAll<HTMLButtonElement>("button")].filter(button => !button.disabled);
      const index = controls.indexOf(document.activeElement as HTMLButtonElement);
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      event.preventDefault();
    }
  });
  root.addEventListener("keyup", event => event.stopPropagation());

  const update = (view: PlayerInteractionView) => {
    current = view;
    name.textContent = view.name;
    level.textContent = "LEVEL " + view.level;
    state.textContent = view.state.toUpperCase();
    state.dataset.tone = view.stateTone;
    distance.textContent = view.distance.toFixed(1) + "m away";
    health.textContent = view.health + " / " + view.maxHealth;
    healthFill.style.transform = "scaleX(" + Math.max(0, Math.min(1, view.health / Math.max(1, view.maxHealth))) + ")";
    for (const field of ["weapon", "armour", "trait", "appearance"] as const)
      root.querySelector<HTMLElement>('[data-player-field="' + field + '"]')!.textContent = view[field];
    party.disabled = view.partyState !== "invite";
    party.textContent = view.partyState === "member" ? "IN YOUR PARTY" : view.partyState === "full" ? "PARTY FULL" : view.partyState === "far" ? "MOVE CLOSER" : "INVITE TO PARTY";
    trade.disabled = view.distance > 4 || view.health <= 0;
    trade.textContent = view.health <= 0 ? "PLAYER DEFEATED" : view.distance > 4 ? "MOVE CLOSER TO TRADE" : "TRADE";
    if (!portrait || portraitTarget !== view.id) {
      portrait?.destroy();
      portrait = createCharacterPortrait(canvas, view.characterRoot, () => () => {});
      portraitTarget = view.id;
    }
    portrait.refresh(view.handId, view.armourId, view.appearanceKey);
  };

  return {
    isOpen() { return !root.hidden; },
    targetId() { return current?.id ?? null; },
    open(view: PlayerInteractionView) {
      actions.stop();
      root.hidden = false;
      update(view);
      closeButtons.at(-1)?.focus();
    },
    update,
    close,
  };
}
