// Sprites are built from pixel layers so movement reuses the same face, markings and silhouette.
const palette={
 otter:{o:'#282331',s:'#503546',m:'#855344',h:'#b47753',c:'#d4a179',w:'#f4d7a7',e:'#241e29',n:'#382733',g:'#f4c19a',p:'#9b6370'},
 fox:{o:'#282032',s:'#77354a',m:'#bb4e3d',h:'#e47945',c:'#f7a158',w:'#ffdfaa',e:'#251b2b',n:'#38243a',g:'#ffe3a1',p:'#ac5e6d'},
 owl:{o:'#242844',s:'#363f68',m:'#526089',h:'#7485af',c:'#a8b9d2',w:'#e4e7e6',e:'#20233b',n:'#4e3d55',g:'#f6bb70',p:'#8275a2'}
};
const otter={
 tail:['....ooo.....','..oohhmo....','oohmmmssooo.','osmmhmmmssso','..ooossssoo.','.....ooo....'],
 body:['....ooooooo.....','..oomhhhhmsoo...','.omhchhhhhmsso..','omhmmmmhmmmmmso.','omhmmmmmmmmmmso.','osmmmmmmmmmccsso','osmmmmmccccwwmso','.ossmmccwcccso..','..ooossssssoo...'],
 head:['..ooo.....ooo.','.ohpoooooohpo.','.omomhhhhmooo.','..omhchhhmso..','..ohhhhmewho..','..omhhhmehho..','...owcwccwwoo.','...owwwwwwnnno','....ocwwwweoo.','.....oocccoo..'],
 neck:['..ooo..','.omhhho','ohhhcco','omccwso','osccso.','ooooo..'],
 paw:['osso','ommo','.oo.'],
};
const fox={
 tail:['....ooo..........','..oowcmoo........','.owwchhmmoo......','owwccchhmmssoo...','owwccchhmmmssssoo','.ooocchmmmsssooo.','....oossssooo....','......oooo.......'],
 body:['....oooooooo....','..oohhhhhmsoo...','.omhchhhhhhmsso.','omhchhhhhhhmmso.','ommmhmmmmhhmmso.','osmmmmmmmhwccsso','.osmmmmmccwwcso.','..ooosssmmwsoo..','.....ooooooo....'],
 head:['..oo.....oo...','..opo...opo...','..opho.ohpo...','..omchohcmo...','..omchhhhmo...','...ohhcchhmo..','...ohhmewchmo.','...omhmewwccno','....owwccwwnno','.....owwwcsoo.','......ooooo...'],
 neck:['...oooo.','..ohhhso','.ohhhcso','ohhmccso','omccwso.','omcwso..','oswso...','oooo....'],
 paw:['osso','osmo','osmo','osmo','.oo.'],
};
const owl={
 body:['....oooooo....','..oohhhhmsoo..','.ohhhchhhhso..','.ohhhhchhhmso.','ohhhhchhhhhmso','ohhchchhhhmmso','ohhmhcchhmmmso','ohmmhccchmmmso','.ommmhchmmmso.','..osmmmmmsoo..','...ooosoo.....'],
 head:['..oo.......oo..','..ohoooooooho..','.ohhhcchhchhso.','ohhccchhccchmso','ohcwwcchcwwcmso','ohwwggccggwwhso','ohwgegcwgegwhso','omcwggcwggwcmso','.omhwwgwcwhmso.','..oohhnchhoo...','....oooooo.....'],
 fold:['..oooo.','.ohhhso','ohchmso','ohhmso.','ohmsso.','omsoo..','.oo....'],
 high:['.oooo........','ohhmsoo......','occhhmooo....','..ohchhhsoo..','...ohcchhmsoo','.....ooshmmso','.......ooooo.'],
 level:['..oooooo......','oohcchhmooo...','ohchchhhhmmsoo','.oohhhchmmmsso','...oosssmsooo.','.....ooooo....'],
 low:['.........oooo.','......oooohhso','....oohchhhso.','..oohchhhmso..','.ohchhmssso...','ohhmmsoooo....','ossooo........','.oo...........'],
};

function pixels(ctx,colors,rows,x,y,mirror=false){
 for(let row=0;row<rows.length;row++){
  const line=rows[row];
  for(let col=0;col<line.length;col++){
   const color=colors[line[col]];
   if(color){ctx.fillStyle=color;ctx.fillRect(x+(mirror?-col:col),y+row,1,1);}
  }
 }
}
function mark(ctx,color,x,y,w=1,h=1){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function shadow(ctx,owl,airborne){
 mark(ctx,airborne?'#13263639':'#18273359',owl?-7:-11,0,owl?14:23,2);
 mark(ctx,airborne?'#13263626':'#18273335',owl?-5:-8,2,owl?10:17,1);
}
function drawRunner(ctx,id,time,pose){
 const isFox=id==='fox',art=isFox?fox:otter,c=palette[id];
 const dash=pose==='dash',stride=pose==='walk'||dash,excited=pose==='bond'||pose==='cast';
 const frame=Math.floor(time/(isFox?82:108))%4;
 const feet=stride?[[-2,0],[0,-1],[2,0],[0,-1]][frame]:[0,0];
 const bounce=excited?Math.round(Math.sin(Math.min(1,time/850)*Math.PI)*3):0;
 const rise=-bounce-(stride&&frame%2?1:0);
 const tail=stride?[0,1,0,-1][frame]:Math.round(Math.sin(time/235));
 const nod=excited?-1:pose==='idle'?Math.round(Math.sin(time/620)*.6):0;
 const blink=time%4400>4220;
 const bodyY=(isFox?-11:-9)+rise,headX=(isFox?-1:0)+(dash?2:0),headY=(isFox?-18:-13)+rise+nod+(dash?2:0);
 const footY=(isFox?-5:-3)+rise;
 pixels(ctx,c,art.tail,-18,(isFox?-13:-7)+rise+tail-(excited?2:0));
 // The far legs sit under the torso. The near legs overlap the body and keep the paws attached in every frame.
 pixels(ctx,c,art.paw,-8-feet[0],footY+feet[1]);
 pixels(ctx,c,art.paw,2+feet[0],footY+(stride&&frame%2===0?-1:0));
 pixels(ctx,c,art.body,-11,bodyY);
 pixels(ctx,c,art.paw,-7+feet[0],footY+(stride&&frame%2===0?-1:0));
 pixels(ctx,c,art.paw,1-feet[0],footY+feet[1]-(excited?2:0));
 pixels(ctx,c,art.neck,headX+1,headY+(isFox?5:4));
 pixels(ctx,c,art.head,headX,headY);
 if(isFox){
  mark(ctx,c[blink?'m':'g'],headX+7,headY+6);
  if(!blink)mark(ctx,c.e,headX+8,headY+6);
  mark(ctx,c.p,headX+3,headY+2);
 }else{
  if(blink)mark(ctx,c.s,headX+7,headY+5,2);
  else mark(ctx,c.w,headX+8,headY+4);
  mark(ctx,c.g,headX+10,headY+7);
  mark(ctx,c.w,headX+9,headY+8,2);
 }
}
function drawOwl(ctx,time,pose,flightBlend){
 const c=palette.owl,flight=flightBlend>.24,frame=Math.floor(time/92)%4;
 const lift=Math.round((-11+(frame%2?-2:0))*flightBlend),blink=time%4700>4520;
 const wings=[owl.high,owl.level,owl.low,owl.level][frame],wingY=lift+[-17,-13,-11,-13][frame];
 if(flight){pixels(ctx,c,wings,-17,wingY);pixels(ctx,c,wings,17,wingY,true);}
 pixels(ctx,c,owl.body,-7,lift-12);
 if(!flight){pixels(ctx,c,owl.fold,-8,-11);pixels(ctx,c,owl.fold,8,-11,true);}
 mark(ctx,c.n,-5,lift-1,3,2);mark(ctx,c.n,2,lift-1,3,2);
 mark(ctx,c.g,-4,lift,2);mark(ctx,c.g,2,lift,2);
 pixels(ctx,c,owl.head,-7+(pose==='idle'?Math.round(Math.sin(time/920)) :0),lift-20);
 if(blink){mark(ctx,c.s,-4,lift-14,3);mark(ctx,c.s,2,lift-14,3);}
 else{mark(ctx,c.w,-4,lift-15);mark(ctx,c.w,3,lift-15);}
 mark(ctx,c.g,0,lift-12,2,2);mark(ctx,c.n,0,lift-10);
}
export function drawFamiliar(ctx,id,x,y,time=0,{scale=1,flipped=false,reduced=false,pose='idle',groundShadow=true,flightBlend}={}){
 if(!Object.hasOwn(palette,id))return;
 const owlKind=id==='owl',motion=reduced?0:Math.max(0,time),flying=owlKind&&['fly','dash','bond','cast'].includes(pose);
 const renderedPose=reduced?(flying?'fly':'rest'):pose;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(flipped?-scale:scale,scale);
 if(groundShadow)shadow(ctx,owlKind,flying);
 if(owlKind)drawOwl(ctx,motion,renderedPose,reduced?Number(flying):flightBlend??Number(flying));
 else drawRunner(ctx,id,motion,renderedPose);
 ctx.restore();
}
