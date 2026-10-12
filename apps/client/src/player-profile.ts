import { PlayerProfileTokenSchema, type PlayerProfileToken } from "@blockcraft/protocol";

export const PLAYER_PROFILE_STORAGE_KEY = "blockcraft.profile-token.v1";
export const CHARACTER_CREATION_PENDING_KEY = "blockcraft.character-creation-pending.v1";

export interface ProfileStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createGuestProfileToken(randomBytes: Uint8Array): PlayerProfileToken {
  if (randomBytes.length < 16) throw new Error("A guest profile token needs at least 16 random bytes");
  return `guest_${[...randomBytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

export function getOrCreateProfileToken(storage: ProfileStorage, createToken: () => PlayerProfileToken): PlayerProfileToken {
  const existing = storage.getItem(PLAYER_PROFILE_STORAGE_KEY);
  const parsed = PlayerProfileTokenSchema.safeParse(existing);
  if (parsed.success) return parsed.data;
  const token = createToken();
  storage.setItem(PLAYER_PROFILE_STORAGE_KEY, token);
  return token;
}

/** An existing profile predates the creator; never force it through setup. */
export function characterCreationNeeded(storage: ProfileStorage): boolean {
  const existing = PlayerProfileTokenSchema.safeParse(storage.getItem(PLAYER_PROFILE_STORAGE_KEY));
  if (!existing.success) storage.setItem(CHARACTER_CREATION_PENDING_KEY, "1");
  return storage.getItem(CHARACTER_CREATION_PENDING_KEY) === "1";
}

export function finishCharacterCreation(storage: ProfileStorage): void {
  storage.setItem(CHARACTER_CREATION_PENDING_KEY, "0");
}
