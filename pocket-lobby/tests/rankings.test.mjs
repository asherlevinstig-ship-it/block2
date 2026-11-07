import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {readRankings} from '../server/rankings.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {tokenHash} from '../server/identity.mjs';
import {playerPower} from '../public/progression.js';

function insert(sql,id,credits,joined=true){
  const state={...normalizeState({credits,avatar:{name:'Player '+id,outfit:0,hair:0}}),rankingJoined:joined};
  sql.prepare('INSERT INTO tower_players (player_id,state_json,revision,last_request,updated_at) VALUES (?,?,1,?,?)').run(id,JSON.stringify(state),'create',Date.now());
  sql.prepare('INSERT INTO tower_accounts (account_id,username_key,username,player_id,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?,?)').run('account-'+id,'user_'+id,'User_'+id,id,'hash','recovery',Date.now());
  return state;
}

test('ranking boards keep ties, top ten, own position and private identifiers separate',async()=>{
  const {db,sql}=testDatabase();
  for(let index=0;index<12;index++)insert(sql,String(index),1000-index);
  insert(sql,'hidden',999999,false);
  const state=insert(sql,'tied',1000);
  state.score=999999;
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),'tied');
  const result=await readRankings(db,'11',{id:'account-11'});
  assert.equal(result.participants,13);
  assert.equal(result.wealth.top.length,10);
  assert.equal(result.wealth.top[0].rank,1);
  assert.equal(result.wealth.top[1].rank,1);
  assert.equal(result.wealth.top[2].rank,3);
  assert.equal(result.wealth.you.rank,13);
  assert.equal(result.wealth.you.isYou,true);
  assert.equal(result.power.top[0].power,playerPower(state.stats,state.combatGear).total);
  assert(!JSON.stringify(result).includes('account-'));
  assert(result.wealth.top.every(row=>!Object.hasOwn(row,'id')));
  sql.close();
});

test('ranking participation requires an account and cannot be forged through saves',async()=>{
  const {db,sql}=testDatabase();
  const state=insert(sql,'me',100,false);
  const token='a'.repeat(64);
  sql.prepare('INSERT INTO tower_sessions (session_hash,account_id,expires_at,created_at) VALUES (?,?,?,?)').run(await tokenHash(token),'account-me',Date.now()+60000,Date.now());
  async function call(path,body,origin='https://tower.test'){
    const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{
      method:body?'POST':'GET',
      headers:{Cookie:'__Host-tower-account='+token,...(body?{Origin:origin,'Content-Type':'application/json'}:{})},
      body:body?JSON.stringify({...body,characterKey:'me'}):undefined
    }),{TOWER_DB:db});
    return {status:response.status,data:await response.json()};
  }
  let current=await call('save',{revision:1,operation:'forge-join',state:{...state,rankingJoined:true}});
  assert.equal(current.status,200);
  assert.equal(current.data.state.rankingJoined,false);
  const joinBody={revision:current.data.revision,operation:'join',joined:true};
  current=await call('rankings/participation',joinBody);
  assert.equal(current.status,200);
  assert.equal((await call('rankings/participation',joinBody)).data.revision,current.data.revision);
  let board=await call('rankings');
  assert.equal(board.data.joined,true);
  assert.equal(board.data.wealth.you.rank,1);
  assert.equal((await call('rankings/participation',{revision:current.data.revision,operation:'bad-origin',joined:false},'https://other.test')).status,403);
  current=await call('rankings/participation',{revision:current.data.revision,operation:'leave',joined:false});
  assert.equal(current.status,200);
  assert.equal((await call('rankings')).data.participants,0);
  current=await call('rankings/participation',{revision:current.data.revision,operation:'join-again',joined:true});
  const reset=await call('testing/reset',{revision:current.data.revision,operation:'reset',testing:true,confirm:'RESET'});
  assert.equal(reset.status,200);
  assert.equal((await call('rankings')).data.joined,false);
  const guest=await handlePlayerApi(new Request('https://tower.test/api/player/rankings'),{TOWER_DB:db});
  assert.equal(guest.status,401);
  sql.close();
});
import {initializeRankings} from '../public/rankings.js';

test('the rankings view loads, switches score types, preserves own position and reports failures',async()=>{
  class Element{
    constructor(tag='div'){this.tag=tag;this.children=[];this.hidden=false;this.attributes={};}
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(){this.children=[];}
    setAttribute(name,value){this.attributes[name]=value;}
  }
  const nodes=new Map();
  const document={getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},createElement:tag=>new Element(tag)};
  const person={rank:15,name:'<script>player</script>',username:'tester',isYou:true,gold:500,earned:900,power:80,breakdown:[{name:'Combat attributes',points:30,detail:'Three levels'}]};
  let fail=false,joined=true;
  const cloud={
    async readRankings(){
      if(fail)throw new Error('Connection unavailable. Try again.');
      return {accountRequired:false,joined,participants:15,wealth:{top:[],you:joined?person:null},power:{top:[person],you:person}};
    },
    async setRankingParticipation(value){joined=value;}
  };
  initializeRankings(cloud,document,{});
  await nodes.get('progressRankingsTab').onclick();
  assert.equal(nodes.get('personalProgress').hidden,true);
  assert.equal(nodes.get('rankingsProgress').hidden,false);
  nodes.get('rankingsPower').onclick();
  const row=nodes.get('rankingsContent').children[0].children[0];
  assert.equal(row.children[1].children[0].textContent,'<script>player</script> · You');
  assert.equal(row.children[2].children[0].textContent,'80');
  assert.equal(row.children[3].children[0].textContent,'Power breakdown');
  await nodes.get('rankingsJoin').onclick();
  assert.equal(joined,false);
  fail=true;
  await nodes.get('rankingsRefresh').onclick();
  assert.match(nodes.get('rankingsStatus').textContent,/Connection unavailable/);
  assert.equal(nodes.get('rankingsRefresh').disabled,false);
  nodes.get('progressPersonalTab').onclick();
  assert.equal(nodes.get('rankingsProgress').hidden,true);
});
