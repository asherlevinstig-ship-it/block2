export const pondBridgeTarget=120;
export const publicRequests={
  kitchen:{title:'Kitchen supplies',item:'fish',quantity:4,gold:32,description:'Stock the Tower kitchen with fresh fish. Any catch counts.'},
  bridge:{title:'Silverfin Bridge',item:'timber',quantity:10,gold:48,description:'Help build a shortcut between Lantern Trail and Silverfin Pond.'},
  forge:{title:'Forge supplies',item:'ironOre',quantity:3,gold:40,description:'Supply the Tower forge with iron ore for its smiths.'}
};

export function townContributionRecord(completed=[]){
  return Object.entries(publicRequests)
    .filter(([id])=>completed.includes(id))
    .map(([id,request])=>({id,title:request.title,quantity:request.quantity,material:{fish:'fish',timber:'timber',ironOre:'iron ore'}[request.item]}));
}
