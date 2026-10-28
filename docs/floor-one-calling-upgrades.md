# Floor 1 Calling upgrades

Floor upgrades shape a single attempt. Character levels, Calling XP, equipment and Crown Fragments remain permanent and separate.

## Reward flow

Each eligible contributor to a Root Warden kill banks one choice. Each Warden rewards that character once per attempt, for a maximum of two picks. Respawning and killing the same Warden again does not grant more picks in that attempt.

Offers contain up to three upgrades from the player's Calling. Each Calling has six upgrades across three directions, two per direction. Ability-specific upgrades require the ability to be currently equipped and its character-level slot to be unlocked. Three foundational options per Calling remain available without abilities. A second offer excludes the first chosen upgrade. In the unusual case where fewer than three useful upgrades are eligible, it shows only the useful options.

The offer is stable when reopened. Choice requests include the offer ID, and the server validates the attempt, Calling, ability availability and offered upgrade. A stale, duplicate or forged request cannot spend or award another upgrade.

## Safety and presentation

Rewards remain banked during combat. The server requires five seconds since incoming damage, no nearby enemy engaging the player or winding up/striking, a living player and a Floor 1 position.

When safe and stationary, the client presents the chooser through the existing exclusive-popup queue. It uses the existing interactive-dialog protection: movement and attacks stop, and incoming damage is blocked while the chooser is shown. Choose Later dismisses that offer without losing it or automatically reopening it. The ready button and Kit allow reopening it. Active effects are listed together under Floor 1 Build in Kit.

Attempts clear on death, return through the town portal, departure from Floor 1 or disconnect. Rejoining in Floor 1 starts a fresh attempt. These temporary effects are never written into character save data. Permanent levels, gear and Crown Fragments are unaffected.

## Effects

The shared catalog in packages/protocol/src/floor-run-upgrades.ts supplies all UI text and offer filtering. Effects run on the authoritative server.

- Tank: parry reprisal, efficient guard, timed windup interruption, stronger/longer ally Bulwark, wider Challenge, wider Earthbreaker.
- Mage: a visible arc to another enemy, distance damage, spending high stamina for damage, wider Surge, shield absorption into an empowered hit, wider Overload.
- Assassin: attacks from behind, opening hits, finishing wounded enemies, longer Stealth, longer Death Mark, an additional Blade Dance cut.
- Thief: attacking distracted enemies, efficient guard, exploiting stagger, longer Smoke Bomb concealment, tougher/longer Decoy, longer Escape Artist evade.
- Ranger: distance damage, opening hits, rooting a staggered enemy, an extra Volley Focus shot, a longer terrain-aware Disengage, longer Deadeye acquisition range.
- Healer: protecting an injured ally through damage, restoring ally stamina on hits, efficient guard, stronger critical Field Mend, wider Renewal, longer Renewal.

New healing remains within healing abilities. Shared Vigor restores stamina only. Enemy levels, health and encounter difficulty stay fixed.

The first version extends existing mechanics rather than adding new aiming controls. Some foundational perks reward conditions through modest damage or stamina changes; ability upgrades build on existing specialisations and augments.

## Verification

The server suites cover offers for every Calling, locked-ability filtering, duplicate Warden kills, multiplayer contribution eligibility, stable offers, stale requests, combat safety, dialog protection, death/departure cleanup, and actual effects for all 36 upgrades. The full regression/build command is npm run check.

A local-only UI fixture is available at /qa/floor-upgrades.html under the Vite development server. It can exercise class changes, two consecutive choices, Choose Later, combat deferral and attempt clearing without modifying a game character. It is not part of the production build.
