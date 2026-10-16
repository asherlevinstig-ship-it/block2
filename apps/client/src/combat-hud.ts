import { batch, signal } from "@preact/signals";
import { h, render } from "preact";
import {
  MAIN_HAND_DEFINITIONS,
  POWER_DEFINITIONS,
  SEISMIC_CLEAVE_UPGRADES,
  SPECIAL_DEFINITIONS,
  HUNT_EQUIPMENT_SETS,
  CALLING_ABILITY_OPTIONS,
  CALLING_ABILITY_AUGMENTS,
  CALLING_AUGMENT_TRIALS,
  huntSetForLoadout,
  type ArmourId,
  type MainHandId,
  type PowerId,
  type SeismicMasteryId,
  type SpecialId,
  type BuildPathId,
  type CallingAbilityId,
  type CallingAugmentId,
} from "@blockcraft/protocol";
import { isPowerCompatibleWithMainHand } from "./power-loadout.js";
import type { InteractionMode } from "./interaction-mode.js";

type PowerSlot = "primary" | "secondary";
type CooldownState = { percent: number; label: string; ready: boolean };
type CallingState = { label: string; detail: string } | null;

const mode = signal<InteractionMode>("build");
const mainHand = signal<MainHandId>("longsword");
const armour = signal<ArmourId>("none");
const ironSwordOwned = signal(false);
const primaryPower = signal<PowerId>("shockwave");
const secondaryPower = signal<PowerId>("eruption");
const activePowerSlot = signal<PowerSlot>("primary");
const characterLevel = signal(1);
const seismicMastery = signal<SeismicMasteryId>("advancing_fault");
const special = signal<SpecialId>("hunters_mark");
const powerAiming = signal(false);
const specialAiming = signal(false);
const calling = signal<BuildPathId | null>(null);
const callingAbility = signal<CallingAbilityId | null>(null);
const callingRank = signal(0);
const callingAugment = signal<CallingAugmentId | null>(null);
const callingAugmentProgress = signal<Partial<Record<CallingAugmentId, number>>>({});
const masteredCallingAugments = signal<CallingAugmentId[]>([]);
const callingPending = signal(false);
const callingState = signal<CallingState>(null);
const powerCooldown = signal<CooldownState>({ percent: 0, label: "SERVER UPDATE", ready: false });
const specialCooldown = signal<CooldownState>({ percent: 0, label: "READY · F", ready: true });
const callingCooldown = signal<CooldownState>({ percent: 0, label: "CHOOSE CALLING", ready: false });
const loadoutOpen = signal(false);

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

export function visibleCallingAbilities(pathId: BuildPathId, rank: number) {
  return CALLING_ABILITY_OPTIONS.filter(option => option.pathId === pathId && option.unlockRank <= rank);
}

export function visibleCallingAugments(abilityId: CallingAbilityId, rank: number) {
  return CALLING_ABILITY_AUGMENTS.filter(option => option.abilityId === abilityId && option.unlockRank <= rank);
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
  const activeSet = huntSetForLoadout(selected, armour.value);
  return h("div", { id: "main-hand-loadout" },
    h("p", null, h("span", null, "MAIN HAND"), h("strong", { id: "main-hand-name" }, name), h("em", { id: "main-hand-attack" }, definition.attackName)),
    activeSet ? h("b", { id: "hunt-set-status", "data-set": activeSet }, `${HUNT_EQUIPMENT_SETS[activeSet].name.toUpperCase()} · SET ACTIVE`) : null,
  );
}

function PowerLoadout() {
  const selectedHand = mainHand.value;
  const selectedPower = activePowerSlot.value === "primary" ? primaryPower.value : secondaryPower.value;
  const secondaryLocked = characterLevel.value < 3;
  const compatible = isPowerCompatibleWithMainHand(POWER_DEFINITIONS[selectedPower], selectedHand);
  const cooldown = powerCooldown.value;
  const locked = characterLevel.value < 2;
  return h("button", { id: "power-slot", type: "button", disabled: locked,
    "aria-label": locked ? "Power unlocks at level 2" : `Use ${POWER_DEFINITIONS[selectedPower].name}`,
    class: `${locked ? "locked" : compatible ? "" : "incompatible"} ${!locked && cooldown.ready && compatible && !powerAiming.value ? "ready" : ""} ${powerAiming.value ? "aiming" : ""}`.trim() },
    h("span", null, "POWER"), h("strong", { id: "power-name" }, locked ? "Unlocks at LV 2" : POWER_DEFINITIONS[selectedPower].name),
    h("em", { id: "power-cooldown-label" }, locked ? "KEEP FIGHTING" : cooldown.label), h("i", { id: "power-cooldown-fill", style: { width: `${locked ? 0 : cooldown.percent}%` } }),
  );
}

function LoadoutDrawer() {
  const selectedHand = mainHand.value;
  const selectedPower = activePowerSlot.value === "primary" ? primaryPower.value : secondaryPower.value;
  const secondaryLocked = characterLevel.value < 3;
  return h("aside", { id: "combat-loadout-drawer", hidden: !loadoutOpen.value, "aria-label": "Combat loadout" },
    h("header", null,
      h("div", null, h("span", null, "FIELD LOADOUT"), h("strong", null, "Prepare your combat kit")),
      h("button", { type: "button", class: "loadout-close", "aria-label": "Close loadout", onClick: () => { loadoutOpen.value = false; } }, "×"),
    ),
    h("section", { class: "loadout-group" },
      h("p", null, h("span", null, "MAIN HAND"), h("small", null, MAIN_HAND_DEFINITIONS[selectedHand].name)),
      h("div", { id: "main-hand-picker", role: "group", "aria-label": "Main-hand weapon" },
        (["longsword", "bow", "magic_focus"] as const).map(id => h("button", { type: "button", "data-main-hand": id, "aria-pressed": String(id === selectedHand) }, MAIN_HAND_LABELS[id])),
      ),
    ),
    h("section", { class: "loadout-group" },
      h("p", null, h("span", null, "POWERS"), h("small", null, characterLevel.value < 2 ? "Unlocks at level 2" : "Choose slot, then technique")),
      h("div", { id: "power-loadout-slots", role: "group", "aria-label": "Power loadout slots" },
        h("button", { type: "button", "data-power-slot": "primary", "aria-pressed": String(activePowerSlot.value === "primary"), disabled: characterLevel.value < 2 }, h("span", null, "R"), h("strong", null, characterLevel.value < 2 ? "LOCKED · LV 2" : POWER_DEFINITIONS[primaryPower.value].name.toUpperCase())),
        h("button", { type: "button", "data-power-slot": "secondary", "aria-pressed": String(activePowerSlot.value === "secondary"), disabled: secondaryLocked }, h("span", null, "T"), h("strong", null, secondaryLocked ? "LOCKED · LV 3" : POWER_DEFINITIONS[secondaryPower.value].name.toUpperCase())),
      ),
      h("div", { id: "power-picker", role: "group", "aria-label": "Equipped Power" }, POWER_IDS.map(id => {
        const allowed = isPowerCompatibleWithMainHand(POWER_DEFINITIONS[id], selectedHand);
        return h("button", { type: "button", "data-power": id, "aria-pressed": String(id === selectedPower), disabled: characterLevel.value < 2 || !allowed,
          title: characterLevel.value < 2 ? "Powers unlock at level 2" : allowed ? `${POWER_DEFINITIONS[id].name} is compatible with ${MAIN_HAND_DEFINITIONS[selectedHand].name}` : `${POWER_DEFINITIONS[id].name} requires a melee main hand` }, characterLevel.value < 2 ? "LOCKED" : POWER_LABELS[id]);
      })),
      h("section", { id: "seismic-upgrades", hidden: selectedPower !== "seismic_cleave", "aria-label": "Seismic Cleave upgrades" },
        h("p", null, h("span", null, "ACTIVE AUGMENTS"), h("strong", null, "Fault Reach · Aftershock")),
        h("div", { id: "seismic-mastery-picker", role: "group", "aria-label": "Seismic Cleave mastery" },
          (["advancing_fault", "tectonic_stand"] as const).map(id => h("button", { type: "button", "data-seismic-mastery": id, "aria-pressed": String(seismicMastery.value === id) },
            h("strong", null, id === "advancing_fault" ? "ADVANCING" : "TECTONIC"), h("small", null, id === "advancing_fault" ? "Focused · mobile" : "Wide · planted"))),
        ),
      ),
    ),
    h("section", { class: "loadout-group" },
      h("p", null, h("span", null, "SPECIAL"), h("small", null, characterLevel.value < 4 ? "Unlocks at level 4" : SPECIAL_DEFINITIONS[special.value].name)),
      h("div", { id: "special-picker", role: "group", "aria-label": "Equipped Special" },
        h("button", { type: "button", "data-special": "hunters_mark", "aria-pressed": String(special.value === "hunters_mark"), disabled: characterLevel.value < 4 || special.value === "venom_fan" }, characterLevel.value < 4 ? "LOCKED · LV 4" : "MARK"),
        h("button", { type: "button", "data-special": "bramble_snare", "aria-pressed": String(special.value === "bramble_snare"), disabled: characterLevel.value < 4 || special.value === "venom_fan" }, characterLevel.value < 4 ? "LOCKED · LV 4" : "SNARE"),
      ),
    ),
    calling.value ? h("section", { class: "loadout-group" },
      h("p", null, h("span", null, "CALLING ABILITY"), h("small", null, "One equipped to G")),
      h("div", { id: "calling-ability-picker", role: "group", "aria-label": "Equipped Calling ability" },
        visibleCallingAbilities(calling.value, callingRank.value).map(option =>
          h("button", { type: "button", "data-calling-ability": option.id,
              "aria-pressed": String(callingAbility.value === option.id), title: option.description },
            h("span", null, option.category.toUpperCase()), h("strong", null, option.name),
            h("small", null, option.description)),
        ),
      ),
      callingAbility.value ? h("div", { id: "calling-augment-picker", role: "group", "aria-label": "Calling ability upgrade" },
        h("p", null, h("span", null, "BRANCH UPGRADE"), h("small", null, "Change freely in Town")),
        visibleCallingAugments(callingAbility.value, callingRank.value).map(option => {
          const mastered = masteredCallingAugments.value.includes(option.id);
          const trial = CALLING_AUGMENT_TRIALS[option.id];
          const progress = callingAugmentProgress.value[option.id] ?? 0;
          return h("button", { type: "button", "data-calling-augment": option.id,
              "aria-pressed": String(callingAugment.value === option.id), disabled: !mastered,
              title: mastered ? option.description : trial.description },
            h("strong", null, option.name),
            h("small", null, mastered ? option.description : `TRIAL ${progress}/${trial.target} · ${trial.description}`),
            !mastered ? h("i", { class: "calling-trial-fill", style: { width: `${Math.round(progress / trial.target * 100)}%` } }) : null);
        }),
      ) : null,
    ) : null,
  );
}

function SpecialLoadout() {
  const selected = special.value;
  const cooldown = specialCooldown.value;
  const locked = characterLevel.value < 4;
  return h("button", { id: "special-slot", type: "button", disabled: locked,
      "aria-label": locked ? "Special unlocks at level 4" : `Use ${SPECIAL_DEFINITIONS[selected].name}`,
      class: `${locked ? "locked" : cooldown.ready && !specialAiming.value ? "ready" : ""} ${specialAiming.value ? "aiming" : ""}`.trim() },
      h("span", null, "SPECIAL"), h("strong", { id: "special-name" }, locked ? "Unlocks at LV 4" : SPECIAL_DEFINITIONS[selected].name),
      h("em", { id: "special-cooldown-label" }, locked ? "COMING LATER" : cooldown.label), h("i", { id: "special-cooldown-fill", style: { width: `${locked ? 0 : cooldown.percent}%` } }),
  );
}

function CallingLoadout() {
  const selected = calling.value;
  const definition = CALLING_ABILITY_OPTIONS.find(option => option.id === callingAbility.value)
    ?? CALLING_ABILITY_OPTIONS.find(option => option.pathId === selected && option.unlockRank === 0);
  const cooldown = callingCooldown.value;
  const state = callingState.value;
  return h("button", { id: "calling-slot", type: "button", disabled: !selected,
      "aria-label": definition ? `Use ${definition.name}` : "Choose a Calling to unlock its ability",
      class: `${cooldown.ready && selected && !callingPending.value ? "ready" : ""} ${callingPending.value ? "anticipating" : ""} ${state ? "active-state" : ""}`.trim() },
      h("span", null, "CALLING"),
      h("strong", { id: "calling-name" }, definition?.name ?? "Unbound"),
      h("em", { id: "calling-cooldown-label" }, callingPending.value ? "CAST" : cooldown.label),
      state ? h("b", { id: "calling-state-label" }, h("span", null, state.label), h("small", null, state.detail)) : null,
      h("i", { id: "calling-cooldown-fill", style: { width: `${cooldown.percent}%` } }),
  );
}

function CombatHud() {
  return h("div", { id: "combat-hud-shell", "data-loadout-open": String(loadoutOpen.value) },
    h(ModeToggle, null),
    h(MainHandLoadout, null),
    h(PowerLoadout, null),
    h(SpecialLoadout, null),
    h(CallingLoadout, null),
    h("button", { id: "loadout-toggle", type: "button", "aria-expanded": String(loadoutOpen.value), "aria-controls": "combat-loadout-drawer", onClick: () => { loadoutOpen.value = !loadoutOpen.value; } },
      h("span", { "aria-hidden": "true" }, "⚙"), h("strong", null, "KIT")),
    h(LoadoutDrawer, null),
  );
}

function setIfChanged<T>(target: { value: T }, value: T): void {
  if (!Object.is(target.value, value)) target.value = value;
}

export const combatHud = {
  mount(root: HTMLElement): void { render(h(CombatHud, null), root); },
  setMode(value: InteractionMode): void { setIfChanged(mode, value); },
  setWeapon(value: MainHandId, hasIronSword: boolean): void { batch(() => { setIfChanged(mainHand, value); setIfChanged(ironSwordOwned, hasIronSword); }); },
  setArmour(value: ArmourId): void { setIfChanged(armour, value); },
  setPowerLoadout(primary: PowerId, secondary: PowerId, active: PowerSlot, level: number): void {
    batch(() => { setIfChanged(primaryPower, primary); setIfChanged(secondaryPower, secondary); setIfChanged(activePowerSlot, active); setIfChanged(characterLevel, level); });
  },
  setSeismicMastery(value: SeismicMasteryId): void { setIfChanged(seismicMastery, value); },
  setSpecial(value: SpecialId): void { setIfChanged(special, value); },
  setCalling(value: BuildPathId | null, abilityId: CallingAbilityId | null, rank: number, augmentId: CallingAugmentId | null = null,
    progress: Partial<Record<CallingAugmentId, number>> = {}, mastered: CallingAugmentId[] = []): void {
    batch(() => {
      setIfChanged(calling, value); setIfChanged(callingAbility, abilityId); setIfChanged(callingRank, rank); setIfChanged(callingAugment, augmentId);
      if (JSON.stringify(callingAugmentProgress.value) !== JSON.stringify(progress)) callingAugmentProgress.value = progress;
      if (JSON.stringify(masteredCallingAugments.value) !== JSON.stringify(mastered)) masteredCallingAugments.value = mastered;
    });
  },
  setCallingPending(value: boolean): void { setIfChanged(callingPending, value); },
  setCallingState(value: CallingState): void {
    if (JSON.stringify(callingState.value) !== JSON.stringify(value)) callingState.value = value;
  },
  setPowerAiming(value: boolean): void { setIfChanged(powerAiming, value); },
  setSpecialAiming(value: boolean): void { setIfChanged(specialAiming, value); },
  setCooldowns(power: CooldownState, nextSpecial: CooldownState, nextCalling?: CooldownState): void {
    batch(() => {
      if (JSON.stringify(powerCooldown.value) !== JSON.stringify(power)) powerCooldown.value = power;
      if (JSON.stringify(specialCooldown.value) !== JSON.stringify(nextSpecial)) specialCooldown.value = nextSpecial;
      if (nextCalling && JSON.stringify(callingCooldown.value) !== JSON.stringify(nextCalling)) callingCooldown.value = nextCalling;
    });
  },
};
