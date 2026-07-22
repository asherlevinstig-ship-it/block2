// Guided-onboarding UI: the first-promotion / field-work-graduation modals and
// the D-rank preparation objective + checklist shown in the HUD. Extracted from
// index.html so the panel/checklist/modal logic lives beside the other client
// modules. State the rest of the client also reads (progressionFocus, the
// inventory, DOM nodes, helpers) is injected; firstPromotionSeen/Shown are owned
// here since nothing outside onboarding touches them.
export function isOnboardingBuildPlacement(x, y, z, meadow) {
  if (!meadow) return false;
  const { x: cx, z: cz, G } = meadow;
  return y >= G + 1 && y <= G + 5 &&
    Math.abs(x - (cx + 40)) <= 1 && Math.abs(z - (cz - 18)) <= 1;
}

export function countOnboardingBuildBlocks(meadow, getBlock, plankId) {
  if (!meadow || typeof getBlock !== 'function') return 0;
  const { x: cx, z: cz, G } = meadow;
  let count = 0;
  for (let x = cx + 39; x <= cx + 41; x++) {
    for (let z = cz - 19; z <= cz - 17; z++) {
      for (let y = G + 1; y <= G + 5; y++) {
        if (getBlock(x, y, z) === plankId) count++;
      }
    }
  }
  return count;
}

export function onboardingResourceCells(meadow, blocks) {
  if (!meadow || !blocks) return [];
  const { x: cx, z: cz, G } = meadow;
  const cells = [];
  const tree = onboardingTreeTarget(meadow);
  for (let y = G + 1; y <= G + 4; y++) cells.push({ x: tree.x, y, z: tree.z, id: blocks.LOG });
  for (let x = cx + 8; x <= cx + 12; x += 2) cells.push({ x, y: G + 1, z: cz - 28, id: blocks.WHEAT_3 });
  return cells;
}

export function onboardingTreeTarget(meadow) {
  if (!meadow) return null;
  return { x: meadow.x + 22, z: meadow.z - 6 };
}

export function isOnboardingTreeLog(x, y, z, meadow) {
  if (!meadow) return false;
  const tree = onboardingTreeTarget(meadow);
  return x === tree.x && z === tree.z && y >= meadow.G + 1 && y <= meadow.G + 4;
}

export function gateMilestoneHandoff(message, earned = true) {
  const firstClear = message && message.firstClear;
  if (!earned || !firstClear || (firstClear.rank | 0) !== 1) return null;
  return {
    label: 'ADVENTURER LOOP UNLOCKED',
    text: 'Contracts, Gates, quests, events, and hostile threats all grant Hunter XP. Each rank now contains 10 levels; higher ranks demand increasingly greater mastery.',
    action: 'TRACK NEXT CONTRACT',
  };
}

export function rankPromotionDetails(message) {
  const rank = Math.max(0, Math.min(5, (message && message.rank) | 0));
  if (!message || rank <= Math.max(0, (message.fromRank | 0))) return null;
  const letter = 'EDCBAS'[rank];
  const gateRank = Math.max(0, Math.min(4, message.gateRank | 0));
  const nextRankLevel = Math.max(0, message.nextRankLevel | 0);
  return {
    rank,
    letter,
    title: `${letter}-RANK HUNTER`,
    gateAccess: `${'EDCBA'[gateRank]}-RANK GATES`,
    level: Math.max(1, message.level | 0),
    rankLevel: Math.max(1, Math.min(rank >= 5 ? 10 : 10, Math.max(1, (message.level | 0) - ([1,11,21,31,41,51][rank] || 1) + 1))),
    statPoints: Math.max(0, message.statPoints | 0),
    next: nextRankLevel
      ? `${'EDCBAS'[rank + 1]}-Rank Level 1 begins`
      : 'Maximum Hunter rank achieved',
  };
}

export function createOnboardingUI(deps) {
  const {
    rewardWin, rewardPanel, rankUpWin, rankUpPanel, I, ITEMS, HUB,
    escHTML, rewardLineHTML, countItem, hasAnyArmorItem, toolMaxDur, refreshPlayUi,
    getFocus, getInv, releasePointerLock, restoreLock, clearRewardTimer, sendNet,
    baseSetupStatus,
  } = deps;

  let firstPromotionSeen = false, firstPromotionShown = false, trainingCompleteShown = false;

  function firstPromotionObjective() {
    const focus = getFocus();
    if (focus === 'first_road_ready') return {
      label: 'Progression Path', text: "Take Mara's Road Ready quest, use the starter sword, and reach Level 3", target: HUB.mara,
      path: { now: 'Road Ready', next: 'Then clear your first E-rank Gate', why: 'The first dungeon should teach combat before the base loop opens up', step: 2, total: 6 },
    };
    if (focus === 'first_e_gate') return {
      label: 'First Dungeon', text: "Accept Mara's First Gate quest, find the E-rank Gate, and defeat its boss", target: HUB.mara,
      path: { now: 'Clear an E-rank Gate', next: 'Then build your first station', why: 'This is the first dungeon milestone, not D-rank prep', step: 3, total: 6 },
    };
    if (focus === 'first_craft_station') return {
      label: 'Progression Path', text: 'Craft a Crafting Table or Furnace so your base has a real work station', target: HUB.smith,
      path: { now: 'Craft a station', next: 'Then claim land', why: 'Your first dungeon should pay forward into a safer home base', step: 4, total: 6 },
    };
    if (focus === 'first_land_claim') return {
      label: 'Progression Path', text: 'Leave town, press L, and buy your first land claim for a protected base', target: { x: HUB.northGate ? HUB.northGate.x : HUB.jobs.x, z: HUB.northGate ? HUB.northGate.z : HUB.jobs.z },
      path: { now: 'Claim your first land', next: 'Then expand it to 3 connected tiles', why: 'Protect your home before repeatable field work', step: 5, total: 7 },
    };
    if (focus === 'first_claim_expand') return {
      label: 'Progression Path', text: 'Expand your protected base to 3 connected land claims. Adjacent expansion gets a discount.', target: { x: HUB.northGate ? HUB.northGate.x : HUB.jobs.x, z: HUB.northGate ? HUB.northGate.z : HUB.jobs.z },
      path: { now: 'Expand to 3 connected claims', next: 'Then establish your base', why: 'A real base needs enough protected room for storage, light, and a station', step: 6, total: 8 },
    };
    if (focus === 'first_base_setup') {
      const base = typeof baseSetupStatus === 'function' ? baseSetupStatus() : null;
      const checks = base && Array.isArray(base.checks) ? base.checks : [
        { id: 'storage', label: 'Storage', done: false },
        { id: 'light', label: 'Light', done: false },
        { id: 'station', label: 'Station', done: false },
      ];
      const missing = checks.filter(c => !c.done);
      const next = missing[0]
        ? { ...missing[0], hint: 'These only count inside editable claimed land.' }
        : { id: 'contract', hint: 'Base established. Take your first profession contract from the Job Board.' };
      return {
        label: 'Progression Path',
        text: base && base.ready ? 'Base established - visit the Job Board and take your first profession contract' : 'Inside claimed land, place a chest, a torch or lantern, and a Crafting Table or Furnace',
        target: { x: HUB.northGate ? HUB.northGate.x : HUB.jobs.x, z: HUB.northGate ? HUB.northGate.z : HUB.jobs.z },
        checklist: checks,
        prep: { next },
        path: { now: 'Place storage, light, and a station', next: 'Then take a contract', why: 'Your first base should become a usable home before repeatable field work', step: 7, total: 8 },
      };
    }
    if (focus === 'first_profession_contract') return {
      label: 'Progression Path', text: 'Visit the Job Board and take your first repeatable contract', target: HUB.jobs,
      path: { now: 'Take a contract', next: 'Then climb E-rank toward promotion', why: 'Contracts become the repeatable path between Gates', step: 8, total: 8 },
    };
    if (focus === 'e_rank_climb') return { label: 'E-Rank Journey', text: 'Build Hunter XP through contracts, quests, Gates, events, and hostile threats. D-Rank begins after E-Rank Level 10.', target: HUB.jobs };
    if (focus === 'first_promotion_job') return { label: 'First Promotion', text: 'Visit the Job Board and take your first Hunter contract', target: HUB.jobs };
    if (focus === 'first_promotion_contract') return { label: 'First Promotion', text: "Take Mara's Field Work from the Job Board", target: HUB.jobs };
    if (focus === 'first_d_gate') {
      const prep = dRankPrepStatus();
      return { label: 'D-Rank Preparation', text: prep.next.text, checklist: prep.checks, prep };
    }
    if (focus === 'next_adventurer_contract') return { label: 'Adventurer Contracts', text: 'Return to the Job Board and take your next rotating contract', target: HUB.jobs };
    return null;
  }

  function dRankPrepStatus() {
    const inv = getInv();
    const weapon = inv.some(s => {
      const tool = s && ITEMS[s.id] && ITEMS[s.id].tool;
      return !!(tool && tool.tier >= 3 && (tool.cls === 'sword' || tool.cls === 'axe'));
    });
    const armor = hasAnyArmorItem();
    const food = [I.BREAD, I.MONSTER_MEAT, I.COOKED_MEAT, I.HEARTY_SANDWICH].reduce((n, id) => n + countItem(id), 0) >= 3;
    const tool = inv.some(s => {
      const info = s && ITEMS[s.id] && ITEMS[s.id].tool;
      // swords AND axes are weapons in the gear economy; utility tools are pick/shovel/hoe
      if (!info || info.cls === 'sword' || info.cls === 'axe') return false;
      const max = toolMaxDur(s), cur = s.dur == null ? max : s.dur;
      return max > 0 && cur / max >= .75;
    });
    const key = countItem(I.SOLO_KEY_D) > 0 || countItem(I.TEAM_KEY_D) > 0;
    const checks = [
      { id: 'weapon', label: 'Iron-tier weapon', done: weapon, hint: 'Craft or carry an iron sword or axe at Tobin\'s smithy.', target: HUB.smith },
      { id: 'armor', label: 'Iron armor', done: armor, hint: 'Craft Iron Armor with 8 ingots, then equip it.', target: HUB.smith },
      { id: 'food', label: 'Food x3', done: food, hint: 'Buy food from Greta or cook meals for the road.', target: HUB.tavern },
      { id: 'tool', label: 'Healthy tool', done: tool, hint: 'Use a Repair Kit or craft a fresh utility tool.', target: HUB.smith },
      { id: 'key', label: 'D-rank key', done: key, hint: 'Take Adventurer work or use a D-rank key from your rewards.', target: HUB.jobs },
    ];
    let next;
    if (!weapon) next = { ...checks[0], text: 'Equip or carry an iron-tier weapon' };
    else if (!armor) next = { ...checks[1], text: "Craft Iron Armor with 8 ingots near Tobin's smithy" };
    else if (!food) next = { ...checks[2], text: 'Visit Greta at the tavern and stock 3 food' };
    else if (!tool) next = { ...checks[3], text: 'Use your Repair Kit on a worn tool' };
    else if (!key) next = { ...checks[4], text: 'Secure a D-rank Gate key' };
    else next = { id: 'gate', text: 'Ready - find and clear a D-rank Gate', target: null };
    return { weapon, armor, food, tool, key, checks, missing: checks.filter(c => !c.done), next, ready: checks.every(c => c.done) };
  }

  function objectiveHudHTML(obj) {
    let html = '<div class="qt">' + escHTML(obj.label || 'Current Quest') + '</div><div class="qv">' + escHTML(obj.text) + '</div>';
    if (obj.path) {
      html += '<div class="pathstrip">' +
        '<div class="pathbar"><i style="width:' + Math.max(0, Math.min(100, ((obj.path.step || 1) / (obj.path.total || 1)) * 100)) + '%"></i></div>' +
        '<div class="pathrow active"><b>Now</b><span>' + escHTML(obj.path.now || obj.text) + '</span></div>' +
        '<div class="pathrow"><b>Next</b><span>' + escHTML(obj.path.next || 'Keep going') + '</span></div>' +
        '<div class="pathwhy">' + escHTML(obj.path.why || '') + '</div>' +
      '</div>';
    }
    if (Array.isArray(obj.checklist)) {
      html += '<div class="prepchecklist">' + obj.checklist.map(c => '<div class="' + (c.done ? 'done' : 'todo') + '"><b>' + (c.done ? '&#10003;' : '&#9675;') + '</b><span>' + escHTML(c.label) + '</span></div>').join('') + '</div>';
      if (obj.prep && obj.prep.next && obj.prep.next.hint) html += '<div class="prephint"><b>How:</b> ' + escHTML(obj.prep.next.hint) + '</div>';
    }
    if (obj.actionHTML) html += '<div class="qactions">' + obj.actionHTML + '</div>';
    return html;
  }

  function showTrainingComplete() {
    if (!rewardWin || !rewardPanel || trainingCompleteShown) return false;
    trainingCompleteShown = true;
    rewardPanel.className = 'earned';
    rewardPanel.innerHTML =
      '<h2>TRAINING COMPLETE</h2>' +
      '<div class="rsub">WELCOME TO THE TOWN OF BEGINNINGS</div>' +
      '<div class="rewardloot">' +
        rewardLineHTML({ label: 'Next Contact', value: 'MARA VALE' }) +
        rewardLineHTML({ label: 'First Assignment', value: 'FIRST HANDS' }) +
      '</div>' +
      '<div class="rnote"><b>Your next three steps:</b><br>Follow the green light to Mara, accept your first field quest, then return at Level 2 to awaken your combat path.</div>' +
      '<button id="trainingcontinue">MEET MARA</button>';
    rewardWin.classList.remove('hidden');
    releasePointerLock();
    clearRewardTimer();
    const btn = document.getElementById('trainingcontinue');
    if (btn) btn.onclick = () => {
      rewardWin.classList.add('hidden');
      restoreLock();
      refreshPlayUi();
    };
    return true;
  }

  function showFieldWorkGraduation() {
    if (!rewardWin || !rewardPanel) return false;
    rewardPanel.className = 'earned promotion';
    rewardPanel.innerHTML =
      '<h2>FIELD WORK COMPLETE</h2>' +
      '<div class="rsub">ADVENTURER LOOP UNLOCKED</div>' +
      '<div class="rewardloot">' +
        rewardLineHTML({ label: 'Guaranteed Upgrade', value: 'IRON SWORD', id: I.IRON_SWORD }) +
        rewardLineHTML({ label: 'Armor Materials', value: 'IRON INGOT x8', id: I.IRON_INGOT }) +
        rewardLineHTML({ label: 'Repair Practice', value: 'WORN IRON PICK', id: I.IRON_PICK }) +
        rewardLineHTML({ label: 'Tool Care', value: 'REPAIR KIT', id: I.REPAIR_KIT }) +
        rewardLineHTML({ label: 'Navigation Utility', value: 'COMPASS SENSE' }) +
      '</div>' +
      '<div class="rnote"><b>Next objective:</b><br>Craft armor near Tobin, stock travel food from Greta, check your tool, then clear a D-rank Gate. Future Adventurer contracts now rotate between patrols, Gates, and server events.</div>' +
      '<button id="graduationcontinue">TRACK D-RANK GATE</button>';
    rewardWin.classList.remove('hidden');
    rewardWin.classList.add('promotion-open');
    releasePointerLock();
    clearRewardTimer();
    const btn = document.getElementById('graduationcontinue');
    if (btn) btn.onclick = () => {
      rewardWin.classList.add('hidden');
      rewardWin.classList.remove('promotion-open');
      restoreLock();
      refreshPlayUi();
    };
    return true;
  }

  function showFirstPromotion() {
    const focus = getFocus();
    if (!['first_promotion_job','first_promotion_contract','first_d_gate','next_adventurer_contract'].includes(focus)) return false;
    if (!rewardWin || !rewardPanel || firstPromotionSeen || firstPromotionShown) return false;
    firstPromotionShown = true;
    const hasKey = countItem(I.SOLO_KEY_D) > 0;
    const objective = firstPromotionObjective();
    rewardPanel.className = 'earned promotion';
    rewardPanel.innerHTML =
      '<h2>FIRST PROMOTION</h2>' +
      '<div class="rsub">E-RANK CLEARED - D-RANK ACCESS UNLOCKED</div>' +
      '<div class="rewardloot">' +
        rewardLineHTML({ label: 'D-Rank Solo Gate Key', value: hasKey ? 'SECURED' : 'CHECK INVENTORY', id: I.SOLO_KEY_D }) +
        rewardLineHTML({ label: 'Public and Key Access', value: 'D-RANK' }) +
      '</div>' +
      '<div class="rnote"><b>Prepare before entering D-rank:</b><br>Bring iron armor, an iron-tier weapon, food, and a repaired tool.</div>' +
      '<div class="rnote"><b>Next objective:</b><br>' + escHTML(objective.text) + '. Adventurer contracts become your repeatable progression path.</div>' +
      '<button id="promotioncontinue">TRACK NEXT STEP</button>';
    rewardWin.classList.remove('hidden');
    rewardWin.classList.add('promotion-open');
    releasePointerLock();
    clearRewardTimer();
    const btn = document.getElementById('promotioncontinue');
    if (btn) btn.onclick = () => {
      firstPromotionSeen = true;
      rewardWin.classList.add('hidden');
      rewardWin.classList.remove('promotion-open');
      sendNet('ackFirstPromotion', {});
      restoreLock();
      refreshPlayUi();
    };
    return true;
  }

  function showRankPromotion(message) {
    const details = rankPromotionDetails(message);
    if (!details || !rankUpWin || !rankUpPanel) return false;
    const unlocks = [
      [],
      ['D-Rank Gates & keys', 'Familiars', 'Improved contract rewards'],
      ['C-Rank Gates & keys', 'Combat specialisation', 'Mount progression'],
      ['B-Rank Gates & keys', 'Road Warden region', 'Advanced contracts'],
      ['A-Rank Gates & keys', 'Fellowships', 'High-rank equipment'],
      ['Western Frontier', 'Dragon mastery', 'S-Rank endgame'],
    ][details.rank] || [];
    rankUpPanel.innerHTML =
      '<div class="rupill">HUNTER PROMOTION</div>' +
      '<div class="rurank">' + escHTML(details.letter) + '</div>' +
      '<h2>' + escHTML(details.title) + '</h2>' +
      '<div class="rusub">RANK EARNED THROUGH HUNTER XP</div>' +
      '<div class="rurewards">' +
        '<div class="rureward"><span>HUNTER LEVEL</span><b>' + escHTML(details.letter) + '-RANK LEVEL ' + details.rankLevel + '</b></div>' +
        '<div class="rureward"><span>GATE ACCESS</span><b>' + escHTML(details.gateAccess) + '</b></div>' +
        '<div class="rureward"><span>STAT POINTS EARNED</span><b>+' + details.statPoints + '</b></div>' +
      '</div>' +
      '<div class="ruunlocks"><span>NEWLY UNLOCKED</span>' + unlocks.map(item => '<b>◆ ' + escHTML(item) + '</b>').join('') + '</div>' +
      '<div class="runext"><b>Next target:</b> ' + escHTML(details.next) + '.<br>Keep earning Hunter XP from quests, contracts, Gates, events, and hostile threats.</div>' +
      '<button id="rankupcontinue">CONTINUE</button>';
    rankUpWin.classList.remove('hidden');
    releasePointerLock();
    const btn = document.getElementById('rankupcontinue');
    if (btn) btn.onclick = () => {
      rankUpWin.classList.add('hidden');
      if (!rewardWin || rewardWin.classList.contains('hidden')) restoreLock();
    };
    return true;
  }

  return {
    firstPromotionObjective, dRankPrepStatus, objectiveHudHTML,
    showTrainingComplete, showFieldWorkGraduation, showFirstPromotion, showRankPromotion,
    isSeen: () => firstPromotionSeen,
    setSeen: v => { firstPromotionSeen = v === true; },
  };
}
