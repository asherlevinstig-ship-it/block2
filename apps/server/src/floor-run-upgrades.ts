import { EMPTY_FLOOR_RUN_STATE, floorUpgradeChoices, type BuildPathId, type CallingAbilityId,
  type FloorRunUpgradeState } from "@blockcraft/protocol";

interface Attempt { seed: number; earned: Set<string>; picked: string[]; spent: number; offer: string[]; offerId: string | null; path: BuildPathId | null }
export class FloorRunUpgrades {
  private attempts = new Map<string, Attempt>();
  private sequence = 0;
  start(id: string): void { this.attempts.set(id, { seed: ++this.sequence * 7919, earned: new Set(), picked: [], spent: 0, offer: [], offerId: null, path: null }); }
  clear(id: string): void { this.attempts.delete(id); }
  active(id: string): boolean { return this.attempts.has(id); }
  earn(id: string, wardenId: string): boolean {
    const run = this.attempts.get(id);
    if (!run || run.earned.has(wardenId) || run.earned.size >= 2) return false;
    run.earned.add(wardenId); return true;
  }
  state(id: string, path: BuildPathId | null, abilities: readonly CallingAbilityId[]): FloorRunUpgradeState {
    const run = this.attempts.get(id);
    if (!run) return { ...EMPTY_FLOOR_RUN_STATE, picked: [], choices: [] };
    const pending = run.earned.size - run.spent;
    const eligible = path ? floorUpgradeChoices(path, abilities, run.picked, run.seed + run.spent) : [];
    if (run.path !== path || run.offer.some(choice => !eligible.includes(choice))) { run.offer = []; run.offerId = null; }
    run.path = path;
    if (pending > 0 && path && run.offer.length === 0) {
      run.offer = eligible; run.offerId = `${run.seed}:${run.spent}:${path}`;
    }
    return { active: true, path, earned: run.earned.size, pending, picked: [...run.picked],
      offerId: pending > 0 ? run.offerId : null, choices: pending > 0 ? [...run.offer] : [] };
  }
  choose(id: string, offerId: string, upgradeId: string, path: BuildPathId | null, abilities: readonly CallingAbilityId[]): boolean {
    const state = this.state(id, path, abilities), run = this.attempts.get(id);
    if (!run || state.pending <= 0 || state.offerId !== offerId || !state.choices.includes(upgradeId)) return false;
    run.picked.push(upgradeId); run.spent++; run.offer = []; run.offerId = null; return true;
  }
  has(id: string, upgradeId: string): boolean { return this.attempts.get(id)?.picked.includes(upgradeId) ?? false; }
}
