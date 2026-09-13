const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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
  assert.equal(Math.round(fog.far),68);
  assert.ok(sun.intensity<.7);
  assert.notEqual(hemi.color.getHex(),0xffffff);
});

test('biome profiles express diffuse snow, contrasty desert, cool forest, and olive swamp',async()=>{
  const {SURFACE_PALETTES,createEnvironmentIdentity}=await import('../../client/js/environment-identity.mjs');
  const profiles=Object.fromEntries(SURFACE_PALETTES.map(profile=>[profile.name,profile]));
  assert.ok(profiles.plains.key>profiles.plains.horizon,'plains keeps a warm key against blue distance fog');
  assert.ok(profiles.forest.ambient<profiles.plains.ambient,'forest canopy reduces ambient light');
  assert.ok(profiles.desert.sun>profiles.plains.sun&&profiles.desert.ambient<profiles.plains.ambient,'desert separates bright sun from ambient fill');
  assert.ok(profiles.snowy.ambient>profiles.plains.ambient,'snow receives bright diffuse fill');
  assert.ok(profiles.swamp.sun<profiles.forest.sun&&profiles.swamp.fogFar<profiles.forest.fogFar,'swamp is muted and misty');

  const renderAmbient=biome=>{
    const identity=createEnvironmentIdentity(THREE),hemi={color:new THREE.Color(0xffffff),groundColor:new THREE.Color(0xffffff),intensity:1};
    identity.surface({biome,town:false,dt:10,day:1,opaque:{color:new THREE.Color(0xffffff)},transparent:{color:new THREE.Color(0xffffff)},fog:{color:new THREE.Color(),near:0,far:0},backdrop:new THREE.Color(),hemi,sun:{color:new THREE.Color(),intensity:1}});
    return hemi.intensity;
  };
  assert.ok(renderAmbient(4)>renderAmbient(2),'snow renders with more diffuse fill than desert');
});

test('dungeons suppress skylight and retain authored local colour profiles',async()=>{
  const {DUNGEON_PALETTES,createEnvironmentIdentity}=await import('../../client/js/environment-identity.mjs');
  for(const [theme,profile] of Object.entries(DUNGEON_PALETTES)){
    assert.ok(profile.ambient<=.36,theme+' ambient remains deliberately low');
    assert.ok(profile.sun<=.025,theme+' directional skylight remains minimal');
    assert.ok(profile.fogFar>profile.fogNear,theme+' fog range remains usable');
  }
  const identity=createEnvironmentIdentity(THREE);
  assert.notEqual(identity.dungeon('forge').key.getHex(),identity.dungeon('frozen').key.getHex());
  assert.notEqual(identity.dungeon('overgrown').ground.getHex(),identity.dungeon('void').ground.getHex());
});

test('voxel atlas keeps pixel filtering and deterministic natural and dungeon wear tiles',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(source,/const ATLAS_COLS = 8, ATLAS_ROWS = 8/);
  assert.match(source,/atlasTex\.magFilter = THREE\.NearestFilter;[\s\S]*atlasTex\.minFilter = THREE\.NearestFilter;[\s\S]*atlasTex\.generateMipmaps = false/);
  for(const tile of ['[0,6]','[1,6]','[2,6]','[3,6]','[4,6]','[5,6]','[6,6]','[7,6]','[2,7]','[3,7]','[4,7]','[5,7]']){
    assert.ok(source.includes('return '+tile),tile+' participates in deterministic surface selection');
  }
  assert.match(source,/return \[faceIndex===3\?1:0,7\]/,'dungeon stone selects cracked sides and mossy tops');
  assert.match(source,/const wear=hash2\(x\*29\+y\*7\+id\*41,z\*31-y\*11\+faceIndex\*53\)/);
  assert.match(source,/const BIOME_FACE_CONTRAST=\[1\.0,1\.04,1\.14,1\.10,\.72,\.90\]/,'desert face contrast is stronger while snow is more diffuse');
  assert.match(source,/const directional=Math\.max\(\.35,1-\(1-face\.shade\)\*contrast\)/);
  assert.match(source,/if\(faceIndex===3&&wear<\.18\)return \[0,6\]/,'grass top variants remain separate from side transitions');
  assert.match(source,/if\(faceIndex!==2&&faceIndex!==3&&wear<\.14\)return \[5,6\]/,'dirt roots remain on exposed side faces');
});
