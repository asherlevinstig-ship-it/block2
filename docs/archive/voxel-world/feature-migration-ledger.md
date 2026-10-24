# Voxel World feature migration ledger

This is the source of truth for moving useful systems from the archived voxel game into the canonical Fast World.

## Status key

- **LIVE** — already functions in the Fast World; preserve and harden it.
- **EXTRACT** — useful game logic exists but is coupled to the voxel runtime; separate it before extending it.
- **REBUILD** — retain the design and player value, but re-author presentation or navigation for low-poly geometry.
- **HOLD** — keep for a later milestone; do not pull it into current work yet.
- **RETIRE** — intentionally remains only in the archive.

## Foundations and player systems

| System | Status | Existing owner/reference | Fast World action | Validation required |
|---|---|---|---|---|
| Authoritative Colyseus rooms | LIVE | `apps/server/src/game-room.ts` | Split domain systems out of the room without changing authority | Two clients agree on movement, combat and loot |
| Profile persistence and character saves | LIVE | `apps/server/src/player-save.ts` | Keep save compatibility; add an explicit save version before schema divergence | Existing and new profiles load safely |
| Input prediction, acknowledgements and reconciliation | LIVE | `apps/client/src/main.ts`, movement modules, `apps/server/src/movement-shadow.ts` | Keep as presentation-neutral movement infrastructure | High-latency traversal has no hard corrections |
| Movement diagnostics and performance logs | LIVE | client movement/performance modules | Retain for solo testing; add Fast World region and collision-source fields | Logs identify input, server, collision and rendering faults |
| Keyboard, mouse and tablet controls | LIVE | tablet/input/camera modules in `apps/client/src` | Continue Roblox-style touch iteration against the same actions | Laptop and emulated tablet complete onboarding |
| Character creation and appearance | LIVE | protocol appearance schema and client creation UI | Replace voxel body-only assumptions with low-poly rig slots | Appearance survives reconnect and equipment changes |
| Camera modes | LIVE | `apps/client/src/camera-view.ts`, camera modules | Tune third-person as primary; keep first-person optional | No clipping or lost aiming across town and combat |
| Calling selection | LIVE | protocol build paths, client Calling UI, server validation | Keep six Callings; make previews and unlock communication Fast World-native | New player always chooses once and understands first unlock |
| Calling abilities and loadouts | LIVE | protocol ability definitions and server ability handlers | Preserve mechanics; continue ability-specific animation and VFX passes | Power and Special match title, role and hotbar state |
| Character levels and stat choices | LIVE | protocol progression rules and server progression | Keep progression, simplify presentation and pacing | Level-up never blocks combat and points remain spendable |
| Inventory, equipment comparison and capacity | LIVE | protocol item rules and client inventory modules | Keep logic; finish low-poly worn-gear attachment | Only owned items appear and equip state is unambiguous |
| Loot bags, hold-to-pickup and expiry | LIVE | protocol loot rules and client loot modules | Keep Fortnite-style hold interaction and world-space presentation | No click pickup, duplication or lingering collected loot |
| Potions and utility slots | LIVE | protocol potion/utility rules | Preserve compact hotbar behaviour | Keyboard and touch activation agree with server state |
| Blacksmith, forging and equipment affixes | EXTRACT | protocol recipes; server blacksmith/forge modules | Move spatial checks away from voxel coordinates; rebuild station interaction in Fast Town | Buy, dismantle, forge and reroll work at low-poly stations |
| Storage chest | EXTRACT | client storage UI and server storage rules | Replace voxel landmark coordinates with Fast Town entity anchors | Storage is persistent and cannot be used remotely |

## Combat and enemies

| System | Status | Existing owner/reference | Fast World action | Validation required |
|---|---|---|---|---|
| Main-hand combos and directional attacks | LIVE | protocol weapon definitions, client attack aiming, server strike sampling | Preserve server hit rules and improve low-poly animation contact | Swing faces aim and hits only valid targets |
| Dodge pressure, stamina and perfect counter | LIVE | protocol dodge rules and client/server dodge modules | Keep fixed difficulty and readable timing | Circling alone is insufficient against leaders |
| Guard, parry and Tank ally protection | LIVE | Calling handlers and Tank VFX | Preserve directional guard-zone design | Allies behind Tank receive intended protection |
| Projectiles, near misses and telegraphs | LIVE | projectile, ranged feedback and enemy cue modules | Decouple ray tests from voxel readers into scene collision queries | Telegraphs match actual impact lanes |
| Mob awareness, line of sight and pursuit memory | EXTRACT | server awareness/navigation modules | Replace voxel raycasts with Fast World obstacle queries | Mobs cannot see through buildings and do not become invisible/stale |
| Mob spacing, formations and assist calls | LIVE | server spacing/coordination modules | Keep behavioural logic independent of model art | Groups surround and cooperate without stacking |
| Area leaders, followers and exposed windows | LIVE | area mini-boss and boss HUD modules; Fast World ID adapter in `area-mini-bosses.ts` | Greenwood now reuses archived phases, follower openings and leader rewards; extend the same adapter region by region | Solo under-level kills are difficult; team roles matter |
| Boss phases and named attacks | LIVE | boss pattern/pressure modules | Continue region-specific animation, audio and VFX | Every major attack has a readable label and counterplay |
| Static regional difficulty | LIVE | Fast World region definitions and server spawns | Keep levels fixed; never scale down to the player | Region danger is predictable and promotes parties |
| Respawn rhythm | LIVE | wilderness respawn rules and Fast World spawn data | Keep 40-second minimum with higher-level increases | Cleared spaces remain clear long enough to breathe |
| Enemy art and animation | REBUILD | client mob-art and low-poly asset loaders | Replace voxel silhouettes with rigged low-poly archetypes incrementally | Walk, turn, attack, hurt and defeat all animate correctly |

## World, exploration and content

| System | Status | Existing owner/reference | Fast World action | Validation required |
|---|---|---|---|---|
| Town of Beginnings functions | REBUILD | Fast Town asset kit plus archived town interaction rules | Keep service layout and onboarding value; use low-poly prefabs and entity anchors | Town is readable, spacious and visually coherent |
| Greenwood, Mistfen, Quarry and Ashen region identities | LIVE | Fast World region/scenery modules and server rapid-world spawns | Deepen terrain, props, roads, encounters and boundaries | Each region is recognizable without reading its label |
| Regional roads and density discoveries | REBUILD | archived roadside encounter and role-opportunity modules | Re-author carts, shrines, caches, clashes and clearings as Fast World entities | Major roads offer discoveries without extra quest HUD |
| Minimap and fog of war | REBUILD | client minimap modules | Render low-poly world data, discovered entities and region shapes instead of voxel sampling | Map matches actual roads, terrain and markers |
| Dynamic guidance and distance markers | LIVE | objective guidance and Fast World region badge | Keep proximity-based guidance; avoid central combat overlays | Guidance appears only when useful and never covers combat |
| Event log and quick chat | LIVE | client social UI and protocol quick-chat phrases | Preserve event history and no-typed-chat design | Players online, location and meaningful events remain readable |
| Parties, trading and nearby players | EXTRACT | server party/trading modules and client panels | Keep rules; replace voxel distance/landmark assumptions where present | Two-player Fast World session completes invite, trade and combat |
| Realm events and hunts | HOLD | realm event/hunt modules | Reintroduce only after regional free-roam loop is strong | Event adds movement and cooperation without HUD overload |
| Silver Depths and Ember Vault | HOLD | dungeon rooms, portals and expedition modules | Preserve layouts/rewards as design references; rebuild spaces with low-poly scenes | Instanced party flow works without voxel chunk dependencies |
| Freeform mining and block destruction | RETIRE | `packages/voxel-world`, mining handlers and chunk mutations | Do not migrate as a world-wide mechanic; consider authored resource nodes or limited destructibles later | No hidden dependency blocks Fast World removal of voxel chunks |
| Procedural voxel terrain and chunk meshing | RETIRE | `packages/voxel-world`, client chunk renderer | Keep only in archive; Fast World uses authored low-poly terrain and explicit streaming | Active client no longer renders voxel meshes |
| Voxel cave cutaway and cell fog | RETIRE | client cutaway/cave discovery modules | Replace only if a future low-poly dungeon needs room-based visibility | No Fast World code depends on voxel slice height |
| Voxel town buildings and scene dressing | RETIRE | voxel generator and client scene dressing | Use licensed low-poly asset kits instead | Archived visuals never appear in Fast World |

## Presentation and operations

| System | Status | Existing owner/reference | Fast World action | Validation required |
|---|---|---|---|---|
| HUD, hotbar and popup queue | LIVE | client HUD and popup modules | Continue compact action-first HUD; one interactive popup at a time | No overlap at supported resolutions |
| Ability, combat and loot VFX | REBUILD | calling particles and feedback modules | Keep timing contracts; replace voxel-shaped effects with grounded particles, decals and low-poly impacts | Each ability has a distinct silhouette and satisfying impact |
| Audio feedback | EXTRACT | client combat audio calls | Build a Fast World sound library keyed to existing semantic events | Attack, hit, pickup, level and boss cues are distinct |
| Low-poly asset libraries | LIVE | `apps/client/public/assets` and asset loaders | Track licences, source, scale, pivots, animation compatibility and fallback status | No silent fallback for required production models |
| Graphics quality and presentation budgets | LIVE | graphics-quality and performance modules | Tune for Fast World assets and tablet-class GPU limits | Stable frame pacing during group combat |
| Cloudflare client deployment and Colyseus backend | LIVE | root deployment scripts and connection endpoint module | Keep one canonical live URL and health check | Root URL loads Fast World and matchmaking succeeds |

## Migration order

1. **Separate naming and entry routes** — Fast World is default; voxel is explicit legacy only. Completed 24 October 2026.
2. **Extract neutral foundations** — movement/collision interfaces, player saves, combat queries, items and progression.
3. **Move spatial gameplay to entity anchors** — town services, LOS, minimap, discoveries, portals and interaction ranges.
4. **Rebuild content presentation** — low-poly mobs, terrain, VFX, dungeons and regional landmarks.
5. **Remove active voxel runtime dependencies** — stop building and shipping voxel generation/meshing after all required rows are LIVE, REBUILT or consciously RETIRED.

Update this ledger in the same commit whenever a migration changes status or ownership.
