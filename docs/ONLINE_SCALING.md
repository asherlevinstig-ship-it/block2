# Online Scaling Runbook

Blockcraft production uses one persistent global overworld simulation:

- The `main` overworld has no player-count matchmaking cap. Its interest filtering keeps distant entities out of each client's replication view.
- The single-writer persistence lease still blocks a second `main` room; removing the player cap does not permit competing world simulations.
- Dungeon rooms are raid instances. They stay capped at 8 players.
- Clients join `blockcraft` with `shardId: main`, and dungeon transitions return them to that world.
- Load tests may set `BLOCKCRAFT_TEST_SHARD_MAX_CLIENTS` while `BLOCKCRAFT_E2E=1` to exercise bounded-room overflow without imposing that policy in production.

## Release Checks

Run these before releasing online/session changes:

```sh
npm test
npm run test:load:shards
npm run test:load:dungeons
npm run test:soak:online
```

`npm run test:soak:online` is the closest local production shape: 32 users, 4 overworld shards, 2 full dungeon parties, dungeon traffic, then return-to-shard.

## Production Metrics

Enable the JSON metrics endpoint explicitly:

```sh
BLOCKCRAFT_METRICS=1
BLOCKCRAFT_METRICS_TOKEN=<long random token>
```

Then fetch:

```sh
curl -H "Authorization: Bearer $BLOCKCRAFT_METRICS_TOKEN" https://your-host.example/__metrics
```

In production, the endpoint refuses to serve without `BLOCKCRAFT_METRICS_TOKEN`.

## Production Storage

Local JSON storage is fine for development and these load tests. For hosted production, use Firebase-backed storage:

```sh
STORE=firebase
FIREBASE_SERVICE_ACCOUNT=<service account JSON>
```

or configure `GOOGLE_APPLICATION_CREDENTIALS` to point at the service-account file.

Watch:

- `totals.clients`, `shards[].clients`, `dungeons[].clients`
- `eventLoop.p99Ms`
- `rooms[].tickMaxMs` and `rooms[].tickOverBudget`
- `totals.persistenceFailures`
- `memory.heapUsedMb` and `memory.rssMb`
- `totals.rejectedMessages`

Healthy local baseline from the mixed soak is roughly 32 clients, 407 msg/s, event-loop p99 around 36 ms, no unexpected leaves, and low heap growth.
