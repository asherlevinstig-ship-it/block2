# Overworld Exploration Audit

## Executive assessment

Blockcraft has a large, mechanically populated overworld, but its best content is unevenly distributed across the experience. The current world generator produces 41 regional landmarks, 43 small discovery sites, 41 separate treasure-cache chests, two cave networks, and two ancient cities in a 1,000 × 64 × 1,000 world. These counts come from executing the current generator, not from a playtest or live-server census.[^1] The world also has six biomes, four distance-based danger rings, roads, public Gates, roaming wildlife, road caravans, bandit camps, weather events, and player-built land.[^1][^2][^3]

The key product problem is that **a place is not always an activity**. Discovering a named site usually records it in the journal; only some sites ask the player to observe, fight, solve, harvest, rescue, loot, or make a choice. The game already has enough geography to support compelling expeditions. The highest-return work is to connect its existing ingredients into a reliable sequence of *lead → journey → encounter → decision → reward → return or next lead*, rather than adding another biome or scattering more structures.[^4][^5]

This is a source-code audit of the current workspace, not a physical-device or live-player study. “Exists” means the mechanic has an implemented path; it does not establish that new players notice it or that all spawned instances are accessible in a live session.

## What players can do now

| Activity | Current player loop | Depth assessment |
|---|---|---|
| Map the realm | Find landmarks, small sites, and ancient cities; fill regional journal counts; buy map leads; earn 10/20/40-discovery milestones, region gold, and the completion mantle.[^4][^5] | Strong collection spine, but many individual locations are arrival-only. |
| Follow treasure routes | Take a three-stage clue map from Orin; travel to marked locations and investigate; earn gold and diamonds, or ancient-city materials on the deep route.[^5] | One of the clearest expedition loops. Target selection is deterministic by day, so repeated routes may eventually feel familiar. |
| Interact with small discoveries | Solve an Odd-Flame Shrine; claim rare plants, buried caches, lore tablets, fishing pools, and weather sites. Weather harvesting requires rain, storm, or clear conditions.[^6] | Good variety on paper; most individual interactions are short and one-time. Fishing pools are the notable daily repeat. |
| Explore caves and ancient cities | Enter carved cave networks, face cave/ancient enemies, claim vaults and tablets, and confront a Warden wake-up sequence.[^1][^7] | Best candidate for a signature overworld expedition. There are only two generated networks, so bespoke guidance and reliable entry matter. |
| Patrol roads | Encounter wounded hunters, merchant rescues, and fleeing supply thieves; find caravans, patrols, bandit camps, captains, and temporarily unlocked camp chests.[^3] | Strong systemic activity because player actions affect the shared Road Safety score, but the opportunity chain is fragmented across several notices and systems. |
| Take regional contracts | Choose a six-hour rotating offer: scout, camp clear, biome collection, cache, shrine, merchant, and rotating road work. Claim at the Guild Board; some contracts propagate to teammates.[^8] | Solid repeatable direction, but one active contract and board return requirements can interrupt a longer exploration trip. |
| Hunt, gather, mine, fish, and tame | Wildlife graze, sleep, warn herds, flee, burrow, hunt prey, and sometimes counterattack; wild cats/dogs/wolves can be approached, fed, calmed, and bound. Mining, biome collectibles, and fishing supply crafting/food loops.[^9][^10][^11] | Living-world texture is much improved. Their connection to exploration objectives and ecological consequences is still thin. |
| Find public Gates | Public Gates appear in rank-banded wilderness; nearby party listings and the new same-shard Random Gate queue support group entry.[^12] | High-value combat destination, though queueing remotely can bypass the journey to the physical landmark. |
| Join timed events and travel | Parkour, King of the Hill, Caravan Defence, meteor activity, and the S-rank skyship provide scheduled or late-game excursions.[^13][^14] | Useful variety, but event participation and skyship travel are distinct from free-roam discovery. The skyship currently deposits players at the western edge of the same overworld, not a separate authored region.[^14] |
| Build a homestead | Claim, trust, rename, expand, furnish, farm, and store goods on persistent land.[^15] | Strong reason to return to a place; weak connection between the chosen plot’s biome/region and what a player can uniquely build or produce there. |

### Strengths worth protecting

The world has a real spatial grammar: roads connect major landmarks, roadside breadcrumbs help navigation, biomes change materials and wildlife, and danger rings alter enemy pressure and loot.[^1][^2] Treasure maps already make travel legible with a marked target and a visible clue presentation.[^5] Road Safety is a shared, persistent consequence: successful interventions improve it, and it changes bandit pressure, caravan conditions, and merchant discounts.[^3] The Cartographer, journal, weather vane, contract board, team map sharing, and regional map provide several ways to turn exploration into progression.[^4][^5][^8]

## Where the experience loses momentum

### 1. Named landmarks often stop at “mapped”

An abandoned watchtower, giant tree, crashed airship, graveyard, shrine, and ruins are visually authored in voxel blocks, but the generic discovery-sight path only records their ID and can advance a scout contract. The actual discovery-interaction whitelist applies to selected **small** and ancient-city sites, not these major/minor landmark types.[^1][^4][^6] Some exceptions have other systems nearby—bandit camps fight back; caves lead underground; ruins can host a knowledge challenge—but the broad landmark set lacks a distinct action and payoff per archetype.[^7][^16]

**Judgment:** this is the largest content-depth gap. A grand silhouette promises a story or challenge; a journal toast alone underdelivers.

### 2. Exploration rewards are front-loaded and finite

The map rewards discoveries at 10, 20, and 40 sites, full regional completion, and full-world completion. Most small discoveries check a persistent claimed ID, making them one-and-done; hidden fishing pools are treated as daily claims.[^5][^6] Physical treasure caches have generated loot, but they sit outside the journal’s mapped-location list.[^5][^17] Once a route has been walked, the player’s reason to revisit it shifts to Gates, contracts, resource gathering, or ambient events.

**Judgment:** the long tail needs repeatable *changes at known places*, not more permanent icons. Weather sites show the right model: a known location becomes relevant again under changing conditions.

### 3. Multiple activity systems do not yet form a single expedition

Orin’s treasure map, the Guild Board’s regional contract, Road Safety, a weather site, a caravan, a Gate, and a pet-taming target can all exist in the same trip. They are largely presented as separate objectives and claim flows. Contracts must be accepted and claimed at the Guild Board; the Cartographer has a separate range-gated menu; Road Safety is tracked globally; weather sites have a separate codex.[^5][^8][^18]

**Judgment:** players can have many things to do, but few *planned routes* that bundle them. The friction is especially visible when a player has crossed a large world to complete one contract and then has no explicit nearby follow-up.

### 4. Strong systemic events need better legibility and follow-through

Roadside encounters have distinct types and rewards, and bandit camps advance through garrison, captain, surrender/retreat, and cleared states.[^3] The client receives activity markers and result notifications.[^19] However, the relationship between a rescued merchant, Road Safety, a changed merchant discount, and the next regional opportunity is not expressed as one readable story arc. This is an inference from the separate state and UI paths, not a player-tested finding.

### 5. Some interactions deserve an authority/quality pass before being expanded

Fishing awards a catch reported by the client; the server checks rod ownership, allowed space, and rate, but explicitly cannot verify reel skill.[^11] That is acceptable for a low-stakes pastime but not for rare competitive exploration rewards. Full-world completion and ancient-city rewards should also be tested against blocked entrances, inventory-full states, disconnects, and shared-party credit, because those are high-friction failure points in a long excursion.[^5][^6]

## RAG assessment

| Dimension | Rating | Reason |
|---|---|---|
| World layout and visual destinations | 🟢 Green | Six biomes, roads, distinct landmark silhouettes, caves, and cities create meaningful destinations.[^1][^2] |
| Discovery quantity | 🟢 Green | 86 journal locations plus 41 separate physical cache sites in the current deterministic world.[^1][^5] |
| Discovery interaction depth | 🟠 Amber | Strong pockets, but many named landmarks are sight-only and most small interactions are short one-time claims.[^4][^6] |
| Repeatable free-roam activity | 🟠 Amber | Contracts, Gates, caravans, camps, weather, wildlife, and events exist, but revisit reasons are not coherently routed.[^3][^8][^13] |
| Navigation and player guidance | 🟠 Amber | Map leads, clue beams, journal, activity markers, and Trail Sense help; their separate flows still ask players to assemble the expedition themselves.[^5][^19] |
| World reactivity | 🟠 Amber | Road Safety affects the shared world and weather wakes sites; most landmark states do not change after discovery.[^3][^6] |
| Long-form exploration progression | 🟠 Amber | Milestones and the completion mantle provide goals; there is little authored escalation between “find sites” and “find all sites.”[^5] |

## Recommended build order

### P1 — Give every landmark archetype a second verb

Do this before placing more landmarks. Create a small reusable interaction framework: *observe, solve, defend, repair, track, recover, or choose*. Give each existing archetype one primary verb and at least one visible state change. Examples: repair the watchtower beacon to reveal the next road lead; decipher a graveyard epitaph to expose a buried cache; climb the Elderheart to survey nearby weather sites; recover an airship manifest that starts a three-stop salvage route. A camp can remain combat-first, but its captain/chest sequence should end with a named result and a nearby next lead.

Keep rewards bounded: modest materials/gold/XP, one journal lore entry, and occasional route unlocks. Do not make every landmark a giant quest. The win condition is that a new player can answer, “What did I *do* there?” for all nine landmark archetypes, not just “I found it.”

**Acceptance:** each archetype has a server-validated completion state, a clear in-world prompt, at least one non-toast visual response, reward/credit once per player or per configured reset, and a test covering distance, repeated claim, and disconnect/rejoin. Existing 41 sites remain reachable.[^1][^4]

### P2 — Add an expedition planner that combines existing leads

At Orin or the Guild Board, offer a 20–30 minute route across two or three *already existing* sites in one danger ring. Include one objective from a different system where available: a contract, weather find, camp, cache, treasure clue, cave, or public Gate. Show the route as a compact sequence on the map and HUD, with “next stop” after each completion. Allow teammates to join the same route. On return, show a unified recap: distance, sites, encounters, rewards, Road Safety change, and discoveries shared.

This should be a composition layer, not another parallel contract system. Reuse Cartographer, contract, discovery, and activity events rather than duplicating their reward grants. Keep the current single active regional contract rule unless it is intentionally redesigned.[^5][^8]

**Acceptance:** a player can accept one route in town, follow three readable stops, finish without reopening multiple menus, and receive one recap. A partial route survives reconnect and cannot duplicate rewards. Test solo and team credit.

### P3 — Make known places change over time

Reuse established sites. A cleared bandit camp can become a temporary safe roadside camp or later be retaken; a watchtower can reveal an active patrol; a known fishing pool can have a daily catch; a shrine can rotate one of a few observation puzzles; weather sites already activate under specific skies.[^3][^6] Let Road Safety and weather choose which opportunities appear. This creates revisits and a sense that the world responds to collective play without increasing geometry density.

**Acceptance:** at least three landmark archetypes have a second state players can encounter on a later session; map/journal indicators differentiate *known*, *active now*, *completed*, and *resetting*; no per-player or per-site unbounded timers.

### P4 — Make caves and ancient cities a marquee expedition

The two cave networks are scarce enough to deserve authored sequencing: readable surface clue, safe entrance, early foreshadowing, escalating rooms, one meaningful optional risk, vault choice, Warden payoff, and a clean return trail. Use the existing ancient treasure map as the lead-in, but avoid revealing all drama in the map itself.[^1][^5][^7] Ensure a party can understand why it went underground and what changed when it emerged.

**Acceptance:** both generated cave routes pass automated entrance-to-core traversal checks; a two-player playtest can find the entrance from the lead, complete the route without external instructions, and recover rewards after an inventory-full or reconnect scenario.

### P5 — Link ecology and homesteads to exploration

Wildlife already has credible behaviour and direct taming.[^9][^10] Let players track signs (prints, scat, nests, calls) rather than following an icon straight to an animal. Make rare material gathering favor the appropriate biome and condition, and make homestead plots express local identity with region-specific craft or decor rather than only ownership.[^2][^15] Keep any new rare reward server-authoritative and capped; do not turn ordinary animal killing into the optimal exploration path.

**Acceptance:** a first-time pet seeker can complete an observe → track → approach → feed → calm → bond loop in the overworld, and can explain how the biome affected the hunt. A base owner has one useful, non-power-creeping reason to return to their chosen region.

## Suggested first playable slice

Build **one 25-minute “Roads of the Elderheart” expedition** using existing terrain: Orin gives a lead; the player repairs an abandoned watchtower beacon; the beacon points toward an Elderheart clue; along the road a merchant rescue or bandit patrol changes Road Safety; the final site pays a modest material bundle and a lore page; the team receives one recap and one nearby optional Gate lead. This slice exercises map guidance, landmark verbs, systemic encounters, team credit, reward pacing, and persistence. Once it works, reuse the framework across the other archetypes. The exact theme is a design proposal, not a feature currently in code.

## Measurement and validation

Track: percentage of players who leave town and map a first landmark; median time to first *interaction* at a landmark; route acceptance/completion/abandonment; average distinct activity types per 20-minute wilderness trip; repeat visits to known places; team route completion; reward duplication/rejection; and where players turn back. Compare early and midgame cohorts and solo versus grouped players. These are proposed metrics; the audit did not find evidence that they are currently measured as a complete exploration funnel.

Before shipping large additions, run a two-player observational playtest and a traversal test for each authored site. The main question is not whether markers render, but whether players can spot the clue, understand the verb, complete it, and know what to do next.

## Sources

[^1]: Blockcraft source, [`server/world.js`](../server/world.js#L310), regional landmarks, roads, small discoveries, caches, cave networks, and ancient-city generation. Counts were calculated by invoking the exported generators in this workspace on 2026-09-13.
[^2]: Blockcraft source, [`server/rooms/constants.js`](../server/rooms/constants.js#L1), biome, danger-ring, weather, wildlife, and progression constants; [`server/world.js`](../server/world.js#L1), world geometry and biome selection.
[^3]: Blockcraft source, [`server/rooms/spawning.mixin.js`](../server/rooms/spawning.mixin.js#L1008), bandit camps, caravans, roadside encounters, Road Safety, and activity payloads.
[^4]: Blockcraft source, [`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js#L8489), discovery registration, team map sharing, and sight-based contract credit.
[^5]: Blockcraft source, [`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js#L8524), Cartographer, clues, treasure-map stages, region/world rewards, and exploration milestones; [`client/js/menus.mjs`](../client/js/menus.mjs#L4355), player-facing Cartographer and journal.
[^6]: Blockcraft source, [`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js#L8712), discovery interaction whitelist, claim limits, weather gating, and rewards.
[^7]: Blockcraft source, [`server/rooms/spawning.mixin.js`](../server/rooms/spawning.mixin.js#L1580), cave/ancient-city enemies; [`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js#L8130), ancient-city Warden and core.
[^8]: Blockcraft source, [`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js#L8239), rotating regional offers, board acceptance, team propagation, and claim rewards.
[^9]: Blockcraft source, [`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js#L9174) and [`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js#L9638), herds, predator/prey, boar warnings, burrows, grazing, and sleep.
[^10]: Blockcraft source, [`server/rooms/dragons.mixin.js`](../server/rooms/dragons.mixin.js#L21), wild-pet notice/feed/calm/bond sequence and pet commands.
[^11]: Blockcraft source, [`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js#L3918), fishing authority limits; [`docs/SYSTEMS.md`](SYSTEMS.md#L119), mining and crafting overview.
[^12]: Blockcraft source, [`server/rooms/dungeon.mixin.js`](../server/rooms/dungeon.mixin.js#L830), nearby Gate matchmaking and Random Gate queue; [`client/js/menus.mjs`](../client/js/menus.mjs#L3080), queue UI.
[^13]: Blockcraft source, [`server/rooms/events.mixin.js`](../server/rooms/events.mixin.js#L378), parkour, King of the Hill, Caravan Defence, and event lifecycle.
[^14]: Blockcraft source, [`server/rooms/events.mixin.js`](../server/rooms/events.mixin.js#L228), skyship rank/fare, boarding, and western-edge arrival.
[^15]: Blockcraft source, [`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js#L4506), land claim lifecycle, buying, renaming, and trust; [`docs/SYSTEMS.md`](SYSTEMS.md#L98), homestead progression.
[^16]: Blockcraft source, [`client/js/menus.mjs`](../client/js/menus.mjs#L4249), landmark descriptions and ruins knowledge-challenge hint.
[^17]: Blockcraft source, [`server/rooms/economy.mixin.js`](../server/rooms/economy.mixin.js#L195), generated overworld chest records and cache loot.
[^18]: Blockcraft source, [`client/js/menus.mjs`](../client/js/menus.mjs#L4390), weather codex; [`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js#L8320), board range and contract flow.
[^19]: Blockcraft source, [`client/js/networking.mjs`](../client/js/networking.mjs#L2413), discovery/treasure notifications and overworld activity; [`client/js/world.mjs`](../client/js/world.mjs#L3695), map markers and visibility.
