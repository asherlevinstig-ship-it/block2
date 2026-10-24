# Blockcraft Fast World

Blockcraft is a browser-first, fast low-poly multiplayer action RPG inspired by the pace and readability of Realm of the Mad God. The Fast World is the only active product direction.

## Archived voxel game

The final shared-runtime voxel version is preserved permanently at:

- Branch: `archive/voxel-world-final-2026-10-24`
- Tag: `voxel-world-final-2026-10-24`
- Commit: `67c554af`
- Live reference route: `/?legacy=voxel`

Do not add new product work to the voxel experience. Reusable systems are tracked in [the migration ledger](docs/archive/voxel-world/feature-migration-ledger.md) and should be extracted into the Fast World deliberately.

## Current product test

A new player chooses a Calling, learns movement and combat quickly, leaves a readable low-poly Town of Beginnings, crosses fixed-difficulty regions, fights distinct enemy groups and leaders, collects meaningful loot, and develops a build. The loop must remain fluid on laptop and tablet-class hardware.

## Workspace

- `apps/client` - PlayCanvas browser client
- `apps/server` - authoritative Colyseus simulation
- `packages/protocol` - validated network contracts
- `packages/voxel-world` - archived terrain implementation still used temporarily by shared collision and legacy systems; do not expand it
- `docs` - architecture decisions and milestone acceptance criteria

## Commands

```sh
npm install
npm run dev
npm run check
```

The client runs at `http://localhost:5173` and connects to the server at `ws://localhost:2567` by default. The root route opens the Fast World. Use `/?legacy=voxel` only when checking a migration against the archived game.

The server remains authoritative for movement, combat, progression, loot, inventory and multiplayer state. The client predicts presentation and reconciles against acknowledged server input.
