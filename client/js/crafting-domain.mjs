export function recipeFootprint(recipe){
  if(recipe.shapeless)return recipe.shapeless.length<=4?2:3;
  return Math.max(recipe.shape.length,...recipe.shape.map(row=>row.length));
}
export function ingredientCounts(ids){
  const counts=new Map();
  for(const id of ids)counts.set(id,(counts.get(id)||0)+1);
  return counts;
}
export function shapedIngredientIds(recipe){
  const ids=[];
  for(const row of recipe.shape)for(const ch of row)if(ch!=='.'&&ch!==' ')ids.push(recipe.keys[ch]);
  return ids;
}
export function recipeNeedCounts(recipe){return ingredientCounts(recipe.shapeless||shapedIngredientIds(recipe));}
