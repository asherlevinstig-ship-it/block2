import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {handleAccountApi} from '../server/accounts.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
const origin='https://tower.test',secret='a'.repeat(64),code='b'.repeat(64);
function fixture(){
 const {db,sql}=testDatabase();let person={type:'student',id:123,schoolId:4},exchanges=0;
 const env={TOWER_DB:db,LIVEWEAVE_AUTH_URL:'https://liveweave.test/tower-auth.php',LIVEWEAVE_AUTH_SECRET:secret,LIVEWEAVE_FETCH:async(url,options)=>{exchanges++;assert.equal(options.headers.Authorization,'Bearer '+secret);assert.equal(options.redirect,'error');assert.equal(JSON.parse(options.body).code,code);return Response.json(person);}};
 function client(){const cookies=new Map();return {cookies,async call(path,body,site=origin){const headers={Cookie:[...cookies].map(([k,v])=>k+'='+v).join(';')};if(body){headers.Origin=site;headers['Content-Type']='application/json';}const handler=path.startsWith('account/')?handleAccountApi:handlePlayerApi;const r=await handler(new Request(origin+'/api/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);for(const c of r.headers.getSetCookie()){const [pair]=c.split(';'),[k,v]=pair.split('=');if(v)cookies.set(k,v);else cookies.delete(k);}const text=await r.text();return {status:r.status,location:r.headers.get('Location'),data:r.headers.get('Content-Type')?.includes('json')?JSON.parse(text):text};},async start(){const r=await this.call('account/liveweave/start',{});assert.equal(r.status,200);return new URL(r.data.url).searchParams.get('state');},callback(state){return this.call('account/liveweave/callback?state='+state+'&code='+code);}};}
 return {sql,env,client,get exchanges(){return exchanges;},setPerson:value=>person=value};
}
test('LiveWeave links the guest character and another device opens the same saved progress',async()=>{
 const f=fixture(),a=f.client(),b=f.client();
 const initial=await a.call('player/session',{legacy:{credits:315,stats:{patienceXp:80},fishStock:{perch:3}}}),guest=new Map(a.cookies);
 const state=await a.start();assert.equal((await a.callback(state)).status,303);assert.equal(f.exchanges,1);
 assert.equal((await a.call('player/state')).data.characterKey,initial.data.characterKey);
 assert.equal((await a.call('player/state')).data.state.credits,315);
 const status=await a.call('account/status');assert.equal(status.data.liveweave.linked,true);assert.equal(status.data.liveweave.passwordLogin,false);
 assert.equal(a.cookies.has('__Host-tower-character'),false);
 const stale=f.client();for(const [k,v] of guest)stale.cookies.set(k,v);assert.equal((await stale.call('player/state')).status,401);
 await b.call('player/session',{legacy:{credits:12}});assert.equal((await b.callback(await b.start())).status,303);
 assert.equal((await b.call('player/state')).data.characterKey,initial.data.characterKey);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM tower_external_accounts').get().n,1);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM tower_accounts').get().n,1);
 assert.equal((await a.callback(state)).status,400);assert.equal(f.exchanges,2);
 f.sql.close();
});
test('LiveWeave can link an existing password account without replacing it',async()=>{
 const f=fixture(),a=f.client();await a.call('player/session',{legacy:{credits:84}});
 const registration=await a.call('account/register',{username:'ExistingHero',password:'existing long password phrase'});
 assert.equal((await a.callback(await a.start())).status,303);
 const status=await a.call('account/status');assert.equal(status.data.account.id,registration.data.account.id);assert.equal(status.data.account.username,'ExistingHero');assert.equal(status.data.liveweave.passwordLogin,true);
 f.setPerson({type:'student',id:999,schoolId:4});assert.equal((await a.callback(await a.start())).status,409);
 assert.equal((await a.call('player/state')).data.state.credits,84);
 f.sql.close();
});
test('LiveWeave refuses browser mismatches, expired flows and changed game identities',async()=>{
 const f=fixture(),a=f.client(),b=f.client();await a.call('player/session',{});await b.call('player/session',{});
 const state=await a.start();assert.equal((await b.callback(state)).status,400);assert.equal(f.exchanges,0);
 // Keep the flow cookie but swap out the character cookie while sign-in is open.
 for(const [k,v] of b.cookies)if(k==='__Host-tower-character')a.cookies.set(k,v);
 assert.equal((await a.callback(state)).status,400);assert.equal(f.exchanges,0);
 const expired=await b.start();f.sql.prepare('UPDATE tower_login_flows SET expires_at=0').run();assert.equal((await b.callback(expired)).status,400);
 assert.equal((await a.call('account/liveweave/start',{},'https://attacker.test')).status,403);
 f.sql.close();
});
test('LiveWeave separates student and teacher IDs and creates new characters after expired sessions',async()=>{
 const f=fixture(),a=f.client();a.cookies.set('__Host-tower-account','c'.repeat(64));
 assert.equal((await a.callback(await a.start())).status,303);
 const student=await a.call('player/state');assert.equal(student.data.state.characterCreated,false);assert.equal(student.data.state.actionPoints.value,0);
 const b=f.client();f.setPerson({type:'teacher',id:123,schoolId:4});assert.equal((await b.callback(await b.start())).status,303);
 assert.notEqual((await b.call('player/state')).data.characterKey,student.data.characterKey);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM tower_external_accounts').get().n,2);
 f.sql.close();
});
test('a linked local account never silently switches to another character',async()=>{
 const f=fixture(),a=f.client(),b=f.client();await a.call('player/session',{});await a.callback(await a.start());
 await b.call('player/session',{legacy:{credits:65}});await b.call('account/register',{username:'OtherHero',password:'another long password phrase'});
 assert.equal((await b.callback(await b.start())).status,409);assert.equal((await b.call('player/state')).data.state.credits,65);
 f.sql.close();
});
test('invalid exchange data never links a character and unavailable providers are hidden',async()=>{
 const f=fixture(),a=f.client();await a.call('player/session',{});f.setPerson({type:'student',id:123,schoolId:-1});assert.equal((await a.callback(await a.start())).status,502);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM tower_external_accounts').get().n,0);
 f.env.LIVEWEAVE_AUTH_SECRET='';assert.equal((await a.call('account/status')).data.liveweave.enabled,false);assert.equal((await a.call('account/liveweave/start',{})).status,503);
 f.sql.close();
});
