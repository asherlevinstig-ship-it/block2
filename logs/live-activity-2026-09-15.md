# RPG live activity — 15 September 2026

Times are Asia/Bangkok (UTC+7). Colyseus log timestamps are converted from UTC.

## 15:22 baseline

- Status: deployed and serving traffic; process uptime 4 hours; restarts since deployment 0.
- Load: 8 concurrent users, 1 active room, CPU 4.3%, memory 319 MB.
- Room activity: the latest metrics sample reported 8 clients / 8 players (7 overworld, 1 dungeon), 38 mobs, average tick 2.49 ms, no over-budget ticks, and no wasted mob syncs.
- Persistence: 934 operations, 0 persistence failures; Firestore day totals were 105 reads, 970 writes, 0 deletes, 1 failed call, and 578 locally rejected/deferred operations.
- Player activity: a group of players disconnected normally between 15:21 and 15:22; leave/vitals synchronization completed and the room remained live.
- Incident marker: the application error log recorded repeated `RangeError: Max payload size exceeded` WebSocket receiver errors at approximately 15:16:32, 15:16:41, and 15:17:25. The process did not restart.
- Infrastructure history: older Colyseus tooling output contains `updateProcessConfig`/routing errors and PM2 stop retries from the deployment window. These are not current application crashes, but will be compared against later samples.

### Database monitoring scope

- Firestore exposes cumulative application counters in the live metrics log, so each sample will record reads, writes, deletes, failures, rejections, and interval deltas.
- The application does not currently expose a cumulative MySQL query/billing counter. MySQL usage will therefore be derived from structured activity (question attempts, homework/profile operations) and checked for connection, pool, query, and latency errors. No unavailable total will be estimated as if it were measured.

## 16:08 database usage check

- Load remained steady at 8 concurrent users and 1 active room. CPU was 4.1%, memory 312 MB, uptime 5 hours, and restarts remained 0.
- Firestore totals: 105 reads, 1,116 writes, 0 deletes, 1 failed call, and 578 rejected/deferred operations.
- Change from 15:22: reads +0, writes +146, deletes +0, failed calls +0, rejected/deferred +0 over about 46 minutes.
- Observed write rate: approximately 3.2 writes/minute across eight players, or about 24 writes per player-hour.
- The period included a meteor impact which made 414 world edits. Writes continued in small batches instead of increasing by one write per block, consistent with dirty-region/coalesced persistence working.
- MySQL: no connection, pool, query, or timeout errors appeared in the current log window. Colyseus still exposes no exact cumulative MySQL query count, so a billing-grade MySQL total is unavailable from this dashboard.

## 18:17 monitoring sample (latest metrics 18:16:18)

- Dashboard: 9 concurrent users, 1 room, CPU 5.3%, memory 287 MB, uptime 7 minutes, 0 restarts since the new deployment. The expired dashboard stream was refreshed for this sample.
- Deployment occurred at 18:09:52–18:09:56. PM2 force-killed the old process after its 1.6-second stop timeout. New process remains online; this is a deployment transition, not evidence of a crash loop.
- New incidents: at 17:48:51 an oversized WebSocket message disconnected a client; an HTTP bug report succeeded three seconds later. At 18:10:16–18:10:18, seven visible shard-main-already-active exceptions occurred during new world initialization. The new room subsequently served 9 players continuously in the available minute samples. No later occurrence appears in the retrieved tail.
- Current persistence: 64 operations, 0 failures; Firestore process counters reads 665, writes 85, deletes 0, failedCalls 1, rejected 1. Tick average 2.32 ms, maximum 30.17 ms, over-budget ticks 0; 7 overworld and 2 other-dimension players, 26 mobs.
- Counters reset on deployment despite retaining the same day label. Last old-process metrics at 18:09:14: reads 112, writes 1943, deletes 0, failedCalls 1, rejected 782, persistence ops 1880/failures 0. Compared with the preceding recorded 16:08 sample, old-process increments were +7 reads, +827 writes, +0 failed calls, +204 rejections; adding observed new-process counters gives lower bounds of +672 reads, +912 writes, +1 failed call, +205 rejections, +0 deletes. Activity between the last old sample and termination is unmeasured.
- New-process 18:11:18–18:16:18 interval: +0 reads, +69 writes, +0 failed calls, +1 rejection over 5 minutes with 9 connected players: 13.8 writes/minute, approximately 92 writes per connected-player-hour. Includes startup/world activity and is not a steady-state player cost estimate. Startup reports 104902 restored world edits, 10 furnaces, 6 teams, and regional migration deferred until the Pacific quota reset. The 665 startup reads and new failed call warrant follow-up; no explicit RESOURCE_EXHAUSTED line is visible in this tail.
- MySQL: no cumulative query/billing counter exposed. In the new-process tail, no explicit Recall attempts, homework saves, authentication/profile-read events, query/pool/connectivity failures, or slow-query evidence are visible; these are observed counts of zero in a limited tail, not whole-interval totals. Repeated room.path.request events remain visible (same requested/current path); they do not establish database query counts. Player vitals merges appear in the old tail. No explicit mining failure appears in the retrieved window; successful mining cannot be verified from these metrics.

## 18:48 final afternoon summary

- End state: the application was online with 9 concurrent users and 1 active room. CPU was 7.7%, memory 289 MB, process uptime 37 minutes, and the dashboard reported 0 restarts. Peak directly observed load during the monitoring samples was 10 connected players.
- The post-deployment process stayed up from approximately 18:10 through the end of monitoring. Resource use remained stable (roughly 274–319 MB memory and 3.5–7.7% CPU across observed samples), with no crash loop and no persistence failures.
- A second overworld-room initialization occurred around 18:25. Between 18:25:25 and 18:25:31, several `shard main is already active` exceptions were logged before room `6MGxBkl__` successfully started. The room restored 104,784 world edits, 10 furnaces, 1 gate, and 6 teams. Regional world-edit migration timed out after 12 seconds and was deferred until the Pacific quota reset. This did not restart the application process, but the repeated room-creation contention remains an unresolved reliability warning.
- Final room metrics at 18:46:31 showed 10 clients / 10 players, 368 persistence operations with 0 failures, an average tick of 2.65 ms, a maximum tick of 65.88 ms, and 0 over-budget ticks. No server-side mining error was visible in the inspected tail.
- Firestore counters for the final room segment moved from reads 667 / writes 34 / failed 1 / rejected 0 at 18:26 to reads 668 / writes 382 / failed 1 / rejected 101 at 18:46. That is +1 read, +348 writes, and +101 locally rejected/deferred operations over 20 minutes at roughly 10 players: 17.4 writes/minute or about 104 writes per connected-player-hour. These figures include world and meteor persistence, so they are not a pure per-player gameplay cost.
- A meteor event at 18:41 generated 421 world edits. The application continued batching persistence successfully. A brief outbound spike at 18:39 (about 249 KB/s total, 237 KB/s for the peak client) coincided with clients dropping from 10 to 9 and recovering; no `Max payload size exceeded` error followed it.
- Exact whole-afternoon Firestore totals cannot be reconstructed because counters reset at deployment and the write/rejection counters restarted again when the room was recreated. Measured segments show +827 old-process writes from 16:08 to 18:09, then at least 85 writes in the first post-deploy room and 382 in the final room: at least 1,294 additional observed writes after 16:08, excluding gaps. The large 665-read startup value and the deferred migration remain the main quota concerns.
- No additional `Max payload size exceeded` error was found after the known 17:48:51 incident. No Firestore `RESOURCE_EXHAUSTED`, MySQL connectivity/query error, slow-query warning, explicit Recall/homework event, or explicit mining failure appeared in the available final log tail.
- Overall: the server finished the afternoon healthy and stable under 9–10 users, but the room-creation race (`shard main is already active`), high startup reads, and growing rejected/deferred Firestore-operation count should be treated as follow-up issues. The oversized WebSocket incident was not observed again after 17:48, but one afternoon without recurrence is not enough to prove the payload fix complete.
