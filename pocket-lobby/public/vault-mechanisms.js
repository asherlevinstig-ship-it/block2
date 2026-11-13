export const vaultMechanisms={
  spillway:{name:'Open the spillway',detail:'Drain three tiles along the east edge. The extra lane gives you room to step clear of slam rings.'},
  screen:{name:'Raise a stone screen',detail:'Raise a low wall near the entrance. Stand behind it to block the charged volley. Detonation rings still reach you.'}
};
export const vaultSpillwayTiles=[{x:11,y:6},{x:11,y:7},{x:11,y:8}];
export const vaultScreen={x:4.5,y:5};
export const validVaultMechanism=id=>typeof id==='string'&&Object.hasOwn(vaultMechanisms,id);

export function chooseVaultMechanism(state,id){
  if(state.location!=='depthsVault'||state.depthsRun?.cleared!==2||state.hunting?.encounter||state.vaultCoop||state.depthsRun.vaultMechanism){
    throw new Error('Choose a Vault mechanism once, before engaging the Guardian.');
  }
  if(!validVaultMechanism(id))throw new Error('Choose the spillway or stone screen.');
  state.depthsRun.vaultMechanism=id;
}
