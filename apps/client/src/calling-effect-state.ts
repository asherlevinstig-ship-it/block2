import type { CallingAbilityEffect, CallingStateUpdate } from "@blockcraft/protocol";

export const callingEffectKey = (playerId: string, abilityId: string): string => `${playerId}:${abilityId}`;

/** Each ability owns its own lifetime; clearing G must never erase an active F shield. */
export class CallingEffectState {
  private readonly active = new Map<string, CallingStateUpdate>();
  private readonly seen = new Set<string>();

  accept(effect: CallingAbilityEffect): boolean {
    if (!effect.effectId) return true;
    const key = callingEffectKey(effect.casterId, `${effect.abilityId}:${effect.effectId}`);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!);
    return true;
  }

  update(state: CallingStateUpdate): void {
    const key = callingEffectKey(state.playerId, state.abilityId);
    this.active.delete(key);
    if (state.phase !== "clear") this.active.set(key, state);
  }

  latest(playerId: string, now: number): CallingStateUpdate | null {
    let latest: CallingStateUpdate | null = null;
    for (const [key, state] of this.active) {
      if (state.activeUntil !== undefined && state.activeUntil <= now) { this.active.delete(key); continue; }
      if (state.playerId === playerId) latest = state;
    }
    return latest;
  }

  removePlayer(playerId: string): void {
    for (const [key, state] of this.active) if (state.playerId === playerId) this.active.delete(key);
  }

  clear(): void { this.active.clear(); this.seen.clear(); }
}
