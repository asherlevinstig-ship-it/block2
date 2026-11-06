export const GUEST_COOKIE='__Host-tower-character',ACCOUNT_COOKIE='__Host-tower-account';
export const SESSION_AGE=30*86400;
export const randomToken=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
export async function tokenHash(raw){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function cookieToken(request,name){const token=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);return token&&/^[a-f0-9]{64}$/.test(token)?token:null;}
export const sessionCookie=token=>ACCOUNT_COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+SESSION_AGE;
export const clearCookie=name=>name+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
export async function resolveIdentity(request,env){
  const accountToken=cookieToken(request,ACCOUNT_COOKIE);
  if(accountToken){
    const sessionHash=await tokenHash(accountToken);
    const row=await env.TOWER_DB.prepare('SELECT a.account_id, a.username, a.player_id, s.expires_at FROM tower_sessions s JOIN tower_accounts a ON a.account_id = s.account_id WHERE s.session_hash = ? AND s.expires_at > ?').bind(sessionHash,Date.now()).first();
    if(!row?.account_id)return {expired:true};
    return {playerId:row.player_id,account:{id:row.account_id,username:row.username},sessionHash,expiresAt:row.expires_at};
  }
  const guestToken=cookieToken(request,GUEST_COOKIE);if(!guestToken)return null;
  const playerId=await tokenHash(guestToken);
  const linked=await env.TOWER_DB.prepare('SELECT account_id FROM tower_accounts WHERE player_id = ?').bind(playerId).first();
  if(linked?.account_id)return {expired:true};
  return {playerId,account:null,expiresAt:Date.now()+SESSION_AGE*1000};
}
