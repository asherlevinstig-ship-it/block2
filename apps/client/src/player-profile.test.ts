import { describe, expect, it } from "vitest";
import { PLAYER_PROFILE_STORAGE_KEY, createGuestProfileToken, getOrCreateProfileToken } from "./player-profile";

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (key: string) => key === PLAYER_PROFILE_STORAGE_KEY ? value : null,
    setItem: (key: string, next: string) => { if (key === PLAYER_PROFILE_STORAGE_KEY) value = next; },
    value: () => value,
  };
}

describe("guest player profiles", () => {
  it("creates an opaque 128-bit profile token", () => {
    expect(createGuestProfileToken(Uint8Array.from({ length: 16 }, (_, index) => index)))
      .toBe("guest_000102030405060708090a0b0c0d0e0f");
  });

  it("reuses a valid saved profile token", () => {
    const existing = "guest_0123456789abcdef0123456789abcdef";
    const storage = memoryStorage(existing);
    expect(getOrCreateProfileToken(storage, () => "guest_ffffffffffffffffffffffffffffffff")).toBe(existing);
  });

  it("replaces an invalid saved value", () => {
    const storage = memoryStorage("not-a-profile");
    const replacement = "guest_ffffffffffffffffffffffffffffffff";
    expect(getOrCreateProfileToken(storage, () => replacement)).toBe(replacement);
    expect(storage.value()).toBe(replacement);
  });
});
