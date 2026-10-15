import { ARMOUR_DEFINITIONS, BUILD_PATH_RANKS, BUILD_PATH_SPECIALIZATIONS, CALLING_ABILITY_AUGMENTS, CALLING_ABILITY_OPTIONS, MAIN_HAND_DEFINITIONS, type ArmourId, type BuildPathAffinity, type BuildPathId, type BuildPathSpecializationId, type CallingAbilityId, type CallingAugmentId, type MainHandId, type TraitId } from "@blockcraft/protocol";

export type BuildPathState = { selectedPathId: BuildPathId | null; xp: Partial<Record<BuildPathId, number>>;
  specializations: Partial<Record<BuildPathId, BuildPathSpecializationId>>;
  callingAbilities: Partial<Record<BuildPathId, CallingAbilityId>>;
  callingAugments: Partial<Record<CallingAbilityId, CallingAugmentId>>;
  trials: Partial<Record<BuildPathSpecializationId, number>>; mastered: BuildPathSpecializationId[] };
export type BuildAffinitySource = { mainHandId: string; armourId: string; equippedTrait: string; equippedSpecial: string;
  powerPoints: number; vitalityPoints: number; agilityPoints: number };

const PATH_IDS = ["tank", "mage", "assassin", "thief", "ranger"] as const;
const SPECIALIZATION_IDS = PATH_IDS.flatMap(pathId => BUILD_PATH_SPECIALIZATIONS[pathId].map(option => option.id)) as BuildPathSpecializationId[];
const safePath = (value: unknown): value is BuildPathId => typeof value === "string" && PATH_IDS.includes(value as BuildPathId);
const safeSpecialization = (value: unknown): value is BuildPathSpecializationId => typeof value === "string" && SPECIALIZATION_IDS.includes(value as BuildPathSpecializationId);
const specializationDefinition = (specializationId: BuildPathSpecializationId): { id: BuildPathSpecializationId; trialTarget: number } | undefined => {
  for (const pathId of PATH_IDS) for (const option of BUILD_PATH_SPECIALIZATIONS[pathId])
    if (option.id === specializationId) return option;
  return undefined;
};

export function parseBuildPathState(raw: unknown): BuildPathState {
  let value = raw;
  if (typeof value === "string") try { value = JSON.parse(value); } catch { value = null; }
  if (!value || typeof value !== "object") return { selectedPathId: null, xp: {}, specializations: {}, callingAbilities: {}, callingAugments: {}, trials: {}, mastered: [] };
  if ("buildPath" in value && (value as { buildPath?: unknown }).buildPath) value = (value as { buildPath: unknown }).buildPath;
  const record = value as { selectedPathId?: unknown; xp?: unknown; specializations?: unknown; callingAbilities?: unknown; callingAugments?: unknown; trials?: unknown; mastered?: unknown };
  const xp: Partial<Record<BuildPathId, number>> = {};
  if (record.xp && typeof record.xp === "object") for (const pathId of PATH_IDS) {
    const amount = (record.xp as Record<string, unknown>)[pathId];
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) xp[pathId] = Math.min(65_535, Math.floor(amount));
  }
  const specializations: Partial<Record<BuildPathId, BuildPathSpecializationId>> = {};
  if (record.specializations && typeof record.specializations === "object") for (const pathId of PATH_IDS) {
    const choice = (record.specializations as Record<string, unknown>)[pathId];
    if (typeof choice === "string" && BUILD_PATH_SPECIALIZATIONS[pathId].some(option => option.id === choice))
      specializations[pathId] = choice as BuildPathSpecializationId;
  }
  const callingAbilities: Partial<Record<BuildPathId, CallingAbilityId>> = {};
  if (record.callingAbilities && typeof record.callingAbilities === "object") for (const pathId of PATH_IDS) {
    const choice = (record.callingAbilities as Record<string, unknown>)[pathId];
    if (typeof choice === "string" && CALLING_ABILITY_OPTIONS.some(option => option.id === choice && option.pathId === pathId))
      callingAbilities[pathId] = choice as CallingAbilityId;
  }
  const callingAugments: Partial<Record<CallingAbilityId, CallingAugmentId>> = {};
  if (record.callingAugments && typeof record.callingAugments === "object") for (const ability of CALLING_ABILITY_OPTIONS) {
    const choice = (record.callingAugments as Record<string, unknown>)[ability.id];
    if (typeof choice === "string" && CALLING_ABILITY_AUGMENTS.some(option => option.id === choice && option.abilityId === ability.id))
      callingAugments[ability.id] = choice as CallingAugmentId;
  }
  const trials: Partial<Record<BuildPathSpecializationId, number>> = {};
  if (record.trials && typeof record.trials === "object") for (const specializationId of SPECIALIZATION_IDS) {
    const progress = (record.trials as Record<string, unknown>)[specializationId];
    if (typeof progress === "number" && Number.isFinite(progress) && progress > 0) trials[specializationId] = Math.floor(progress);
  }
  const mastered = Array.isArray(record.mastered) ? [...new Set(record.mastered.filter(safeSpecialization))] : [];
  return { selectedPathId: safePath(record.selectedPathId) ? record.selectedPathId : null, xp, specializations, callingAbilities, callingAugments, trials, mastered };
}

export function serializeBuildPathState(state: BuildPathState): string { return JSON.stringify(parseBuildPathState(state)); }

export function buildPathRank(xp: number): number {
  let rank = 0;
  for (const threshold of BUILD_PATH_RANKS) if (xp >= threshold.xp) rank = threshold.rank;
  return rank;
}

export function effectiveBuildPathRank(state: BuildPathState, pathId: BuildPathId): number {
  const raw = buildPathRank(state.xp[pathId] ?? 0), specialization = state.specializations[pathId];
  return raw >= 4 && (!specialization || !state.mastered.includes(specialization)) ? 3 : raw;
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
  return { ...state, selectedPathId: pathId, xp: { ...state.xp, [pathId]: state.xp[pathId] ?? 0 }, specializations: { ...state.specializations }, callingAbilities: { ...state.callingAbilities } };
}

export function selectedCallingAbility(state: BuildPathState, pathId: BuildPathId): CallingAbilityId {
  return state.callingAbilities[pathId]
    ?? CALLING_ABILITY_OPTIONS.find(option => option.pathId === pathId && option.unlockRank === 0)!.id;
}

export function chooseCallingAbility(state: BuildPathState, pathId: BuildPathId, abilityId: CallingAbilityId): BuildPathState {
  const definition = CALLING_ABILITY_OPTIONS.find(option => option.id === abilityId);
  if (state.selectedPathId !== pathId || !definition || definition.pathId !== pathId
    || effectiveBuildPathRank(state, pathId) < definition.unlockRank) return state;
  return { ...state, callingAbilities: { ...state.callingAbilities, [pathId]: abilityId } };
}

export function selectedCallingAugment(state: BuildPathState, abilityId: CallingAbilityId): CallingAugmentId | null {
  return state.callingAugments[abilityId] ?? null;
}

export function chooseCallingAugment(state: BuildPathState, abilityId: CallingAbilityId, augmentId: CallingAugmentId): BuildPathState {
  const ability = CALLING_ABILITY_OPTIONS.find(option => option.id === abilityId);
  const augment = CALLING_ABILITY_AUGMENTS.find(option => option.id === augmentId && option.abilityId === abilityId);
  if (!ability || state.selectedPathId !== ability.pathId || selectedCallingAbility(state, ability.pathId) !== abilityId
    || !augment || effectiveBuildPathRank(state, ability.pathId) < augment.unlockRank) return state;
  return { ...state, callingAugments: { ...state.callingAugments, [abilityId]: augmentId } };
}

export function chooseBuildSpecialization(state: BuildPathState, pathId: BuildPathId, specializationId: BuildPathSpecializationId): BuildPathState {
  if (state.selectedPathId !== pathId || buildPathRank(state.xp[pathId] ?? 0) < 3 || state.specializations[pathId]
    || !BUILD_PATH_SPECIALIZATIONS[pathId].some(option => option.id === specializationId)) return state;
  return { ...state, specializations: { ...state.specializations, [pathId]: specializationId } };
}

export function grantBuildPathXp(state: BuildPathState, amount: number): { state: BuildPathState; rankUp: boolean } {
  const pathId = state.selectedPathId;
  if (!pathId || amount <= 0) return { state, rankUp: false };
  const before = Math.max(0, state.xp[pathId] ?? 0);
  const after = Math.min(65_535, before + Math.floor(amount));
  return { state: { ...state, selectedPathId: pathId, xp: { ...state.xp, [pathId]: after }, specializations: { ...state.specializations }, callingAbilities: { ...state.callingAbilities } }, rankUp: buildPathRank(after) > buildPathRank(before) };
}

export function grantMasterTrialProgress(state: BuildPathState, specializationId: BuildPathSpecializationId, amount: number): { state: BuildPathState; completed: boolean } {
  if (amount <= 0 || !state.selectedPathId || state.mastered.includes(specializationId) || state.specializations[state.selectedPathId] !== specializationId)
    return { state, completed: false };
  const definition = specializationDefinition(specializationId);
  if (!definition) return { state, completed: false };
  const before = state.trials[specializationId] ?? 0, after = Math.min(definition.trialTarget, before + Math.floor(amount));
  const completed = after >= definition.trialTarget;
  return { state: { ...state, trials: { ...state.trials, [specializationId]: after },
    mastered: completed ? [...state.mastered, specializationId] : state.mastered }, completed };
}
