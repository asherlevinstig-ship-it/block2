export const familiars={
 otter:{name:'Reed Otter',color:'#89dacb',unlock:'Catch your first fish',passive:'Quick Waters',perk:'Fish bite 15% sooner, including during Auto fishing.',ability:'Second Chance',detail:'Secure the +5 Patience XP timing bonus during a bite, or recover it just after missing one.',cooldown:45000},
 fox:{name:'Ember Fox',color:'#f5ab78',unlock:'Unlock the Moonwell Depths',passive:'Ember Claws',perk:'Weapon hits against dungeon adds build 8 extra stagger.',ability:'Cinder Pounce',detail:'Select an add during its attack warning to interrupt it.',cooldown:24000},
 owl:{name:'Moon Owl',color:'#bfc8ff',unlock:'Find the lantern on Lantern Trail',passive:'Trail Scout',perk:'See one trail junction farther through the map fog from where you stand.',ability:'Moon Sight',detail:'Highlight nearby exits and interactable exploration clues for 15 seconds.',cooldown:35000}
};
export const OTTER_WAIT=.85, FOX_STAGGER=8, MOON_SIGHT_MS=15000;
export const isFamiliar=id=>typeof id==='string'&&Object.hasOwn(familiars,id);
const clock=value=>Number.isSafeInteger(value)&&value>=0?value:0;
export function normalizeFamiliars(input){
 const owned=[...new Set((Array.isArray(input?.owned)?input.owned:[]).filter(isFamiliar))];
 const equipped=owned.includes(input?.equipped)?input.equipped:null;
 const readyAt=Object.fromEntries(owned.filter(id=>clock(input?.readyAt?.[id])).map(id=>[id,clock(input.readyAt[id])]));
 const sight=input?.sight?.room&&owned.includes('owl')&&clock(input.sight.until)?{room:input.sight.room,until:input.sight.until}:null;
 return {owned,equipped,readyAt,sight};
}
export function familiarUnlocked(state,id){
 if(id==='otter')return state.history?.fishCaught===true;
 if(id==='fox')return state.depthsDiscovered===true;
 return id==='owl'&&state.adventure?.lantern===true;
}
export const familiarFishingTime=(state,duration)=>Math.round(duration*(state.familiars?.equipped==='otter'?OTTER_WAIT:1));
export const moonSightActive=(state,room,now)=>state.equipped==='owl'&&state.sight?.room===room&&state.sight.until>now;

const sprites={
 otter:{colors:['#322a31','#77503f','#a97651','#e5ba88','#e2d9ba'],rows:['........11..','.......1221.','......122221','......122341','...111122441','.1122222231.','12222223331.','1113333311..','..11...11...']},
 fox:{colors:['#382739','#ac472f','#ec823f','#ffd096','#fff0cb'],rows:['......1...1.','......21.21.','......32131.','......322221','.....1232431','..411222331.','.443222231..','4331222221..','.11.11..11..']},
 owl:{colors:['#2b3052','#54608f','#8995cb','#d7dcff','#ffca85'],rows:['..1....1..','..211112..','.12333321.','1234344321','1234544321','.12233321.','..123321..','..112211..','...5..5...']}
};
export function drawFamiliar(ctx,id,x,y,time=0,{scale=1,flipped=false,reduced=false}={}){
 if(!isFamiliar(id))return;
 const art=sprites[id],hover=id==='owl',bob=reduced?0:hover?Math.round(Math.sin(time/245)*3):Math.round(Math.sin(time/210)*.6);
 ctx.save();ctx.translate(Math.round(x),Math.round(y)+bob-(hover?10:0));ctx.scale(flipped?-scale:scale,scale);
 for(const [row,line] of art.rows.entries())for(const [column,pixel] of [...line].entries()){
  if(pixel==='.')continue;
  ctx.fillStyle=art.colors[Number(pixel)-1];ctx.fillRect(column-6,row-9,1,1);
 }
 ctx.restore();
}
