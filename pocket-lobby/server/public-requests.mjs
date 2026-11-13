import {pondBridgeTarget,publicRequests} from '../public/public-requests.js';
import {fishProducts} from '../public/fishing.js';

const invalid=message=>Object.assign(new Error(message),{status:400});
export async function readPublicRequests(db){
  const row=await db.prepare("SELECT delivered FROM tower_public_projects WHERE id='pond-bridge'").first();
  const delivered=row?.delivered??0;
  return {delivered,target:pondBridgeTarget,open:delivered>=pondBridgeTarget};
}

export async function deliverPublicRequest(db,row,state,id,operation,now){
  if(state.location!=='market'||state.controlMode==='auto'||state.plan||state.report||state.hunting?.encounter||state.health<=0)throw invalid('Visit the Trading Post in Play mode to deliver supplies.');
  if(!Object.hasOwn(publicRequests,id))throw invalid('Choose a request on the board.');
  if(state.publicRequests?.includes(id))throw invalid('You already delivered this request.');
  const request=publicRequests[id];
  if(state.credits+request.gold>100000000)throw invalid('Make room in your wallet before delivering supplies.');
  if(id==='kitchen'){
    const fish=Object.keys(fishProducts).sort((a,b)=>fishProducts[a].price-fishProducts[b].price);
    if(fish.reduce((sum,key)=>sum+(state.fishStock[key]??0),0)<request.quantity)throw invalid('Bring four fish to fill the kitchen request.');
    let remaining=request.quantity;
    for(const key of fish){
      const used=Math.min(remaining,state.fishStock[key]??0);
      if(used)state.fishStock[key]-=used;
      remaining-=used;
      if(!remaining)break;
    }
  }else if(id==='bridge'){
    if((await readPublicRequests(db)).open)throw invalid('The bridge is complete.');
    if(state.woodcutting.timber<request.quantity)throw invalid('Bring ten timber for the bridge crew.');
    state.woodcutting.timber-=request.quantity;
  }else{
    if((state.huntingLoot.ironOre??0)<request.quantity)throw invalid('Bring three iron ore for the forge.');
    state.huntingLoot.ironOre-=request.quantity;
  }
  state.publicRequests=[...(state.publicRequests??[]),id];
  state.credits+=request.gold;
  state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+request.gold);
  const update=db.prepare("UPDATE tower_players SET state_json=?, revision=revision+1, last_request=?, updated_at=? WHERE player_id=? AND revision=? AND (? != 'bridge' OR EXISTS (SELECT 1 FROM tower_public_projects WHERE id='pond-bridge' AND delivered<=?)) RETURNING *")
    .bind(JSON.stringify(state),operation,now,row.player_id,row.revision,id,pondBridgeTarget-request.quantity);
  if(id!=='bridge')return update.first();
  const advance=db.prepare("UPDATE tower_public_projects SET delivered=delivered+? WHERE id='pond-bridge' AND changes()=1 RETURNING delivered").bind(request.quantity);
  const [saved]=await db.batch([update,advance]);
  return saved.results[0]??null;
}
