import { batch, signal } from "@preact/signals";
import { Fragment, h, render } from "preact";
import {
  MAIN_HAND_DEFINITIONS,
  POWER_DEFINITIONS,
  SEISMIC_CLEAVE_UPGRADES,
  SPECIAL_DEFINITIONS,
  type MainHandId,
  type PowerId,
  type SeismicMasteryId,
  type SpecialId,
} from "@blockcraft/protocol";
import { isPowerCompatibleWithMainHand } from "./power-loadout.js";
import type { InteractionMode } from "./interaction-mode.js";

type PowerSlot = "primary" | "secondary";
type CooldownState = { percent: number; label: string; ready: boolean };

const mode = signal<InteractionMode>("build");
const mainHand = signal<MainHandId>("longsword");
const ironSwordOwned = signal(false);
const primaryPower = signal<PowerId>("shockwave");
const secondaryPower = signal<PowerId>("eruption");
const activePowerSlot = signal<PowerSlot>("primary");
const characterLevel = signal(1);
const seismicMastery = signal<SeismicMasteryId>("advancing_fault");
const special = signal<SpecialId>("hunters_mark");
const powerAiming = signal(false);
const specialAiming = signal(false);
const powerCooldown = signal<CooldownState>({ percent: 0, label: "SERVER UPDATE", ready: false });
const specialCooldown = signal<CooldownState>({ percent: 0, label: "READY · F", ready: true });

const POWER_IDS = ["shockwave", "seismic_cleave", "eruption", "lunge_strike"] as const;
const POWER_LABELS: Record<PowerId, string> = { shockwave: "SHOCKWAVE", seismic_cleave: "SEISMIC", eruption: "ERUPTION", lunge_strike: "LUNGE" };
const MAIN_HAND_LABELS = { longsword: "SWORD", bow: "BOW", magic_focus: "FOCUS" } as const;

export function cooldownState(remainingMs: number, cooldownMs: number, readyLabel: string, blockedLabel?: string): CooldownState {
  const remaining = Math.max(0, remainingMs);
  const percent = Math.round(Math.max(0, Math.min(1, remaining / Math.max(1, cooldownMs))) * 100);
  return {
    percent,
    label: blockedLabel ?? (remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : readyLabel),
    ready: !blockedLabel && remaining <= 0,
  };
}

function ModeToggle() {
  return h("div", { id: "mode-toggle", role: "group", "aria-label": "Primary action mode" },
    h("button", { type: "button", "data-mode": "build", "aria-pressed": String(mode.value === "build") }, "BUILD"),
    h("button", { type: "button", "data-mode": "combat", "aria-pressed": String(mode.value === "combat") }, "COMBAT"),
  );
}

function MainHandLoadout() {
  const selected = mainHand.value;
  const definition = MAIN_HAND_DEFINITIONS[selected];
  const name = selected === "longsword" && ironSwordOwned.value ? "Iron Sword · +1 DMG" : definition.name;
  return h("div", { id: "main-hand-loadout" },
    h("p", null, h("span", null, "MAIN HAND"), h("strong", { id: "main-hand-name" }, name), h("em", { id: "main-hand-attack" }, definition.attackName)),
    h("div", { id: "main-hand-picker", role: "group", "aria-label": "Main-hand weapon" },
      (["longsword", "bow", "magic_focus"] as const).map(id => h("button", { type: "button", "data-main-hand": id, "aria-pressed": String(id === selected) }, MAIN_HAND_LABELS[id])),
    ),
  );
}

function PowerLoadout() {
  const selectedHand = mainHand.value;
  const selectedPower = activePowerSlot.value === "primary" ? primaryPower.value : secondaryPower.value;
  const secondaryLocked = characterLevel.value < 3;
  const compatible = isPowerCompatibleWithMainHand(POWER_DEFINITIONS[selectedPower], selectedHand);
  const cooldown = powerCooldown.value;
  return h(Fragment, null,
    h("div", { id: "power-picker", role: "group", "aria-label": "Equipped Power" }, POWER_IDS.map(id => {
      const allowed = isPowerCompatibleWithMainHand(POWER_DEFINITIONS[id], selectedHand);
      return h("button", { type: "button", "data-power": id, "aria-pressed": String(id === selectedPower), disabled: !allowed,
        title: allowed ? `${POWER_DEFINITIONS[id].name} is compatible with ${MAIN_HAND_DEFINITIONS[selectedHand].name}` : `${POWER_DEFINITIONS[id].name} requires a melee main hand` }, POWER_LABELS[id]);
    })),
    h("div", { id: "power-loadout-slots", role: "group", "aria-label": "Power loadout slots" },
      h("button", { type: "button", "data-power-slot": "primary", "aria-pressed": String(activePowerSlot.value === "primary") }, h("span", null, "R"), h("strong", null, POWER_DEFINITIONS[primaryPower.value].name.toUpperCase())),
      h("button", { type: "button", "data-power-slot": "secondary", "aria-pressed": String(activePowerSlot.value === "secondary"), disabled: secondaryLocked }, h("span", null, "T"), h("strong", null, secondaryLocked ? "LOCKED · LV 3" : POWER_DEFINITIONS[secondaryPower.value].name.toUpperCase())),
    ),
    h("button", { id: "power-slot", type: "button", "aria-label": `Use ${POWER_DEFINITIONS[selectedPower].name}`,
      class: `${compatible ? "" : "incompatible"} ${cooldown.ready && compatible && !powerAiming.value ? "ready" : ""} ${powerAiming.value ? "aiming" : ""}`.trim() },
      h("span", null, "POWER"), h("strong", { id: "power-name" }, POWER_DEFINITIONS[selectedPower].name),
      h("em", { id: "power-cooldown-label" }, cooldown.label), h("i", { id: "power-cooldown-fill", style: { width: `${cooldown.percent}%` } }),
    ),
    h("section", { id: "seismic-upgrades", hidden: selectedPower !== "seismic_cleave", "aria-label": "Seismic Cleave upgrades" },
      h("p", null, h("span", null, "ACTIVE AUGMENTS"), h("strong", null, "Fault Reach · Aftershock")),
      h("div", { id: "seismic-mastery-picker", role: "group", "aria-label": "Seismic Cleave mastery" },
        (["advancing_fault", "tectonic_stand"] as const).map(id => h("button", { type: "button", "data-seismic-mastery": id, "aria-pressed": String(seismicMastery.value === id) },
          h("strong", null, id === "advancing_fault" ? "ADVANCING" : "TECTONIC"), h("small", null, id === "advancing_fault" ? "Focused · mobile" : "Wide · planted"))),
      ),
    ),
  );
}

function SpecialLoadout() {
  const selected = special.value;
  const cooldown = specialCooldown.value;
  const hiddenRewardSpecial = selected === "venom_fan";
  return h(Fragment, null,
    h("div", { id: "special-picker", role: "group", "aria-label": "Equipped Special" },
      h("button", { type: "button", "data-special": "hunters_mark", "aria-pressed": String(selected === "hunters_mark"), disabled: hiddenRewardSpecial }, "MARK"),
      h("button", { type: "button", "data-special": "bramble_snare", "aria-pressed": String(selected === "bramble_snare"), disabled: hiddenRewardSpecial }, "SNARE"),
    ),
    h("button", { id: "special-slot", type: "button", "aria-label": `Use ${SPECIAL_DEFINITIONS[selected].name}`,
      class: `${cooldown.ready && !specialAiming.value ? "ready" : ""} ${specialAiming.value ? "aiming" : ""}`.trim() },
      h("span", null, "SPECIAL"), h("strong", { id: "special-name" }, SPECIAL_DEFINITIONS[selected].name),
      h("em", { id: "special-cooldown-label" }, cooldown.label), h("i", { id: "special-cooldown-fill", style: { width: `${cooldown.percent}%` } }),
    ),
  );
}

function CombatHud() {
  return h(Fragment, null, h(ModeToggle, null), h(MainHandLoadout, null), h(PowerLoadout, null), h(SpecialLoadout, null));
}

function setIfChanged<T>(target: { value: T }, value: T): void {
  if (!Object.is(target.value, value)) target.value = value;
}

export const combatHud = {
  mount(root: HTMLElement): void { render(h(CombatHud, null), root); },
  setMode(value: InteractionMode): void { setIfChanged(mode, value); },
  setWeapon(value: MainHandId, hasIronSword: boolean): void { batch(() => { setIfChanged(mainHand, value); setIfChanged(ironSwordOwned, hasIronSword); }); },
  setPowerLoadout(primary: PowerId, secondary: PowerId, active: PowerSlot, level: number): void {
    batch(() => { setIfChanged(primaryPower, primary); setIfChanged(secondaryPower, secondary); setIfChanged(activePowerSlot, active); setIfChanged(characterLevel, level); });
  },
  setSeismicMastery(value: SeismicMasteryId): void { setIfChanged(seismicMastery, value); },
  setSpecial(value: SpecialId): void { setIfChanged(special, value); },
  setPowerAiming(value: boolean): void { setIfChanged(powerAiming, value); },
  setSpecialAiming(value: boolean): void { setIfChanged(specialAiming, value); },
  setCooldowns(power: CooldownState, nextSpecial: CooldownState): void {
    batch(() => {
      if (JSON.stringify(powerCooldown.value) !== JSON.stringify(power)) powerCooldown.value = power;
      if (JSON.stringify(specialCooldown.value) !== JSON.stringify(nextSpecial)) specialCooldown.value = nextSpecial;
    });
  },
};
