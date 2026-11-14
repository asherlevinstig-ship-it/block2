import {furnitureBox,validRoomTile} from './shared-world.js';

export function showBreakInRoom(doc,visit){
 const dialog=doc.createElement('dialog');
 dialog.className='game-window';
 dialog.innerHTML='<div class="modal-head"><h2 id="breakInRoomTitle"></h2><button type="button" class="close" aria-label="Return to lobby">×</button></div><p class="break-in-clock"></p><p>Use the arrow keys or select an adjacent floor tile to explore.</p><div class="break-in-floor" aria-label="Room floor"></div><p role="status"></p><button type="button" class="primary">Return to lobby</button>';
 dialog.setAttribute('aria-labelledby','breakInRoomTitle');
 const title=dialog.querySelector('h2');title.textContent=visit.owner+'’s room';
 const floor=dialog.querySelector('.break-in-floor');
 floor.style.cssText='display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:2px;width:min(420px,72vw);';
 const boxes=visit.furniture.map(furnitureBox);
 const tiles=[];
 for(let y=0;y<10;y++)for(let x=0;x<10;x++)tiles.push({x,y});
 const open=({x,y})=>validRoomTile('home',x,y,boxes);
 let pos=tiles.filter(open).sort((a,b)=>Math.abs(a.x)+Math.abs(a.y-5)-Math.abs(b.x)-Math.abs(b.y-5))[0];
 const clock=dialog.querySelector('.break-in-clock'),status=dialog.querySelector('[role=status]');
 let timer;
 function close(){dialog.close();}
 function move(tile){
  if(Date.now()>=visit.until){close();return;}
  if(!pos||!open(tile)||Math.abs(tile.x-pos.x)+Math.abs(tile.y-pos.y)!==1)return;
  pos=tile;render();status.textContent='Moved to column '+(pos.x+1)+', row '+(pos.y+1)+'.';
 }
 function render(){
  for(const [i,tile] of tiles.entries()){
   const tileButton=floor.children[i];
   const here=pos?.x===tile.x&&pos?.y===tile.y;
   const boxIndex=boxes.findIndex(box=>tile.x<box.x+box.w&&tile.x+1>box.x&&tile.y<box.y+box.d&&tile.y+1>box.y);
   const item=visit.furniture[boxIndex];
   tileButton.textContent=here?'●':item?'▣':'·';
   tileButton.disabled=!pos||!open(tile)||Math.abs(tile.x-pos.x)+Math.abs(tile.y-pos.y)!==1;
   tileButton.style.background=here?'#665321':item?'#43334a':'#233050';
   tileButton.setAttribute('aria-label',here?'Your position':item?.type??'Floor '+(tile.x+1)+', '+(tile.y+1));
   tileButton.title=item?.type??'';
  }
 }
 for(const tile of tiles){
  const button=doc.createElement('button');button.type='button';
  button.style.cssText='aspect-ratio:1;padding:0;min-width:0;min-height:0;';
  button.onclick=()=>move(tile);floor.append(button);
 }
 dialog.addEventListener('keydown',event=>{
  const step={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[event.key];
  if(step&&pos){event.preventDefault();move({x:pos.x+step[0],y:pos.y+step[1]});}
 });
 for(const button of dialog.querySelectorAll('.close,.primary'))button.onclick=close;
 dialog.addEventListener('close',()=>{clearInterval(timer);dialog.remove();},{once:true});
 function tick(){
  const seconds=Math.ceil((visit.until-Date.now())/1000);
  if(seconds<=0){close();return;}
  clock.textContent=seconds+' seconds before you return to the lobby';
 }
 if(visit.until<=Date.now())return;
 doc.body.append(dialog);render();dialog.showModal();tick();timer=setInterval(tick,250);
}
