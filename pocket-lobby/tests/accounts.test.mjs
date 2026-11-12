import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {handleAccountApi} from '../server/accounts.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {resolveIdentity} from '../server/identity.mjs';
const origin='https://tower.test';
function client(env){
  const cookies=new Map();let key;
  return {cookies,get key(){return key;},async call(path,body,requestOrigin=origin){
    const headers={Cookie:[...cookies].map(([k,v])=>k+'='+v).join(';')};
    if(body){headers.Origin=requestOrigin;headers['Content-Type']='application/json';}
    const handler=path.startsWith('account/')?handleAccountApi:handlePlayerApi;
    const response=await handler(new Request(origin+'/api/'+path,{headers,method:body?'POST':'GET',body:body?JSON.stringify({...body,...(path.startsWith('player/')&&key?{characterKey:key}:{})}):undefined}),env);
    for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(';'),[k,v]=pair.split('=');if(v)cookies.set(k,v);else cookies.delete(k);}
    const data=await response.json();if(data.characterKey)key=data.characterKey;
    return {status:response.status,data};
  }};
}
test('accounts retain a character, reject stale identities, recover once and revoke sessions',async()=>{
  const {db,sql}=testDatabase(),env={TOWER_DB:db},a=client(env),b=client(env);
  const created=await a.call('player/session',{legacy:{credits:321,avatar:{name:'Éowyn ✦',hair:2,outfit:3},homeFurniture:[{id:1,type:'bed',x:2,y:3,rot:0}],fishStock:{perch:4}}});assert.equal(created.status,200);
  const guest=[...a.cookies];
  const registered=await a.call('account/register',{username:'TestHero',password:'a sufficiently long passphrase'});assert.equal(registered.status,200);assert.equal(registered.data.recoveryCode.length,64);
  assert.equal(a.cookies.has('__Host-tower-character'),false);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM tower_players').get().n,1);
  const row=sql.prepare('SELECT * FROM tower_accounts').get();assert(!row.password_hash.includes('passphrase'));assert.notEqual(row.recovery_hash,registered.data.recoveryCode);
  const stolen=client(env);for(const [k,v] of guest)stolen.cookies.set(k,v);
  assert.equal((await stolen.call('player/state')).status,401);
  assert.equal((await stolen.call('player/session',{legacy:{credits:999}})).status,401);
  assert.equal((await b.call('account/login',{username:'testhero',password:'incorrect but long password'})).status,401);
  assert.equal((await b.call('account/login',{username:'TESTHERO',password:'a sufficiently long passphrase'})).status,200);
  const cross=await b.call('player/state');assert.equal(cross.data.characterKey,created.data.characterKey);assert.equal(cross.data.state.credits,321);assert.equal(cross.data.state.avatar.name,'Éowyn ✦');assert.equal(cross.data.state.homeFurniture.length,1);
  const stale=new Request(origin+'/api/player/save',{method:'POST',headers:{Cookie:[...b.cookies].map(([k,v])=>k+'='+v).join(';'),Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({characterKey:'wrong-character',operation:'stale',revision:cross.data.revision,state:{credits:999}})});
  assert.equal((await handlePlayerApi(stale,env)).status,409);
  assert.equal((await a.call('account/login',{username:'TestHero',password:'a sufficiently long passphrase'},'https://evil.test')).status,403);
  const reset=await b.call('account/recover',{username:'TestHero',password:'a new sufficiently long passphrase',recoveryCode:registered.data.recoveryCode});assert.equal(reset.status,200);assert.notEqual(reset.data.recoveryCode,registered.data.recoveryCode);
  assert.equal((await a.call('player/state')).status,401);
  assert.equal((await a.call('account/recover',{username:'TestHero',password:'another sufficiently long passphrase',recoveryCode:registered.data.recoveryCode})).status,401);
  assert.equal((await b.call('player/state')).data.state.credits,321);
  assert.equal((await b.call('account/recovery-code',{password:'wrong password long enough'})).status,401);
  const rotate=await b.call('account/recovery-code',{password:'a new sufficiently long passphrase'});assert.equal(rotate.status,200);
  assert.equal((await b.call('account/logout',{})).status,200);assert.equal((await b.call('player/state')).status,401);
  const expired=client(env);expired.cookies.set('__Host-tower-account','f'.repeat(64));assert.equal((await expired.call('player/session',{legacy:{}})).data.reauthenticate,true);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM tower_players').get().n,1);
  sql.close();
});
test('account validation and rate limits run before expensive password hashing',async()=>{
  const {db,sql}=testDatabase(),a=client({TOWER_DB:db});
  assert.equal((await a.call('account/register',{username:'!bad',password:'short'})).status,400);
  for(let n=0;n<15;n++)await a.call('account/login',{username:'nobody',password:''});
  assert.equal((await a.call('account/login',{username:'nobody',password:''})).status,429);
  sql.close();
});

test('password changes preserve progress and recovery but revoke all previous sessions',async()=>{
 const {db,sql}=testDatabase(),env={TOWER_DB:db},a=client(env),b=client(env);
 await a.call('player/session',{legacy:{credits:77}});
 const registered=await a.call('account/register',{username:'PasswordHero',password:'the original long passphrase'});
 await b.call('account/login',{username:'PasswordHero',password:'the original long passphrase'});
 assert.equal((await a.call('account/password',{password:'wrong current password',newPassword:'a new long passphrase'})).status,401);
 assert.equal((await a.call('account/password',{password:'the original long passphrase',newPassword:'short'})).status,400);
 assert.equal((await b.call('player/state')).status,200);
 const oldCookies=[...a.cookies];
 assert.equal((await a.call('account/password',{password:'the original long passphrase',newPassword:'a new long passphrase'})).status,200);
 assert.equal((await a.call('player/state')).data.state.credits,77);
 assert.equal((await b.call('player/state')).status,401);
 const stale=client(env);for(const [k,v] of oldCookies)stale.cookies.set(k,v);
 assert.equal((await stale.call('player/state')).status,401);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM tower_sessions').get().n,1);
 assert.equal((await b.call('account/login',{username:'PasswordHero',password:'the original long passphrase'})).status,401);
 assert.equal((await b.call('account/login',{username:'PasswordHero',password:'a new long passphrase'})).status,200);
 assert.equal((await b.call('account/recover',{username:'PasswordHero',password:'a recovered long passphrase',recoveryCode:registered.data.recoveryCode})).status,200);
 sql.close();
});

test('failed sign-up session creation rolls back account linking and leaves guest usable',async()=>{
 const {db,sql}=testDatabase(),a=client({TOWER_DB:db});
 await a.call('player/session',{legacy:{credits:42}});
 sql.exec("CREATE TRIGGER fail_session BEFORE INSERT ON tower_sessions BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
 assert.equal((await a.call('account/register',{username:'RetryHero',password:'a sufficiently long passphrase'})).status,503);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM tower_accounts').get().n,0);
 assert.equal((await a.call('player/state')).data.state.credits,42);
 sql.exec('DROP TRIGGER fail_session');
 assert.equal((await a.call('account/register',{username:'RetryHero',password:'a sufficiently long passphrase'})).status,200);
 sql.close();
});
