export function dragonSummonHint({owned,adult,realmAllowed,mountedDragon}) {
  if(!owned||mountedDragon)return '';
  if(!adult)return 'Your dragon is growing · Press B to view growth';
  if(!realmAllowed)return 'Return to the overworld or Taming Land · then press X to ride';
  return 'Press X to summon & ride your dragon';
}
