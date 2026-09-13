# Combat validation — 2026-09-13

Combat feel and balance remain **Amber**. This pass expands automated evidence;
it does not replace human playtesting or retune enemy damage, windups or recovery.

## Browser checks

Three local Chromium/Colyseus dungeon scenarios passed without retries. The test
now delays actual WebSocket messages in both directions, including movement,
state replication and effects, instead of delaying only outgoing ability requests.
The connection handshake is unchanged. Outgoing encoding buffers are copied before
delaying because the SDK reuses them. This models fixed latency, not jitter,
packet loss, reconnects or geographically remote hosting.

| Added round-trip delay | Observed cast-to-confirmation times | Accepted / rejected casts |
| --- | --- | --- |
| 0 ms | 73.3, 84.4 ms | 2 / 0 |
| 150 ms | 243.6, 267.9 ms | 2 / 0 |
| 300 ms | 328.8, 398.0 ms | 2 / 0 |

These are individual samples, not latency percentiles. Each scenario verifies
cooldown feedback, one buffered cast, cancellation on blur, insufficient-mana
feedback, the rendered slam-warning radius and the server-driven boss recovery
label. The warning assertion now checks geometry radius multiplied by scale:
pooling changed the geometry layout without changing the intended 4.6 m radius.

Reproduce: `npx playwright test e2e/combat-responsiveness.spec.js --retries=0 --reporter=line`.

## Co-op and impact checks

Authoritative tests verify that an unarmed hit damages the enemy and provokes
aggro, and that dead, invisible or distant attackers cannot monopolize targeting
over a reachable teammate. Existing boss-contact coverage verifies that moving
out during the windup avoids damage. Sound-routing and overlapping-hit tests pass;
they do not judge perceived audio quality or how satisfying impacts feel.

## Eight-player traffic check

One local dungeon, eight clients, ten initial mobs, 60.8 seconds:

- 7,088 messages; 117 messages/second; all clients remained connected.
- Event-loop delay: p99 34.64 ms, maximum 56.26 ms.
- Heap growth: -0.49 MB; existing load-test thresholds passed.
- 448 rejected messages. The fixture sends repeated attack/ability traffic
  without ensuring each request is a legal, in-range combat decision. Rejection
  reasons were not recorded individually in this run.

This is server traffic validation, not rendering performance, successful-hit
throughput or a balanced eight-player fight. It ran after the browser scenarios.

```powershell
$env:DUNGEON_LOAD_DUNGEONS='1'
$env:DUNGEON_LOAD_PARTY_SIZE='8'
$env:DUNGEON_LOAD_DURATION_MS='60000'
node tools/dungeon-load-test.js
```

## Remaining playtest

Use fixed starter gear for solo and four-player sessions lasting 10–15 minutes.
Include melee and ranged roles, ordinary groups, an elite and the first boss.
Record deaths, damage sources, time to kill, resource downtime, intended dodges
that still hit, and target switches. Ask players whether they recognized warnings
and recovery windows without prompting. Repeat under measured real-world latency
and on touch controls. Tune only recurring, attributable problems; the present
automated results do not establish optimal timing or enemy pressure.
