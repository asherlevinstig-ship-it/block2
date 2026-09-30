import { describe, expect, it } from "vitest";
import {
  MOVEMENT_INPUT_TIMEOUT_MS,
  MOVEMENT_RATE_LIMIT,
  activeMovementInput,
  recordMovementMessage,
  type MovementRateWindow,
} from "../src/movement-input.js";

describe("movement input lifecycle", () => {
  it("stops a player when the latest movement packet becomes stale", () => {
    const stored = {
      request: { sequence: 7, strafe: 1, forward: 0, yaw: 90 },
      receivedAt: 1_000,
    };
    expect(activeMovementInput(stored, 1_000 + MOVEMENT_INPUT_TIMEOUT_MS)).toEqual(stored.request);
    expect(activeMovementInput(stored, 1_001 + MOVEMENT_INPUT_TIMEOUT_MS)).toEqual({
      sequence: 7,
      strafe: 0,
      forward: 0,
      yaw: 90,
    });
  });

  it("limits movement message floods and opens a fresh window", () => {
    let window: MovementRateWindow | undefined;
    for (let index = 0; index < MOVEMENT_RATE_LIMIT; index += 1) {
      const result = recordMovementMessage(window, 2_000);
      window = result.window;
      expect(result.allowed).toBe(true);
    }
    const blocked = recordMovementMessage(window, 2_000);
    expect(blocked.allowed).toBe(false);
    expect(recordMovementMessage(blocked.window, 3_000).allowed).toBe(true);
  });
});
