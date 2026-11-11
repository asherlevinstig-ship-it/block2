import {enemyAttack, vaultPhase} from './hunting.js';

const gestures = {
  'Stone Sweep':'sweep', 'Shattering Stomp':'stomp', 'Hurled Stone':'throw', 'Shoulder Rush':'rush',
  'Quick Slash':'slash', 'Pursuing Lunge':'lunge', 'Delayed Overhead':'overhead', 'Returning Sweep':'return',
  'Anchor Sweep':'sweep', 'Sundering Smash':'overhead', 'Chain Harpoon':'harpoon',
  'Twinblade Cleave':'cleave', 'Held Overhead':'overhead', 'Chained Lunge':'lunge',
  'Heartbolt Volley':'volley', 'Runic Detonation':'detonate', 'Heart Pulse':'pulse',
  'Heart Bolt':'volley', 'Runic Blast':'detonate', 'Ironclad Smash':'overhead',
  'Vault Cleave':'cleave', 'Vault Lunge':'lunge', 'Sentinel Lunge':'lunge',
  'Sentinel Strike':'slash', 'Warden Slam':'stomp', 'Crushing Slam':'stomp'
};

export function guardianCue(encounter, pose, time, reduced) {
  const now = pose.now ?? time;
  if (!encounter || pose.defeated) return {gesture:null, strength:0, release:false, staggered:false, exposed:false};
  const staggered = now < (encounter.staggerUntil ?? 0);
  const exposed = now < Math.max(encounter.staggerWeakUntil ?? 0, encounter.exposedUntil ?? 0);
  const recovery = now < (encounter.brainRecoveryUntil ?? 0);
  const remaining = encounter.nextBoarAt - now;
  const move = enemyAttack(encounter);
  const warning = !staggered && !recovery && remaining >= 0 && remaining <= move.tell;
  const lastAttack = pose.lastAttack;
  const age = time - lastAttack?.time;
  const release = !staggered && !warning && age >= 0 && age < 320;
  const attack = warning ? move : release ? {name:lastAttack.move, shape:lastAttack.attackShape} : null;
  const fallback = {arc:'sweep', ring:'stomp', bolt:'throw', lane:'rush'};
  const gesture = attack ? gestures[attack.name] ?? fallback[attack.shape] : null;
  const strength = warning ? (reduced ? 1 : .55 + .45 * (1 - remaining / move.tell))
    : release ? (reduced ? 1 : 1 - age / 320) : 0;
  return {gesture, strength, release, staggered, exposed, recovery};
}

function drawing({ctx,px,py,polygon,rect}, lift, lean) {
  const screenX = (x,y) => px+x+Math.min(1,Math.max(0,-y/55))*lean;
  const poly = (points, color, edge) => polygon(points.map(([x,y]) => [Math.round(screenX(x,y)),Math.round(py+y+lift)]),color,edge);
  const pixel = (x,y,w,h,color) => rect(Math.round(screenX(x,y)),Math.round(py+y+lift),w,h,color);
  function line(points, color, width = 1) {
    ctx.strokeStyle=color;
    ctx.lineWidth=width;
    ctx.beginPath();
    points.forEach(([x,y],index) => index ? ctx.lineTo(screenX(x,y),py+y+lift) : ctx.moveTo(screenX(x,y),py+y+lift));
    ctx.stroke();
  }
  function limb(from,to,width,color,edge='#1b2733') {
    const dx=to[0]-from[0],dy=to[1]-from[1], length=Math.hypot(dx,dy)||1;
    const x=-dy/length*width,y=dx/length*width;
    poly([[from[0]+x,from[1]+y],[to[0]+x*.72,to[1]+y*.72],[to[0]-x*.72,to[1]-y*.72],[from[0]-x,from[1]-y]],color,edge);
  }
  return {poly,pixel,line,limb};
}

const moveHand = (rest, target, amount) => rest.map((value,index) => value+(target[index]-value)*amount);

function warden(draw, cue, hit) {
  const {poly,pixel,line,limb}=draw;
  const {gesture,strength,release,staggered,exposed}=cue;
  const light=hit?'#efd6ae':'#aab79a';
  const stone=hit?'#aa9484':'#627d72';
  const dark='#344f51';
  const rest=[25,-19];
  const targets={sweep:release?[37,-30]:[8,-32],stomp:release?[27,-8]:[25,-62],throw:release?[38,-38]:[25,-53],rush:[11,-31]};
  const hand=moveHand(rest,targets[gesture]??rest,strength);
  const raised=gesture==='stomp'&&!release ? strength*15 : 0;
  const footX=gesture==='stomp'&&release ? 20 : 15;
  const open=exposed?4:0;
  const bow=staggered?5:0;

  poly([[-22,-14],[-12,-20],[-8,-10],[-10,0],[-28,0],[-29,-5]],dark,'#263c41');
  poly([[9,-18-raised],[footX+7,-13-raised],[footX+12,-3-raised],[footX+8,1-raised],[6,1-raised],[5,-5-raised]],stone,'#263c41');
  poly([[-28,-7],[-15,-10],[-11,-6],[-13,-3],[-26,-3]],light);
  poly([[8,-7-raised],[footX+5,-9-raised],[footX+8,-5-raised],[footX+4,-3-raised],[7,-3-raised]],light);
  limb([-16,-36+bow],[-30,-15+bow],7,dark);
  poly([[-29,-49+bow],[-20,-55+bow],[-11,-49+bow],[-10,-34+bow],[-24,-23+bow],[-34,-32+bow]],stone,'#223c42');
  poly([[-31,-39+bow],[-28,-47+bow],[-20,-51+bow],[-15,-46+bow],[-21,-38+bow]],light);
  poly([[-21,-42+bow],[9,-43+bow],[22,-29],[14,-13],[-9,-11],[-22,-23]],'#223c44');
  poly([[-20,-42+bow],[-13,-48+bow],[-1-open,-40+bow],[-5-open,-32],[-1-open,-22],[-9,-16],[-20,-23]],stone,'#293e43');
  poly([[2+open,-40+bow],[11,-47+bow],[21,-38],[19,-25],[12,-16],[3+open,-22],[6+open,-32]],stone,'#293e43');
  poly([[-18,-42+bow],[-13,-45+bow],[-4-open,-39+bow],[-9-open,-34],[-19,-34]],light);
  poly([[7+open,-40+bow],[12,-44+bow],[18,-37],[14,-32],[8+open,-32]],light);
  if(exposed){
    poly([[-2,-42+bow],[5,-35],[1,-29],[5,-20],[-4,-24],[-6,-34]],'#62d8c4');
    line([[-3,-43+bow],[1,-37],[-2,-32],[2,-26],[1,-20]],'#dcfff0',2);
    line([[-4,-32],[-12,-30],[-17,-33]],'#9af0d8');
    line([[2,-27],[11,-28],[14,-23]],'#9af0d8');
    pixel(-6,-22,2,2,'#c0fff0');
  }else{
    line([[-1,-40+bow],[-5,-32],[-1,-22]],'#b4c5a6');
    line([[-18,-27],[-12,-25],[-10,-21]],'#3a605b');
  }
  poly([[-13,-48+bow],[-9,-57+bow],[2,-60+bow],[13,-55+bow],[17,-46+bow],[11,-40+bow],[-4,-41+bow]],dark,'#233942');
  poly([[-10,-51+bow],[-7,-56+bow],[2,-58+bow],[11,-53+bow],[10,-49+bow],[-1,-48+bow]],light);
  pixel(4,-48+bow,8,2,exposed?'#caffed':'#f5de89');
  limb([17,-35+bow],hand,6,dark);
  const [x,y]=hand;
  poly([[x-8,y-5],[x-2,y-11],[x+7,y-10],[x+11,y-2],[x+7,y+6],[x-3,y+7],[x-9,y+2]],stone,'#263c41');
  poly([[x-6,y-5],[x-1,y-9],[x+6,y-8],[x+7,y-3],[x,y-1]],light);
  if(gesture==='throw'&&!release){
    poly([[x-8,y-15],[x-5,y-22],[x+4,y-24],[x+10,y-17],[x+7,y-10],[x-1,y-9]],'#ba9b77','#443d41');
    line([[x-5,y-19],[x+2,y-22],[x+7,y-18]],'#ffdb9d',2);
  }
  if(gesture==='rush')line([[16,-39],[22,-36],[23,-30]],'#efbb85',2);
  if(raised)line([[footX-5,-4-raised],[footX+8,-4-raised]],'#f4ce8d',2);
}

function sword(draw,hand,tip,colors,width=3) {
  const {poly,line}=draw;
  const [x,y]=hand,dx=tip[0]-x,dy=tip[1]-y,len=Math.hypot(dx,dy)||1;
  const u=dx/len,v=dy/len,px=-v,py=u;
  const edge=(along,side)=>[x+u*along+px*side,y+v*along+py*side];
  poly([edge(6,-width),edge(len-6,-width*.75),tip,edge(len-6,width*.75),edge(6,width)],colors[0],'#263346');
  poly([edge(7,-width),edge(len-6,-width*.75),tip,edge(7,0)],colors[1]);
  line([edge(-5,0),edge(7,0)],'#9b785c',3);
  line([edge(5,-width-3),edge(5,width+3)],'#e7c483',2);
}

function sentinel(draw,cue,hit) {
  const {poly,pixel,line,limb}=draw;
  const {gesture,strength,release,staggered}=cue;
  const restingHand=[17,-27], restingTip=[29,-57];
  const poses={
    slash:release?[[24,-21],[47,-12]]:[[10,-36],[2,-64]],
    lunge:release?[[28,-30],[60,-28]]:[[9,-27],[39,-28]],
    overhead:release?[[24,-18],[46,-5]]:[[15,-49],[9,-79]],
    return:release?[[3,-28],[-29,-22]]:[[24,-25],[50,-34]],
    sweep:release?[[24,-21],[46,-11]]:[[10,-36],[0,-64]]
  };
  const [handTarget,tipTarget]=poses[gesture]??[restingHand,restingTip];
  const hand=moveHand(restingHand,handTarget,strength),tip=moveHand(restingTip,tipTarget,strength);
  const silver=hit?'#f9ded3':'#adbdc6', white=hit?'#fff0e4':'#e4ece4';
  const lean=gesture==='lunge'?strength*(release?7:-3):0;
  const bow=staggered?5:0;

  poly([[-11,-45+bow],[-19,-37],[-27,-11],[-22,-3],[-15,-8],[-8,-4],[5,-18],[3,-40]],'#4c365d','#27263e');
  poly([[-12,-40],[-18,-31],[-23,-11],[-18,-10],[-12,-25],[-8,-38]],'#7c527f');
  line([[-24,-11],[-21,-7],[-16,-12]],'#b58ea1');
  limb([-7,-24],[-11,-5],4,'#4c6678');
  limb([5,-23],[11+lean,-4],4,'#4c6678');
  poly([[-15,-7],[-8,-8],[-3,-2],[-4,0],[-17,0]],silver,'#29394a');
  poly([[7+lean,-7],[13+lean,-8],[19+lean,-2],[18+lean,0],[5+lean,0]],silver,'#29394a');
  poly([[-13+lean,-43+bow],[4+lean,-46+bow],[14+lean,-38+bow],[9,-24],[2,-18],[-9,-23]],silver,'#29394a');
  poly([[-10+lean,-42+bow],[4+lean,-44+bow],[10+lean,-38+bow],[2,-31],[-6,-34]],white);
  line([[-9,-27],[1,-23],[8,-27]],'#645175',2);
  poly([[-10+lean,-47+bow],[-8+lean,-56+bow],[-1+lean,-64+bow],[8+lean,-56+bow],[13+lean,-48+bow],[6+lean,-42+bow],[-2+lean,-43+bow]],silver,'#273749');
  poly([[-7+lean,-53+bow],[-1+lean,-62+bow],[4+lean,-56+bow],[2+lean,-49+bow]],white);
  line([[-4+lean,-51+bow],[3+lean,-48+bow],[10+lean,-50+bow]],'#334052',3);
  pixel(4+lean,-50+bow,5,1,'#ffda8c');
  limb([10+lean,-36+bow],hand,4,silver);
  sword(draw,hand,tip,['#90a9bb',gesture&&strength>.65?'#fff1b8':'#e2f1ee']);
  pixel(hand[0]-2,hand[1]-2,5,4,'#687e8d');
}

function vaultGuardian(draw,cue,hit,phase) {
  const {poly,pixel,line,limb}=draw;
  const {gesture,strength,release,exposed,staggered}=cue;
  const armor=hit?'#c9a197':phase===1?'#8a7870':'#6c697f';
  const light=hit?'#f4d4b4':phase===1?'#ceae79':'#9e9ab0';
  const core=phase===3?'#e4b6ff':phase===2?'#ffb17d':'#97d9cf';
  const bow=staggered?7:0;
  const rest=[31,-34];
  const handTargets={
    sweep:release?[47,-24]:[16,-33],overhead:release?[36,-15]:[27,-70],
    harpoon:release?[42,-41]:[18,-44],cleave:release?[42,-28]:[14,-42],
    lunge:release?[43,-35]:[23,-27],volley:[32,-47],detonate:[22,-61],pulse:[42,-33],
    stomp:[35,-59]
  };
  const hand=moveHand(rest,handTargets[gesture]??rest,strength);
  const split=phase===3?10:phase===2?4:exposed?5:0;

  for(const side of [-1,1]){
    poly([[side*7,-27],[side*25,-21],[side*30,-4],[side*25,1],[side*6,0],[side*3,-6]],'#3b4154','#242c3e');
    poly([[side*9,-22],[side*21,-19],[side*26,-7],[side*22,-5],[side*8,-8]],armor);
    line([[side*7,-5],[side*25,-4]],light,2);
  }
  limb([-20,-46+bow],[-35,-25+bow],9,'#47475a');
  poly([[-39,-60+bow],[-31,-66+bow],[-20,-64+bow],[-13,-51+bow],[-23,-40+bow],[-38,-45+bow]],armor,'#2b3245');
  line([[-38,-58+bow],[-30,-63+bow],[-22,-61+bow]],light,2);
  poly([[-24,-53+bow],[-13,-61+bow],[14,-61+bow],[25,-48],[19,-29],[8,-18],[-14,-22],[-24,-34]],'#2b2b45','#222c40');
  poly([[-23,-53+bow],[-12,-58+bow],[-2-split,-45],[-8-split,-38],[-3-split,-27],[-15,-24],[-23,-36]],armor,'#39384c');
  poly([[2+split,-45],[12,-57+bow],[24,-49],[22,-37],[14,-23],[3+split,-28],[8+split,-39]],armor,'#39384c');
  line([[-21,-51+bow],[-13,-55+bow],[-4-split,-45]],light,2);
  line([[5+split,-44],[13,-54+bow],[22,-47]],light,2);
  poly([[0,-49],[7+split*.3,-39],[3,-29],[-2,-26],[-8-split*.3,-38]],phase===3?'#8f57bd':'#405765');
  poly([[0,-46],[5,-39],[1,-31],[-4,-38]],core);
  pixel(-1,-41,2,5,'#fff2df');
  if(exposed)line([[-3,-47],[-9,-39],[-7,-35],[-14,-31],[-17,-27]],'#fff0b7',2);

  poly([[-15,-64+bow],[-9,-73+bow],[8,-73+bow],[17,-65+bow],[12,-53+bow],[2,-49+bow],[-12,-54+bow]],armor,'#252a3c');
  poly([[-13,-65+bow],[-12,-79+bow],[-5,-74+bow],[0,-82+bow],[6,-74+bow],[13,-78+bow],[14,-64+bow]],light,'#464355');
  line([[-8,-61+bow],[10,-61+bow]],'#31344a',4);
  pixel(-5,-62+bow,4,2,core);pixel(4,-62+bow,4,2,core);
  limb([19,-46+bow],hand,8,armor);
  const [x,y]=hand;
  if(phase===1){
    const tip=gesture==='overhead'&&!release?[x-2,y-15]:gesture==='harpoon'?[x+19,y-1]:[x+12,y+29];
    limb([x-4,y-12],tip,2.5,'#c5ad7d','#494255');
    const [tx,ty]=tip;
    poly([[tx-14,ty-10],[tx-9,ty-5],[tx,ty-2],[tx+9,ty-5],[tx+15,ty-12],[tx+13,ty-1],[tx+4,ty+5],[tx-4,ty+5],[tx-12,ty]],'#8c9ba4','#353d51');
    line([[tx-11,ty-4],[tx-4,ty+1],[tx+4,ty+1],[tx+12,ty-5]],'#d6d5bd',2);
    if(gesture==='harpoon')line([[x-14,y+3],[x-7,y+6],[x+3,y+4],[tx,ty]],'#efcb85',2);
  }else if(phase===2){
    const tip=gesture==='overhead'&&!release?[x+1,y-25]:[x+24,y+(release?10:-22)];
    sword(draw,hand,tip,['#9a8da9','#ffd49d'],4);
    const offHand=moveHand([-32,-26],gesture==='cleave'?[-37,-18]:[-26,-38],strength);
    sword(draw,offHand,[offHand[0]-15,offHand[1]+(gesture==='cleave'&&release?18:-16)],['#8a7c99','#eeb695'],3);
  }else{
    const spread=(gesture==='pulse'?15:gesture==='detonate'?5:9)*strength;
    const height=gesture==='detonate'?strength*12:0;
    for(const side of [-1,1]){
      const fx=side*(32+spread),fy=-54-height;
      poly([[fx,fy-10],[fx+6,fy-2],[fx+4,fy+5],[fx,fy+9],[fx-6,fy]],'#8d71b2','#3d3158');
      poly([[fx,fy-9],[fx+3,fy-1],[fx,fy+5],[fx-2,fy-2]],core);
      if(gesture==='volley')line([[fx,fy+4],[side*14,-42],[3,-39]],'#c095e9');
    }
    if(gesture==='detonate')line([[-9,-54],[0,-68-height*.5],[9,-54]],'#edcbff',2);
    if(gesture==='pulse')line([[-16,-37],[0,-29],[16,-37]],'#edcbff',2);
  }
}

export function drawDungeonGuardian(type,time,options) {
  const {pose,reduced,combat}=options;
  const cue=guardianCue(combat,pose,time,reduced);
  const lean=cue.gesture==='rush'&&!reduced ? cue.strength*(cue.release?12:7) : 0;
  const draw=drawing(options,cue.recovery&&!cue.gesture&&!cue.staggered ? 2 : 0,lean);
  if(type==='depthsWarden')warden(draw,cue,pose.hit);
  else if(type==='depthsSentinel')sentinel(draw,cue,pose.hit);
  else if(type==='depthsColossus')vaultGuardian(draw,cue,pose.hit,vaultPhase(combat)?.index??1);
}
