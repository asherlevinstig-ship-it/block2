import { batch, computed, signal } from "@preact/signals";
import { Fragment, h, render } from "preact";

const health = signal(5);
const maximumHealth = signal(5);
const stamina = signal(100);
const maximumStamina = signal(100);
const level = signal(1);
const experience = signal(0);
const experienceRequired = signal(40);

export function hudFraction(value: number, maximum: number): number {
  return Math.max(0, Math.min(1, value / Math.max(1, maximum)));
}

const healthWidth = computed(() => `${hudFraction(health.value, maximumHealth.value) * 100}%`);
const staminaWidth = computed(() => `${hudFraction(stamina.value, maximumStamina.value) * 100}%`);
const experienceWidth = computed(() => `${(experienceRequired.value > 0 ? hudFraction(experience.value, experienceRequired.value) : 1) * 100}%`);

function HealthBar() {
  return h("div", { id: "player-health", "aria-label": "Player health" },
    h("span", null, "HP"),
    h("div", null, h("i", { id: "player-health-fill", style: { width: healthWidth.value } })),
    h("strong", { id: "player-health-value" }, `${health.value} / ${maximumHealth.value}`),
  );
}

function StaminaBar() {
  return h("div", { id: "player-stamina", "aria-label": "Player stamina" },
    h("span", null, "ST"),
    h("div", null, h("i", { id: "player-stamina-fill", style: { width: staminaWidth.value } })),
    h("strong", { id: "player-stamina-value" }, String(Math.round(stamina.value))),
  );
}

function LevelBar() {
  const required = experienceRequired.value;
  return h("button", { id: "player-level", type: "button", "aria-label": "Character level and experience" },
    h("span", null, "LV ", h("strong", { id: "player-level-value" }, String(level.value))),
    h("div", null, h("i", { id: "player-xp-fill", style: { width: experienceWidth.value } })),
    h("em", { id: "player-xp-value" }, required > 0 ? `${experience.value} / ${required} XP` : "MAX LEVEL"),
  );
}

function PlayerHud() {
  return h(Fragment, null, h(HealthBar, null), h(StaminaBar, null), h(LevelBar, null));
}

export const playerHud = {
  mount(root: HTMLElement): void {
    render(h(PlayerHud, null), root);
  },
  setHealth(value: number, maximum: number): void {
    batch(() => {
      health.value = value;
      maximumHealth.value = maximum;
    });
  },
  setStamina(value: number, maximum: number): void {
    batch(() => {
      stamina.value = value;
      maximumStamina.value = maximum;
    });
  },
  setProgression(nextLevel: number, nextExperience: number, required: number): void {
    batch(() => {
      level.value = nextLevel;
      experience.value = nextExperience;
      experienceRequired.value = required;
    });
  },
};
