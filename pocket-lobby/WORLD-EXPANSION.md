# Wider world: the lands around the Tower

Design proposal and implementation brief, 9 November 2026.
This is a proposed expansion, not a list of live features. Existing saves and the current world remain intact.

## Player experience

The Tower is home. Leave it to discover useful, beautiful and dangerous places; return with gold, materials, powers and stories. The aim remains becoming rich and powerful. Exploring should unlock better choices for earning, developing a build and meeting people.

A good outing has a readable destination, a choice along the way, one memorable discovery, something useful to bring home and a clear return route. Aim for a satisfying 10–20 minute trip before requiring a longer expedition. Time targets need playtesting against actual walking speed.

Do not expand by adding corridors with identical scenery and another copy of the boar. Each region needs a distinct silhouette, resource identity and encounter behaviour.

## World structure

A permanent, shared geography of connected isometric areas. Region borders are neighbouring paths that players walk through. Preserve the Tower, Moonwood and existing shortcuts.

Proposed outward structure:

- Tower of Beginnings: home, market, shops, lounge and meeting point.
- Moonwood: existing beginner fishing, timber, hunting, shrine and ruins; improve orientation while retaining progression.
- Willowmere Valley: first expansion, reached beyond Glass Creek. A river, fishing banks, a working hamlet and an optional predator trail.
- Emberfall Highlands: later expansion beyond the valley's northern pass. Exposed stone, fire magic, armoured creatures and the future quarry/mining work.
- Frostglass Reach: later expansion beyond the highlands. Frozen water, ice magic, tougher expeditions and valuable materials.
- The Veiled Marsh: later optional branch from Moonwood. Shadow magic, concealed paths and slower, dangerous creatures.

The latter three are reserved directions, not simultaneous production commitments. Do not add their names or resource rewards to the live map until players can reach their border.

## Fog, navigation and discovery

Keep the implemented discovered/frontier/hidden world-map model. Distant place names and routes remain hidden. An adjacent unexplored route is enough to invite investigation. Reveal a place on entry, persist it, and show one brief discovery cue.

Each area has a clear entrance and exit. Roads, water flow, bridges and distant landmarks agree across adjacent scenes. Use a visible Tower silhouette or route marker near home. Mark danger at the entrance, before the player commits. Avoid keys, cryptic bridge recipes or long instruction panels for basic travel.

Known places can show their activity and danger. An unknown place should not reveal its loot table, monsters or exact coordinates in a destination picker or Auto preview.

First visits are manual in the new region. Existing beginner Auto Explore remains available. After manually visiting a new safe worksite, a player can assign Auto work there. Safe Auto does not silently reveal the whole dangerous region.

## First playable region: Willowmere Valley

Seven proposed areas. Entry begins from an unused border of Glass Creek, preserving every current connection and gate.

| Area | Purpose | Distinct view | First interaction | Danger |
|---|---|---|---|---|
| Reedwater Crossing | Region entrance and orientation | Broad river with an old stone arch bridge | Walk across and reveal the valley entrance | Safe road |
| Willowbank | Shared fishing destination | Willow roots, open bank and separated fishing stations | Cast alongside other players | Safe |
| Millbrook Hamlet | Small social hub and rest stop | Working waterwheel, warm windows and a compact dock | Meet the river trader or rest | Safe |
| Sunmeadow | Gathering and a scenic alternate route | Wildflowers, tall grass and open sky | Gather using the existing timber loop first | Safe road |
| Fangwood | Optional hunting detour | Broken fences, scratch marks and dense trees | Choose whether to approach a new predator | Dangerous; opt-in combat |
| Drowned Watchtower | Region landmark and small expedition entrance | Ruined tower reflected in the river | Inspect a visible entrance; expedition added in a later stage | Danger clearly marked |
| Old Ferry Path | Useful return shortcut | Abandoned ferry landing with a clear footpath | Open a simple latch from the far side | Safe once opened |

Topology:

Glass Creek → Reedwater Crossing → Willowbank → Millbrook Hamlet
Reedwater Crossing → Sunmeadow → Millbrook Hamlet
Millbrook Hamlet → Fangwood → Drowned Watchtower
Millbrook Hamlet → Old Ferry Path → Glass Creek

The first three places form the initial delivery. They must feel like one river landscape. The remaining four extend that loop only after the initial slice plays well.

### First outing example

1. Notice the unexplored path beyond Glass Creek.
2. Reach Reedwater Crossing; the next outline emerges through fog.
3. Follow the river to Willowbank and see other people fishing.
4. Reach the hamlet; sell a catch or rest, then choose to continue or return.
5. Later, discover the ferry path as a shorter journey home.

No quest acceptance is required to walk this route. No new task tracker or permanent sidebar card is needed.

## Activities and rewards

Fish: add one recognisable valley species with common/fine/rare quality, using existing Patience, Luck and rod requirements. First decide a measured earnings target; then set price, odds and catch time together. Do not make an old rod earn dramatically more gold merely by changing rooms. Keep Silverfin Pond viable for low-level convenience.

Gathering: initially reuse timber to avoid creating a material with no purpose. A distinct valley wood can follow only alongside a usable recipe or upgrade. Existing timber, inventory and sale behaviour must continue to work.

Hunting: one new predator with an observable behaviour, such as circling followed by a warned lunge. It must change how the player responds. Damage and rewards use the existing real-time server combat rules. Do not launch it as a renamed boar with larger HP.

Magic: the watchtower expedition can later provide a clear source of Awakening Stones or mastery for an appropriate Essence. Keep the existing three bonded Essences plus derived Confluence system. No new Rootstone-style parallel power system.

Economy: compare travel-inclusive gold/hour, XP/hour, supply costs, equipment requirements and loss exposure against the current pond and boar loops. Test manual and Auto separately. Increasing distance and danger should offer a meaningful benefit without making all earlier work obsolete.

The hamlet trader can buy ordinary catches locally. Unique upgrades, banking and major services stay in the Tower at first, keeping it socially and economically important. No automatic withdrawals from a player's safe.

## Multiplayer expectations

Shared public exploration, gathering and fishing, retaining the current 20-connection room cap. Personal catches and resource rewards prevent another player taking the last fish. Give fishing stations enough physical space; two spaces around the current post are not a 20-player fishing area.

Manual and Auto players show the same presence, rods, lines, action labels and confirmed result floats. Inventory, bank balances and unrevealed map progress remain private.

Current combat encounters are personal simulations even when avatars share a clearing. Do not present one player's monster as a shared boss. Co-operative bosses and shared threat/loot ownership need a separate design and server implementation.

Offline work currently catches up from saved plans when state is read; it is not a permanently connected simulated avatar. Do not promise offline characters remain visibly present in the world without adding server scheduling and a bounded presence lifecycle.

## Authored world and generation

Author region geography, connections, landmarks, workstations and dangerous encounters. Use deterministic generation for decorative grass, rocks, foliage and cosmetic variation around those authored anchors. Everyone in a region instance sees the same layout.

Validate each generated layout: exits reachable both ways, no blocked workstations, no water shortcuts, no decorative collision traps, and adequate standing space. Persist a versioned seed; never reshuffle a place on reload or invalidate an active route on deployment.

Later expeditions may use seeded interior variations. Keep public roads stable and recognisable. Weather and light are initially cosmetic; announce gameplay effects before introducing them.

## Implementation sequence and completion checks

### 1. Connected river slice

Deliver Reedwater Crossing, Willowbank and Millbrook Hamlet. Include authored scenery, reciprocal connections, fog integration, discovery saving, safe return routes and shared presence. Reuse existing resources initially.

Done when two fresh players can independently walk from the Tower to the hamlet and back, discover only visited areas, fish simultaneously from distinct spots, sell a catch and reload without losing position or discoveries. Check desktop and narrow screens. New areas must not be pre-revealed on old saves.

### 2. Reasons to return

Introduce the valley fish, a local trader and one useful recipe or item. Set reward values from measured current earning rates. Extend Auto fishing to a deliberately selected discovered site, including bait purchases, travel, sales and return. Test gold reserves and offline catch-up.

Done when a player can explain why they would visit the valley instead of the pond and why they might still return to the Tower.

### 3. Choice and danger

Add Sunmeadow, Fangwood, the watchtower exterior and the ferry return loop. Implement one distinct enemy. Safe routes remain usable without combat. Connect Auto risk rules explicitly to the new site and verify survival and retreat decisions.

Done when a player can recognise and avoid the dangerous branch, deliberately take it for a reason, and understand the outcome without reading a long panel.

### 4. Expedition and repeatable life

Build the watchtower interior using existing expedition spoils, recovery and return rules. Add one visible ambient event, such as a travelling trader or a school of fish, only after persistent geometry and economy are reliable. Avoid event-only requirements for essential progression.

Done when repeat visits offer a meaningful choice, the event cannot duplicate rewards, and a party-sized group can share the public approach without losing presence or overlapping unreadable VFX.

## Work that must accompany new room IDs

Current room configuration is spread across client world layouts, collision and public-room sizes, server location validation, world-map positions and region lists, discovery validation, timber key validation, travel graphs and Auto exploration/work assumptions. Inventory fish IDs and sale catalogs also need updates for a new species.

Before adding the river slice, consolidate room identity and region metadata in a shared catalog used by rendering, map fog, server travel, discovery validation and multiplayer. Preserve old IDs. Keep interior instance rules separate from public-region metadata. New map layouts should use shared coordinates rather than another manually duplicated list.

Add tests for bidirectional connectivity, unreachable tiles, new/old save compatibility, frontier-only previews, two-player fishing, manual/Auto consistency, reserve protection, retries and exact-once rewards. Use isolated test characters for live verification.

## Explicitly deferred

New continents, mining implementation, player robbery/PvP, guild territory, shared bosses, unlimited procedural terrain, full-screen survival meters, new quest chains and economy-wide rarity inflation. These can build on a convincing first region later.
