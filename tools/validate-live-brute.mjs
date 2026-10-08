import { Client } from "@colyseus/sdk";
import { WORLD_ROOM } from "@blockcraft/protocol";
import { Block, generateChunk, getBlock, isPlayerSupported, resolvePlayerMotion, worldToChunk } from "@blockcraft/voxel-world";

// Isolated live rooms, disposable guests, no mining or persistent profiles.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const client = new Client("https://block2.asherlevin85.workers.dev/game");
for (const scenario of (process.argv.slice(2).length ? process.argv.slice(2) : ["stationary", "commit-sidestep", "late-sidestep"])) {
  const room = await client.create(WORLD_ROOM, { name: `Timing QA ${scenario}` });
  const started = performance.now();
  const trace = []; const rtts = []; const sentPings = new Map();
  let bootstrap; let sequence = 0; let mode = "travel"; let sideUntil = 0; let reactionAt = Infinity;
  let previousState = ""; let previousCommit = false; let previousSequence = 0;
  let releaseAt = null; let commitmentAt = null; let sawRecoveryEnd = false;
  room.onMessage("*", () => {});
  room.onMessage("world:bootstrap", data => { bootstrap = data; });
  room.onMessage("pong", data => { if (sentPings.has(data.id)) rtts.push(performance.now() - sentPings.get(data.id)); });
  room.onMessage("combat:player-hit", data => {
    const player = room.state.players.get(room.sessionId); const brute = room.state.mobs.get("stone-brute");
    trace.push({ at: Math.round(performance.now() - started), event: "player:hit", ...data,
      playerPose: player && { x: player.x, y: player.y, z: player.z }, brutePose: brute && { x: brute.x, y: brute.y, z: brute.z } });
  });
  room.onMessage("action:rejected", data => trace.push({ event: "rejected", ...data }));
  room.send("world:ready");
  try {
    for (let i = 0; !bootstrap && i < 100; i++) await sleep(50);
    if (!bootstrap) throw new Error("Bootstrap timeout");
    const chunks = new Map(bootstrap.chunks.map(c => [`${c.chunkX},${c.chunkZ}`, { ...c, blocks: Uint8Array.from(c.blocks) }]));
    const read = (x, y, z) => {
      if (y < 0) return Block.Stone;
      const c = worldToChunk(x, z); const key = `${c.chunkX},${c.chunkZ}`;
      if (!chunks.has(key)) chunks.set(key, generateChunk(bootstrap.seed, c.chunkX, c.chunkZ));
      return getBlock(chunks.get(key), c.localX, y, c.localZ);
    };
    let player = room.state.players.get(room.sessionId);
    let brute = room.state.mobs.get("stone-brute");
    if (!player || !brute) throw new Error("Missing actors");
    // Breadth-first collision-aware path through the town gate to the brute.
    const origin = { x: player.x, y: player.y, z: player.z };
    const queue = [{ pose: origin, parent: -1 }]; const visited = new Set(); let found = -1;
    for (let index = 0; index < queue.length && index < 12000; index++) {
      const node = queue[index];
      if (Math.hypot(node.pose.x - brute.x, node.pose.z - brute.z) < 1.7) { found = index; break; }
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = resolvePlayerMotion(node.pose, { x, y: 0, z }, read);
        if (!isPlayerSupported(read, next.x, next.y, next.z) || Math.abs(next.x - node.pose.x - x) > 0.05 || Math.abs(next.z - node.pose.z - z) > 0.05
          || next.x < -18 || next.x > 55 || next.z < -18 || next.z > 55
          // Avoid the crawler/spitter forest during approach; only test the brute.
          || (next.x > 32 && next.z < 29)) continue;
        const key = `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.z)}`;
        if (visited.has(key)) continue;
        visited.add(key); queue.push({ pose: { x: next.x, y: next.y, z: next.z }, parent: index });
      }
    }
    if (found < 0) throw new Error("No walkable route to brute");
    const path = []; for (let i = found; queue[i].parent >= 0; i = queue[i].parent) path.unshift(queue[i].pose);
    let waypoint = 0; let nextSend = 0; let nextPing = 0; let nextProgress = 10000;
    while (performance.now() - started < 90000) {
      const now = performance.now(); const elapsed = Math.round(now - started);
      player = room.state.players.get(room.sessionId); brute = room.state.mobs.get("stone-brute");
      if (elapsed > nextProgress) {
        console.log(JSON.stringify({ progress: scenario, elapsed, position: { x: player.x, y: player.y, z: player.z }, waypoint, target: path[waypoint], ack: player.lastProcessedInput, recentRttMs: rtts.slice(-5).map(Math.round) }));
        nextProgress += 10000;
      }
      if (brute.combatState !== previousState) {
        trace.push({ at: elapsed, event: "state", state: brute.combatState, yaw: brute.yaw, distance: Math.hypot(player.x - brute.x, player.z - brute.z),
          timeline: { startedAt: brute.attackStartedAt, releaseAt: brute.attackReleaseAt, contactAt: brute.attackContactAt,
            contactEndAt: brute.attackContactEndAt, recoveryEndAt: brute.attackRecoveryEndAt } });
        if (brute.combatState === "windup") mode = scenario.includes("far") ? "retreat" : "observe";
        if (releaseAt !== null && previousState === "recover" && brute.combatState !== "recover") sawRecoveryEnd = true;
        previousState = brute.combatState;
      }
      if (brute.aimCommitted !== previousCommit) {
        trace.push({ at: elapsed, event: "committed", active: brute.aimCommitted, yaw: brute.yaw });
        if (brute.aimCommitted && commitmentAt === null) {
          commitmentAt = now;
          if (scenario !== "stationary") reactionAt = now + (scenario === "late-sidestep" ? 200 : scenario.startsWith("walk-") ? 100 : 0);
        }
        previousCommit = brute.aimCommitted;
      }
      if (brute.actionSequence !== previousSequence) {
        trace.push({ at: elapsed, event: "release", yaw: brute.yaw });
        releaseAt ??= now; previousSequence = brute.actionSequence;
      }
      if (now >= reactionAt) {
        trace.push({ at: elapsed, event: scenario === "commit-dodge" ? "dodge-command" : "sidestep-command", player: { x: player.x, y: player.y, z: player.z } });
        if (scenario === "commit-dodge") {
          const angle = brute.yaw * Math.PI / 180;
          room.send("dodge", { requestId: "latency-dodge", strafe: Math.cos(angle), forward: -Math.sin(angle), yaw: player.yaw });
          mode = "observe";
        } else { sideUntil = now + 900; mode = "sidestep"; }
        reactionAt = Infinity;
      }
      if (now >= nextPing) {
        const id = String(sequence + 100000); sentPings.set(id, now); room.send("ping", { id }); nextPing = now + 1000;
      }
      if (now >= nextSend) {
        let x = 0; let z = 0;
        if (mode === "travel") {
          while (path[waypoint] && Math.hypot(player.x - path[waypoint].x, player.z - path[waypoint].z) < 0.65) waypoint++;
          const target = path[waypoint] ?? brute;
          const dx = target.x - player.x; const dz = target.z - player.z; const distance = Math.hypot(dx, dz);
          if (distance > 0.1) { const strength = Math.min(1, distance / 4); x = dx / distance * strength; z = dz / distance * strength; }
        } else if (mode === "sidestep" && now < sideUntil) {
          const angle = brute.yaw * Math.PI / 180; const side = scenario.includes("left") ? -1 : 1;
          x = Math.cos(angle) * side; z = -Math.sin(angle) * side;
        } else if (mode === "retreat") {
          const dx = player.x - brute.x; const dz = player.z - brute.z; const distance = Math.hypot(dx, dz);
          x = dx / Math.max(0.001, distance) * 0.45; z = dz / Math.max(0.001, distance) * 0.45;
        }
        room.send("move", { sequence: ++sequence, strafe: x, forward: z, yaw: Math.atan2(brute.x - player.x, brute.z - player.z) * 180 / Math.PI });
        nextSend = now + 66;
      }
      if (sawRecoveryEnd || (releaseAt !== null && now - releaseAt > 2000)) break;
      await sleep(20);
    }
    console.log(JSON.stringify({ scenario, roomId: room.roomId, rttMs: rtts.map(Math.round), playerHealth: player.health,
      observedRelease: releaseAt !== null, observedRecoveryEnd: sawRecoveryEnd, trace }));
  } finally { await room.leave(); }
}
process.exit(0);
