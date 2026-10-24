import { describe, expect, it } from "vitest";
import { connectionEndpointForAttempt } from "./connection-endpoint.js";

describe("live matchmaking endpoint recovery", () => {
  const primary = "https://block2.example/game";
  const fallback = "https://game-origin.example";

  it("starts on the same-origin Cloudflare route", () => {
    expect(connectionEndpointForAttempt(primary, fallback, 1, true)).toBe(primary);
  });

  it("alternates through the direct game origin after a failed route", () => {
    expect(connectionEndpointForAttempt(primary, fallback, 2, true)).toBe(fallback);
    expect(connectionEndpointForAttempt(primary, fallback, 3, true)).toBe(primary);
    expect(connectionEndpointForAttempt(primary, fallback, 4, true)).toBe(fallback);
  });

  it("does not replace configured or local endpoints", () => {
    expect(connectionEndpointForAttempt(primary, fallback, 2, false)).toBe(primary);
    expect(connectionEndpointForAttempt(primary, null, 2, true)).toBe(primary);
  });
});
