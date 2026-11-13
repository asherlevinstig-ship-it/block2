import {furnitureCatalog,furnitureCategories} from './furniture-catalog.js';
export function initializeFurnitureShop(cloud,document,window){
 const get=id=>document.getElementById(id),dialog=get('furnitureShopDialog');
 let category='all',selected='sofa',rotation=0,busy=false;
 const state=()=>window.towerFurnitureState?.()??cloud.initial;
 function stock(id){const s=state(),owned=s.ownedFurniture?.[id]??0,placed=(s.homeFurniture??[]).filter(item=>item.type===id).length;return {owned,placed,bag:Math.max(0,owned-placed)};}
 function render(){
  if(!dialog.open)return;
  const s=state();get('furnitureWallet').textContent=s.credits.toLocaleString()+' gold';
  get('furnitureDelivery').textContent='Tower Furnishings showroom · Purchases go straight to your inventory.';
  const filters=get('furnitureFilters');filters.replaceChildren();
  for(const [id,name] of Object.entries(furnitureCategories)){const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(category===id));b.onclick=()=>{category=id;get('furnitureShopStatus').textContent='';const first=Object.keys(furnitureCatalog).find(key=>id==='all'||furnitureCatalog[key].category===id);if(id!=='all'&&furnitureCatalog[selected].category!==id)selected=first;rotation=0;render();};filters.append(b);}
  const grid=get('furnitureProducts');grid.replaceChildren();
  for(const [id,item] of Object.entries(furnitureCatalog)){
   if(category!=='all'&&item.category!==category)continue;
   const b=document.createElement('button'),art=document.createElement('span'),name=document.createElement('b'),price=document.createElement('strong'),owned=document.createElement('small');b.type='button';b.dataset.furniture=id;b.setAttribute('aria-pressed',String(id===selected));b.setAttribute('aria-label',item.name+', '+item.price+' gold');art.className='furniture-card-art';const image=window.towerFurnitureThumbnail?.(id);if(image)art.append(image);name.textContent=item.name;price.textContent=item.price+' gold';owned.textContent=stock(id).owned?'Owned ×'+stock(id).owned:'Not owned';b.append(art,name,price,owned);b.onclick=()=>{selected=id;rotation=0;get('furnitureQuantity').value=1;get('furnitureShopStatus').textContent='';render();if(window.matchMedia?.('(max-width:580px)').matches)get('furniturePreview').scrollIntoView({block:'start',behavior:'smooth'});};grid.append(b);
  }
  const item=furnitureCatalog[selected],counts=stock(selected);
  get('furnitureItemName').textContent=item.name;get('furnitureItemCategory').textContent=furnitureCategories[item.category];get('furnitureItemDescription').textContent=item.description;
  get('furnitureFootprint').textContent=item.size.join(' × ')+' floor tiles · Rotatable';
  get('furnitureOwned').textContent='Owned '+counts.owned+' · In room '+counts.placed+' · In bag '+counts.bag;
  const stage=get('furniturePreview');stage.replaceChildren();const preview=window.towerFurniturePreview?.(selected,rotation);if(preview)stage.append(preview);
  get('furnitureRotate').disabled=busy;get('furnitureQuantity').max=item.limit??99;if(item.limit)get('furnitureQuantity').value=1;
  get('furniturePlace').hidden=!counts.bag;get('furniturePlace').disabled=busy||s.blocked;get('furniturePlace').textContent=s.location==='home'?'Place in my room':'Take it home';
  updatePurchase();
 }
 function updatePurchase(){
  const s=state(),item=furnitureCatalog[selected],q=Number(get('furnitureQuantity').value),cost=item.price*q,counts=stock(selected),limited=!!item.limit&&counts.owned>=item.limit,allowed=s.location==='furnishings',valid=Number.isSafeInteger(q)&&q>=1&&q<=Math.min(item.limit??99,99)&&counts.owned+q<=(item.limit??1000000);
  get('furnitureCost').textContent=Number.isFinite(cost)?cost.toLocaleString()+' gold':'—';get('furnitureBuy').textContent=limited?'Already owned':!allowed?'Visit Tower Furnishings':'Buy '+(q>1?q+' items':'item')+' · '+(valid?cost.toLocaleString():'—')+' gold';
  get('furnitureBuy').disabled=busy||s.blocked||limited||!valid||(allowed&&s.credits<cost);get('furnitureQuantity').disabled=busy||limited;
  get('furnitureBuyHint').textContent=limited?'One per adventurer. Find yours in Inventory → Furniture.':s.blocked?'Take control and finish your activity before shopping.':!valid?'Choose a quantity from 1 to '+(item.limit??99)+'.':allowed&&s.credits<cost?'You need '+(cost-s.credits).toLocaleString()+' more wallet gold.':'Delivered to Inventory → Furniture. Pick up placed items to reuse them.';
 }
 function open(id){if(state().location!=='furnishings'){window.towerFurnitureVisit?.(id);return;}if(Object.hasOwn(furnitureCatalog,id)){selected=id;category='all';}rotation=0;get('furnitureQuantity').value=1;get('furnitureShopStatus').textContent='';if(!dialog.open)dialog.showModal();render();}
 get('furnitureShopClose').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 get('furnitureQuantity').oninput=updatePurchase;
 get('furnitureRotate').onclick=()=>{rotation=(rotation+1)%4;render();};
 get('furniturePlace').onclick=()=>{if(!busy)window.towerFurniturePlace?.(selected);};
 get('furnitureBuy').onclick=async()=>{
  if(busy||get('furnitureBuy').disabled)return;
  if(state().location!=='furnishings'){window.towerFurnitureVisit?.();return;}
  const id=selected,quantity=Number(get('furnitureQuantity').value),item=furnitureCatalog[id];busy=true;render();get('furnitureShopStatus').textContent='Placing your order…';
  try{window.towerPauseForAccount?.();const packet=await cloud.gameplay('buyFurniture',{id,quantity});window.towerApplyBankState?.(packet.state);get('furnitureShopStatus').textContent='Purchased '+quantity+' × '+item.name+' · Find it in Inventory → Furniture.';window.towerFurnitureFeedback?.(item.name,quantity,item.price*quantity);}
  catch(error){get('furnitureShopStatus').textContent=error.message;}
  finally{busy=false;render();}
 };
 return {open,render,close:()=>{if(!busy)dialog.close();}};
}
