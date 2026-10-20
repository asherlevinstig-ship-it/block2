export const PERFORMANCE_LOG_INTERVAL_MS = 2_000;
export const PERFORMANCE_LOG_RETENTION_MS = 10 * 60_000;
export const PERFORMANCE_LOG_MAX_SAMPLES = PERFORMANCE_LOG_RETENTION_MS / PERFORMANCE_LOG_INTERVAL_MS;

export type PerformanceLogSample = {
  at: number;
  frameP50Ms: number;
  frameP95Ms: number;
  fps: number;
  rttMs: number | null;
  inputAckMs: number | null;
  patchesPerSecond: number;
  bytesPerSecond: number;
  serverTickP50Ms: number | null;
  serverTickP95Ms: number | null;
  activeMobs: number | null;
  sleepingMobs: number | null;
  chunkBuildMs: number;
  chunkBuildPeakMs: number;
  chunkQueue: number;
  graphicsMode: string;
  graphicsTier: string;
  withinBudget: boolean;
};

export function appendPerformanceSample(
  samples: readonly PerformanceLogSample[],
  sample: PerformanceLogSample,
): PerformanceLogSample[] {
  const cutoff = sample.at - PERFORMANCE_LOG_RETENTION_MS;
  return [...samples.filter(entry => entry.at >= cutoff), sample].slice(-PERFORMANCE_LOG_MAX_SAMPLES);
}

export function parsePerformanceLog(value: string | null, now = Date.now()): PerformanceLogSample[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((sample): sample is PerformanceLogSample => typeof sample === "object" && sample !== null
      && typeof sample.at === "number" && sample.at >= now - PERFORMANCE_LOG_RETENTION_MS)
      .slice(-PERFORMANCE_LOG_MAX_SAMPLES);
  } catch {
    return [];
  }
}

export function formatPerformanceLog(
  samples: readonly PerformanceLogSample[],
  context: { path: string; room: string; userAgent: string },
): string {
  const header = [
    "BLOCKCRAFT PERFORMANCE LOG v1",
    `captured=${new Date().toISOString()}`,
    `path=${context.path}`,
    `room=${context.room}`,
    `browser=${context.userAgent}`,
    `samples=${samples.length} interval=${PERFORMANCE_LOG_INTERVAL_MS}ms retention=${PERFORMANCE_LOG_RETENTION_MS}ms`,
  ];
  return `${header.join("\n")}\n\n${samples.map(sample => JSON.stringify({
    ...sample,
    at: new Date(sample.at).toISOString(),
  })).join("\n") || "No samples captured yet."}`;
}
