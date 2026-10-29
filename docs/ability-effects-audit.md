# Ability effects audit — current low-poly Fast World

This is a source and automated combat audit of all 18 Calling abilities. It checks effects against authoritative mechanics, target selection, range, cooldowns, lifetime, interruption, upgrades and feedback. It does **not** certify visual polish or subjective game feel: browser playtesting is unavailable because local browser access is disabled in Work settings.

## Faults corrected

- Persistent effects were keyed only by player. One ability could erase another ability's active shield, mark or timer. Effects now have independent ownership by player and ability; the HUD returns to a remaining active effect when the latest one ends.
- The acknowledgement created a substitute local effect using camera radians, local position and incomplete upgrade information. It could suppress the authoritative effect for 700ms. Accepted effects now use the server's degree heading, target, position and modifiers. Immediate input anticipation is retained. Bounded cast-identity tracking prevents duplicate effects without swallowing a legitimate subsequent cast.
- Several effects were broadcast and then sent again to the same owner. Duplicate block, diversion, Challenge and cast deliveries are removed. Training and private Stealth remain owner-only.
- Bulwark's shield signature faced opposite its directional protection. The visual now faces the positive-Z convention used by combat. World headings no longer get added a second time to a parent entity's rotation.
- Challenge used Bulwark's duration storage, shortening an existing guard and inadvertently granting its ally-protection wall. Challenge now owns its brace separately. Zero-damage defenses no longer erase an unexpired Bulwark. Iron Skin reads the active Bulwark upgrade even if G has since changed.
- Disengage follow-up shots were identified from the currently selected G ability. With Volley Focus selected, they could split and credit the wrong trial. Follow-up charges now retain their originating ability and clear the replaced charge effect.
- Temporal Flux reduced the old universal Special cooldown. It now also advances the actual F cooldown and immediately updates its HUD recovery time.
- Arcane Surge and Smoke Bomb advertised their full potential stamina gain even at the resource cap. Feedback now reports the actual recovery.
- Arcane Echo had a progression notice that was hidden during combat. It now has a dedicated world-space combat cue.
- Arcane Surge, Earthbreaker, Challenge and Decoy could affect enemies through walls. Shared area target selection now checks combat line of sight. Smoke diversion also checks height and visibility and cancels diverted enemies' pending melee.
- Offensive effects could be triggered by a defeated caster. Dead characters can no longer cast.
- Buffs, queued Overloads, healing fields and decoys could survive an attempt ending. Death, disconnect and Calling changes clear their owned effects and notify clients. Cooldown costs are retained.
- Damage removed a Resurrection channel on the server without broadcasting its interruption or clearing the persistent effect. Both now happen immediately, including the channel link.
- Death Mark's persistent cue could remain after consumption or target death. Consumption, combo execution and defeat now clear it independently of the Assassin's G selection.
- Eagle Eye's trial required shots beyond normal Deadeye range, effectively requiring the upgrade before earning it. Normal successful precision shots now count, matching the trial description.
- Overload's generic activation burst could appear at the caster while its real blast was primed elsewhere. Its hands gather power; the targeted ground telegraph owns the world effect. Renewal's dedicated field similarly owns its ground visuals.
- Arcane Surge, Earthbreaker and Challenge now send their authoritative radius for a brief boundary pulse, including range upgrades. Healing and Resurrection links remain fixed in world space rather than rotating around the world origin.
- Using G no longer clears the displayed selection of the F augment.

## Ability-by-ability assessment

These ratings concern mechanical clarity found in source and tests, not an unseen appearance score.

| Ability | Status | Assessment after fixes / remaining concern |
|---|---|---|
| Bulwark | Green | Directional guard, ally protection, reduction and duration have matching ownership. Simultaneous Challenge no longer overwrites it. |
| Challenge | Green | Visible targets, taunt support credit and its own timed brace. Cannot grant Bulwark's wall. |
| Earthbreaker | Amber | Real area hit, upgraded radius and interrupt payoff. Boundary is accurate; the impact still needs a visual timing check against its instant damage. |
| Arcane Surge | Green | Actual target damage, capped resource recovery, echo and F recovery are connected. Radius uses the real upgraded range. |
| Mana Shield | Green | Charges, hit feedback, energy and shatter persist independently of G. Death clears the barrier. |
| Overload | Amber | Targeted warning, delayed blast and aftershock are distinct. Effects stay at their actual location. Readability under crowded combat still needs playtesting. |
| Stealth | Green | Pursuit break, private activation, concealment and empowered attack have dedicated signals. Owner outline and remote invisibility still need visual confirmation. |
| Death Mark | Green | Aimed visible target; marks clear on consumption, combo execution and defeat. Description matches targeting. |
| Blade Dance | Green | Every cut now resolves on its visible beat, collision-safely advances the Assassin, revalidates and retargets living enemies, and ends with a stronger staggered final cut. Death, Calling changes and missing targets cancel the remaining sequence safely. |
| Smoke Bomb | Green | Smoke, concealment and actual stamina recovery have separate feedback; diversion respects visibility and cancels pending melee. |
| Decoy | Green | Attackable player imitation, enemy redirection and destruction. Description now promises the implemented decoy. Dies with its owner/attempt. |
| Escape Artist | Green | Dodge exhaustion reset, stamina and evasion work; Clean Getaway conceals rather than heals. |
| Volley Focus | Amber | Split arrows, source-owned charges and per-hit feedback work. Players still need clearer equipment guidance when carrying a non-ranged weapon. |
| Disengage | Green | Movement path, brief evasion and two follow-up shots. Its shots cannot accidentally become Volley Focus shots. |
| Deadeye | Green | Aimed hit, long-shot bonus, mark combo and a now-attainable Eagle Eye trial. |
| Field Mend | Green | Injury-based target selection and actual healing/stamina feedback. A moving ally can outpace the short, static cosmetic link; target selection remains authoritative. |
| Renewal | Amber | Fixed field, real healing pulses and boundary work. Interactions with multiple simultaneous friendly fields need a visual crowd/readability check. |
| Resurrection | Green | Valid fallen ally, vulnerable channel and completion effect. Damage, movement and cancellation now remove the channel cues promptly. |

## Validation and next check

Automated checks cover the six defeated-caster cases, wall occlusion, real cooldown recovery, actual resource text, source-owned Ranger follow-ups, independent Tank guards, death cleanup, Resurrection interruption, Eagle Eye progress, mark cleanup and client state/delivery ownership. Existing class, upgrade, mastery and contribution tests remain part of the full release check.

Release validation: all type checks and production builds pass, with 2,186 reported tests passing (695 client, 1,290 server, 148 protocol and 53 world tests).

The next live review should exercise G and F together, interrupt Resurrection, kill an active Mage/Thief, compare normal versus upgraded ranges in both camera views, and judge Blade Dance's new dash cadence under real latency. Multiplayer effect density, late-join reconstruction of long-lived effects and subjective particles/audio quality remain unverified by this code audit.
