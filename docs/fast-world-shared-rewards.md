# Fast World contribution rewards

Floor 1 and the other Fast World encounters reuse `CombatContributions`, personal loot bags and the existing XP/Calling reward rules.

- Normal enemies require at least 10% of maximum health in damage/support within the last 20 seconds. Eligible players must be alive, within 22 metres and within 2.5 metres vertically.
- Leaders retain meaningful contributions throughout their current life: 5% of maximum health, within 30 metres and the same vertical limit at defeat.
- Each eligible contributor receives their own loot roll, gold, level-adjusted XP and Calling progress. Rewards are not divided among participants.
- If nobody meets the threshold, a living nearby player who actually finishes the enemy still receives the solo reward. A tiny finishing hit does not bypass other contributors' eligibility.
- Real guard/parry prevention, Bulwark and ally protection count. Challenge counts when it redirects an enemy from another living player.
- Field Mend, Renewal pulses and completed Resurrection count actual health restored to another player involved in that enemy's fight. Self-healing, overhealing, stamina restoration and healing unrelated spectators do not count.
- Defeat, encounter reset, respawn and disconnect use the existing contribution cleanup. Credit cannot carry into another enemy life.
- Existing personal loot ownership and duplicate-pickup protection remain authoritative.

Room integration coverage: `apps/server/src/fast-world-shared-rewards.test.ts`.
