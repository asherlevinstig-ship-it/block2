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

export function selectRecipeForOutput(recipes,outputId,describe=()=>({}),currentRecipe=null){
  const candidates=recipes.filter(recipe=>recipe&&recipe.out&&recipe.out[0]===outputId);
  if(candidates.length<2)return candidates[0]||null;
  const rank=recipe=>{
    const state=describe(recipe)||{},missing=Array.isArray(state.missing)?state.missing.length:0;
    return [
      currentRecipe===recipe?0:1,
      state.ready?0:1,
      state.locked?1:0,
      missing?1:0,
      state.needsTable?1:0,
      Number.isFinite(state.missingCount)?state.missingCount:missing,
      -Math.max(1,recipe.out[1]|0),
    ];
  };
  return candidates.map((recipe,index)=>({recipe,index,rank:rank(recipe)})).sort((a,b)=>{
    for(let i=0;i<a.rank.length;i++)if(a.rank[i]!==b.rank[i])return a.rank[i]-b.rank[i];
    return a.index-b.index;
  })[0].recipe;
}
