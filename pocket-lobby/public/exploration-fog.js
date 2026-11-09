export function explorationVisibility({currentRoom,discovered=[],knownRooms=[],rooms=[],exits}){
 const known=new Set([...knownRooms,...discovered,currentRoom].filter(room=>rooms.includes(room))),frontier=new Set();
 for(const room of known)for(const door of exits(room))if(rooms.includes(door.to)&&!known.has(door.to))frontier.add(door.to);
 return {known,frontier,status:room=>known.has(room)?'discovered':frontier.has(room)?'frontier':'hidden'};
}
