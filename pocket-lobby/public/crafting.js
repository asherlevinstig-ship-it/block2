export const craftingRecipes={
  woodStool:{name:'Wooden Stool',cost:5,description:'A simple wooden seat for your home.'},
  woodTable:{name:'Small Table',cost:10,description:'A compact table with a natural wood finish.'},
  bookcase:{name:'Bookshelf',cost:15,description:'A freestanding shelf with room for books and keepsakes.'}
};
export function isAtWorkbench(state){
  if(state.location!=='logging'||!state.position)return false;
  const {x,y}=state.position;
  return Number.isInteger(x)&&Number.isInteger(y)&&Math.max(5-x,0,x-6)+Math.abs(y-3)===1;
}
export function craftFurniture(state,id){
  if(!Object.hasOwn(craftingRecipes,id))throw new Error('Choose a known recipe.');
  if(!isAtWorkbench(state)||state.plan)throw new Error('Visit the workbench in Timber Hollow to craft.');
  const recipe=craftingRecipes[id],wood=state.woodcutting,owned=state.ownedFurniture?.[id]??0;
  if(!wood||!Number.isSafeInteger(wood.timber)||wood.timber<recipe.cost)throw new Error('You need '+recipe.cost+' timber for this recipe.');
  if(!Number.isSafeInteger(owned)||owned<0||owned>=1000000)throw new Error('Your furniture inventory is full.');
  state.ownedFurniture??={};wood.timber-=recipe.cost;state.ownedFurniture[id]=owned+1;
  return {name:recipe.name,cost:recipe.cost};
}
