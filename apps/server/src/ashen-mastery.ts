import {
  ASHEN_MASTERY_BRANCHES,
  ASHEN_MASTERY_MAX,
  type AshenBlueprintId,
  type AshenMasteryBranchId,
  type AshenMasteryProgress,
} from "@blockcraft/protocol";

function envelope(json: string): Record<string, unknown> {
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return {}; }
}

export function parseAshenMastery(source: unknown): AshenMasteryProgress {
  let raw = source;
  if (typeof raw === "string") raw = envelope(raw).ashenMastery;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: AshenMasteryProgress = {};
  for (const blueprint of Object.keys(ASHEN_MASTERY_BRANCHES) as AshenBlueprintId[]) {
    const entry = (raw as Record<string, unknown>)[blueprint];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const value = entry as { xp?: unknown; branch?: unknown };
    const xp = typeof value.xp === "number" && Number.isFinite(value.xp)
      ? Math.max(0, Math.min(ASHEN_MASTERY_MAX, Math.floor(value.xp))) : 0;
    const branches = ASHEN_MASTERY_BRANCHES[blueprint] as Record<string, unknown>;
    const branch = typeof value.branch === "string" && Object.hasOwn(branches, value.branch)
      ? value.branch as AshenMasteryBranchId : undefined;
    result[blueprint] = { xp, ...(branch ? { branch } : {}) };
  }
  return result;
}

export function withAshenMastery(json: string, mastery: AshenMasteryProgress): string {
  return JSON.stringify({ ...envelope(json), ashenMastery: parseAshenMastery(mastery) });
}

export function grantAshenMastery(json: string, blueprint: AshenBlueprintId, amount: number):
  { json: string; before: number; after: number; ready: boolean } {
  const mastery = parseAshenMastery(json);
  const before = mastery[blueprint]?.xp ?? 0;
  const after = Math.min(ASHEN_MASTERY_MAX, before + Math.max(0, Math.floor(amount)));
  mastery[blueprint] = { ...mastery[blueprint], xp: after };
  return { json: withAshenMastery(json, mastery), before, after, ready: before < ASHEN_MASTERY_MAX && after >= ASHEN_MASTERY_MAX };
}

export function chooseAshenMastery(json: string, blueprint: AshenBlueprintId, branch: AshenMasteryBranchId): string | null {
  const mastery = parseAshenMastery(json);
  const entry = mastery[blueprint];
  if (!entry || entry.xp < ASHEN_MASTERY_MAX || entry.branch
    || !Object.hasOwn(ASHEN_MASTERY_BRANCHES[blueprint], branch)) return null;
  mastery[blueprint] = { xp: ASHEN_MASTERY_MAX, branch };
  return withAshenMastery(json, mastery);
}
