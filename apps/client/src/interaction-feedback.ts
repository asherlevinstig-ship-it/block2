export type HoldStopReason = "damage" | "combat" | "range" | "released" | "focus" | "connection" | "menu" | "defeated";

export function holdStopReason(state: {
  connected: boolean; defeated: boolean; menuOpen: boolean; combat?: boolean;
  inRange: boolean; released: boolean;
}): HoldStopReason | null {
  if (state.defeated) return "defeated";
  if (!state.connected) return "connection";
  if (state.menuOpen) return "menu";
  if (state.combat) return "combat";
  if (!state.inRange) return "range";
  return state.released ? "released" : null;
}

export function holdStopMessage(action: "loot" | "portal", reason: HoldStopReason, touch: boolean): string | null {
  if (reason === "menu" || reason === "defeated") return null;
  const target = action === "loot" ? "loot" : "portal";
  const retry = touch ? "Keep holding the button until it fills." : "Keep E held until it fills.";
  if (reason === "damage") return `Interrupted by a hit. Get to safety, then try the ${target} again.`;
  if (reason === "combat") return "Looting interrupted by combat. Get to safety, then hold to collect.";
  if (reason === "range") return `Too far from the ${target}. Move closer and hold again.`;
  if (reason === "connection") return "Interaction stopped: waiting for the world connection.";
  if (reason === "focus") return `Interaction paused when the game lost focus. Hold again to use the ${target}.`;
  return `Released too soon. ${retry}`;
}

/** One quiet, replaceable notice; repeated causes do not extend it indefinitely. */
export function createInteractionFeedback() {
  const element = document.createElement("div");
  element.id = "interaction-feedback";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.hidden = true;
  document.body.append(element);
  let lastMessage = "";
  let lastShown = -Infinity;
  let timer = 0;
  return {
    isActive() { return !element.hidden; },
    show(message: string | null) {
      if (!message) return;
      const now = performance.now();
      if (message === lastMessage && now - lastShown < 3500) return;
      lastMessage = message;
      lastShown = now;
      element.textContent = message;
      element.hidden = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { element.hidden = true; }, 3200);
    },
  };
}
