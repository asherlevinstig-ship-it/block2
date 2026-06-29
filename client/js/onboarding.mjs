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
  for (let y = G + 1; y <= G + 4; y++) cells.push({ x: cx + 22, y, z: cz - 6, id: blocks.LOG });
  for (let x = cx + 8; x <= cx + 12; x += 2) cells.push({ x, y: G + 1, z: cz - 28, id: blocks.WHEAT_3 });
  return cells;
}

export function createOnboardingUI(deps) {
  const {
    rewardWin, rewardPanel, I, ITEMS, HUB,
    escHTML, rewardLineHTML, countItem, hasAnyArmorItem, toolMaxDur, refreshPlayUi,
    getFocus, getInv, releasePointerLock, restoreLock, clearRewardTimer, sendNet,
  } = deps;

  let firstPromotionSeen = false, firstPromotionShown = false;

  function firstPromotionObjective() {
    const focus = getFocus();
    if (focus === 'first_promotion_job') return { label: 'First Promotion', text: 'Visit the Job Board and choose Adventurer' };
    if (focus === 'first_promotion_contract') return { label: 'First Promotion', text: "Take Mara's Field Work from the Job Board" };
    if (focus === 'first_d_gate') {
      const prep = dRankPrepStatus();
      return { label: 'D-Rank Preparation', text: prep.next.text, checklist: prep.checks };
    }
    if (focus === 'next_adventurer_contract') return { label: 'Adventurer Contracts', text: 'Return to the Job Board and take your next rotating contract' };
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
      if (!info || info.cls === 'sword') return false;
      const max = toolMaxDur(s), cur = s.dur == null ? max : s.dur;
      return max > 0 && cur / max >= .75;
    });
    const key = countItem(I.SOLO_KEY_D) > 0 || countItem(I.TEAM_KEY_D) > 0;
    const checks = [
      { label: 'Iron-tier weapon', done: weapon },
      { label: 'Iron armor', done: armor },
      { label: 'Food x3', done: food },
      { label: 'Healthy tool', done: tool },
      { label: 'D-rank key', done: key },
    ];
    let next;
    if (!weapon) next = { id: 'weapon', text: 'Equip or carry an iron-tier weapon', target: HUB.smith };
    else if (!armor) next = { id: 'armor', text: "Craft Iron Armor with 8 ingots near Tobin's smithy", target: HUB.smith };
    else if (!food) next = { id: 'food', text: 'Visit Greta at the tavern and stock 3 food', target: HUB.tavern };
    else if (!tool) next = { id: 'tool', text: 'Use your Repair Kit on a worn tool', target: HUB.smith };
    else if (!key) next = { id: 'key', text: 'Secure a D-rank Gate key', target: HUB.jobs };
    else next = { id: 'gate', text: 'Ready - find and clear a D-rank Gate', target: null };
    return { weapon, armor, food, tool, key, checks, next, ready: checks.every(c => c.done) };
  }

  function objectiveHudHTML(obj) {
    let html = '<div class="qt">' + escHTML(obj.label || 'Current Quest') + '</div><div class="qv">' + escHTML(obj.text) + '</div>';
    if (Array.isArray(obj.checklist)) html += '<div class="prepchecklist">' + obj.checklist.map(c => '<div class="' + (c.done ? 'done' : 'todo') + '"><b>' + (c.done ? '&#10003;' : '&#9675;') + '</b>' + escHTML(c.label) + '</div>').join('') + '</div>';
    return html;
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
    if (!rewardWin || !rewardPanel || !focus || firstPromotionSeen || firstPromotionShown) return false;
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

  return {
    firstPromotionObjective, dRankPrepStatus, objectiveHudHTML,
    showFieldWorkGraduation, showFirstPromotion,
    isSeen: () => firstPromotionSeen,
    setSeen: v => { firstPromotionSeen = v === true; },
  };
}
