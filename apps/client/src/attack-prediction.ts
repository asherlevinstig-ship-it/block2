import type { MainHandId, WeaponAttackState } from "@blockcraft/protocol";

interface Prediction {
  requestId: string; mainHandId: MainHandId; startedAt: number;
  combo: boolean; comboWindowMs: number; durations: readonly number[];
  beforeStep: number; beforeExpiresAt: number;
}
interface Entry extends Prediction { order: number }

/** Rebase unacknowledged swings after a correction, without undoing newer input. */
export class AttackPredictionJournal {
  private entries = new Map<string, Entry>();
  private order = 0;
  private acknowledgedOrder = -1;

  record(prediction: Prediction): void {
    this.entries.set(prediction.requestId, { ...prediction, order: this.order++ });
    while (this.entries.size > 32) this.entries.delete(this.entries.keys().next().value!);
  }

  reconcile(message: WeaponAttackState, offset: number) {
    const entry = this.entries.get(message.requestId);
    if (!entry || entry.order <= this.acknowledgedOrder) return null;
    this.acknowledgedOrder = entry.order;
    for (const [id, pending] of this.entries) if (pending.order <= entry.order) this.entries.delete(id);
    let weapon = message.mainHandId;
    let step = message.comboStep as number;
    let expiresAt = message.comboExpiresAt > 0 ? message.comboExpiresAt - offset : 0;
    let recoveryUntil = message.recoveryUntil > 0 ? message.recoveryUntil - offset : 0;
    let active = message.accepted && message.startedAt !== undefined ? {
      requestId: entry.requestId, mainHandId: weapon, step, startedAt: message.startedAt - offset,
    } : null;
    for (const pending of this.entries.values()) {
      step = pending.combo && weapon === pending.mainHandId && pending.startedAt <= expiresAt ? step % 3 + 1 : 1;
      weapon = pending.mainHandId;
      const duration = pending.durations[step - 1] ?? pending.durations[0]!;
      recoveryUntil = pending.startedAt + duration;
      expiresAt = pending.combo ? recoveryUntil + pending.comboWindowMs : 0;
      active = { requestId: pending.requestId, mainHandId: weapon, step, startedAt: pending.startedAt };
    }
    return { mainHandId: weapon, step, expiresAt, recoveryUntil, active };
  }

  /** Compatibility with a backend that has not rolled out attack:state yet. */
  rejectLegacy(requestId: string | undefined) {
    const entry = requestId ? this.entries.get(requestId) : undefined;
    if (!entry) return null;
    return this.reconcile({ requestId: entry.requestId, accepted: false, serverTime: 0,
      mainHandId: entry.mainHandId, comboStep: entry.beforeStep as 0 | 1 | 2 | 3,
      comboExpiresAt: entry.beforeExpiresAt, recoveryUntil: 0 }, 0);
  }

  clear(): void { this.entries.clear(); this.acknowledgedOrder = this.order - 1; }
}
