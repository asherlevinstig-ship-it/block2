import { describe, expect, it } from "vitest";
import { PERFORMANCE_LOG_MAX_SAMPLES, PERFORMANCE_LOG_RETENTION_MS,
  appendPerformanceSample, formatPerformanceLog, parsePerformanceLog, type PerformanceLogSample } from "./performance-log.js";

function sample(at: number): PerformanceLogSample {
  return { at, frameP50Ms: 10, frameP95Ms: 18, fps: 60, rttMs: 40, inputAckMs: 50,
    patchesPerSecond: 30, bytesPerSecond: 10_000, serverTickP50Ms: 2, serverTickP95Ms: 5,
    activeMobs: 8, sleepingMobs: 70, chunkBuildMs: 0, chunkBuildPeakMs: 4, chunkQueue: 0,
    graphicsMode: "auto", graphicsTier: "high", withinBudget: true };
}

describe("performance log", () => {
  it("retains only the rolling time and sample window", () => {
    const now = 1_000_000;
    const entries = Array.from({ length: PERFORMANCE_LOG_MAX_SAMPLES + 3 }, (_, index) =>
      sample(now - PERFORMANCE_LOG_RETENTION_MS - 1 + index * 2_000));
    const result = appendPerformanceSample(entries, sample(now));
    expect(result.length).toBeLessThanOrEqual(PERFORMANCE_LOG_MAX_SAMPLES);
    expect(result.every(entry => entry.at >= now - PERFORMANCE_LOG_RETENTION_MS)).toBe(true);
    expect(result.at(-1)?.at).toBe(now);
  });

  it("recovers valid recent samples and ignores corrupt storage", () => {
    expect(parsePerformanceLog("not json", 5_000)).toEqual([]);
    expect(parsePerformanceLog(JSON.stringify([sample(1_000), sample(5_000)]), 5_000)).toHaveLength(2);
  });

  it("formats a portable report without player data", () => {
    const report = formatPerformanceLog([sample(5_000)], { path: "/", room: "world", userAgent: "test" });
    expect(report).toContain("BLOCKCRAFT PERFORMANCE LOG v1");
    expect(report).toContain('"frameP95Ms":18');
    expect(report).toContain("room=world");
  });
});
