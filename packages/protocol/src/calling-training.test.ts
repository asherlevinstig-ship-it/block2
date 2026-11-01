import { describe, expect, it } from "vitest";
import { CallingAbilityRequestSchema } from "./index.js";

describe("Calling training request", () => {
  it("accepts the optional effigy-training marker without weakening strict payloads", () => {
    expect(CallingAbilityRequestSchema.safeParse({ requestId: "training-1", slot: "power", training: true }).success).toBe(true);
    expect(CallingAbilityRequestSchema.safeParse({ requestId: "decoy-1", slot: "special",
      target: { x: 4, y: 8, z: 7 } }).success).toBe(true);
    expect(CallingAbilityRequestSchema.safeParse({ requestId: "decoy-1",
      target: { x: 4, y: 8, z: 7, unsafe: true } }).success).toBe(false);
    expect(CallingAbilityRequestSchema.safeParse({ requestId: "training-1", training: "yes" }).success).toBe(false);
    expect(CallingAbilityRequestSchema.safeParse({ requestId: "training-1", training: true, cheat: true }).success).toBe(false);
  });
});
