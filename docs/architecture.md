# Architecture decisions

## Product constraint

Deep world, simple controls. Every technical choice must support fast browser entry, readable top-down play, authoritative multiplayer, and acceptable iPad performance.

## Initial boundaries

The client renders, predicts presentation, and submits intent. It never awards loot, confirms a mined voxel, advances a quest, or decides combat damage.

The server owns players, action validation, voxel mutations, and the active simulation. Colyseus rooms coordinate domain code; room classes must not become the domain implementation.

Shared packages remain narrow:

- `protocol` owns message validation and public payload types.
- `voxel-world` owns deterministic generation, addressing, and block rules.
- Future combat, items, quests, and persistence packages are added only when the vertical slice needs them.

## Deliberately deferred

Redis, multi-region handoff, a content CMS, durable job queues, markets, guilds, narrative engines, ECS adoption, navmeshes, and object storage are not foundation dependencies. Each must be justified by a measured requirement.

## Persistence direction

Generate base chunks from a stable seed. Persist only validated mutations. Introduce compaction after mutation volume is measured. The first milestone may use an in-memory mutation repository, but its interface must make persistence replaceable.

## Performance budgets

Before content expansion, record on a target iPad and an average laptop:

- time to interactive
- frame-time median and p95
- rendered voxel count
- chunk generation time
- chunk payload size
- movement round-trip and correction rate
- mining acknowledgement latency
- memory after ten minutes of traversal
