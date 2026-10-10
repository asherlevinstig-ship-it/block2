export function lootVisibleToPlayer(ownerId: string | undefined, playerId: string): boolean {
  return !ownerId || ownerId === playerId;
}
