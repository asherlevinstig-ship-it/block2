export function explorationVisibility({currentRoom,discovered=[],knownRooms=[],rooms=[],exits,scout=false}){
 const known=new Set([...knownRooms,...discovered,currentRoom].filter(room=>rooms.includes(room))),frontier=new Set();
 for(const room of known)for(const door of exits(room))if(rooms.includes(door.to)&&!known.has(door.to))frontier.add(door.to);
 const scouted=new Set();
 if(scout){
  const depth=scout===3?3:2,visited=new Set([currentRoom]);
  let layer=[currentRoom];
  for(let step=0;step<depth;step++){
   const next=[];
   for(const room of layer)for(const {to} of exits(room)){
    if(!rooms.includes(to)||visited.has(to))continue;
    visited.add(to);next.push(to);
    if(!known.has(to)){scouted.add(to);frontier.add(to);}
   }
   layer=next;
  }
 }
 return {known,frontier,scouted,status:room=>known.has(room)?'discovered':frontier.has(room)?'frontier':'hidden'};
}
