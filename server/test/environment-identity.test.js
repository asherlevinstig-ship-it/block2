const test=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');

test('town has a warm civic palette distinct from the surrounding plains',async()=>{
  const {TOWN_PALETTE,SURFACE_PALETTES,createEnvironmentIdentity}=await import('../../client/js/environment-identity.mjs');
  assert.notEqual(TOWN_PALETTE.tint,SURFACE_PALETTES[0].tint);
  const render=(town)=>{
    const identity=createEnvironmentIdentity(THREE);
    const opaque={color:new THREE.Color(0xffffff)},transparent={color:new THREE.Color(0xffffff)};
    const fog={color:new THREE.Color(0xffffff)},backdrop=new THREE.Color(0xffffff);
    const hemi={groundColor:new THREE.Color(0xffffff)};
    identity.surface({biome:0,town,dt:10,day:1,opaque,transparent,fog,backdrop,hemi});
    return {opaque:opaque.color,ground:hemi.groundColor};
  };
  const town=render(true),wild=render(false);
  assert.ok(town.opaque.r-town.opaque.b>wild.opaque.r-wild.opaque.b);
  assert.ok(town.ground.r-town.ground.b>wild.ground.r-wild.ground.b);
});
