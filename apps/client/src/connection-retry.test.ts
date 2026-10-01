import { describe, expect, it, vi } from "vitest";
import { retryConnection } from "./connection-retry.js";

describe("connection retry", () => {
  it("recovers from a temporary matchmaking failure", async () => {
    vi.useFakeTimers();
    const operation = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue("connected");
    const onRetry = vi.fn();
    const result = retryConnection(operation, onRetry, [0, 25]);
    await vi.advanceTimersByTimeAsync(25);
    await expect(result).resolves.toBe("connected");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(2, 25, expect.any(TypeError));
    vi.useRealTimers();
  });

  it("surfaces the final error after all retries fail", async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockRejectedValue(new Error("offline"));
    const result = retryConnection(operation, () => undefined, [0, 10, 20]);
    const assertion = expect(result).rejects.toThrow("offline");
    await vi.runAllTimersAsync();
    await assertion;
    expect(operation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
