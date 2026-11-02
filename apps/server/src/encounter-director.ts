import { assign, createActor, setup } from "xstate";

export type EncounterIntelligencePhase = "dormant" | "alert" | "engaged" | "secured";
export type EncounterTactic = "hold" | "press-ranged" | "break-cover" | "punish-healer" | "break-guard" | "search-stealth";

export interface EncounterIntelligenceDefinition {
  id: string;
  memberIds: readonly string[];
}

export interface EncounterDirective {
  encounterId: string;
  phase: EncounterIntelligencePhase;
  targetId: string;
  members: readonly string[];
  firstContactAt: number;
  lastContactAt: number;
  tactic: EncounterTactic;
  tacticTargetId: string;
  tacticUntil: number;
}

type EncounterContext = {
  targetId: string;
  firstContactAt: number;
  lastContactAt: number;
  tactic: EncounterTactic;
  tacticTargetId: string;
  tacticUntil: number;
};

type EncounterEvent =
  | { type: "CONTACT"; targetId: string; now: number }
  | { type: "TACTIC"; tactic: EncounterTactic; targetId: string; now: number; durationMs: number }
  | { type: "TICK"; now: number }
  | { type: "SECURE" }
  | { type: "RESET" };

const ALERT_COMMIT_MS = 250;
const SHARED_MEMORY_MS = 6_000;

const encounterMachine = setup({
  types: {
    context: {} as EncounterContext,
    events: {} as EncounterEvent,
  },
  guards: {
    alertCommitted: ({ context, event }) => event.type === "TICK"
      && event.now - context.firstContactAt >= ALERT_COMMIT_MS,
    memoryExpired: ({ context, event }) => event.type === "TICK"
      && event.now - context.lastContactAt >= SHARED_MEMORY_MS,
    tacticExpired: ({ context, event }) => event.type === "TICK" && context.tactic !== "hold"
      && event.now >= context.tacticUntil,
  },
  actions: {
    rememberContact: assign(({ context, event }) => event.type === "CONTACT" ? {
      targetId: event.targetId,
      firstContactAt: context.targetId ? context.firstContactAt : event.now,
      lastContactAt: event.now,
    } : {}),
    forgetContact: assign({ targetId: "", firstContactAt: 0, lastContactAt: 0 }),
    rememberTactic: assign(({ context, event }) => event.type === "TACTIC" ? {
      targetId: event.targetId,
      firstContactAt: context.targetId ? context.firstContactAt : event.now,
      lastContactAt: event.now,
      tactic: event.tactic,
      tacticTargetId: event.targetId,
      tacticUntil: event.now + Math.max(250, event.durationMs),
    } : {}),
    forgetTactic: assign({ tactic: "hold" as const, tacticTargetId: "", tacticUntil: 0 }),
  },
}).createMachine({
  id: "server-authoritative-encounter-intelligence",
  initial: "dormant",
  context: { targetId: "", firstContactAt: 0, lastContactAt: 0,
    tactic: "hold", tacticTargetId: "", tacticUntil: 0 },
  states: {
    dormant: {
      on: {
        CONTACT: { target: "alert", actions: "rememberContact" },
        TACTIC: { target: "alert", actions: ["rememberContact", "rememberTactic"] },
        RESET: { actions: ["forgetContact", "forgetTactic"] },
      },
    },
    alert: {
      on: {
        CONTACT: { actions: "rememberContact" },
        TACTIC: { actions: ["rememberContact", "rememberTactic"] },
        TICK: [
          { guard: "memoryExpired", target: "dormant", actions: ["forgetContact", "forgetTactic"] },
          { guard: "tacticExpired", actions: "forgetTactic" },
          { guard: "alertCommitted", target: "engaged" },
        ],
        SECURE: { target: "secured", actions: ["forgetContact", "forgetTactic"] },
        RESET: { target: "dormant", actions: ["forgetContact", "forgetTactic"] },
      },
    },
    engaged: {
      on: {
        CONTACT: { actions: "rememberContact" },
        TACTIC: { actions: ["rememberContact", "rememberTactic"] },
        TICK: [
          { guard: "memoryExpired", target: "dormant", actions: ["forgetContact", "forgetTactic"] },
          { guard: "tacticExpired", actions: "forgetTactic" },
        ],
        SECURE: { target: "secured", actions: ["forgetContact", "forgetTactic"] },
        RESET: { target: "dormant", actions: ["forgetContact", "forgetTactic"] },
      },
    },
    secured: {
      on: { RESET: { target: "dormant", actions: ["forgetContact", "forgetTactic"] } },
    },
  },
});

/**
 * Shared, deterministic encounter memory. Individual mobs retain their existing
 * navigation and attack execution; this director gives the group one target and
 * one lifecycle without moving combat authority to the client.
 */
export class XStateEncounterDirector {
  private readonly definitions = new Map<string, EncounterIntelligenceDefinition>();
  private readonly encounterByMember = new Map<string, string>();
  private readonly actors = new Map<string, ReturnType<typeof createActor<typeof encounterMachine>>>();

  constructor(definitions: readonly EncounterIntelligenceDefinition[]) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
      this.actors.set(definition.id, createActor(encounterMachine).start());
      for (const memberId of definition.memberIds) this.encounterByMember.set(memberId, definition.id);
    }
  }

  contact(memberId: string, targetId: string, now: number): EncounterDirective | null {
    const encounterId = this.encounterByMember.get(memberId);
    if (!encounterId || !targetId) return null;
    const actor = this.actors.get(encounterId)!;
    actor.send({ type: "CONTACT", targetId, now });
    actor.send({ type: "TICK", now });
    return this.directiveForEncounter(encounterId);
  }

  signal(memberId: string, tactic: Exclude<EncounterTactic, "hold">, targetId: string,
    now: number, durationMs = 3_000): EncounterDirective | null {
    const encounterId = this.encounterByMember.get(memberId);
    if (!encounterId || !targetId) return null;
    const actor = this.actors.get(encounterId)!;
    actor.send({ type: "TACTIC", tactic, targetId, now, durationMs });
    actor.send({ type: "TICK", now });
    return this.directiveForEncounter(encounterId);
  }

  directive(memberId: string, now: number): EncounterDirective | null {
    const encounterId = this.encounterByMember.get(memberId);
    if (!encounterId) return null;
    this.actors.get(encounterId)!.send({ type: "TICK", now });
    return this.directiveForEncounter(encounterId);
  }

  secure(memberId: string): void {
    const encounterId = this.encounterByMember.get(memberId);
    if (encounterId) this.actors.get(encounterId)!.send({ type: "SECURE" });
  }

  reset(): void {
    for (const actor of this.actors.values()) actor.send({ type: "RESET" });
  }

  stop(): void {
    for (const actor of this.actors.values()) actor.stop();
  }

  private directiveForEncounter(encounterId: string): EncounterDirective {
    const definition = this.definitions.get(encounterId)!;
    const snapshot = this.actors.get(encounterId)!.getSnapshot();
    return {
      encounterId,
      phase: snapshot.value as EncounterIntelligencePhase,
      targetId: snapshot.context.targetId,
      members: definition.memberIds,
      firstContactAt: snapshot.context.firstContactAt,
      lastContactAt: snapshot.context.lastContactAt,
      tactic: snapshot.context.tactic,
      tacticTargetId: snapshot.context.tacticTargetId,
      tacticUntil: snapshot.context.tacticUntil,
    };
  }
}
