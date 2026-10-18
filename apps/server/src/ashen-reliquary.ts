import type { AshenReliquaryChoice, ItemId } from "@blockcraft/protocol";
import { ASHEN_COMBAT_GROUP_IDS } from "./wilderness-encounters.js";

export const ASHEN_CLEAR_WINDOW_MS = 120_000;
export const ASHEN_RELIQUARY_OPEN_MS = 180_000;
export const ASHEN_RELIQUARY_COOLDOWN_MS = 300_000;

export const ASHEN_RELIQUARY_REWARDS: Record<AshenReliquaryChoice,
  { items: readonly { itemId: ItemId; quantity: number }[]; gold: number; label: string }> = {
  weapon: { items: [{ itemId: "ember_ore", quantity: 3 }, { itemId: "stone_core", quantity: 2 }], gold: 0,
    label: "Weapon materials" },
  armour: { items: [{ itemId: "ember_ore", quantity: 2 }, { itemId: "iron_ore", quantity: 4 }], gold: 0,
    label: "Armour materials" },
  gold: { items: [], gold: 45, label: "45 gold" },
};

export class AshenReliquaryCycle {
  private startedAt = 0;
  private unlockUntil = 0;
  private cooldownUntil = 0;
  private readonly defeated = new Set<string>();
  private readonly contributors = new Set<string>();
  private readonly eligible = new Set<string>();
  private readonly claimed = new Set<string>();

  private refresh(now: number): void {
    if (this.cooldownUntil > 0 && now >= this.cooldownUntil) this.reset();
    else if (!this.unlockUntil && this.startedAt > 0 && now - this.startedAt > ASHEN_CLEAR_WINDOW_MS) {
      this.startedAt = 0; this.defeated.clear(); this.contributors.clear();
    }
  }

  private reset(): void {
    this.startedAt = 0; this.unlockUntil = 0; this.cooldownUntil = 0;
    this.defeated.clear(); this.contributors.clear(); this.eligible.clear(); this.claimed.clear();
  }

  recordDefeat(mobId: string, playerIds: readonly string[], now: number): { unlocked: boolean; defeated: number } {
    this.refresh(now);
    if (!ASHEN_COMBAT_GROUP_IDS.some(id => id === mobId) || this.unlockUntil || this.cooldownUntil > now)
      return { unlocked: false, defeated: this.defeated.size };
    if (!this.startedAt) this.startedAt = now;
    this.defeated.add(mobId);
    for (const id of playerIds) this.contributors.add(id);
    if (this.defeated.size < ASHEN_COMBAT_GROUP_IDS.length)
      return { unlocked: false, defeated: this.defeated.size };
    this.unlockUntil = now + ASHEN_RELIQUARY_OPEN_MS;
    this.cooldownUntil = now + ASHEN_RELIQUARY_COOLDOWN_MS;
    for (const id of this.contributors) this.eligible.add(id);
    return { unlocked: true, defeated: this.defeated.size };
  }

  snapshot(playerId: string, now: number) {
    this.refresh(now);
    const phase = this.unlockUntil > now ? "unlocked" : this.cooldownUntil > now ? "cooldown" : "sealed";
    return { phase: phase as "sealed" | "unlocked" | "cooldown", defeated: this.defeated.size,
      required: ASHEN_COMBAT_GROUP_IDS.length, eligible: this.eligible.has(playerId), claimed: this.claimed.has(playerId),
      expiresAt: this.unlockUntil, cooldownUntil: this.cooldownUntil };
  }

  markClaimed(playerId: string, now: number): boolean {
    const state = this.snapshot(playerId, now);
    if (state.phase !== "unlocked" || !state.eligible || state.claimed) return false;
    this.claimed.add(playerId);
    return true;
  }
}
