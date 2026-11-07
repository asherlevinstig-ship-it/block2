# Progression balance, version 2

This pass establishes a longer curve for the existing woodland and Moonwell dungeon. It does not add new regions or an endless dungeon tier system.

## Skill costs

All combat attributes, Patience, Luck and Woodcutting share one curve. The cost from level L to L+1 is `50 + 15*(L-1) + 10*(L-1)^2` XP. Examples are 50 at level 1, 270 at level 5, 995 at level 10, 3,945 at level 20 and 8,895 at level 30. Costs plateau at 1,000,000 at extreme legacy levels. XP and level calculations are shared by the server, shops, character displays and rankings.

Existing saves convert once. Earned levels and the fraction of the next level are preserved. Existing mastery levels and their partial progress are preserved too. Gold, unlocked powers, owned equipment and enchantments are retained. Offline shifts retain their scheduled intervals. Ordinary saves cannot reset the migration version or forge progression.

## Combat and magic

Woodland Boars retain their starting rewards. Stoneback Beetles award 25 Strength, 20 Agility and 25 Vitality XP. Dungeon enemies progressively increase in health: Gate 100, Gallery 150, optional Cache Guardian 180 and Vault Guardian 240. Their respective combat XP rewards are 30/20/30, 45/35/45, 55/40/55 and 75/55/75.

Base Gem mastery has cumulative thresholds 0, 30, 150, 600 and 2,000. A used Gem gains mastery once per victory: Boar 10, Beetle 15, Gate 20, Gallery 30, Cache Guardian 40 and Vault Guardian 50. Unused Gems receive none. The maximum elemental bonuses remain unchanged. Reaching full mastery takes 200 Boar victories or 20 main-route clears when the Gem contributes to all three fights, before accounting for the optional guardian.

The first eligible victory after bonding and every fifth eligible victory give an Awakening Stone. A Vault Guardian victory guarantees one. The Cache Guardian unlocks the Essence Cache, whose separately claimed stone remains guaranteed. Cache Guardian kills do not increment the ordinary stone milestone counter. Claims and combat retries remain idempotent.

## Equipment economy

Oak Rod and Iron Sword remain 60 and 150 gold. Silverwood Rod is 240, Moonweave Rod 1,200, Hunting Spear 600 and Quick Dagger 550. Equipment stat requirements stay the same, evaluated against the new curve. Enchantment steps cost 150/600/1,800 gold and 1/3/6 Vault shards, with existing damage bonuses retained. Fishing and woodcutting retain their active and offline output rates.

## Validation and next balance work

Deterministic combat simulations use identical 0.5 rolls and no manual dodges or spells. Starter gear loses to Gallery, Cache and Vault. Level 3 with Iron Sword loses to Vault. Level 5 with Iron Sword and Stoneback Vest wins Vault at 7 HP from a full-health start; level 10 with Quick Dagger and vest wins at 66 HP. A complete level-five safe-route expedition succeeds using prepared Boar Stew and banks one shard. These checks establish relative progression, not real-player win rates or measured session lengths.

The current content remains an early-game progression band. Further regions, encounter patterns and higher equipment tiers are needed before this supports a long endgame. Existing maximum combat bonuses still apply. Playtesting should measure time to first upgrade, failed runs, XP per active hour, offline earnings and material accumulation before extending the curve further.
