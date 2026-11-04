/** A server-owned adventurer used to exercise real player interaction UI. */
export const INTERACTION_TEST_PLAYER_ID = "interaction-test-adventurer";

export const INTERACTION_TEST_PLAYER = Object.freeze({
  id: INTERACTION_TEST_PLAYER_ID,
  name: "Test Adventurer-BOT",
  // Four metres west of the arrival point, directly down the open east-gate
  // road. Keep this on the town-facing side of spawn: the tower portal and
  // its 5.4m-wide plinth sit east of spawn at x=104.5.
  x: 95.5,
  y: 8,
  z: 106.5,
  level: 5,
  health: 4,
  maxHealth: 10,
});

export function isInteractionTestPlayer(playerId: string): boolean {
  return playerId === INTERACTION_TEST_PLAYER_ID;
}
