import { describe, expect, it } from "vitest";
import { PERFORMANCE_LOG_MAX_SAMPLES, PERFORMANCE_LOG_RETENTION_MS,
  appendPerformanceSample, automaticPerformanceAnomalies, formatPerformanceLog, parsePerformanceLog,
  type PerformanceLogSample } from "./performance-log.js";

function sample(at: number): PerformanceLogSample {
  return { at, frameP50Ms: 10, frameP95Ms: 18, fps: 60, rttMs: 40, inputAckMs: 50,
    patchesPerSecond: 30, bytesPerSecond: 10_000, serverTickP50Ms: 2, serverTickP95Ms: 5,
    serverTickMaxMs: 9, serverTickOverBudgetPercent: 0,
    activeMobs: 8, sleepingMobs: 70, chunkBuildMs: 0, chunkBuildPeakMs: 4, chunkQueue: 0,
    graphicsMode: "auto", graphicsTier: "high", withinBudget: true,
    engineUpdateMs: 8, renderMs: 7, customUpdateMs: 5, terrainUpdateMs: 0, sceneDressingMs: 1,
    mobPresentationMs: 2, worldUiMs: 1, drawCalls: 100, renderedTriangles: 10_000,
    shadowMapUpdates: 0, shadowMapMs: 0, particleMs: 0,
    visibleMobs: 8, fullDetailMobs: 5, lodMobs: 3, gpuMs: 6, presentationWaitMs: 2,
    longTaskMs: 0, renderScale: 1, canvasWidth: 1280, canvasHeight: 720, devicePixelRatio: 1,
    documentVisible: true, windowFocused: true, appFrameCount: 120, browserRafCount: 120,
    browserRafP50Ms: 16.7, browserRafP95Ms: 16.8, frameUnder20Ms: 118, frame20To42Ms: 2,
    frame42To58Ms: 0, frameOver58Ms: 0, anomalies: [] };
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
    expect(report).toContain("BLOCKCRAFT PERFORMANCE LOG v5");
    expect(report).toContain('"frameP95Ms":18');
    expect(report).toContain("room=world");
  });

  it("labels the subsystem responsible for a slow frame", () => {
    const slow = { ...sample(5_000), frameP95Ms: 83, renderMs: 31, mobPresentationMs: 18,
      rttMs: 620, bytesPerSecond: 300 * 1024 };
    expect(automaticPerformanceAnomalies(slow)).toEqual([
      "FRAME_BUDGET", "RENDER_COST", "MOB_PRESENTATION_COST", "NETWORK_RTT", "TRAFFIC_BURST",
    ]);
  });
});
