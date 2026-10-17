import { CALLING_ABILITY_AUGMENTS, CALLING_AUGMENT_TRIALS, type BuildPathUpdate } from "@blockcraft/protocol";

type AssassinJourney = { next: string; trial: string | null };

export function assassinJourney(update: BuildPathUpdate, characterLevel: number): AssassinJourney {
  if (update.selectedPathId !== "assassin") return { next: "", trial: null };

  const next = characterLevel < 2 ? "CHARACTER LV 2 · Stealth unlocks on G"
    : characterLevel < 4 ? "CHARACTER LV 4 · Death Mark unlocks on F"
    : update.rank < 2 ? "PATH RANK 2 · Shadowstep and Stealth upgrades"
    : update.rank < 3 ? "PATH RANK 3 · Choose Executioner or Phantom; Blade Dance unlocks"
    : !update.selectedSpecializationId ? "CHOOSE A VETERAN PATH · Executioner or Phantom in Town"
    : update.rank < 4 ? "MASTER · Reach 140 mastery and finish your Veteran trial"
    : "MASTERED · Shape your G ability and upgrade in the loadout";

  if (update.rank < 2) return { next, trial: null };
  if (update.masterTrial && !update.masterTrial.complete) {
    return { next, trial: `${update.masterTrial.name} trial · ${update.masterTrial.progress}/${update.masterTrial.target} · ${update.masterTrial.description}` };
  }

  const abilityId = update.selectedCallingAbilityId === "assassin_blade_dance" ? "assassin_blade_dance" : "assassin_vanish";
  const available = CALLING_ABILITY_AUGMENTS.filter(option => option.abilityId === abilityId
    && option.unlockRank <= update.rank && !update.masteredCallingAugments.includes(option.id));
  const active = available.sort((a, b) => {
    const aTrial = CALLING_AUGMENT_TRIALS[a.id], bTrial = CALLING_AUGMENT_TRIALS[b.id];
    return (update.callingAugmentProgress[b.id] ?? 0) / bTrial.target
      - (update.callingAugmentProgress[a.id] ?? 0) / aTrial.target;
  })[0];
  if (!active) return { next, trial: null };
  const trial = CALLING_AUGMENT_TRIALS[active.id];
  return { next, trial: `${active.name} · ${update.callingAugmentProgress[active.id] ?? 0}/${trial.target} · ${trial.description}` };
}
