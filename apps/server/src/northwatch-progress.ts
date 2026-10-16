export interface NorthwatchProgress {
  clears: number;
  marks: number;
}

const bounded = (value: unknown, max: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;

export function parseNorthwatchProgress(source: string | unknown): NorthwatchProgress {
  let raw: unknown = source;
  if (typeof source === "string") try { raw = JSON.parse(source); } catch { raw = null; }
  const entry = raw && typeof raw === "object" && !Array.isArray(raw) && "northwatch" in raw
    ? (raw as { northwatch?: unknown }).northwatch : raw;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { clears: 0, marks: 0 };
  const data = entry as Record<string, unknown>;
  return { clears: bounded(data.clears, 5), marks: bounded(data.marks, 3) & 3 };
}

export function withNorthwatchProgress(source: string, progress: NorthwatchProgress): string {
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { raw = {}; }
  const base = Array.isArray(raw) ? { loadouts: raw }
    : raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return JSON.stringify({ ...base, northwatch: parseNorthwatchProgress(progress) });
}
