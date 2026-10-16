import { PlayerProfileTokenSchema, type PlayerProfileToken } from "@blockcraft/protocol";

export const PLAYER_PROFILE_STORAGE_KEY = "blockcraft.profile-token.v1";
export const CHARACTER_CREATION_PENDING_KEY = "blockcraft.character-creation-pending.v1";
export const PLAYER_PROFILE_BACKUPS_KEY = "blockcraft.profile-backups.v1";

export interface ProfileBackup { token: PlayerProfileToken; name: string; savedAt: number }

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

export function profileBackups(storage: ProfileStorage): ProfileBackup[] {
  let value: unknown;
  try { value = JSON.parse(storage.getItem(PLAYER_PROFILE_BACKUPS_KEY) ?? "[]"); } catch { return []; }
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(entry => {
    const token = PlayerProfileTokenSchema.safeParse(entry?.token);
    if (!token.success || seen.has(token.data)) return [];
    seen.add(token.data);
    return [{ token: token.data, name: typeof entry.name === "string" ? entry.name.slice(0, 20) : "Explorer",
      savedAt: typeof entry.savedAt === "number" && Number.isFinite(entry.savedAt) ? entry.savedAt : 0 }];
  });
}

/** Keeps the old server save reachable while a fresh token triggers the first-run creator. */
export function startNewAdventure(storage: ProfileStorage, createToken: () => PlayerProfileToken, name: string, now: number): PlayerProfileToken {
  const current = PlayerProfileTokenSchema.parse(storage.getItem(PLAYER_PROFILE_STORAGE_KEY));
  const backups = profileBackups(storage);
  const next = PlayerProfileTokenSchema.parse(createToken());
  if (next === current || backups.some(backup => backup.token === next)) throw new Error("Could not create a distinct profile.");
  if (!backups.some(backup => backup.token === current)) backups.push({ token: current, name: name.slice(0, 20), savedAt: now });
  storage.setItem(PLAYER_PROFILE_BACKUPS_KEY, JSON.stringify(backups));
  storage.setItem(CHARACTER_CREATION_PENDING_KEY, "1");
  try { storage.setItem(PLAYER_PROFILE_STORAGE_KEY, next); }
  catch (error) { storage.setItem(CHARACTER_CREATION_PENDING_KEY, "0"); throw error; }
  return next;
}

export function restoreProfile(storage: ProfileStorage, selected: string, currentName: string, now: number): void {
  const current = PlayerProfileTokenSchema.parse(storage.getItem(PLAYER_PROFILE_STORAGE_KEY));
  const restoreToken = PlayerProfileTokenSchema.parse(selected);
  const backups = profileBackups(storage);
  if (!backups.some(backup => backup.token === restoreToken)) throw new Error("That saved character is unavailable.");
  const remaining = backups.filter(backup => backup.token !== restoreToken);
  if (!remaining.some(backup => backup.token === current)) remaining.push({ token: current, name: currentName.slice(0, 20), savedAt: now });
  storage.setItem(PLAYER_PROFILE_BACKUPS_KEY, JSON.stringify(remaining));
  storage.setItem(CHARACTER_CREATION_PENDING_KEY, "0");
  storage.setItem(PLAYER_PROFILE_STORAGE_KEY, restoreToken);
}
