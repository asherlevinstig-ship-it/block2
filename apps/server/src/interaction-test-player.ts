import { INTERACTION_TEST_PLAYER } from "@blockcraft/protocol";
import { PlayerState } from "./schema.js";

export const INTERACTION_TEST_PLAYER_RESET_MS = 5_000;

export function createInteractionTestPlayerState(): PlayerState {
  const player = new PlayerState();
  Object.assign(player, {
    x: INTERACTION_TEST_PLAYER.x,
    y: INTERACTION_TEST_PLAYER.y,
    z: INTERACTION_TEST_PLAYER.z,
    yaw: 270,
    name: INTERACTION_TEST_PLAYER.name,
    level: INTERACTION_TEST_PLAYER.level,
    health: INTERACTION_TEST_PLAYER.health,
    maxHealth: INTERACTION_TEST_PLAYER.maxHealth,
    stamina: 100,
    maxStamina: 100,
    mainHandId: "longsword",
    mainHandTag: "melee",
    armourId: "wanderer_robes",
    equippedTrait: "momentum",
    appearanceSkin: "deep",
    appearanceHair: "silver",
    appearanceCoat: "rust",
    appearanceHairStyle: "spiked",
    appearanceCoatStyle: "explorer",
    huntLoadoutsJson: JSON.stringify({ interactionTestPlayer: true }),
    invulnerableUntil: Number.MAX_SAFE_INTEGER,
  });
  return player;
}

export function resetInteractionTestPlayerState(player: PlayerState): void {
  player.x = INTERACTION_TEST_PLAYER.x;
  player.y = INTERACTION_TEST_PLAYER.y;
  player.z = INTERACTION_TEST_PLAYER.z;
  player.health = INTERACTION_TEST_PLAYER.health;
  player.stamina = player.maxStamina;
  player.defending = false;
}
