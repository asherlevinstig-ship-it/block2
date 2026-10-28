# Floor 1 defeat and retry summary

The existing defeat popup now contains one compact summary for a Floor 1 attempt. It does not introduce another dialog or another progression system.

The server captures the summary before temporary upgrades and attempt state are cleared. It reports:

- Personal Warden victories (each eligible Warden once), chosen upgrades and unused choices.
- Crownkeeper health at defeat when nearby; otherwise the last observed health is labelled as last seen. Players who have not approached the court see “not reached”.
- Current character level/XP, gold and banked Crown Fragments. Equipment remains permanent. Carried minerals use the existing recovery-bag rules.
- The enemy and attack that caused the defeat, with one action-focused tip.

Melee contacts and projectiles retain their attack pattern at contact/release. A delayed rock shot cannot be mistaken for the Crownkeeper's later charge. Ground hazards receive ground-marker advice instead of guessing a melee move. These snapshots also prevent an old projectile parry from being mistaken for a cleave/charge counter.

The client renders into the existing defeat card and popup queue. A late summary updates that card in place. One event-log entry records the result; it does not add another toast or popup. Return to Town replaces the misleading Restart Run text, and the return status no longer claims temporary upgrades were kept.

Town return, portal travel and resurrection clear the old summary. A fresh attempt starts without old upgrades or observed boss information. Resurrection remains available through the existing rescue window.

Verification covers the before-cleanup snapshot, duplicate lethal hits, retained items/currency, mineral recovery, unseen/previously observed/dead bosses, projectile and hazard advice, archived-mode isolation, town return/fresh attempts, maximum-level copy and combat counter regression. Manual visual playtesting remains pending while browser use is disabled in Work settings.
