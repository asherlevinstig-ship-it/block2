export function initializeHudClearance(doc=document,win=window){
 const panels=['autoPanel','contextGuide'].map(id=>doc.getElementById(id)).filter(Boolean);if(!panels.length)return;
 const obstacles=['essenceHotbar'].map(id=>doc.getElementById(id));
 obstacles.push(...doc.querySelectorAll('.hud-quickbar,.hud-actionbar'));
 let queued=false;
 function measure(){
  queued=false;for(const panel of panels){if(panel.hidden)continue;
  const parent=panel.offsetParent;if(!parent)continue;
  const stage=parent.getBoundingClientRect(),box=panel.getBoundingClientRect();let bottom=18;
  for(const item of obstacles){
   if(!item||!item.getClientRects().length)continue;
   const dock=item.getBoundingClientRect();
   if(dock.width&&dock.height&&box.left<dock.right+8&&box.right>dock.left-8)bottom=Math.max(bottom,stage.bottom-dock.top+14);
  }
  panel.style.setProperty('--auto-dock-clearance',Math.ceil(bottom)+'px');
  panel.style.setProperty('--auto-panel-max',Math.max(100,Math.floor(stage.height-bottom-16))+'px');
  }
 }
 const schedule=()=>{if(!queued){queued=true;win.requestAnimationFrame(measure);}};
 const resize=new win.ResizeObserver(schedule);for(const panel of panels){resize.observe(panel);if(panel.parentElement)resize.observe(panel.parentElement);}for(const item of obstacles)if(item)resize.observe(item);
 const changes=new win.MutationObserver(schedule);for(const panel of panels)changes.observe(panel,{attributes:true,attributeFilter:['hidden']});for(const item of obstacles)if(item)changes.observe(item,{attributes:true,attributeFilter:['hidden','class']});
 win.addEventListener('resize',schedule);schedule();return {measure:schedule};
}
