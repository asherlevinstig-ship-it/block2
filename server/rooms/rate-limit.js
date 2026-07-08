function rateLimited(bucketsBySession,sessionId,bucket,ratePerSec,burst,now=Date.now()){
  let buckets=bucketsBySession.get(sessionId);
  if(!buckets){buckets=new Map();bucketsBySession.set(sessionId,buckets);}
  let state=buckets.get(bucket);
  if(!state){state={tokens:burst,last:now};buckets.set(bucket,state);}
  state.tokens=Math.min(burst,state.tokens+(now-state.last)/1000*ratePerSec);
  state.last=now;
  if(state.tokens<1)return true;
  state.tokens-=1;
  return false;
}
module.exports={rateLimited};
