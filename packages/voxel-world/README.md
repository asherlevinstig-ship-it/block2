# Archived voxel-world package

This package contains the deterministic voxel terrain implementation from the retired Blockcraft voxel game.

Status: **frozen transitional dependency**.

The active Fast World still imports some movement constants, collision helpers, encounter positions and line-of-sight utilities from this package. Those dependencies are migration work, not permission to add new Fast World content here.

Rules:

1. Do not add new regions, buildings, discoveries, quests or visual assets here.
2. Compatibility fixes must preserve the archived route and include a focused test.
3. Transferable rules should move to a presentation-neutral package or a Fast World module.
4. Voxel meshing, block mutation, procedural chunk generation and free-digging remain archived.

See `docs/archive/voxel-world/feature-migration-ledger.md` for ownership and migration status.
