export const CONTRIBUTION_WINDOW_MS = 20_000;
export const CONTRIBUTION_RADIUS = 22;
type Pose = { x: number; y: number; z: number };
type Hit = { at: number; value: number };
export class CombatContributions {
  private readonly mobs = new Map<string, Map<string, Hit[]>>();
  private readonly supports = new Map<string, Map<string, Hit[]>>();
  private readonly totals = new Map<string, Map<string, number>>();
  hasRecentContribution(mobId: string, playerId: string, now: number): boolean {
    return [this.mobs.get(mobId)?.get(playerId), this.supports.get(mobId)?.get(playerId)]
      .some(hits => hits?.some(hit => now >= hit.at && now - hit.at <= CONTRIBUTION_WINDOW_MS && hit.value > 0));
  }
  record(mobId: string, playerId: string, damage: number, now: number): void {
    if (!Number.isFinite(damage) || damage <= 0) return;
    let contributors = this.mobs.get(mobId);
    if (!contributors) { contributors = new Map(); this.mobs.set(mobId, contributors); }
    const hits = (contributors.get(playerId) ?? []).filter(hit => now - hit.at <= CONTRIBUTION_WINDOW_MS);
    hits.push({ at: now, value: damage }); contributors.set(playerId, hits);
    let totals = this.totals.get(mobId);
    if (!totals) { totals = new Map(); this.totals.set(mobId, totals); }
    totals.set(playerId, (totals.get(playerId) ?? 0) + damage);
  }
  /** Real healing and protection count for boss credit without pretending to deal damage. */
  recordSupport(mobId: string, playerId: string, value: number, now: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    let contributors = this.supports.get(mobId);
    if (!contributors) { contributors = new Map(); this.supports.set(mobId, contributors); }
    const hits = (contributors.get(playerId) ?? []).filter(hit => now - hit.at <= CONTRIBUTION_WINDOW_MS);
    hits.push({ at: now, value }); contributors.set(playerId, hits);
    let totals = this.totals.get(mobId);
    if (!totals) { totals = new Map(); this.totals.set(mobId, totals); }
    totals.set(playerId, (totals.get(playerId) ?? 0) + value);
  }
  eligible(mobId: string, mob: Pose & { maxHealth: number }, players: Iterable<[string, Pose & { health: number }]>, now: number): string[] {
    const contributors = this.mobs.get(mobId);
    const supporters = this.supports.get(mobId);
    const threshold = Math.max(1, Math.ceil(mob.maxHealth * .1));
    return [...players].filter(([id, player]) => player.health > 0 && Math.abs(player.y - mob.y) <= 2.5
      && Math.hypot(player.x - mob.x, player.z - mob.z) <= CONTRIBUTION_RADIUS
      && [...(contributors?.get(id) ?? []), ...(supporters?.get(id) ?? [])]
        .reduce((total, hit) => total + (now >= hit.at && now - hit.at <= CONTRIBUTION_WINDOW_MS ? hit.value : 0), 0) >= threshold).map(([id]) => id);
  }
  eligiblePersistent(mobId: string, mob: Pose & { maxHealth: number }, players: Iterable<[string, Pose & { health: number }]>, thresholdRatio = .05, radius = 30): string[] {
    const totals = this.totals.get(mobId);
    const threshold = Math.max(1, Math.ceil(mob.maxHealth * thresholdRatio));
    return [...players].filter(([id, player]) => player.health > 0 && Math.abs(player.y - mob.y) <= 2.5
      && Math.hypot(player.x - mob.x, player.z - mob.z) <= radius
      && (totals?.get(id) ?? 0) >= threshold).map(([id]) => id);
  }
  clear(mobId: string): void { this.mobs.delete(mobId); this.supports.delete(mobId); this.totals.delete(mobId); }
  disconnect(playerId: string): void {
    for (const [mobId, contributors] of this.mobs) {
      contributors.delete(playerId); if (!contributors.size) this.mobs.delete(mobId);
    }
    for (const [mobId, contributors] of this.supports) {
      contributors.delete(playerId); if (!contributors.size) this.supports.delete(mobId);
    }
    for (const [mobId, totals] of this.totals) {
      totals.delete(playerId); if (!totals.size) this.totals.delete(mobId);
    }
  }
}
