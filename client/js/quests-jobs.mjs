export const jobXpNeed = level => Math.round(30 * Math.pow(Math.max(1, level | 0), 1.45));

export function jobXpIntoLevel(xp) {
  let level = 1, remaining = Math.max(0, xp | 0);
  while (level < 99) {
    const needed = jobXpNeed(level);
    if (remaining < needed) break;
    remaining -= needed;
    level++;
  }
  return { lvl: level, xp: remaining, need: jobXpNeed(level) };
}

export const jobLevelFromXp = xp => jobXpIntoLevel(xp).lvl;

export function clampJobContract(contract, knownJobs) {
  if (!contract || typeof contract !== 'object' || !knownJobs[contract.job]) return null;
  const type = String(contract.type || '').slice(0, 20);
  if (!['mine','farm','cook','smith','repair','meditate','sell','kill','gate','quest','event'].includes(type)) return null;
  const out = {
    id: String(contract.id || '').slice(0, 80),
    job: contract.job, type, target: contract.target == null ? 0 : contract.target | 0,
    need: Math.max(1, Math.min(999, contract.need | 0)),
    have: Math.max(0, Math.min(999, contract.have | 0)),
    rewardGold: Math.max(0, Math.min(9999, contract.rewardGold | 0)),
    rewardJobXp: Math.max(0, Math.min(9999, contract.rewardJobXp | 0)),
    rewardXp: Math.max(0, Math.min(99999, contract.rewardXp | 0)),
    title: String(contract.title || 'Job Contract').slice(0, 48),
    desc: String(contract.desc || 'Complete the work order.').slice(0, 140),
    difficulty: ['quick','balanced','demanding'].includes(contract.difficulty) ? contract.difficulty : '',
    difficultyLabel: String(contract.difficultyLabel || '').slice(0, 20),
    estimate: String(contract.estimate || '').slice(0, 40),
    location: String(contract.location || '').slice(0, 64),
    offeredAt: Math.max(0, Number(contract.offeredAt) || 0),
    expiresAt: Math.max(0, Number(contract.expiresAt) || 0),
  };
  out.have = Math.min(out.have, out.need);
  return out;
}

export function createQuestModel(context) {
  function done(quest) {
    if (!quest) return false;
    if (quest.type === 'fetch') return context.countItem(quest.item) >= quest.need;
    if (quest.type === 'utility') return quest.utility ? context.utilityUnlocked(quest.utility) : context.utilityUnlocks().length > 0;
    if (quest.type === 'familiar') return quest.familiar ? context.familiarUnlocks().includes(quest.familiar) : context.familiarUnlocks().length > 0;
    if (quest.type === 'mount') return quest.mount === 'dragon' ? context.dragonUnlocks().length > 0 : context.mounted();
    if (quest.type === 'mount_use') return quest.mount === 'dragon' ? context.mounted() && context.isDragon(context.mountKind()) : context.mounted();
    return quest.have >= quest.need;
  }

  function progressText(quest) {
    if (!quest) return '';
    if (quest.type === 'pvp_bounty') return 'Target: ' + context.escape(quest.targetName || 'Unknown') + ' - ' + (done(quest) ? 'completed' : context.formatTime((quest.expiresAt || 0) - Date.now()));
    if (quest.type === 'fetch') return Math.min(quest.need, context.countItem(quest.item)) + ' / ' + quest.need;
    if (quest.type === 'utility') {
      const name = context.utilityName(quest.utility);
      return context.utilityUnlocked(quest.utility) ? 'Unlocked: ' + context.escape(name) : 'Not unlocked yet';
    }
    if (quest.type === 'familiar') {
      const name = context.familiarName(quest.familiar);
      return context.familiarUnlocks().includes(quest.familiar) ? 'Bound: ' + context.escape(name) : 'Not bound yet';
    }
    if (quest.type === 'mount') return context.dragonUnlocks().length ? 'Dragon bonded' : 'No dragon bonded yet';
    if (quest.type === 'mount_use') return context.mounted() && context.isDragon(context.mountKind()) ? 'Mounted' : 'Not mounted yet';
    return Math.min(quest.need || 1, quest.have || 0) + ' / ' + (quest.need || 1);
  }

  return { done, progressText };
}
