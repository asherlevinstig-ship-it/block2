export function crownkeeperFragments(source: string): number {
  try {
    const value = JSON.parse(source)?.crownkeeperFragments;
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(65535, Math.floor(value))) : 0;
  } catch { return 0; }
}

export function withCrownkeeperFragments(source: string, fragments: number): string {
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { raw = {}; }
  const base = Array.isArray(raw) ? { loadouts: raw } : raw && typeof raw === "object" ? raw : {};
  return JSON.stringify({ ...base, crownkeeperFragments: Number.isFinite(fragments) ? Math.max(0, Math.min(65535, Math.floor(fragments))) : 0 });
}
