# Product TODO

## Canonical direction

- **Fast World only:** all new gameplay, art, regions and performance work targets the low-poly Fast World.
- **Voxel migration:** use [the feature migration ledger](archive/voxel-world/feature-migration-ledger.md) as the source of truth. Do not recreate a system until its current logic and target ownership are recorded there.
- **Code separation:** progressively move transferable rules out of the oversized shared client entry point and the legacy `voxel-world` package. Preserve behaviour with focused tests before changing presentation.

## Deferred progression

- **Regional build upgrades:** turn veteran materials into mutually exclusive build choices at the forge without adding a quest panel. Greenwood should offer movement/critical upgrades, Mistfen poison/control, Stoneheart armour/stagger/guard, and Ashen Reach burning/aggression. Announce forge readiness through the event log.

