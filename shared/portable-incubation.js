// Player-owned nests in temporary realms persist through normal profile saves.
const TYPES = new Set(['ember', 'verdant', 'frost', 'storm', 'void']);
function sanitizePortableNests(value) {
  return (Array.isArray(value) ? value : []).slice(0, 32).filter(n => n && typeof n.realm === 'string'
    && /^[A-Za-z0-9_:.-]{1,160}$/.test(n.realm) && [n.x,n.y,n.z].every(v => Number.isInteger(v) && v >= 0 && v <= 1024))
    .map(n => ({realm:n.realm,x:n.x,y:n.y,z:n.z}));
}
function sanitizePortableEgg(value) {
  if (!value || !TYPES.has(value.type) || !Number.isFinite(value.finishAt) || !Number.isFinite(value.startedAt)) return null;
  return {type:value.type,eggId:Math.max(0,Math.min(999,value.eggId|0)),
    startedAt:Math.max(0,Math.min(4102444800000,value.startedAt)),finishAt:Math.max(0,Math.min(4102444800000,value.finishAt)),
    gender:value.gender==='female'?'female':'male',personality:String(value.personality||'calm').slice(0,24)};
}
function portableRealm(player, profile) {
  if (!player.dgn && player.dim === 'overworld') return 'overworld';
  const active=profile.activeRoom;
  if (player.dim==='tutorial' && active) return 'tutorial:'+active.dim+(active.job?':'+active.job:'');
  return String(player.dim||'realm')+':'+String(player.dgn||'private').replace(/[^A-Za-z0-9_:.-]/g,'').slice(0,128);
}
function builtInPortableNests(player, profile) {
  const realm=portableRealm(player,profile),active=profile.activeRoom;
  if(player.dim!=='tutorial'||!active)return [];
  if(active.dim==='taming_land')return [[-14,-4],[14,-4],[-14,12],[14,12],[0,6]]
    .map(([dx,dz])=>({realm,x:420+dx,y:21,z:925+dz}));
  if(active.dim==='job'&&active.job==='pet_tamer')return [{realm,x:500,y:23,z:933}];
  return [];
}
module.exports={sanitizePortableNests,sanitizePortableEgg,portableRealm,builtInPortableNests};
