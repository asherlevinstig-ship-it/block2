const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const shrine=require('../../shared/dragon-shrine');
const registry=require('../../shared/npc-quest-chains');

test('mount lesson grants an insulator, not an automatic egg',()=>{
  const chain=registry.createNpcQuestChains({B:{LOG:5,PLANKS:7,COBBLE:8,GLASS:9,COAL_ORE:15,IRON_ORE:16,DIAMOND_ORE:17,TORCH:19,EGG_INSULATOR:34},I:new Proxy({DRAGON_EGG:185},{get:(o,k)=>o[k]||100})})['Mara Vale'];
  assert.deepEqual(chain[5].rewardItems,[{id:34,count:1}]);
  assert.match(chain[6].desc,/Emberwatch Shrine/);
  assert.match(chain[6].desc,/3 guardians/);
});

test('shrine clears headroom and puts a podium on solid ground',()=>{
  const blocks=new Map(), B={STONE:3,COBBLE:8,AIR:0,BRICK:12,TORCH:19};
  shrine.build((x,y,z,id)=>blocks.set([x,y,z].join(','),id),B);
  assert.equal(blocks.get('540,22,372'),B.COBBLE);
  assert.equal(blocks.get('540,23,372'),B.BRICK);
  assert.equal(blocks.get('540,25,372'),B.AIR);
});

function harness(){
  const source=fs.readFileSync(require.resolve('../rooms/dragons.mixin.js'),'utf8');
  const methods=source.slice(source.indexOf('  dragonShrineQuest('),source.indexOf('  // Dragon incubation'));
  const Room=vm.runInNewContext('(class Room {'+methods+'})',{DRAGON_SHRINE:shrine.site,I:{DRAGON_EGG:185},Mob:class{},Math});
  const messages=[], client={sessionId:'me',send:(type,data)=>messages.push({type,data})};
  const prof={activeNpcQuest:{giver:'Mara Vale',title:'First Bonded Mount',shrineGuardKills:0},inv:[],mountUnlocks:[]};
  const rec={token:'token',prof}, room=new Room();
  Object.assign(room,{clients:[client],state:{players:new Map([['me',{dim:'overworld',dgn:'',x:shrine.site.x,z:shrine.site.z,y:shrine.site.y}]]),mobs:new Map()},mobMeta:{},mobSeq:0,dirtyPlayers:new Set(),profileFor:()=>rec,isPlayerAlive:()=>true,rateLimited:()=>false,freshMeta:()=>({}),addRewardItem:(p,id)=>{p.inv.push({id,count:1});return 0;},syncPlayerProfile(){}});
  return {room,client,prof,messages};
}

test('three guardians gate the egg and claim is one-time',()=>{
  const {room,client,prof,messages}=harness();
  room.handleClaimDragonShrineEgg(client);
  assert.equal(room.state.mobs.size,3);
  assert.equal(messages.at(-1).data.reason,'guards');
  for(const [id] of room.state.mobs){const meta=room.mobMeta[id];room.state.mobs.delete(id);delete room.mobMeta[id];room.onDragonShrineGuardKilled(meta);}
  room.handleClaimDragonShrineEgg(client);
  assert.equal(prof.inv.length,1);
  assert.equal(prof.activeNpcQuest.shrineEggClaimed,true);
  room.handleClaimDragonShrineEgg(client);
  assert.equal(prof.inv.length,1);
  assert.equal(messages.at(-1).data.reason,'claimed');
});

test('full inventory leaves egg claim retryable and saved kills avoid repeat fights',()=>{
  const {room,client,prof,messages}=harness();
  prof.activeNpcQuest.shrineGuardKills=3;
  room.addRewardItem=()=>1;
  room.handleClaimDragonShrineEgg(client);
  assert.equal(messages.at(-1).data.reason,'full');
  assert.equal(prof.activeNpcQuest.shrineEggClaimed,undefined);
  assert.equal(room.state.mobs.size,0);
});
