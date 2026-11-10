import test from 'node:test';
import assert from 'node:assert/strict';
import {autoRecapSnapshot,autoRecapView,initializeAutoRecap} from '../public/auto-recap.js';

const fishPlan={source:'rules',kind:'fishing',routineId:'fish',startedAt:1000,catches:{silverfin:10},
 goldEarned:40,goldSpent:3,rationGoldSpent:3};
const roomName=id=>({pond:'Silverfin Pond',home:'Your Home',creek:'Glass Creek'})[id];

test('the recap shows the away delta, separate bread spending, and the current physical room',()=>{
 const baseline=autoRecapSnapshot({plan:fishPlan});
 const plan={...fishPlan,catches:{silverfin:20,perch:8},goldEarned:136,goldSpent:12,rationGoldSpent:12};
 const state={plan,location:'pond',autoPresence:{room:'creek',moving:true}};
 const recap=autoRecapView(state,baseline,roomName);
 assert.deepEqual(recap.rewards,[{label:'Fish caught',value:18}]);
 assert.deepEqual(recap.wallet,['+96 gold earned','−9 gold spent · 9 on bread']);
 assert.equal(recap.location,'Glass Creek');
 assert.equal(recap.status,'Walking to Silverfin Pond');
 assert.equal(recap.summary,'Since you stepped away');
 assert.equal(recap.food,true);
 assert.equal(autoRecapView(state,{...baseline,id:'older'},roomName).rewards[0].value,28);
});

test('a stopped Auto recap explains the budget and excludes manual shifts',()=>{
 const state={location:'home',report:{...fishPlan,endedAt:100000,reason:'food-budget'}};
 const recap=autoRecapView(state,null,roomName);
 assert.equal(recap.running,false);
 assert.equal(recap.completion,'fish:100000');
 assert.match(recap.status,/bread budget/);
 assert.equal(recap.location,'Your Home');
 assert.equal(autoRecapView({...state,report:{...state.report,source:'board'}},null,roomName),null);
});

function harness(initial,saved=new Map()){
 let packet=initial;
 const nodes=new Map();
 const node=()=>({children:[],dataset:{},open:false,append(...items){this.children.push(...items);},
  replaceChildren(){this.children=[];},showModal(){this.open=true;},close(){this.open=false;}});
 const doc={hidden:false,createElement:node,querySelector:()=>null,addEventListener(){},
  getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}};
 let controls=0;
 const recap=initializeAutoRecap({doc,getPacket:()=>packet,roomName,takeControl:async()=>{controls++;return true;},
  openFood(){},openDetails(){},storage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)}});
 return {recap,doc,saved,node:doc.getElementById,setPacket:value=>{packet=value;},controls:()=>controls};
}

test('returning opens once for a completed report and the full session remains available',async()=>{
 const state={location:'home',report:{...fishPlan,endedAt:100000,reason:'food-budget'}};
 const packet={characterKey:'character',state,serverTime:100000};
 const first=harness(packet);
 assert(first.recap.resume({initial:true}));
 await first.node('autoRecapPlay').onclick();
 assert.equal(first.controls(),1);
 assert.equal(first.node('autoRecap').open,false);
 const reloaded=harness(packet,first.saved);
 assert.equal(reloaded.recap.resume({initial:true}),false);
 assert(reloaded.recap.resume({manual:true}));
});

test('brief tab switches stay quiet and a longer absence shows just new progress',t=>{
 let now=100000;
 t.mock.method(Date,'now',()=>now);
 const packet={characterKey:'character',state:{plan:fishPlan,location:'pond'},serverTime:now};
 const game=harness(packet);
 game.recap.leave();
 now+=1000;
 assert.equal(game.recap.resume(),false);
 game.recap.leave();
 now+=61000;
 game.setPacket({...packet,serverTime:now,state:{...packet.state,plan:{...fishPlan,catches:{silverfin:14}}}});
 assert(game.recap.resume());
 assert.equal(game.node('autoRecapRewards').children[0].children[1].textContent,'4');
 assert.equal(game.recap.resume(),false);
});
