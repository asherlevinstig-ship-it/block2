export function explorationVisibility({currentRoom,discovered=[],knownRooms=[],rooms=[],exits,scout=false}){
 const known=new Set([...knownRooms,...discovered,currentRoom].filter(room=>rooms.includes(room))),frontier=new Set();
 for(const room of known)for(const door of exits(room))if(rooms.includes(door.to)&&!known.has(door.to))frontier.add(door.to);
 if(scout){
  for(const first of exits(currentRoom))if(rooms.includes(first.to))for(const next of exits(first.to))if(rooms.includes(next.to)&&!known.has(next.to))frontier.add(next.to);
 }
 return {known,frontier,status:room=>known.has(room)?'discovered':frontier.has(room)?'frontier':'hidden'};
}
