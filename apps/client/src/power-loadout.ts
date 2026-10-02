import {
  MAIN_HAND_DEFINITIONS,
  POWER_DEFINITIONS,
  type MainHandId,
  type PowerDefinition,
  type PowerId,
} from "@blockcraft/protocol";

export function isPowerCompatibleWithMainHand(
  definition: PowerDefinition,
  mainHandId: MainHandId,
): boolean {
  const mainHand = MAIN_HAND_DEFINITIONS[mainHandId];
  return definition.compatibility.includes("universal")
    || definition.compatibility.includes(mainHand.tag);
}

export function compatiblePowerIds(mainHandId: MainHandId): PowerId[] {
  return (Object.keys(POWER_DEFINITIONS) as PowerId[])
    .filter(powerId => isPowerCompatibleWithMainHand(POWER_DEFINITIONS[powerId], mainHandId));
}
