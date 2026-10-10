export const CONTRIBUTION_WINDOW_MS = 20_000;
export const CONTRIBUTION_RADIUS = 22;
type Pose = { x: number; y: number; z: number };
type Hit = { at: number; damage: number };
export class CombatContributions {
  private readonly mobs = new Map<string, Map<string, Hit[]>>();
  record(mobId: string, playerId: string, damage: number, now: number): void {
    if (!Number.isFinite(damage) || damage <= 0) return;
    let contributors = this.mobs.get(mobId);
    if (!contributors) { contributors = new Map(); this.mobs.set(mobId, contributors); }
    const hits = (contributors.get(playerId) ?? []).filter(hit => now - hit.at <= CONTRIBUTION_WINDOW_MS);
    hits.push({ at: now, damage }); contributors.set(playerId, hits);
  }
  eligible(mobId: string, mob: Pose & { maxHealth: number }, players: Iterable<[string, Pose & { health: number }]>, now: number): string[] {
    const contributors = this.mobs.get(mobId);
    const threshold = Math.max(1, Math.ceil(mob.maxHealth * .1));
    return [...players].filter(([id, player]) => player.health > 0 && Math.abs(player.y - mob.y) <= 2.5
      && Math.hypot(player.x - mob.x, player.z - mob.z) <= CONTRIBUTION_RADIUS
      && (contributors?.get(id) ?? []).reduce((total, hit) => total + (now >= hit.at && now - hit.at <= CONTRIBUTION_WINDOW_MS ? hit.damage : 0), 0) >= threshold).map(([id]) => id);
  }
  clear(mobId: string): void { this.mobs.delete(mobId); }
  disconnect(playerId: string): void {
    for (const [mobId, contributors] of this.mobs) {
      contributors.delete(playerId); if (!contributors.size) this.mobs.delete(mobId);
    }
  }
}
