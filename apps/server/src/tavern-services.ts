const TAVERN_KEEPER = { x: -8.2, y: 9.5, z: -1.5, range: 3.1 } as const;

function recordFrom(source: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(source) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return Array.isArray(parsed) ? { loadouts: parsed } : {};
  } catch {
    return {};
  }
}

export function tavernReturnBound(source: string): boolean {
  return recordFrom(source).tavernReturn === true;
}

export function withTavernReturnBound(source: string): string {
  return JSON.stringify({ ...recordFrom(source), tavernReturn: true });
}

export function canUseTavernKeeperService(player: { x: number; y: number; z: number }): boolean {
  return Math.abs(player.y - TAVERN_KEEPER.y) <= 1.8
    && Math.hypot(player.x - TAVERN_KEEPER.x, player.z - TAVERN_KEEPER.z) <= TAVERN_KEEPER.range;
}
