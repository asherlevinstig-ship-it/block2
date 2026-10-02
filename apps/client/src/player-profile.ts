import { PlayerProfileTokenSchema, type PlayerProfileToken } from "@blockcraft/protocol";

export const PLAYER_PROFILE_STORAGE_KEY = "blockcraft.profile-token.v1";

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
