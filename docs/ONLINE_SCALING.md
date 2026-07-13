# Online Scaling Runbook

Blockcraft scales online play by keeping each simulation room small and explicit:

- Overworld rooms are shards. Set `BLOCKCRAFT_SHARD_MAX_CLIENTS=16` in production unless a load test proves a higher cap.
- Dungeon rooms are raid instances. They stay capped at 8 players.
- Clients should join `blockcraft` with a `shardId` (`main`, `shard-2`, `shard-3`, ...). If a shard is full, try the next shard.
- Dungeon transitions should return the player to the same overworld `shardId` they came from.

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
