# Combat feedback and input pass — 2026-09-09

The cooldown buffer is provisionally 120 ms. It stores one deliberate press,
consumes it once when the cooldown ends, and replaces it with a newer press.
Focus loss, hidden tabs, blocked gameplay, death, room changes, and path changes
cancel pending intent. Keyboard repeats do not enqueue additional casts.
Resource checks run again at execution. The server remains authoritative.

Local Playwright combat validation entered an actual Colyseus E-rank dungeon,
cast two Fireballs, queued the second with about 85 ms left on cooldown, and
observed two accepted results and no rejection or extra request. A later queued
press was cancelled by blur. It observed the Foreman's server-driven recovery
state and checked its recovery label. These automated exercises validate behavior;
they do not establish the best timing by human feel. Test latency, touch controls,
and deliberate combos with players before treating 120 ms as final tuning.

Changes:
- Explicit resource, cooldown, missing-target, range and blocked feedback.
- Cooldown rejection preserves the server cooldown instead of clearing it.
- Accepted casts say CAST CONFIRMED, not ABILITY READY.
- Slam/melee warning circles retain their radius and opacity. The server supplies
  existing windup durations; warnings release their geometry/material afterward.
- Volley previews match the server's three/five shot spreads.
- RECOVERING label and lowered arms follow replicated recovery state; this is
  not a promise that other enemies or lingering hazards are safe.
- Finishing hits have a distinct synthesized impact, alongside existing normal,
  critical and armor-block sounds. Sound routing is tested; human listening
  and volume balancing remain useful follow-up checks.

No enemy windup, damage, projectile-speed or recovery timing was retuned.
Validation: full npm test passed (871 at that run), then 174 targeted client/input
checks after the final additions; the combat browser test and all three E-rank
entry/signature/clear/exit tests passed. Lint, build and formatting passed.
The browser run used a separate local server on 2649 to avoid the existing global
setup startup timeout. Production/mobile latency and human combat feel are not
covered by this local run.
