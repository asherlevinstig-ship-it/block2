export function dragonSummonHint({owned,adult,realmAllowed,mountedDragon,touch=false}) {
  if(!owned||mountedDragon)return '';
  if(touch){
    if(!adult)return 'Your dragon is growing · Open Menu → Dragon Bonds to view growth';
    if(!realmAllowed)return 'Return to the overworld or Taming Land · then use Menu → Call Dragon';
    return 'Open Menu → Call Dragon to summon & ride';
  }
  if(!adult)return 'Your dragon is growing · Press B to view growth';
  if(!realmAllowed)return 'Return to the overworld or Taming Land · then press X to ride';
  return 'Press X to summon & ride your dragon';
}
