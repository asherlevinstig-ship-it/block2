const active=new Map();let root=null,doc=null,lastRender=0,venomPulseTimer=0;
const LABELS={frost:['FROSTBITE','#8be9ff'],venom:['MIRE VENOM','#9be76d'],root:['THORN ROOT','#d6ef86']};
function render(now=performance.now(),force=false){
  if(!root)return;
  if(!force&&now-lastRender<180)return;lastRender=now;
  for(const [kind,status] of active)if(status.until<=now)active.delete(kind);
  root.innerHTML=[...active].map(([kind,status])=>{const label=LABELS[kind]||[kind.toUpperCase(),'#fff'];return '<div style="--status:'+label[1]+'"><b>'+label[0]+'</b><span>'+Math.max(1,Math.ceil((status.until-now)/1000))+'s</span><small>'+status.counter+'</small></div>';}).join('');
  root.classList.toggle('hidden',!active.size);
  if(doc){for(const kind of Object.keys(LABELS))doc.body.classList.toggle('status-'+kind,!!(active.get(kind)&&active.get(kind).until>now));}
}
export const biomeStatus=Object.freeze({
  init(document){doc=document;root=document.getElementById('biomestatus');render(performance.now(),true);},
  apply(message){if(!message||!LABELS[message.kind])return;active.set(message.kind,{until:performance.now()+Math.max(250,message.durationMs|0),counter:String(message.counter||'')});render(performance.now(),true);},
  tick(now){render(now);},
  rooted(now=performance.now()){const s=active.get('root');return !!(s&&s.until>now);},
  staminaMultiplier(now=performance.now()){const s=active.get('frost');return s&&s.until>now ? .38 : 1;},
  active(kind,now=performance.now()){const s=active.get(kind);return !!(s&&s.until>now);},
  pulseVenom(){if(!doc)return;doc.body.classList.remove('venom-damage');void doc.body.offsetWidth;doc.body.classList.add('venom-damage');clearTimeout(venomPulseTimer);venomPulseTimer=setTimeout(()=>doc&&doc.body.classList.remove('venom-damage'),420);},
});
