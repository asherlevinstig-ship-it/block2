export const carpenterOrder = {timber:12, reward:60};

export function deliverCarpenterOrder(state){
  if(state.location!=='market')throw new Error('Travel to the Trading Post to deliver timber.');
  if(state.plan||state.report)throw new Error('Read your work report before delivering timber.');
  if(state.carpenterOrderComplete)throw new Error('The Carpenter’s Order is already complete.');
  if(state.woodcutting.timber<carpenterOrder.timber)throw new Error('Invalid delivery. Bring 12 timber to complete the order.');
  if(state.credits+carpenterOrder.reward>100000000)throw new Error('Invalid delivery. Make room in your wallet first.');
  state.woodcutting.timber-=carpenterOrder.timber;
  state.credits+=carpenterOrder.reward;
  state.carpenterOrderComplete=true;
}
