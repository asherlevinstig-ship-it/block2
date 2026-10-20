import { describe, expect, it } from "vitest";
import { SERVER_TICK_SAMPLE_LIMIT, appendTickSample, samplePercentile } from "./performance-metrics.js";

describe("server performance metrics", () => {
  it("calculates stable percentile samples", () => {
    expect(samplePercentile([8, 2, 5, 3, 9], 0.5)).toBe(5);
    expect(samplePercentile([8, 2, 5, 3, 9], 0.95)).toBe(9);
    expect(samplePercentile([], 0.95)).toBe(0);
  });

  it("keeps only the newest bounded tick window", () => {
    const samples: number[] = [];
    for (let value = 0; value < SERVER_TICK_SAMPLE_LIMIT + 5; value++) appendTickSample(samples, value);
    expect(samples).toHaveLength(SERVER_TICK_SAMPLE_LIMIT);
    expect(samples[0]).toBe(5);
    appendTickSample(samples, Number.NaN);
    expect(samples).toHaveLength(SERVER_TICK_SAMPLE_LIMIT);
  });
});
