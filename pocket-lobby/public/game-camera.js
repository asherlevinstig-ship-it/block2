'use strict';
// World camera and zoom. Part of game.js: a classic script that shares its scope and loads before it.
// Only declarations live here; the camera position itself (camX, camY, zoom) is declared with the rest of the view state in game.js.
// The lobby and courtyard open closer in with a following camera; the 10x10 rooms use the closest zoom that still shows the whole room.
function defaultRoomZoom(room){return depthsStageIndex(room)>=0?1.27:['pond','millCellar','logging','clearing'].includes(room)?1.10:moonwood.has(room)?1:room==='hub'?1:room==='outside'?1.25:1.125;}
// Past 1x the camera tracks the player without looking beyond the canvas. Arenas, raids and decorating stay centred so nothing important slides out of view.
// The Grand Lobby is framed, not followed. At its default zoom the whole room sits in the clear space between the
// HUD panels, so the Warden, the Outside steps and both door walls are visible together on any screen.
// Zooming by hand returns to the usual follow camera; Reset zoom frames the room again.
const hubFrame={
  left:grandLobbyView.originX-grandLobbyView.rows*18-10,
  right:grandLobbyView.originX+grandLobbyView.cols*18+10,
  top:grandLobbyView.originY-85,
  bottom:grandLobbyView.originY+(grandLobbyView.cols+grandLobbyView.rows)*9+18
};
let hubFramed=false,hubFrameAt=-Infinity,hubFrameCamera=null;
function hubFraming(){
  const p=canvasBounds(),box=canvas.getBoundingClientRect();
  const edge=(node,side)=>{
    const r=node?.getBoundingClientRect?.();
    if(!(r?.width>0&&r.height>0))return null;
    return r.right>box.left&&r.left<box.right&&r.bottom>box.top&&r.top<box.bottom?r[side]:null;
  };
  const left=Math.max(box.left,edge(document.querySelector('.hud-rail'),'right')??box.left)+6;
  const right=Math.min(box.right,edge($('plus'),'left')??box.right)-6;
  const top=Math.max(box.top,edge(document.querySelector('.play-head'),'bottom')??box.top)+4;
  const bottom=Math.min(box.bottom,edge($('hint'),'top')??box.bottom)-4;
  const fit=Math.min((right-left)/p.scale/(hubFrame.right-hubFrame.left),(bottom-top)/p.scale/(hubFrame.bottom-hubFrame.top));
  if(!(fit>0&&Number.isFinite(fit)))return {zoom:1,x:view.width/2,y:view.height/2-4};
  const framedZoom=Math.max(.75,Math.min(1.25,Math.floor(fit*16)/16));
  return {zoom:framedZoom,
    x:(hubFrame.left+hubFrame.right)/2-(((left+right)/2-box.left-p.x)/p.scale-view.width/2)/framedZoom,
    y:(hubFrame.top+hubFrame.bottom)/2-(((top+bottom)/2-box.top-p.y)/p.scale-(view.height/2-4))/framedZoom};
}
function updateCamera(time,centerX,centerY,follow=player){
  const {width,height}=view;let x=centerX,y=centerY;
  if(currentRoom==='hub'&&hubFramed&&!editing&&!player.inCombat){
    if(!hubFrameCamera||time-hubFrameAt>400){hubFrameCamera=hubFraming();hubFrameAt=time;}
    if(zoom!==hubFrameCamera.zoom)setZoom(hubFrameCamera.zoom,true);
    x=hubFrameCamera.x;y=hubFrameCamera.y;
  }else if(zoom>1&&!editing&&!player.inCombat&&depthsStageIndex(currentRoom)<0&&!window.millRaidClient?.active){
    const [px,py]=point(follow.x+.5,follow.y+.5);
    x=Math.max(centerX/zoom,Math.min(width-(width-centerX)/zoom,px));
    y=Math.max(centerY/zoom,Math.min(height-(height-centerY)/zoom,py-16));
  }
  const snap=reducedMotion.matches||camRoom!==currentRoom||camZoom!==zoom||time-camAt>400;
  const amount=snap?1:Math.min(1,Math.max(0,time-camAt)/170);
  camSmoothX+=(x-camSmoothX)*amount;camSmoothY+=(y-camSmoothY)*amount;
  camRoom=currentRoom;camZoom=zoom;camAt=time;
  // Whole device-independent pixels keep the pixel art from shimmering while the camera glides.
  camX=Math.round(camSmoothX*zoom)/zoom;camY=Math.round(camSmoothY*zoom)/zoom;
}
function setZoom(value,framed=false){
  zoom=Math.max(.75,Math.min(1.5,value));hover=null;hoverItem=null;
  hubFramed=framed;if(!framed)hubFrameCamera=null;
  $('plus').disabled=zoom===1.5;$('minus').disabled=zoom===.75;
}
