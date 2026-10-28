export function crownGateStatus(northAlive: boolean, southAlive: boolean) {
  const remaining = Number(northAlive) + Number(southAlive);
  return {
    remaining,
    title: remaining ? `Crownkeeper Court · ${remaining} ${remaining === 1 ? "seal" : "seals"} remaining` : "Crownkeeper Court · OPEN",
    detail: remaining === 2 ? "Defeat both Root Wardens to break the seals."
      : remaining === 1 ? `Defeat the ${northAlive ? "North" : "South"} Root Warden to break the final seal.`
        : "Both seals broken. Walk through to face the Crownkeeper.",
  };
}
