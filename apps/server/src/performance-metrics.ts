export const SERVER_TICK_BUDGET_MS = 33.3;
export const SERVER_TICK_SAMPLE_LIMIT = 180;

export function appendTickSample(samples: number[], durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  samples.push(durationMs);
  if (samples.length > SERVER_TICK_SAMPLE_LIMIT) samples.splice(0, samples.length - SERVER_TICK_SAMPLE_LIMIT);
}

export function samplePercentile(samples: readonly number[], fraction: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * Math.max(0, Math.min(1, fraction))));
  return sorted[index] ?? 0;
}
