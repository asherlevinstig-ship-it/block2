import { describe, expect, it } from "vitest";
import {
  MOVEMENT_INPUT_TIMEOUT_MS,
  MOVEMENT_RATE_LIMIT,
  activeMovementInput,
  recordMovementMessage,
  requestedStopPosition,
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

  it("accepts a small final position only on a moving-to-idle transition", () => {
    const previous = {
      request: { sequence: 8, strafe: 1, forward: 0, yaw: 90 },
      receivedAt: 1_000,
    };
    const stop = { sequence: 9, strafe: 0, forward: 0, yaw: 90, stopX: 4.2, stopY: 8, stopZ: 3 };
    expect(requestedStopPosition(previous, stop, { x: 4, y: 8, z: 3 })).toEqual({ x: 4.2, y: 8, z: 3 });
    expect(requestedStopPosition(
      { ...previous, request: { ...previous.request, strafe: 0 } },
      stop,
      { x: 4, y: 8, z: 3 },
    )).toBeNull();
    expect(requestedStopPosition(previous, { ...stop, strafe: 0.2 }, { x: 4, y: 8, z: 3 })).toBeNull();
  });

  it("rejects missing or implausibly distant stop positions", () => {
    const previous = {
      request: { sequence: 8, strafe: 1, forward: 0, yaw: 90 },
      receivedAt: 1_000,
    };
    expect(requestedStopPosition(
      previous,
      { sequence: 9, strafe: 0, forward: 0, yaw: 90 },
      { x: 4, y: 8, z: 3 },
    )).toBeNull();
    expect(requestedStopPosition(
      previous,
      { sequence: 9, strafe: 0, forward: 0, yaw: 90, stopX: 5, stopY: 8, stopZ: 3 },
      { x: 4, y: 8, z: 3 },
    )).toBeNull();
  });
});
