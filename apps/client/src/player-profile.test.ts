import { describe, expect, it } from "vitest";
import { CHARACTER_CREATION_PENDING_KEY, PLAYER_PROFILE_BACKUPS_KEY, PLAYER_PROFILE_STORAGE_KEY, characterCreationNeeded, createGuestProfileToken, finishCharacterCreation, getOrCreateProfileToken, profileBackups, restoreProfile, startNewAdventure } from "./player-profile";

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

describe("first-spawn character creation", () => {
  const token = "guest_0123456789abcdef0123456789abcdef";
  it("does not interrupt profiles that existed before the creator", () => {
    const storage = memoryStorage(token);
    expect(characterCreationNeeded(storage)).toBe(false);
  });

  it("keeps a new profile in creation across a refresh, then enters normally", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(characterCreationNeeded(storage)).toBe(true);
    expect(values.get(CHARACTER_CREATION_PENDING_KEY)).toBe("1");
    getOrCreateProfileToken(storage, () => token);
    expect(characterCreationNeeded(storage)).toBe(true);
    finishCharacterCreation(storage);
    expect(characterCreationNeeded(storage)).toBe(false);
  });
});

describe("new adventure profile switch", () => {
  const first = "guest_0123456789abcdef0123456789abcdef";
  const second = "guest_ffffffffffffffffffffffffffffffff";
  const third = "guest_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const setup = () => {
    const values = new Map([[PLAYER_PROFILE_STORAGE_KEY, first]]);
    return { values, storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    } };
  };

  it("preserves the old character and returns to creation under a fresh token", () => {
    const { values, storage } = setup();
    expect(startNewAdventure(storage, () => second, "Charlie", 123)).toBe(second);
    expect(characterCreationNeeded(storage)).toBe(true);
    expect(profileBackups(storage)).toEqual([{ token: first, name: "Charlie", savedAt: 123 }]);
    expect(values.get(PLAYER_PROFILE_BACKUPS_KEY)).toBeTruthy();
  });

  it("can restore the previous save without deleting the new profile", () => {
    const { values, storage } = setup();
    startNewAdventure(storage, () => second, "Charlie", 123);
    restoreProfile(storage, first, "New Explorer", 456);
    expect(values.get(PLAYER_PROFILE_STORAGE_KEY)).toBe(first);
    expect(characterCreationNeeded(storage)).toBe(false);
    expect(profileBackups(storage)).toEqual([{ token: second, name: "New Explorer", savedAt: 456 }]);
  });

  it("rejects a repeated token rather than overwriting a character", () => {
    const { values, storage } = setup();
    startNewAdventure(storage, () => second, "Charlie", 123);
    restoreProfile(storage, first, "New Explorer", 456);
    expect(() => startNewAdventure(storage, () => second, "Charlie", 789)).toThrow("distinct profile");
    expect(values.get(PLAYER_PROFILE_STORAGE_KEY)).toBe(first);
  });

  it("keeps earlier backups after another fresh start", () => {
    const { storage } = setup();
    startNewAdventure(storage, () => second, "Charlie", 123);
    finishCharacterCreation(storage);
    startNewAdventure(storage, () => third, "Second", 456);
    expect(profileBackups(storage).map(backup => backup.token)).toEqual([first, second]);
  });
});
