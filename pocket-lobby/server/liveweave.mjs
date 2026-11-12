import {cookieToken,resolveIdentity,randomToken,tokenHash,clearCookie} from './identity.mjs';
import {handlePlayerApi} from './player-api.mjs';

const FLOW_COOKIE='__Host-tower-liveweave',PROVIDER='liveweave';
const TOKEN=/^[a-f0-9]{64}$/;
export const liveweaveEnabled=env=>!!env.LIVEWEAVE_AUTH_URL&&TOKEN.test(env.LIVEWEAVE_AUTH_SECRET??'');
async function ensureTables(db){
  // Allows a rolling deployment when the hosting credential cannot run D1 migrations.
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS tower_external_accounts (provider TEXT NOT NULL, subject TEXT NOT NULL, school_id INTEGER NOT NULL, account_id TEXT NOT NULL UNIQUE REFERENCES tower_accounts(account_id), created_at INTEGER NOT NULL, PRIMARY KEY (provider, subject))'),
    db.prepare('CREATE TABLE IF NOT EXISTS tower_login_flows (state_hash TEXT PRIMARY KEY, player_id TEXT, account_id TEXT, expires_at INTEGER NOT NULL)')
  ]);
}
export async function liveweaveStatus(env,identity){
  const enabled=liveweaveEnabled(env);
  if(!identity?.account)return {enabled,linked:false,passwordLogin:true};
  const row=await env.TOWER_DB.prepare('SELECT password_hash FROM tower_accounts WHERE account_id = ?').bind(identity.account.id).first();
  let linked=false;
  try{linked=!!await env.TOWER_DB.prepare('SELECT 1 FROM tower_external_accounts WHERE provider = ? AND account_id = ?').bind(PROVIDER,identity.account.id).first();}
  catch(error){if(!/no such table/i.test(error.message))throw error;}
  return {enabled,linked,passwordLogin:row?.password_hash?.startsWith('$scrypt$')??false};
}
function finish(message,status=400){
  const escaped=message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LiveWeave sign-in</title><body style="margin:10vh auto;padding:24px;max-width:520px;background:#0b162b;color:#e8edf8;font:16px/1.6 system-ui"><h1>LiveWeave sign-in</h1><p>'+escaped+'</p><a style="color:#f5d88a" href="/">Return to the game and try again</a></body></html>',{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",'Set-Cookie':clearCookie(FLOW_COOKIE)}});
}
export async function handleLiveweave(request,env,{issueSession,signedIn,json,limit}){
  const url=new URL(request.url),route=url.pathname.split('/').at(-1);
  if(!liveweaveEnabled(env))return json({error:'LiveWeave sign-in is not available yet.'},503);
  if(route==='start'){
    if(request.method!=='POST'||request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Start LiveWeave sign-in from the game.'},403);
    if(!await limit(env.TOWER_DB,'liveweave-start:'+(request.headers.get('CF-Connecting-IP')??'local'),180,600000))return json({error:'Too many sign-in attempts. Please try again in ten minutes.'},429);
    const identity=await resolveIdentity(request,env),state=randomToken(),now=Date.now();
    await ensureTables(env.TOWER_DB);
    await env.TOWER_DB.batch([
      env.TOWER_DB.prepare('DELETE FROM tower_login_flows WHERE expires_at <= ?').bind(now),
      env.TOWER_DB.prepare('INSERT INTO tower_login_flows (state_hash, player_id, account_id, expires_at) VALUES (?, ?, ?, ?)').bind(await tokenHash(state),identity?.playerId??null,identity?.account?.id??null,now+600000)
    ]);
    const auth=new URL(env.LIVEWEAVE_AUTH_URL);auth.searchParams.set('state',state);
    return json({url:auth.href},200,{'Set-Cookie':FLOW_COOKIE+'='+state+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600'});
  }
  if(route!=='callback'||request.method!=='GET')return json({error:'Not found.'},404);
  const state=url.searchParams.get('state')??'',code=url.searchParams.get('code')??'';
  if(!TOKEN.test(state)||!TOKEN.test(code)||cookieToken(request,FLOW_COOKIE)!==state)return finish('This sign-in did not start in this browser, or it expired. Please start again.');
  const hash=await tokenHash(state),flow=await env.TOWER_DB.prepare('SELECT * FROM tower_login_flows WHERE state_hash = ? AND expires_at > ?').bind(hash,Date.now()).first();
  if(!flow)return finish('This sign-in has expired or has already been used. Please start again.');
  const current=await resolveIdentity(request,env);
  if((current?.playerId??null)!==flow.player_id||(current?.account?.id??null)!==flow.account_id)return finish('The game account changed during sign-in. Please start again from the correct character.');
  const claimed=await env.TOWER_DB.prepare('DELETE FROM tower_login_flows WHERE state_hash = ? AND expires_at > ? RETURNING state_hash').bind(hash,Date.now()).first();
  if(!claimed)return finish('This sign-in has already been used. Please start again.');
  const exchange=await (env.LIVEWEAVE_FETCH??fetch)(env.LIVEWEAVE_AUTH_URL,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'TowerSignIn/1.0',Authorization:'Bearer '+env.LIVEWEAVE_AUTH_SECRET},body:JSON.stringify({code,state}),redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!exchange.ok)return finish('LiveWeave could not confirm this sign-in. Please start again.',502);
  const person=await exchange.json();
  if(!['student','teacher'].includes(person.type)||!Number.isSafeInteger(person.id)||person.id<1||!Number.isSafeInteger(person.schoolId)||person.schoolId<0)return finish('LiveWeave returned an invalid account. Please contact your school.',502);
  const subject=person.type+':'+person.id;
  const linked=await env.TOWER_DB.prepare('SELECT a.account_id, a.username FROM tower_external_accounts e JOIN tower_accounts a ON a.account_id = e.account_id WHERE e.provider = ? AND e.subject = ?').bind(PROVIDER,subject).first();
  let account,token;
  if(linked){
    if(flow.account_id&&flow.account_id!==linked.account_id)return finish('That LiveWeave account already has a different game character. Sign out of the game first to open that character.',409);
    account={id:linked.account_id,username:linked.username};token=await issueSession(env.TOWER_DB,account.id);
  }else{
    if(flow.account_id&&await env.TOWER_DB.prepare('SELECT 1 FROM tower_external_accounts WHERE account_id = ?').bind(flow.account_id).first())return finish('This game account is already linked to another LiveWeave account.',409);
    let playerId=flow.player_id;
    if(!playerId){
      const created=await handlePlayerApi(new Request(url.origin+'/api/player/session',{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({newCharacter:true})}),{...env,SERVER_CHARACTER_STARTS:true});
      if(!created.ok)return finish('Your new character could not be created. Please try again.',503);
      playerId=(await created.json()).characterKey;
    }
    const id=flow.account_id??crypto.randomUUID(),username='LiveWeave '+person.type,statements=[];
    if(!flow.account_id)statements.push(env.TOWER_DB.prepare('INSERT INTO tower_accounts (account_id, username_key, username, player_id, password_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id,'liveweave_'+id,username,playerId,'!liveweave',await tokenHash(randomToken()),Date.now()));
    statements.push(env.TOWER_DB.prepare('INSERT INTO tower_external_accounts (provider, subject, school_id, account_id, created_at) VALUES (?, ?, ?, ?, ?)').bind(PROVIDER,subject,person.schoolId,id,Date.now()));
    token=await issueSession(env.TOWER_DB,id,statements);
    account={id,username:flow.account_id?current.account.username:username};
  }
  const response=signedIn({account},token); // Reuse secure account cookies on the redirect.
  const headers=new Headers(response.headers);headers.delete('Content-Type');headers.set('Location','/?account=liveweave');headers.set('Referrer-Policy','no-referrer');headers.append('Set-Cookie',clearCookie(FLOW_COOKIE));
  return new Response(null,{status:303,headers});
}
