const test=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');

test('town has a warm civic palette distinct from the surrounding plains',async()=>{
  const {TOWN_PALETTE,SURFACE_PALETTES,createEnvironmentIdentity}=await import('../../client/js/environment-identity.mjs');
  assert.notEqual(TOWN_PALETTE.tint,SURFACE_PALETTES[0].tint);
  const render=(town)=>{
    const identity=createEnvironmentIdentity(THREE);
    const opaque={color:new THREE.Color(0xffffff)},transparent={color:new THREE.Color(0xffffff)};
    const fog={color:new THREE.Color(0xffffff),near:0,far:0},backdrop=new THREE.Color(0xffffff);
    const hemi={color:new THREE.Color(0xffffff),groundColor:new THREE.Color(0xffffff)};
    const sun={color:new THREE.Color(0xffffff),intensity:1};
    identity.surface({biome:0,town,dt:10,day:1,opaque,transparent,fog,backdrop,hemi,sun});
    return {opaque:opaque.color,ground:hemi.groundColor,fog,sun};
  };
  const town=render(true),wild=render(false);
  assert.ok(town.opaque.r-town.opaque.b>wild.opaque.r-wild.opaque.b);
  assert.ok(town.ground.r-town.ground.b>wild.ground.r-wild.ground.b);
});

test('surface biomes own distinct atmosphere and sunlight profiles',async()=>{
  const {SURFACE_PALETTES,createEnvironmentIdentity}=await import('../../client/js/environment-identity.mjs');
  assert.equal(new Set(SURFACE_PALETTES.map(p=>p.horizon)).size,SURFACE_PALETTES.length);
  assert.ok(SURFACE_PALETTES.find(p=>p.name==='swamp').fogFar<SURFACE_PALETTES.find(p=>p.name==='plains').fogFar);
  assert.ok(SURFACE_PALETTES.find(p=>p.name==='desert').sun>SURFACE_PALETTES.find(p=>p.name==='forest').sun);
  const identity=createEnvironmentIdentity(THREE),opaque={color:new THREE.Color(0xffffff)},transparent={color:new THREE.Color(0xffffff)};
  const fog={color:new THREE.Color(0xffffff),near:44,far:110},backdrop=new THREE.Color(),hemi={color:new THREE.Color(0xffffff),groundColor:new THREE.Color(0xffffff)},sun={color:new THREE.Color(0xffffff),intensity:1};
  identity.surface({biome:5,town:false,dt:10,day:1,opaque,transparent,fog,backdrop,hemi,sun});
  assert.equal(Math.round(fog.far),72);
  assert.ok(sun.intensity<.7);
  assert.notEqual(hemi.color.getHex(),0xffffff);
});
