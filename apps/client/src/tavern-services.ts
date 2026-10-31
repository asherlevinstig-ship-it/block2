export interface TavernBounty {
  id: string;
  title: string;
  objective: string;
  reward: string;
}

const TOWER_BOUNTIES: readonly TavernBounty[] = [
  { id: "root-wardens", title: "Break Both Seals", objective: "Defeat the North and South Root Wardens", reward: "Two leader caches · Calling upgrades" },
  { id: "lost-cache", title: "Lost Rampart Cache", objective: "Clear the guarded cache on either outer route", reward: "Personal equipment bag · gold" },
  { id: "crownkeeper", title: "Crownkeeper Hunt", objective: "Open the eastern court and defeat the Floor 1 boss", reward: "Crown Fragment · boss equipment roll" },
  { id: "clean-route", title: "Supply Run", objective: "Return with both Warden caches before facing the boss", reward: "More resources for the final fight" },
  { id: "party-call", title: "Adventurer's Call", objective: "Help another explorer break a Warden seal", reward: "Shared victory credit · personal loot" },
] as const;

function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

export function rotatingTavernBounties(date = new Date()): readonly TavernBounty[] {
  const start = ((dayNumber(date) % TOWER_BOUNTIES.length) + TOWER_BOUNTIES.length) % TOWER_BOUNTIES.length;
  return [0, 1, 2].map(offset => TOWER_BOUNTIES[(start + offset * 2) % TOWER_BOUNTIES.length]!);
}
