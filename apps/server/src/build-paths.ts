import { ARMOUR_DEFINITIONS, BUILD_PATH_RANKS, MAIN_HAND_DEFINITIONS, type ArmourId, type BuildPathAffinity, type BuildPathId, type MainHandId, type TraitId } from "@blockcraft/protocol";

export type BuildPathState = { selectedPathId: BuildPathId | null; xp: Partial<Record<BuildPathId, number>> };
export type BuildAffinitySource = { mainHandId: string; armourId: string; equippedTrait: string; equippedSpecial: string;
  powerPoints: number; vitalityPoints: number; agilityPoints: number };

const PATH_IDS = ["tank", "mage", "assassin", "thief", "ranger"] as const;
const safePath = (value: unknown): value is BuildPathId => typeof value === "string" && PATH_IDS.includes(value as BuildPathId);

export function parseBuildPathState(raw: unknown): BuildPathState {
  let value = raw;
  if (typeof value === "string") try { value = JSON.parse(value); } catch { value = null; }
  if (!value || typeof value !== "object") return { selectedPathId: null, xp: {} };
  if ("buildPath" in value && (value as { buildPath?: unknown }).buildPath) value = (value as { buildPath: unknown }).buildPath;
  const record = value as { selectedPathId?: unknown; xp?: unknown };
  const xp: Partial<Record<BuildPathId, number>> = {};
  if (record.xp && typeof record.xp === "object") for (const pathId of PATH_IDS) {
    const amount = (record.xp as Record<string, unknown>)[pathId];
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) xp[pathId] = Math.min(65_535, Math.floor(amount));
  }
  return { selectedPathId: safePath(record.selectedPathId) ? record.selectedPathId : null, xp };
}

export function serializeBuildPathState(state: BuildPathState): string { return JSON.stringify(parseBuildPathState(state)); }

export function buildPathRank(xp: number): number {
  let rank = 0;
  for (const threshold of BUILD_PATH_RANKS) if (xp >= threshold.xp) rank = threshold.rank;
  return rank;
}

export function nextBuildRankXp(xp: number): number | null {
  return BUILD_PATH_RANKS.find(threshold => threshold.xp > xp)?.xp ?? null;
}

export function buildPathAffinities(source: BuildAffinitySource): BuildPathAffinity[] {
  const hand = MAIN_HAND_DEFINITIONS[Object.hasOwn(MAIN_HAND_DEFINITIONS, source.mainHandId) ? source.mainHandId as MainHandId : "longsword"];
  const armourId = Object.hasOwn(ARMOUR_DEFINITIONS, source.armourId) ? source.armourId as ArmourId : "none";
  const armour = ARMOUR_DEFINITIONS[armourId];
  const trait = source.equippedTrait as TraitId;
  const values: Record<BuildPathId, { score: number; reasons: string[] }> = {
    tank: { score: 0, reasons: [] }, mage: { score: 0, reasons: [] }, assassin: { score: 0, reasons: [] },
    thief: { score: 0, reasons: [] }, ranger: { score: 0, reasons: [] },
  };
  const add = (id: BuildPathId, score: number, reason: string) => { values[id].score += score; values[id].reasons.push(reason); };
  if (armour.reduction >= 2) add("tank", armour.reduction * 3, "heavy armour");
  if (source.vitalityPoints > 0) add("tank", source.vitalityPoints * 2, "Vitality investment");
  if (trait === "bulwark") add("tank", 6, "Bulwark trait");
  if (hand.tag === "focus") add("mage", 9, "focus weapon");
  if (source.powerPoints > 0) add("mage", source.powerPoints * 2, "Power investment");
  if (["fang_dagger", "matriarch_edge"].includes(hand.id)) add("assassin", 9, "swift blade");
  if (trait === "executioner") add("assassin", 7, "Executioner trait");
  if (source.equippedSpecial === "hunters_mark") add("assassin", 3, "Hunter's Mark");
  if (source.agilityPoints > 0) { add("thief", source.agilityPoints * 2, "Agility investment"); add("ranger", source.agilityPoints, "Agility investment"); }
  if (armourId === "none" || armourId === "leather_armour" || armourId === "fangstalker_wrap") add("thief", 4, "light armour");
  if (trait === "momentum") add("thief", 3, "Momentum trait");
  if (hand.tag === "ranged") add("ranger", 10, "bow weapon");
  if (source.equippedSpecial === "bramble_snare") add("ranger", 5, "Bramble Snare");
  return PATH_IDS.map(pathId => ({ pathId, score: values[pathId].score, reasons: values[pathId].reasons }))
    .sort((a, b) => b.score - a.score || PATH_IDS.indexOf(a.pathId) - PATH_IDS.indexOf(b.pathId)).slice(0, 3);
}

export function chooseBuildPath(state: BuildPathState, pathId: BuildPathId): BuildPathState {
  return { selectedPathId: pathId, xp: { ...state.xp, [pathId]: state.xp[pathId] ?? 0 } };
}

export function grantBuildPathXp(state: BuildPathState, amount: number): { state: BuildPathState; rankUp: boolean } {
  const pathId = state.selectedPathId;
  if (!pathId || amount <= 0) return { state, rankUp: false };
  const before = Math.max(0, state.xp[pathId] ?? 0);
  const after = Math.min(65_535, before + Math.floor(amount));
  return { state: { selectedPathId: pathId, xp: { ...state.xp, [pathId]: after } }, rankUp: buildPathRank(after) > buildPathRank(before) };
}
