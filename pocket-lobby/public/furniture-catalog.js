import {HOME_SAFE_PRICE} from './home-safe.js';
export const furnitureCategories={all:'All furniture',comfort:'Comfort',tables:'Tables & seating',decor:'Lights & plants',storage:'Storage'};
export const furnitureCatalog={
 bed:{name:'Single bed',category:'comfort',price:80,size:[2,1],description:'A cream pillow and a midnight-blue blanket. Your first bed is free; buy another for a guest.'},
 sofa:{name:'Velvet sofa',category:'comfort',price:120,size:[2,1],description:'A deep blue sofa made for taking a break between adventures.'},
 chair:{name:'Club chair',category:'comfort',price:60,size:[1,1],description:'A comfortable little seat for your reading corner.'},
 woodStool:{name:'Wooden Stool',category:'tables',price:20,size:[1,1],description:'Simple, sturdy and easy to fit into a small room. You can also craft one with timber.'},
 stool:{name:'Bar stool',category:'tables',price:30,size:[1,1],description:'A soft rose seat on a brass stand. Pull up a stool.'},
 woodTable:{name:'Small Table',category:'tables',price:45,size:[1,1],description:'A natural wood table for a cosy corner. Also craftable at the Timber Hollow workbench.'},
 table:{name:'Coffee table',category:'tables',price:55,size:[1,1],description:'A low wooden table, with a book and a cup already waiting.'},
 lamp:{name:'Floor lamp',category:'decor',price:65,size:[1,1],description:'A warm pool of light for your home, even when Moonwood turns dark.'},
 plant:{name:'Potted palm',category:'decor',price:35,size:[1,1],description:'Bring a little greenery indoors. No watering required.'},
 bookcase:{name:'Bookshelf',category:'storage',price:95,size:[2,1],description:'A tall shelf for stories and keepsakes. Decorative only; also craftable with timber.'},
 safe:{name:'Home safe',category:'storage',price:HOME_SAFE_PRICE,size:[1,1],limit:1,description:'Protect gold, supplies and spare gear. Place it at home and click to open. Auto can save into it while you’re away.'}
};
export function purchaseFurniture(state,id,quantity=1){
 if(!Object.hasOwn(furnitureCatalog,id)||!Number.isSafeInteger(quantity)||quantity<1||quantity>99)throw new Error('Choose a furniture item and a quantity from 1 to 99.');
 if(state.location!=='furnishings')throw new Error('Travel to the physical Tower Furnishings shop to buy furniture.');
 if(state.plan||state.report||state.fishingCast||state.timberCut||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0||state.gambling?.round?.status==='playing')throw new Error('Invalid activity. Take control and finish your activity before shopping.');
 const item=furnitureCatalog[id],owned=state.ownedFurniture?.[id]??0,cost=item.price*quantity;
 if(!Number.isSafeInteger(owned)||owned<0||owned+quantity>(item.limit??1000000))throw new Error(item.limit?'You already own a home safe. Find it in Furniture.':'Invalid furniture quantity. Your inventory is full.');
 if(!Number.isSafeInteger(state.credits)||state.credits<cost)throw new Error('Invalid balance. You need '+cost+' wallet gold for this order.');
 state.credits-=cost;state.ownedFurniture??={};state.ownedFurniture[id]=owned+quantity;
 if(id==='safe')state.safeVersion=1;
 return {id,name:item.name,quantity,cost};
}
