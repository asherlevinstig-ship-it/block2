import { starterWeaponForPath, type BuildPathId, type ItemId } from "@blockcraft/protocol";

export function starterKitItems(pathId: BuildPathId): readonly { itemId: ItemId; quantity: number }[] {
  return [
    { itemId: starterWeaponForPath(pathId), quantity: 1 },
    { itemId: "wanderer_robes", quantity: 1 },
  ];
}

export function starterKitClaimed(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      && "starterKitClaimed" in parsed && parsed.starterKitClaimed === true;
  } catch { return false; }
}

export function withStarterKitClaimed(raw: string, claimed = true): string {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  const base = Array.isArray(parsed) ? { loadouts: parsed }
    : parsed !== null && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  return JSON.stringify({ ...base, starterKitClaimed: claimed });
}
