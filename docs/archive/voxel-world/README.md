# Voxel World archive

The voxel game was frozen on 24 October 2026 before the Fast World became Blockcraft's canonical experience.

## Permanent recovery points

- Git branch: `archive/voxel-world-final-2026-10-24`
- Git tag: `voxel-world-final-2026-10-24`
- Snapshot commit: `67c554af`
- Live comparison route: `https://block2.asherlevin85.workers.dev/?legacy=voxel`

The branch and tag contain the complete shared runtime at the freeze point, including the voxel overworld, caves, dungeons, mining, regional encounters, progression, multiplayer systems and the early Fast World work.

## Working rule

The archive is a reference library, not a second roadmap. When a feature is wanted in the Fast World:

1. locate it in the migration ledger;
2. preserve its tested game rule, not its voxel presentation;
3. move neutral logic into an appropriate shared or Fast World module;
4. rebuild visuals, navigation and terrain interaction for low-poly geometry;
5. update the ledger with the new owner and validation result.

Never copy the entire old runtime back into the active path. That would recreate the coupling this archive is intended to end.
