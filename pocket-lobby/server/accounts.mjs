import {scrypt,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {handleLiveweave,liveweaveStatus,liveweaveFailure} from './liveweave.mjs';
import {resolveIdentity,randomToken,tokenHash,sessionCookie,clearCookie,ACCOUNT_COOKIE,GUEST_COOKIE,SESSION_AGE} from './identity.mjs';

const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const hashPassword=async(password,salt=randomToken().slice(0,32))=>{
  const derived=await new Promise((resolve,reject)=>scrypt(password,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024},(error,key)=>error?reject(error):resolve(key)));
  return '$scrypt$16384,8,5$'+salt+'$'+derived.toString('hex');
};
export async function verifyPassword(password,encoded){
  if(typeof password!=='string'||password.length>128)return false;
  const match=/^\$scrypt\$16384,8,5\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(encoded??'');
  if(!match)return false;
  const actual=await hashPassword(password,match[1]);return timingSafeEqual(Buffer.from(actual),Buffer.from(encoded));
}
function passwordInput(value){if(typeof value!=='string'||value.length<15||value.length>128)throw new Error('Use a password of 15–128 characters.');return value;}
function usernameInput(value){if(typeof value!=='string'||!/^[a-z][a-z0-9_]{2,19}$/i.test(value.trim()))throw new Error('Use a username of 3–20 letters, numbers or underscores, starting with a letter.');return value.trim();}
async function limit(db,key,max,period){
  const now=Date.now(),window=now-now%period;
  const row=await db.prepare('INSERT INTO tower_auth_limits (limit_key, window_start, hits) VALUES (?, ?, 1) ON CONFLICT(limit_key) DO UPDATE SET hits = CASE WHEN window_start = excluded.window_start THEN hits + 1 ELSE 1 END, window_start = excluded.window_start RETURNING hits').bind(await tokenHash(key),window).first();
  return row.hits<=max;
}
async function issueSession(db,accountId,createAccount=null){
  const token=randomToken(),now=Date.now();
  const session=db.prepare('INSERT INTO tower_sessions (session_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(await tokenHash(token),accountId,now+SESSION_AGE*1000,now);
  if(createAccount)await db.batch([...(Array.isArray(createAccount)?createAccount:[createAccount]),session]);else await session.run();
  await db.prepare('DELETE FROM tower_sessions WHERE account_id = ? AND (expires_at <= ? OR session_hash NOT IN (SELECT session_hash FROM tower_sessions WHERE account_id = ? ORDER BY created_at DESC LIMIT 10))').bind(accountId,now,accountId).run();
  return token;
}
function authHeaders(token){const headers=new Headers();headers.append('Set-Cookie',sessionCookie(token));headers.append('Set-Cookie',clearCookie(GUEST_COOKIE));return headers;}
function signedIn(body,token){const response=json(body);for(const value of authHeaders(token).getSetCookie())response.headers.append('Set-Cookie',value);return response;}
export async function handleAccountApi(request,env){
  if(!env.TOWER_DB)return json({error:'Accounts are temporarily unavailable.'},503);
  const route=new URL(request.url).pathname.slice('/api/account/'.length);
  try{
    if(route.startsWith('liveweave/'))return await handleLiveweave(request,env,{issueSession,signedIn,json,limit});
    const identity=await resolveIdentity(request,env);
    if(route==='status'&&request.method==='GET')return json({account:identity?.account??null,expired:!!identity?.expired,hasCharacter:!!identity?.playerId,liveweave:await liveweaveStatus(env,identity)});
    if(request.method!=='POST')return json({error:'Not found.'},404);
    if(request.headers.get('Origin')!==new URL(request.url).origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Use the account controls in the game.'},403);
    const raw=await request.text();if(raw.length>4096)return json({error:'Account request is too large.'},400);
    const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid account request.'},400);
    if(route==='logout'){
      if(identity?.sessionHash)await env.TOWER_DB.prepare('DELETE FROM tower_sessions WHERE session_hash = ?').bind(identity.sessionHash).run();
      const result=json({ok:true});result.headers.append('Set-Cookie',clearCookie(ACCOUNT_COOKIE));result.headers.append('Set-Cookie',clearCookie(GUEST_COOKIE));return result;
    }
    const ip=request.headers.get('CF-Connecting-IP')??'local';
    if(!await limit(env.TOWER_DB,'auth-ip:'+ip,20,600000))return json({error:'Too many attempts. Please try again in ten minutes.'},429);
    if(route==='password'){
      if(!identity?.account)return json({error:'Sign in to change your password.'},401);
      const password=passwordInput(body.newPassword);
      const row=await env.TOWER_DB.prepare('SELECT password_hash FROM tower_accounts WHERE account_id = ?').bind(identity.account.id).first();
      if(!await verifyPassword(body.password,row?.password_hash))return json({error:'The current password did not match.'},401);
      const nextHash=await hashPassword(password),token=randomToken(),sessionHash=await tokenHash(token),now=Date.now(),id=identity.account.id;
      const results=await env.TOWER_DB.batch([
        env.TOWER_DB.prepare('UPDATE tower_accounts SET password_hash = ? WHERE account_id = ? AND password_hash = ? RETURNING account_id').bind(nextHash,id,row.password_hash),
        env.TOWER_DB.prepare('DELETE FROM tower_sessions WHERE account_id = ? AND EXISTS (SELECT 1 FROM tower_accounts WHERE account_id = ? AND password_hash = ?)').bind(id,id,nextHash),
        env.TOWER_DB.prepare('INSERT INTO tower_sessions (session_hash, account_id, expires_at, created_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM tower_accounts WHERE account_id = ? AND password_hash = ?)').bind(sessionHash,id,now+SESSION_AGE*1000,now,id,nextHash)
      ]);
      if(!results[0].results?.length)return json({error:'Your password changed in another session. Please sign in again.'},409);
      return signedIn({account:identity.account,ok:true},token);
    }
    if(route==='recovery-code'){
      if(!identity?.account)return json({error:'Sign in to manage your recovery code.'},401);
      const row=await env.TOWER_DB.prepare('SELECT password_hash FROM tower_accounts WHERE account_id = ?').bind(identity.account.id).first();
      if(!await verifyPassword(body.password,row?.password_hash))return json({error:'The password did not match.'},401);
      const code=randomToken();await env.TOWER_DB.prepare('UPDATE tower_accounts SET recovery_hash = ? WHERE account_id = ?').bind(await tokenHash(code),identity.account.id).run();return json({recoveryCode:code});
    }
    const username=usernameInput(body.username),key=username.toLowerCase();
    if(!await limit(env.TOWER_DB,'auth-user:'+key,15,600000))return json({error:'Too many attempts for this account. Try again in ten minutes.'},429);
    if(route==='register'){
      const password=passwordInput(body.password);
      if(!identity?.playerId||identity.account)return json({error:'Load a guest character before creating an account.'},409);
      const player=await env.TOWER_DB.prepare('SELECT player_id FROM tower_players WHERE player_id = ?').bind(identity.playerId).first();if(!player)return json({error:'Load your character first.'},409);
      if(await env.TOWER_DB.prepare('SELECT account_id FROM tower_accounts WHERE username_key = ? OR player_id = ?').bind(key,identity.playerId).first())return json({error:'That username or character already has an account. Try signing in.'},409);
      const accountId=crypto.randomUUID(),recoveryCode=randomToken(),passwordHash=await hashPassword(password);
      let token;
      try{token=await issueSession(env.TOWER_DB,accountId,env.TOWER_DB.prepare('INSERT INTO tower_accounts (account_id, username_key, username, player_id, password_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(accountId,key,username,identity.playerId,passwordHash,await tokenHash(recoveryCode),Date.now()));}
      catch(error){if(/UNIQUE/i.test(error.message))return json({error:'That username or character already has an account. Try signing in.'},409);throw error;}
      return signedIn({account:{id:accountId,username},recoveryCode},token);
    }
    const account=await env.TOWER_DB.prepare('SELECT * FROM tower_accounts WHERE username_key = ?').bind(key).first();
    if(route==='login'){
      const hash=account?.password_hash??'$scrypt$16384,8,5$00000000000000000000000000000000$'+'0'.repeat(64);
      if(!await verifyPassword(body.password,hash)||!account)return json({error:'Sign-in details did not match.'},401);
      return signedIn({account:{id:account.account_id,username:account.username}},await issueSession(env.TOWER_DB,account.account_id));
    }
    if(route==='recover'){
      passwordInput(body.password);
      const code=typeof body.recoveryCode==='string'?body.recoveryCode.replace(/[\s-]/g,'').toLowerCase():'';
      if(!/^[a-f0-9]{64}$/.test(code)||!account||await tokenHash(code)!==account.recovery_hash)return json({error:'Recovery details did not match.'},401);
      const nextCode=randomToken(),nextHash=await hashPassword(body.password);
      const changed=await env.TOWER_DB.prepare('UPDATE tower_accounts SET password_hash = ?, recovery_hash = ? WHERE account_id = ? AND recovery_hash = ? RETURNING account_id').bind(nextHash,await tokenHash(nextCode),account.account_id,account.recovery_hash).first();
      if(!changed)return json({error:'That recovery code has already been used.'},409);
      await env.TOWER_DB.prepare('DELETE FROM tower_sessions WHERE account_id = ?').bind(account.account_id).run();
      return signedIn({account:{id:account.account_id,username:account.username},recoveryCode:nextCode},await issueSession(env.TOWER_DB,account.account_id));
    }
    return json({error:'Not found.'},404);
  }catch(error){
    if(route==='liveweave/callback'){
      console.error('LiveWeave callback failed',error.name);
      return liveweaveFailure('Your sign-in could not be completed. Return to the game and start LiveWeave sign-in again.',503);
    }
    if(error instanceof SyntaxError)return json({error:'Invalid account request.'},400);
    if(/Use a (password|username)/.test(error.message))return json({error:error.message},400);
    console.error('Account service error',error.name);return json({error:'The account service is temporarily unavailable. Please try again.'},503);
  }
}
