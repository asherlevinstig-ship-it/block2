'use strict';
// World map dialog, the Shops directory and teacher travel. Part of game.js: a classic script that shares its scope and loads before it.
// Only declarations live here.
function showTeacherTravel(shops){
  const panel=$('teacherTravel');
  panel.hidden=shops||window.playerCloud?.isTeacher!==true;
  if(panel.hidden)return;
  const select=$('teacherTravelDestination'),previous=select.value;
  select.replaceChildren();
  const prompt=document.createElement('option');
  prompt.value='';prompt.textContent='Choose any location';select.append(prompt);
  for(const [id,room] of Object.entries(roomDetails).sort((a,b)=>a[1].name.localeCompare(b[1].name))){
    const option=document.createElement('option');option.value=id;option.textContent=room.name;
    option.disabled=id===currentRoom;select.append(option);
  }
  select.value=previous===currentRoom?'':previous;
  $('teacherTravelStatus').textContent=depthsRun?'Leaving the dungeon by teleport ends the current run.':'';
  const button=$('teacherTravelGo');button.disabled=!select.value;
  select.onchange=()=>{button.disabled=!select.value;};
  button.onclick=async()=>{
    const room=select.value;if(!room||room===currentRoom)return;
    button.disabled=true;select.disabled=true;
    $('teacherTravelStatus').textContent='Travelling…';
    try{
      const state=await serverGameplayTeacherTeleport(room);
      $('hudMapDialog').close();
      window.towerApplyRoutineState(state,{handoff:true});
      note('Arrived at '+roomDetails[state.location].name+'.');
      canvas.focus({preventScroll:true});
    }catch(error){$('teacherTravelStatus').textContent=error.message;}
    finally{select.disabled=false;button.disabled=!select.value||select.value===currentRoom;}
  };
}
async function serverGameplayTeacherTeleport(room){
  if(serverActionBusy)throw new Error('Wait for the current action.');
  serverActionBusy=true;
  route=[];step=null;interaction=null;target=null;
  player.x=player.cx;player.y=player.cy;
  try{return await window.playerCloud.teacherTeleport(room);}
  finally{serverActionBusy=false;}
}
// What each Tower shop is for, in the order a new player needs them.
const shopDirectory=[['store','Buy bait and rods'],['market','Sell fish, timber and hunting spoils'],['armory','Buy weapons'],['bakery','Buy bread and rations'],['tailor','Buy outfits and clothing'],['furnishings','Buy furniture, lighting and storage'],['library','Read skill books']];
function showShopDoor(room){
  if(currentRoom===room){canvas.focus({preventScroll:true});return;}
  setExplorationDestination(room);
  const name=roomDetails[room].name.replace(/^The /,'');
  if(nextExplorationDoor())note(currentRoom==='hub'?'The highlighted door leads to '+name+'.':'Follow the highlighted exit to reach '+name+'.',4200);
  else showHudMap(room);
  canvas.focus({preventScroll:true});
}
function showHudMap(destination=null){
  const dialog=$('hudMapDialog'),routes=$('hudMapRoutes'),shops=destination==='shops';
  if(destination&&destination!=='shops'&&!mapRouteVisible(destination))destination=null;
  const next=destination&&!shops?hudNextDoor(destination):null;
  $('hudMapTitle').textContent=shops?'Tower shops':'World map';
  showTeacherTravel(shops);
  $('mapTrailStatus').textContent='';
  const moonButton=$('mapMoonSight');moonButton.hidden=shops||familiarState.equipped!=='owl'||!canScoutHere();moonButton.disabled=!!familiarSeconds()||unavailable();moonButton.textContent=familiarSeconds()?'Moon Sight · '+familiarSeconds()+'s':'Moon Sight';
  $('hudMapIntro').textContent=shops
    ?(lobbyRoutesOpen()?'Choose a shop to highlight the door that leads to it.':'Talk to the Tower Warden to open the shop doors.')
    :next?'To reach '+mapPlaceName(destination)+', start with '+mapPlaceName(next.to)+'.'
    :depthsRun?'Use the chamber controls to bank your spoils or go deeper.'
    :currentRoom==='hub'&&!lobbyRoutesOpen()?'Talk to the Tower Warden to open the lobby doors.'
    :destination?'There’s no open route to '+roomDetails[destination].name+' from here.':'Choose an open exit from this room.';
  routes.replaceChildren();
  const add=(label,action,highlight=false)=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=label;
    button.classList.toggle('route-next',highlight);
    button.onclick=()=>{dialog.close();action();};
    routes.append(button);
    return button;
  };
  dialog.dataset.mode=shops?'shops':'map';
  if(shops&&lobbyRoutesOpen()){
    for(const [room,purpose] of shopDirectory){
      if(room!==currentRoom&&!hudRoute(room).length)continue;
      const detail=document.createElement('small');
      detail.textContent=room===currentRoom?'You are here':purpose;
      add(roomDetails[room].name.replace(/^The /,''),()=>showShopDoor(room)).append(detail);
    }
  }else if(!shops){
    for(const door of hudRoomExits(currentRoom))add(mapPlaceName(door.to)+(worldMapVisibility().frontier.has(door.to)?' · Explore':''),()=>followHudDoor(door),door.to===next?.to);
  }
  const picker=$('mapDestination');
  picker.replaceChildren();
  $('mapPlanner').hidden=shops||!!depthsRun;
  const placeholder=document.createElement('option');
  placeholder.value='';placeholder.textContent='Select a place';
  picker.append(placeholder);
  for(const [region,rooms] of Object.entries(explorationRegions)){
    const group=document.createElement('optgroup');group.label=region;
    for(const room of rooms){
      if(!hudNextDoor(room)||!mapRouteVisible(room)&&!moonRouteToShare(room).length)continue;
      const option=document.createElement('option');
      option.value=room;option.textContent=(moonRouteToShare(room).length?explorationName(room):mapPlaceName(room))+(worldMapVisibility().frontier.has(room)?' · Explore':'');
      group.append(option);
    }
    if(group.children.length)picker.append(group);
  }
  const preferred=destination&&!shops?destination:trackedDestination;
  picker.value=preferred&&hudNextDoor(preferred)&&mapRouteVisible(preferred)?preferred:'';
  previewMapRoute();
  if(!dialog.open)dialog.showModal();
  updateSharedTrailList();
}
function renderWorldMap(route=[]){
  const positions={...ashenMapPositions,[overlookRoom]:[445,1280],[waystationRoom]:[285,1215],crystaldeep:[60,145],quarry:[60,220],...watchMapPositions,...willowmereMapPositions,millCellar:[590,806],home:[100,55],library:[345,30],hub:[340,110],armory:[265,48],market:[465,48],bakery:[550,129],tailor:[180,70],furnishings:[435,145],lounge:[580,75],store:[118,133],
    outside:[340,205],trail:[340,315],logging:[107,288],clearing:[109,380],[wildlifeRoom]:[514,411],grove:[563,274],shrine:[563,354],
    creek:[338,423],pond:[138,497],ruins:[340,549],roots:[549,493],depthsGate:[340,120],depthsGallery:[340,120],depthsCache:[340,120],depthsTreasury:[340,120],depthsRest:[340,120],depthsTrial:[340,120],depthsVault:[340,120]};
  const rooms=Object.keys(positions).filter(room=>roomDetails[room]&&(room===currentRoom||hudNextDoor(room)));
  const fog=worldMapVisibility(),scouting=moonTrailActive()||familiarScoutMapActive();
  const sharedEdges=new Set(),sharedPlaces=new Set();
  for(const trail of roomMoonTrails.filter(openMoonTrail)){
    let from=trail.room;
    for(const to of trail.route){
      sharedPlaces.add(to);sharedEdges.add([from,to].sort().join('|'));from=to;
    }
  }
  let links='',nodes='',clearings='';
  const linked=new Set();
  const routeEdges=new Set(route.map((door,index)=>[index?route[index-1].to:currentRoom,door.to].sort().join('|')));
  for(const room of rooms){
    const [x,y]=positions[room],status=sharedPlaces.has(room)&&!fog.known.has(room)?'frontier':fog.status(room);
    if(status==='hidden')continue;
    clearings+='<ellipse cx="'+x+'" cy="'+y+'" rx="'+(status==='discovered'?105:54)+'" ry="'+(status==='discovered'?62:45)+'" fill="black"/>';
    for(const door of hudRoomExits(room)){
      const key=[room,door.to].sort().join('|'),shared=sharedEdges.has(key);
      if(!rooms.includes(door.to)||!shared&&(fog.status(door.to)==='hidden'||status!=='discovered'&&!fog.known.has(door.to)&&!(scouting&&fog.scouted.has(room)&&fog.scouted.has(door.to))))continue;
      if(linked.has(key))continue;linked.add(key);
      const [dx,dy]=positions[door.to];links+='<path class="'+(routeEdges.has(key)?'map-route-line':shared?'map-shared-trail':'')+'" d="M'+x+' '+y+'L'+dx+' '+dy+'"/>';
    }
    const scouted=sharedPlaces.has(room)||scouting&&fog.scouted.has(room);
    const raidClock=window.millRaidClient?.phase;
    const raidMarker=room==='millbrook'&&['warning','battle'].includes(raidClock)?' [RAID]':'';
    const name=(status==='frontier'&&room!==wildlifeRoom&&!scouted?'Unexplored':explorationName(room))+raidMarker;
    nodes+='<g class="map-place'+(room===currentRoom?' map-current':'')+(status==='frontier'?' map-frontier':'')+(scouted?' map-scouted':'')+'"><circle cx="'+x+'" cy="'+y+'" r="'+(room===currentRoom?13:8)+'"/>'+(status==='frontier'?'<text class="map-question" x="'+x+'" y="'+(y+4)+'" text-anchor="middle">'+(scouted?'✧':'?')+'</text>':'')+'<text x="'+x+'" y="'+(y+29)+'" text-anchor="middle">'+name+'</text>'+(room===currentRoom?'<text class="map-you" x="'+x+'" y="'+(y-22)+'" text-anchor="middle">YOU ARE HERE</text>':'')+'</g>';
  }
  const ys=rooms.map(room=>positions[room][1]),bottom=Math.max(160,...ys)+48;
  const regions=rooms.some(room=>explorationRegions.Moonwood.includes(room))
    ?'<path class="map-region-divider" d="M30 251H610"/><text class="map-region-text" x="30" y="241">THE TOWER</text><text class="map-region-text" x="30" y="266">MOONWOOD</text>':'';

  const veil='<defs><filter id="map-fog-soft"><feGaussianBlur stdDeviation="12"/></filter><mask id="map-fog-mask"><rect width="640" height="'+bottom+'" fill="white"/><g filter="url(#map-fog-soft)">'+clearings+'</g></mask><pattern id="map-fog-texture" width="90" height="70" patternUnits="userSpaceOnUse"><path d="M0 40Q25 0 60 28T100 35M-20 60Q25 20 70 55" fill="none" stroke="#7994b0" stroke-opacity=".08" stroke-width="20"/></pattern></defs><g mask="url(#map-fog-mask)"><rect width="640" height="'+bottom+'" fill="#071323"/><rect width="640" height="'+bottom+'" fill="url(#map-fog-texture)"/></g>';
  $('mapFogSummary').textContent=explorationRegions.Moonwood.filter(room=>fog.known.has(room)).length+' / '+explorationRegions.Moonwood.length+' Moonwood places discovered · '+willowmereRooms.filter(room=>fog.known.has(room)).length+' / 3 Willowmere · '+watchRooms.filter(room=>fog.known.has(room)).length+' / 4 Beaconwatch · '+(scouting?'Trail Memory reveals nearby routes.':'Explore to clear fog.');
  const valley=rooms.some(room=>willowmereRooms.includes(room)&&fog.status(room)!=='hidden')?'<path class="map-region-divider" d="M30 594H610"/><text class="map-region-text" x="30" y="614">WILLOWMERE VALLEY</text>':'';
  const march=ashenRooms.some(room=>fog.status(room)!=='hidden')?'<path class="map-region-divider" d="M30 1328H610"/><text class="map-region-text" x="455" y="1351">ASHEN MARCH</text>':'';
  $('worldMap').innerHTML='<svg viewBox="0 0 640 '+bottom+'" role="img" aria-label="Exploration map. Fog hides undiscovered places. You are in '+roomDetails[currentRoom].name+'.">'+regions+valley+(rooms.some(room=>watchRooms.includes(room)&&fog.status(room)!=='hidden')?'<path class="map-region-divider" d="M30 861H610"/><text class="map-region-text" x="30" y="883">BEACONWATCH REACH</text>':'') +march+'<g class="map-links">'+links+'</g>'+veil+nodes+'</svg>';
}
