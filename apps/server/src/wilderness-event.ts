import { assign, createActor, setup } from "xstate";

export const WILDERNESS_EVENT_ID = "greenwood-venom-matriarch";
export const WILDERNESS_EVENT_POSITION = { x: 43.5, y: 8, z: 18.5 };
export const WILDERNESS_EVENT_TRACKING_RADIUS = 64;
export const WILDERNESS_EVENT_SCALING_RADIUS = 30;
export const WILDERNESS_EVENT_MAX_PLAYERS = 6;
export const WILDERNESS_EVENT_WARNING_MS = 8_000;
export const WILDERNESS_EVENT_COOLDOWN_MS = 120_000;
const CAMP = ["wild-crawler", "greenwood-briar", "greenwood-briar-north"];

export function wildernessEventScale(nearbyPlayers: number): { players: number; maxHealth: number; attackDamage: number; rewardMultiplier: number } {
  const players = Math.max(1, Math.min(WILDERNESS_EVENT_MAX_PLAYERS, Math.floor(nearbyPlayers)));
  return {
    players,
    maxHealth: 24 + (players - 1) * 12,
    attackDamage: players >= 4 ? 2 : 1,
    rewardMultiplier: 1.5 + (players - 1) * .25,
  };
}

type WildernessEventPhase = "idle" | "warning" | "active" | "cooldown";
type WildernessEventContext = { warningUntil: number; nextAt: number };
type WildernessEventMachineEvent = { type: "ARM"; now: number } | { type: "TICK"; now: number } | { type: "COMPLETE"; now: number };

const wildernessEventMachine = setup({
  types: {
    context: {} as WildernessEventContext,
    events: {} as WildernessEventMachineEvent,
  },
  guards: {
    warningElapsed: ({ context, event }) => event.type === "TICK" && event.now >= context.warningUntil,
    cooldownElapsed: ({ context, event }) => event.type === "TICK" && event.now >= context.nextAt,
  },
  actions: {
    arm: assign(({ event }) => event.type === "ARM" ? {
      warningUntil: event.now + WILDERNESS_EVENT_WARNING_MS,
      nextAt: event.now + WILDERNESS_EVENT_COOLDOWN_MS,
    } : {}),
    clearWarning: assign({ warningUntil: 0 }),
  },
}).createMachine({
  id: "wilderness-public-event",
  initial: "idle",
  context: { warningUntil: 0, nextAt: 0 },
  states: {
    idle: { on: { ARM: { target: "warning", actions: "arm" } } },
    warning: { on: { TICK: { guard: "warningElapsed", target: "active", actions: "clearWarning" } } },
    active: { on: { COMPLETE: { target: "cooldown" } } },
    cooldown: { on: { TICK: { guard: "cooldownElapsed", target: "idle" } } },
  },
});

/** A fresh camp clear arms one shared encounter, not one spawn per player. */
export class WildernessEventCycle {
  private readonly defeated = new Map<string, number>();
  private readonly actor = createActor(wildernessEventMachine).start();

  get phase(): WildernessEventPhase {
    return this.actor.getSnapshot().value as WildernessEventPhase;
  }

  get warningUntil(): number {
    return this.actor.getSnapshot().context.warningUntil;
  }

  record(id: string, now: number, active: boolean): boolean {
    this.actor.send({ type: "TICK", now });
    if (!CAMP.includes(id) || active || this.phase !== "idle") return false;
    this.defeated.set(id, now);
    if (!CAMP.every(member => now - (this.defeated.get(member) ?? -Infinity) <= 60000)) return false;
    this.defeated.clear();
    this.actor.send({ type: "ARM", now });
    return true;
  }

  release(now: number): boolean {
    if (this.phase !== "warning") return false;
    this.actor.send({ type: "TICK", now });
    return this.actor.getSnapshot().matches("active");
  }

  complete(now: number): boolean {
    if (this.phase !== "active") return false;
    this.actor.send({ type: "COMPLETE", now });
    return this.actor.getSnapshot().matches("cooldown");
  }
}
