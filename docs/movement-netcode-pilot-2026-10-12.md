# Movement netcode pilot — 2026-10-12

## Initial pilot scope

`apps/server/src/movement-netcode-pilot.test.ts` defines a test-only Colyseus room. It is not registered by the production server and does not alter live movement or combat. It uses our existing `resolvePlayerMotion` voxel collision solver with a 30 Hz fixed input step.

## What the pilot proved

- Colyseus 0.18 `defineInput`, `setFixedTimestep`, SDK `room.input`, and `Predict.reconciler` work together with our voxel collision function.
- Prediction moves the local pose immediately, even when outbound input packets are held for 150 ms; authority remains still until they arrive and the two positions then converge in this simple case.
- A buffered east/east/north/north/stop sequence preserves turn order and reaches the same endpoint as applying the same voxel steps directly.

The test is deterministic except for one real-time delay case. Run it with `npm run test -w @blockcraft/server -- movement-netcode-pilot.test.ts`.

## What it did not prove

- The live client's feel, including camera and animation, on a real 150–350 ms round trip with jitter or packet loss.
- Behavior on stairs, mining edits, dungeon room transfer, wall-adjacent turns, or server load.
- A direct measured improvement over the current production input/replay implementation. The direct voxel-step baseline in this test is not a complete production-network A/B comparison.
- Combat hit validation or lag compensation. Those are separate from movement prediction and must remain server-authoritative.

## Initial recommendation

The library is a viable replacement for the custom input acknowledgement/replay layer, not our collision solver. The original recommendation was to keep it opt-in until room transfer and real-client checks passed. That rollout is described below.

## Development-only world shadow (next step)

The real world room can run a read-only Colyseus input stream alongside legacy movement. Open the local development client with `?movementShadow=1`. The Move Debug panel reports the shadow-to-authority distance plus rolling p50/p95 over 300 samples. The shadow uses the actual room's blocks, player speed modifiers, gravity and voxel collision; it never changes the player position, hit validation, or combat. Legacy movement remains in control for that local comparison.

Both paths share a 30 Hz fixed room clock because Colyseus only permits one simulation timer per room. The shadow consumes one input per tick while legacy holds its latest input; distance between them is therefore a diagnostic, **not** a score proving one feels better. Teleports or large scripted moves reset the shadow when divergence exceeds 8 m.

To compare under latency, throttle the entire local browser connection to 100, 200, and 350 ms RTT with jitter, run the same route and stop/turn patterns, and copy Move Debug at each setting. Do not use delay on the shadow stream alone: that would give the two paths unequal network conditions. The shadow A/B route is local-development only.

## Opt-in Colyseus-controlled movement

Colyseus `room.input()` sends one command per fixed tick, `Predict.reconciler()` moves the local character, and the server applies the same shared voxel movement step to the authoritative player. Legacy movement messages and client replay are bypassed only for that player. Move Debug opens automatically and says `COLYSEUS CONTROLS` when the handshake succeeds. Without that label, the pilot did not activate.

## Default rollout

After hands-on acceptance of the opt-in pilot, Colyseus is now the default movement path for new connections in both the overworld and Silver Depths. The shared voxel collision solver remains authoritative on the server. The `?movementPilot=1` local URL still works but is no longer needed. For a local legacy comparison use `?movementLegacy=1`; `?movementShadow=1` retains the read-only comparison. Set `MOVEMENT_NETCODE_LEGACY=1` on the server for a rollback; clients then continue with legacy movement if no Colyseus handshake arrives. Older clients also remain on the legacy path during a staged rollout.

Verification: the real local browser loaded default Colyseus movement, moved and stopped, loaded the separate Silver Depths room, refreshed there without losing position, and stopped against its solid boundary. Existing tests cover the overworld-to-dungeon transfer message; a new room integration test covers dungeon movement plus clearing queued input on disconnect/reconnect. Typechecks, all tests, and production builds passed. Still monitor camera feel, stairs, mining, dodge/powers, and real 100–350 ms jitter after deployment; these are not proven by the local smoke test.
