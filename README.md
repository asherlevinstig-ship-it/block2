# Blockcraft

Blockcraft is restarting as a browser-first, top-down voxel multiplayer RPG.

The old game is preserved in the Git branch `codex/backup-current-game-2026-09-29`. This branch intentionally begins with a small technical foundation instead of carrying the old runtime forward.

## First product test

One player can leave a protected town, enter mineable wilderness, dig into a hill, descend into a readable cave, fight one enemy, collect iron, and return to craft a better pickaxe. Then the same loop must work with two players and on iPad.

## Workspace

- `apps/client` - PlayCanvas browser client
- `apps/server` - authoritative Colyseus simulation
- `packages/protocol` - validated network contracts
- `packages/voxel-world` - deterministic chunks and voxel rules
- `docs` - architecture decisions and milestone acceptance criteria

## Commands

```sh
npm install
npm run dev
npm run check
```

The client runs at `http://localhost:5173` and connects to the server at `ws://localhost:2567` by default.

In the first playable slice, use WASD to move, point at a nearby voxel, and press E or left-click to mine. The server validates distance, spawn protection, block existence, and chunk revision before broadcasting the mutation.

Other connected players appear as blue explorers. Their movement is interpolated from authoritative room state; rejected local movement is reconciled to the last server position.
