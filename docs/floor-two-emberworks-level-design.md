# Floor 2 — The Emberworks

## Level-design objective

The Emberworks is an abandoned industrial forge that once powered the tower. It must feel like a coherent working place rather than scenery arranged around combat encounters.

The floor teaches one idea—**control the forge before it overwhelms you**—then develops it through navigation, enemies, two regulator encounters and the Forgeheart Colossus.

Target first-clear duration: **18–24 minutes**.  
Target repeat-clear duration: **11–15 minutes**.  
Recommended level range: **4–8**.

## World footprint

Floor 2 should be wider than Floor 1 without becoming empty.

- Proposed bounds: `x 410–542`, `z 42–170` (132 × 128 metres).
- Entry vestibule: west centre at approximately `416, 106`.
- Cooling hub: `458, 106`.
- North regulator: `480, 70`.
- South regulator: `480, 142`.
- Crucible gate: `501, 106`.
- Forgeheart arena: `525, 106`, 16-metre combat radius.
- Ascent portal: behind the boss at approximately `538, 106`.

This footprint is deliberately separate from the existing Floor 1 bounds. All authoritative terrain, collision, encounters and rendering must derive from one shared Floor 2 manifest.

## Critical route

```text
                             [SCRAP VAULT]
                                  │
                    ┌── BELLOWS GALLERY ──┐
                    │   Furnace Regulator │
                    │                     ▼
[ENTRY] → [INTAKE HALL] → [COOLING HUB] → [CRUCIBLE GATE] → [FORGEHEART] → [ASCENT]
                    │                     ▲
                    │   Quench Regulator  │
                    └── QUENCHWORKS ──────┘
                                  │
                           [COOLANT CACHE]
```

Both branches loop forward into the Crucible approach. Players never need to retrace the entire branch. The Cooling Hub remains visible or signposted from both routes.

## Area-by-area plan

### 1. Entry Vestibule — orientation, not combat clutter

- A broad 12-metre arrival platform with the return portal behind the player.
- The player initially faces the distant Forgeheart chimney and Crucible gate.
- No enemies or props inside the first 10 metres.
- Floor title, objective and two regulator icons appear without opening a modal.
- A one-way pressure door prevents enemies from entering the spawn point.
- Eight seconds of arrival protection prevents portal camping; attacking ends it early. This is protection, not a Floor 2 safe zone.
- The doorway frames the Intake Hall, making the first destination unmistakable.

### 2. Intake Hall — teach the forge cycle

Purpose: teach one hazard in a forgiving room.

- A 20 × 16-metre rectangular combat hall.
- Two Ember Hounds create movement pressure; one Shard Sentry occupies a raised but reachable platform.
- One floor vent cycles through **dark → orange glow → sparks → eruption → cooldown**.
- The first eruption deals modest damage and visibly harms enemies too.
- Cover is waist-high and positioned along the edges, never across the main route.
- Clearing the room opens a heavy pressure door into the Cooling Hub.

### 3. Cooling Hub — navigation anchor

Purpose: let players read the entire floor and choose an order.

- A circular 24-metre chamber containing a dormant turbine.
- North and south regulator pipes are visibly dark before activation and glow blue afterward.
- The sealed Crucible gate is visible directly east from the first entrance.
- Large physical signs read `BELLOWS`, `QUENCHWORKS` and `CRUCIBLE`.
- A central status machine shows `REGULATORS 0/2`, then `1/2`, then `CRUCIBLE OPEN`.
- The room has three broad exits, each at least 5 metres wide.
- No decorative collision in the central movement ring.

This hub eliminates dependence on the minimap. A player who closes the UI can still understand the floor.

### 4A. North branch — Bellows Gallery

Fantasy: dry heat, chains, piston machinery and blast furnaces.

#### Gallery traversal

- A long 7-metre-wide catwalk with three piston lanes.
- Pistons are rhythmic obstacles with obvious sound and light warnings, not random instant damage.
- Side alcoves provide recovery space and ranged sightlines.
- Falling into the machinery returns the player to the latest alcove with damage; it never kills through an unrecoverable void.

#### Pressure encounter

- Two Cinder Imps attack from alternating balconies.
- One Furnace Knight advances through the centre.
- Players can pull a lever to pause the pistons for six seconds, creating a combat advantage rather than merely solving a switch puzzle.

#### Furnace Regulator — The Bellows Beast

- Arena: 22-metre oval with four edge vents and an unobstructed centre.
- The Bellows Beast inhales, pulls players inward, then releases a directional flame blast.
- During the inhale, exposed cooling plates on its back can be broken.
- Activating the regulator floods the room with cool air, finishes the encounter and creates the forward return route.

#### Optional Scrap Vault

- A short side room visible before the regulator, never hidden behind arbitrary wall searching.
- Contains one elite Furnace Knight and a guaranteed crafting-material chest.
- The room rejoins the branch before the boss arena.

### 4B. South branch — Quenchworks

Fantasy: cooling canals, steam, dripping iron and blue-white furnace light.

#### Channel traversal

- Alternating dry platforms and shallow coolant channels.
- Coolant does not slow ordinary movement; it extinguishes the temporary Burning condition.
- Steam jets cross the route at readable intervals.
- A valve rotates one bridge into place, opening both the main route and a shortcut back to the hub.

#### Control encounter

- One Chain Warden tries to hold players near steam vents.
- Two Cinder Imps attack from floor level, not unreachable scenery.
- Opening a coolant valve converts two damaging steam vents into temporary healing mist zones.

#### Quench Regulator — The Molten Jailer

- Arena: 22-metre circular quench basin with four dry islands joined by broad bridges.
- The Jailer throws chains that telegraph where they will land.
- A chained player can cut the chain or have an ally break it.
- At low health, the Jailer heats two islands; coolant valves restore them one at a time.
- Activating the regulator quenches the Jailer, completes the encounter and opens the forward route.

#### Optional Coolant Cache

- A compact challenge reached from the bridge mechanism.
- Rewards a consumable that reduces heat damage for the remainder of the run.
- The path rejoins before the regulator; it is not a dead end requiring a long walk back.

### 5. Crucible Approach — payoff and preparation

- Both branch routes meet on opposite sides of the Crucible gate.
- The gate displays both regulator symbols and clearly identifies any missing objective.
- When both regulators activate, pipes illuminate from the branches to the gate, machinery starts, and the door opens with a short in-world celebration.
- A preparation platform before the boss gives 12 metres of clear space for regrouping, upgrades and inventory use.
- The boss is visible through the opening, but cannot attack the preparation platform.

### 6. Forgeheart Arena — final examination

- A 32-metre circular arena with a cold centre, four furnace quadrants and a readable outer ring.
- The camera always has clear sightlines; columns are outside the central combat radius.
- No stairs, railings or decorative collision inside the fighting area.

#### Phase 1 — Awaken the machine

- The Forgeheart Colossus teaches slow hammer arcs and targeted molten lines.
- Players use the open centre to learn its reach.

#### Phase 2 — Control the furnaces

- At 65% health, two furnace quadrants activate.
- Players close one exposed valve after avoiding its guardian attack.
- The boss remains vulnerable; the interaction changes positioning rather than pausing combat.

#### Phase 3 — The forge overloads

- At 30% health, the outer ring heats in rotating sections.
- The Colossus combines a charge with falling slag markers.
- Correctly baiting the charge into a coolant pipe staggers it and creates the strongest damage opening.

On defeat, the furnaces darken, the room cools from orange to blue, the ascent portal ignites and the boss shell remains as a visible trophy for the remainder of the room instance.

## Navigation and collision rules

These rules are non-negotiable because they directly address Floor 1's earlier usability failures.

- Main combat lanes: minimum **6 metres** wide.
- Doors and gates: minimum **5 metres** clear width.
- Optional-route entrances: minimum **4 metres** clear width.
- Stairs use an authoritative walkable ramp; visual steps never provide collision individually.
- Every staircase, bridge and lift must end on a playable platform with at least 6 metres of landing depth.
- No required jump greater than ordinary step height.
- Props stay at least 1.5 metres away from the critical path.
- Walls use joined modular segments with corner pieces; no visible gaps into the void.
- Invisible barriers may only follow visible walls, railings or machinery.
- Hazard volumes and their visual effects use the same shared coordinates.
- Each branch includes a forward exit and a shortcut; no long mandatory backtracking.

## Encounter pacing

1. **0–1 minute:** orientation and visual promise.
2. **1–3 minutes:** tutorial fight and first hazard.
3. **3–5 minutes:** hub choice and route planning.
4. **5–10 minutes:** first branch and regulator.
5. **10–15 minutes:** second branch with increased mechanical complexity.
6. **15–17 minutes:** gate opening, upgrade choice and preparation.
7. **17–24 minutes:** Forgeheart encounter and reward.

The floor should never deliver more than two mandatory combat rooms without a navigation, discovery or reward beat.

## Art composition

- Entry palette: black iron, dim amber and distant red furnace light.
- Bellows palette: orange, soot black and hot white highlights.
- Quenchworks palette: dark iron, cyan coolant and white steam.
- Boss palette: all previous colours combined, then cooled blue after victory.
- Large silhouettes first: chimney, turbine, furnace doors, suspended chains and the Colossus.
- Medium storytelling props second: broken carts, ingot racks, tools and worker stations.
- Small clutter last and only along room edges.
- Smoke should rise toward ceiling vents, establishing believable airflow instead of uniform particles everywhere.

## Reuse and new asset requirements

Existing systems/assets that should be reused:

- Ember Hound, Cinder Ram and Shard Sentry archetypes as foundations.
- KayKit dungeon walls, gates, stairs and columns.
- Existing portal, boss HUD, Warden progression, hold-E and floor-upgrade systems.
- Existing cinder/forge VFX as a starting point, recoloured per area.

New authored pieces required:

- Modular furnace wall and door.
- Large turbine and two visual regulator assemblies.
- Piston, chain and valve props with simple animations.
- Coolant canal and steam-vent materials.
- Bellows Beast, Molten Jailer and Forgeheart Colossus visual variants.
- Floor 2 minimap silhouette and signage set.

## Performance budget

- At most three active enemy groups at once; distant rooms remain sleeping.
- One shared particle pool for sparks, smoke, steam and embers.
- Maximum two real-time shadow-casting forge lights per loaded room.
- Animated machinery sleeps outside the player's neighbouring room.
- Repeated walls, pipes, chains and railings use instancing.
- Water/coolant uses one simple scrolling material without reflections.
- Boss arena assets preload while the second regulator is active, not during the gate-opening moment.

## Completion criteria

Floor 2 is not ready merely because it can be traversed. It is ready when:

- A new player can identify both branch goals and the boss gate without opening the map.
- Every route can be traversed without snagging on decorative collision.
- No staircase, bridge, door or visual wall contradicts authoritative physics.
- The two branches feel mechanically and visually different.
- All hazards have readable warning, active and recovery states.
- The room resets cleanly after being empty for five seconds.
- PvP cannot produce unavoidable spawn kills at the entry portal.
- A repeat player can complete the critical route without forced backtracking.
- The Forgeheart fight tests mechanics introduced earlier on the same floor.
- The floor maintains its frame-time and entity budgets with a full party present.

## Implementation order

1. Shared Floor 2 manifest, bounds, room graph and ground-height contract.
2. Greybox only: entry, Intake Hall, hub, both loops, gate and boss arena.
3. Collision/navigation tests and a full no-combat traversal.
4. Encounter volumes, sleeping rules and reset behaviour.
5. Furnace-cycle hazard and regulator interactions.
6. Regular enemies and branch bosses.
7. Forgeheart encounter.
8. Art-kit replacement, lighting, VFX and audio.
9. Minimap, signage, objective messaging and rewards.
10. Multiplayer, PvP-spawn and performance validation.

No detailed decoration should begin before the greybox passes navigation and collision review.
