# Crownkeeper counterplay

The existing fixed 52 HP boss, phase thresholds, attack rotation, Briars and attack timings remain in place. This pass adds explicit responses and an earned party damage opening.

| Attack | Cue | Earned opening |
| --- | --- | --- |
| Royal Cleave (smash) | Blue: parry, C on keyboard | A successful parry opens 2 seconds |
| Crown Slam (slam) | Purple: interrupt during windup; dodge after release | A valid stagger during windup opens 2.5 seconds |
| Royal Charge (charge) | Orange: dodge or guard | A real perfect dodge or a clean miss opens 2.5 seconds; a confirmed frontal guard opens 3.5 seconds |
| Stone Volley (rocks) | Gold: guard or dodge | Existing attack recovery |
| Last Decree (warden-barrage) | Orange: dodge and find gaps | Existing attack recovery |

Boss-bar text and overhead combat cues use the same shared response contract. Danger footprint geometry and contact timing stay authoritative and unchanged. Keyboard hints are omitted for touch controls.

During an earned opening, the Crownkeeper stops attacking and every player's weapon hits deal +1 damage after armour. This includes focus bolts and bow shots. The bonus applies to weapons, not healing, spells or environmental damage. The boss bar shows the remaining time and the weapon bonus explicitly; ordinary recovery does not claim this bonus.

A counter cancels queued melee/charge travel and clears the current attack timeline. Interrupted slams advance the rotation instead of repeating indefinitely. Further forced staggers cannot extend or shorten the opening. Phase changes preserve it; an encounter reset clears it.

Creating an opening grants meaningful support contribution to the player responsible, allowing party protection to count toward personal loot and Crown Fragments. Briars remain dangerous during the opening, so the team can attack, protect its Healer or regroup. No class or temporary upgrade is mandatory.

The server-flow test covers entering through the town portal, both Warden rewards and choices, countering with Earthbreaker, defeating the Crownkeeper through weapon hits, receiving personal rewards and returning to town with permanent progress intact and temporary upgrades cleared.

Verification uses protocol cue/counter tests, authoritative combat integration, the server-flow fixture and the existing combat fairness/phase/reset suites. Browser playtesting is unavailable while local browser use is disabled in Work settings; this is not a claim that the complete encounter was played manually.
