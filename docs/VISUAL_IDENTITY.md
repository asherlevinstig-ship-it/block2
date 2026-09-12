# Blockcraft visual identity

Status: character and HUD quality-bar slices implemented; environment, abilities and
performance work remain in progress.

## North star

**Handcrafted voxel dark fantasy, interrupted by luminous arcane technology.**

The ordinary world is warm, tactile and restrained. Gates, awakened abilities, Recall and
legendary rewards introduce precise light, impossible geometry and saturated color. The
contrast should make supernatural power feel earned instead of making every screen glow.

Blockcraft should remain recognisably voxel. The target is not realism: it is stronger
silhouette, composition, material response, animation and information hierarchy.

## Shape language

- Town and friendly craft: broad bases, pitched roofs, braces, circles and softened corners.
- Hunter equipment: clear shoulder, hand and weapon silhouettes; readable from 12 metres.
- Hostile wilderness: forward weight, asymmetry, broken diagonals and exposed joints.
- Gates and knowledge: concentric geometry, deliberate symmetry and clean crystalline planes.
- Corruption: missing pieces, inward collapse and shapes that violate the surrounding grid.

Colour alone must never be the only distinction between a biome, enemy role, combat warning
or interactable object.

## Colour grammar

| Meaning | Core colour | Use |
| --- | --- | --- |
| Safe town, story, earned reward | `#e8bd62` ember gold | Warm light, primary story, major rewards |
| Navigation and interaction | `#75cbe8` wayfinder cyan | Interaction prompts and player guidance |
| Recall and knowledge | `#d8f4ff` crystal white | Ordered glyphs and learning systems |
| Nature and recovery | `#72b879` living jade | Healing, growth and safe nature magic |
| Immediate danger | `#ef6254` warning vermilion | Damage and enemy telegraphs only |
| Dungeon corruption | `#8462b8` void violet | Gates, curses and supernatural hostility |
| Neutral interface | `#07101a` ink / `#dbe7ef` silver | Panels, body text and equipment UI |

Gold is not a generic border colour. Vermilion is not decorative. Saturated colour is reserved
for interaction, danger or supernatural power.

## Typography and interface

- Use a readable system sans-serif for data, instructions and combat.
- Use Georgia only for place names, chapter titles and ceremonial moments.
- Use monospace only for coordinates, diagnostics or compact numeric readouts.
- The centre third of the world remains clear outside explicit dialogue and cinematics.
- Exploration, combat and dialogue are distinct HUD modes, not piles of simultaneous panels.
- One primary objective, one urgent warning and one interaction prompt may demand attention at
  a time. Everything else becomes a quiet rail, feed or menu.

## Combat effects

Every effect family uses five beats: anticipation, cast, travel, impact and residue. Enemy
telegraphs are geometrically simpler and remain readable beneath player effects.

- Shadow: sliced dark planes, violet internal light, inward-moving fragments.
- Guardian: heavy amber facets, compression, short dust displacement.
- Mage: narrow elemental cores with distinct outer shapes; avoid generic glowing spheres.
- Verdant: roots, leaf ribbons and directional growth, not green copies of arcane rings.
- Recall: ordered glyphs, crystalline planes and clean white-blue timing pulses.

Camera motion is brief and proportional. Do not use full-screen flashes for routine attacks.

## Environment quality bar

Every region needs a dominant horizon silhouette, two landmark forms, its own vegetation or
prop family, a traversal motif, an atmospheric behaviour and one local material accent. A
region should remain identifiable in a desaturated screenshot.

Every dungeon family needs a distinct room rhythm as well as a palette: ceiling height,
corridor width, door profile, supports, hazards, prop density and boss-arena composition.

## Performance budgets

Visual work must improve the existing crowded-combat benchmark rather than merely improve
still screenshots.

- Repeated props and particles are instanced or pooled.
- One atlas per common model family; avoid material-per-part construction.
- Distant labels collapse before distant models lose their silhouettes.
- Transparent layers are short-lived and bounded.
- Decorative lights do not cast shadows by default.
- New quality-bar scenes must target a 33.3 ms p95 frame interval on representative integrated
  GPU hardware before they are propagated across the game.

## Quality-bar slice

The first complete slice is: arrival in Town of Beginnings, Mara, first wilderness fight,
E-rank Gate, first boss and reward return. It establishes the reusable standard for one player,
Mara, zombie, skeleton, one dungeon family, three abilities, combat feedback, quest UI and
rewards before the remaining content is converted.

### Character slice — 2026-09-12

- Hunter: an asymmetric shoulder pennant and quiet idle weight shift, shared by the local
  director avatar and multiplayer hunters.
- Mara: one high shoulder, split teal mantle, brass trim and a pulsing cyan lantern-staff.
- Zombie: broad torn shroud, broken bone diagonals and muted rot palette; its short windup
  leads to a forward impact and staggered recovery.
- Skeleton: narrow grave-banner, bony crest and bow on the animated arm; a cyan draw cue
  differentiates ranged anticipation from the zombie's vermilion melee cue.
- Ordinary undead share an anticipation, impact, recovery and aftermath grammar. Server
  attack state and damage authority are unchanged.

The character capture is `e2e/visual-character-slice.spec.js` with `VISUAL_REVIEW=1`.
This is not a performance sign-off: the crowded SwiftShader check on this machine measured
101.5 ms native p95 and 320.1 ms under 4× CPU throttling, with 3,088–3,092 draw calls.
That measurement triggered the first render-cost pass below. The 33.3 ms target is still
not signed off on representative player hardware.

### Render-cost pass — 2026-09-12

The ordinary town-villager kit now uses one material atlas per model and batches rigid
parts within the animated head, torso, arms and legs. The transparent ground shadow stays
separate, and shared town texture sources are not disposed. Mara keeps her authored glow
parts unbatched. Combat presentation also skips invisible secondary-HUD box measurements
and fades out the expensive quest breadcrumb trail; both return when exploration resumes.

In the fixed 24-mob SwiftShader scene, visible town meshes fell from 1,559 to 1,127 and
maximum draw calls fell from about 3,090 to 1,680 (roughly 46%). Post-change SwiftShader
frame p95 varied from 34–57 ms native and 70–200 ms under 4× CPU throttling across runs;
the pre-batching run measured 91 ms and 284 ms respectively. Draw calls are stable but
frame times are noisy and are not a hardware sign-off. The 33.3 ms target still requires
representative integrated-GPU and tablet testing.

### Combat readability pass — 2026-09-12

Replicated attack states now resolve through one visual cue table. Melee has an orange
footprint, ranged attacks a smaller gold origin cue, while area, lane and charge
attacks defer to their authored world-space warnings instead of adding a false
generic danger circle. The E-rank boss's Grave Ring explicitly says `FIND POCKET`:
its inner pocket and outer region are safe, so a solid danger circle would be wrong.
The text sprite is redrawn only when its cue changes, not every frame.

Ordinary zombie and skeleton windups now receive a short client-only follow-through
when the server returns them to idle: contact/release then recovery. The release
particle is deliberately not a hit confirmation. Actual damage still comes from
replicated HP loss and now uses a warm, high-contrast flash before restoring the
model's base colour. Server damage, cooldowns, and telegraph durations are unchanged.
Grave Ring and volley warning FX now carry the server's actual windup duration, so
their visible boundary or lanes do not fade before the attack resolves.
The character-slice browser test asserts melee versus ranged cues, the follow-through,
and the boss safe-pocket exception.

### First journey identity pass — 2026-09-12

The playable arrival-to-reward slice now uses one restrained material story. Town receives
a warmer civic tint than the surrounding plains. The first public Gate and E-rank dungeon
entrance share dark masonry, wayfinder-cyan crystal seams and a single ember-gold crest,
making the threshold recognizable on either side without borrowing warning vermilion.
The E-rank entrance adds only six simple parts and disposes them with dungeon decoration.

The first unlock for each original Hunter path has a distinct voxel silhouette: Shadow Dash
uses four faceted afterimages and low-segment rifts, Fireball uses nested rotated cubes, and
Iron Skin uses a diamond-oriented wireframe box. Particle counts were reduced at the same
time; the pass changes presentation rather than damage or timing. An earned dungeon clear
now carries a faceted rank seal and the same gold/cyan/stone palette. At landscape-tablet
height the result remains scrollable, with its Close action in normal flow so it cannot cover
the reward handoff copy.

Validation lives in `e2e/visual-identity-slice.spec.js`, the E-rank entry capture in
`e2e/environment-identity.spec.js`, and `server/test/environment-identity.test.js`.

### Reward and notification choreography — 2026-09-12

Rewards now have two presentation lanes. Routine XP, gold and materials remain in the
compact feed and aggregate by kind and label. Rare, legendary and explicitly major rewards
enter a priority queue with a faceted icon, short meaning line and next-action hint. Duplicate
queued rewards merge, higher tiers move ahead of lower tiers, and the last 20 presented
moments are retained through `BlockcraftRewardNotifications.history()` for diagnostics and
a future player-facing history panel.

Combat owns the screen: a queued moment waits while the combat presentation or enemy
telegraph is active. If danger begins during a reveal, the reveal is suspended and resumes
afterward without duplicating its history entry. Existing full level-up, Deity and gear-inspect
presentations opt out of the new lane, avoiding stacked celebrations.

An earned Gate clear uses a three-stage sequence: the centred `GATE SEALED` moment, the
faceted rank seal and result summary, then grouped loot and its exit/upgrade handoff. Lower
priority location titles and the result panel yield during the opening beat. Reduced-motion
users receive the same hierarchy without animation, and the landscape-tablet card scrolls
with its Close action in normal flow rather than covering reward text. Policy tests live in
`server/test/reward-notification-policy.test.js`; the browser test verifies staging, history,
combat deferral, active pre-emption and responsive reward layout.

## Review matrix

Capture the quality-bar slice at desktop 1440 x 900, desktop 800 x 600 and landscape tablet.
Review town at noon and night, forest approach, first melee, crowded combat, dungeon entry,
boss telegraph and reward. Each capture is checked for focal point, silhouette, colour meaning,
centre-screen clearance, text hierarchy and frame-time cost.
