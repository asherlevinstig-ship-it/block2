# Milestone 01 - Diggable hill

## Goal

Prove that the defining interaction is readable, authoritative, persistent-ready, and viable on desktop and iPad before rebuilding broader game content.

## Acceptance criteria

1. The client loads directly into an elevated top-down voxel scene.
2. A protected spawn area and mineable wilderness are visually distinct.
3. Two clients can join one room and see authoritative player positions.
4. Nearby chunks are deterministic for a world seed.
5. The client requests mining; the server validates range, protection, and block existence.
6. An accepted mutation is broadcast to every client exactly once.
7. A reconnect receives the current chunk mutation state.
8. The player can expose and enter a shallow underground space.
9. Camera cutaway and lighting keep the player readable underground.
10. Desktop and iPad performance measurements are recorded.

## Out of scope

Accounts, classes, quests, crafting UI, inventories, enemies, markets, guilds, housing, procedural biomes, Redis, and production persistence.

## Current scaffold status

- deterministic 16 x 16 x 24 chunks
- shared Zod message contracts
- authoritative movement and mining room
- cursor-based voxel selection with a visible range-aware target
- revision-aware mining requests and stale-state recovery
- exposed-voxel chunk rebuilding after synchronized mutations
- interpolated remote-player avatars with authoritative local correction
- unit tests for generation, addressing, protection, ray traversal, and action validation
- server-simulated gravity, voxel collision, falling, and one-block stepping
- nine nearby bootstrap chunks surrounding protected spawn
- guaranteed mine-through entrance, descending tunnel, and shallow underground chamber east of spawn
- local prediction driven by the same voxel-motion rules as the authoritative server
- underground roof cutaway, depth feedback, reduced sunlight, and an explorer lantern
- development-only `?qa=cave` spawn for repeatable underground visual checks
- optional live performance panel with frame p50/p95, FPS, RTT, visible voxels, mesh/triangle counts, chunk-build time, payload size, and browser memory
- responsive floating joystick and large contextual Mine control for coarse-pointer/tablet layouts
- current PlayCanvas `Mesh.fromGeometry` construction without deprecated mesh helpers

## Provisional performance budgets

- frame-time p95: at most 33.3 ms
- movement/mining round-trip: at most 150 ms on the local development network
- nine-chunk rebuild: at most 250 ms
- no overlap between the HUD, safe areas, joystick, and Mine control at 768 x 1024

## Recorded development sample

Local desktop browser using a 768 x 1024 iPad portrait viewport, underground QA spawn, one connected player:

- frame time: 6.1 ms p50 / 6.2 ms p95
- approximate FPS: 164
- local Colyseus RTT: 1 ms
- visible voxels: 17,411
- meshes / triangles: 45 / 28,880
- nine-chunk build: 18.8 ms
- bootstrap payload: 109 KB

This is a layout and instrumentation result, not a physical-iPad benchmark. Milestone criterion 10 remains open until the same panel is sampled on target iPad hardware for ten minutes on both the surface and underground.
