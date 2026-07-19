export function createNetworkSession({
  createController,
  Client,
  endpoint,
  sessionStorage,
  attachRoom,
  unavailable,
  interrupted,
  reconnectAttempt,
  resumeFallback,
  reconnectFallback,
  restored,
  failure,
  getPlayerName,
  authToken,
  beforeConnect,
}) {
  const shardKey='bc_shard_id';
  function cleanShardId(value){
    const raw=String(value||'').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,31}$/.test(raw)?raw:'';
  }
  function shardIdForAttempt(attempt){
    let saved='';
    try{saved=cleanShardId(localStorage.getItem(shardKey));}catch(e){}
    const ordered=[];
    ordered.push('main');
    if(saved&&saved!=='main')ordered.push(saved);
    for(let i=2;i<=16;i++)ordered.push('shard-'+i);
    const unique=ordered.filter((id,i,a)=>id&&a.indexOf(id)===i);
    return unique[Math.max(0,attempt|0)]||('shard-'+(Math.max(0,attempt|0)+1));
  }
  const controller=createController({
    Client,
    endpoint,
    roomName:'blockcraft',
    shardAttempts:16,
    resumeTimeout:2600,
    liveReconnectTimeout:2200,
    reconnectAttempts:1,
    primaryJoinOptions:({attempt})=>({shardId:shardIdForAttempt(attempt)}),
    onPrimaryJoinOptions:(joinOptions)=>{
      try{localStorage.setItem(shardKey,cleanShardId(joinOptions&&joinOptions.shardId)||'main');}catch(e){}
    },
    sessionStorage,
    tokenKey:'bc_reconnect_token',
    onAttach:attachRoom,
    onUnavailable:unavailable,
    onInterrupted:interrupted,
    onReconnectAttempt:reconnectAttempt,
    onResumeFallback:resumeFallback,
    onReconnectFallback:reconnectFallback,
    onRestored:restored,
    onFailure:failure,
    authToken,
  });
  const state=controller.state;

  function connect(){
    const name=String(getPlayerName()||'Hunter').slice(0,16);
    try{
      localStorage.removeItem('bc_token');
      localStorage.setItem('bc_name',name);
    }catch(e){}
    beforeConnect();
    controller.connect(name);
  }

  return Object.freeze({controller,state,connect});
}
