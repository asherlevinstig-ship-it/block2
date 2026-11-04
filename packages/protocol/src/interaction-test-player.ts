/** A server-owned adventurer used to exercise real player interaction UI. */
export const INTERACTION_TEST_PLAYER_ID = "interaction-test-adventurer";

export const INTERACTION_TEST_PLAYER = Object.freeze({
  id: INTERACTION_TEST_PLAYER_ID,
  name: "Test Adventurer-BOT",
  x: 102.5,
  y: 8,
  z: 106.5,
  level: 5,
  health: 4,
  maxHealth: 10,
});

export function isInteractionTestPlayer(playerId: string): boolean {
  return playerId === INTERACTION_TEST_PLAYER_ID;
}
