# Milestone 02 - Movement and network feel

## Goal

Make movement dependable before adding combat. Local control must remain responsive while the server stays authoritative, remote players must remain readable under ordinary latency, and interrupted input must fail safe.

## Implemented

- monotonically sequenced movement messages
- server acknowledgement through `lastProcessedInput`
- client correction against the acknowledged predicted position while preserving newer local movement
- hard correction for errors above 1.25 world units and smoothed correction below that threshold
- 100 ms buffered snapshot interpolation for remote players
- movement-facing yaw synchronized through authoritative room state
- a 200 ms server timeout that converts stale held input to idle input
- a 30-message-per-second movement rate limit
- keyboard and joystick reset on browser blur or page visibility loss
- automated checks for prediction errors, facing, snapshot interpolation, 80/150/250 ms delivery spacing, stale inputs, and rate limiting

## Automated acceptance

Run `npm run check`. All movement-network, server-input, collision, world and mining tests must pass, followed by successful production client and server builds.

## Two-client manual acceptance

1. Open the game in two separate browser windows and confirm both players appear.
2. Move each player in all four directions and diagonally; the other window must show continuous motion and the correct facing direction.
3. Hold movement in one window, switch away from it, and confirm the player stops rather than continuing across the world.
4. In browser network tools, repeat with 80 ms, 150 ms, and 250 ms latency. Record visible correction severity and the performance panel RTT.
5. Disconnect and reconnect one window. Confirm the remaining player is unaffected and the returning player receives the authoritative world.

## Physical iPad acceptance

This requires target hardware and remains open until performed there.

1. Test ten minutes on the surface and ten minutes underground.
2. Move with the joystick while pressing Mine with a second finger.
3. Background and restore Safari; movement must reset immediately.
4. Rotate between portrait and landscape and confirm controls remain reachable.
5. Record frame p50/p95, RTT, chunk-build time and memory from the performance panel.
6. Pass when frame p95 remains at or below 33.3 ms, ordinary RTT remains at or below 150 ms, and there is no stuck movement or control overlap.
