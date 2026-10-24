# Architecture decisions

## Product constraint

Fast world, deep builds, simple controls. Every technical choice must support quick Realm-of-the-Mad-God-style movement, readable low-poly combat, authoritative multiplayer, and acceptable tablet performance.

## Active and archived runtimes

The Fast World is canonical and owns all new product development. The root URL opens it.

The voxel game is frozen at Git tag `voxel-world-final-2026-10-24` and is available only at `/?legacy=voxel` for comparison and migration checks. Frozen means:

- no new regions, quests, UI, art or balance work is added to the voxel presentation;
- reusable gameplay rules are extracted or adapted according to the migration ledger;
- `packages/voxel-world` may receive only compatibility fixes required to keep a transferable shared system working while it is extracted;
- visual or terrain-specific bugs in the archived route are documented, not allowed to redirect current development.

## Initial boundaries

The client renders, predicts presentation, and submits intent. It never awards loot, confirms a mined voxel, advances a quest, or decides combat damage.

The server owns players, action validation, voxel mutations, and the active simulation. Colyseus rooms coordinate domain code; room classes must not become the domain implementation.

Shared packages remain narrow:

- `protocol` owns message validation and public payload types.
- `voxel-world` is a transitional legacy dependency. New Fast World terrain, collision and navigation rules must not be added there.
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
