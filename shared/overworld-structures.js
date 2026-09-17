(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BlockcraftOverworldStructures=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const STRUCTURE_FAMILIES=Object.freeze([
    {type:'ruined_keep',name:'Briarwatch Keep',biome:0,radius:15,theme:'plains',activity:'Lower the drawbridge and capture the courtyard',rarity:'rare'},
    {type:'overgrown_temple',name:'Verdant Moon Temple',biome:1,radius:14,theme:'forest',activity:'Cleanse the three corrupted roots',rarity:'rare'},
    {type:'arcane_tower',name:'Sunspire Observatory',biome:2,radius:13,theme:'desert',activity:'Align the sun lenses in order',rarity:'rare'},
    {type:'giant_hall',name:'Hall of the Frostbound',biome:4,radius:16,theme:'snow',activity:'Light the three ancestral braziers',rarity:'legendary'},
    {type:'witch_enclave',name:'Mirelight Enclave',biome:5,radius:14,theme:'swamp',activity:'Break the ritual ingredients in the correct order',rarity:'rare'},
  ]);

  const OBJECTIVE_BLUEPRINTS=Object.freeze({
    ruined_keep:{mode:'sequence',intro:'Reach the gate mechanism, then claim the courtyard standard.',steps:[
      {id:'drawbridge',label:'Drawbridge winch',verb:'Lower drawbridge',hint:'Find the winch inside the gatehouse.',lx:3,lz:8},
      {id:'standard',label:'Courtyard standard',verb:'Capture courtyard',hint:'Advance to the oathbound standard.',lx:-3,lz:-2},
    ]},
    overgrown_temple:{mode:'any',intro:'Find and cleanse every corrupted root binding the shrine.',steps:[
      {id:'root_west',label:'Western corrupted root',verb:'Cleanse root',hint:'A corrupted root coils beside the western pillars.',lx:-6,lz:3},
      {id:'root_east',label:'Eastern corrupted root',verb:'Cleanse root',hint:'A corrupted root coils beside the eastern pillars.',lx:6,lz:-3},
      {id:'root_altar',label:'Altar root',verb:'Cleanse root',hint:'The final root grips the moon altar.',lx:3,lz:-7},
    ]},
    arcane_tower:{mode:'sequence',intro:'Align the observatory lenses from dawn to zenith to dusk.',steps:[
      {id:'lens_dawn',label:'Dawn lens',verb:'Align lens',hint:'Begin with the eastern dawn lens.',lx:4,lz:3},
      {id:'lens_zenith',label:'Zenith lens',verb:'Align lens',hint:'Align the central zenith lens next.',lx:3,lz:-1},
      {id:'lens_dusk',label:'Dusk lens',verb:'Align lens',hint:'Finish at the western dusk lens.',lx:-4,lz:-5},
    ]},
    giant_hall:{mode:'any',intro:'Relight the braziers of hearth, hunt, and oath.',steps:[
      {id:'brazier_hearth',label:'Hearth brazier',verb:'Light brazier',hint:'The hearth brazier waits near the entrance.',lx:3,lz:7},
      {id:'brazier_hunt',label:'Hunt brazier',verb:'Light brazier',hint:'The hunt brazier stands along the western table.',lx:-7,lz:0},
      {id:'brazier_oath',label:'Oath brazier',verb:'Light brazier',hint:'The oath brazier guards the jarl\'s dais.',lx:-3,lz:-8},
    ]},
    witch_enclave:{mode:'sequence',intro:'Disrupt the rite: mire bloom, bone ash, then the cauldron.',steps:[
      {id:'mire_bloom',label:'Mire bloom bundle',verb:'Scatter mire bloom',hint:'Start at the western hut.',lx:-7,lz:-6},
      {id:'bone_ash',label:'Bone ash urn',verb:'Break bone ash urn',hint:'Next, cross to the eastern hut.',lx:7,lz:-2},
      {id:'cauldron',label:'Ritual cauldron',verb:'Quench cauldron',hint:'Quench the central cauldron last.',lx:-3,lz:-5},
    ]},
  });

  function worldPoint(spec,lx,lz,dy=0){
    const r=spec.rotation&3;
    const rx=r===0?lx:r===1?-lz:r===2?-lx:lz;
    const rz=r===0?lz:r===1?lx:r===2?-lz:-lx;
    return {x:spec.x+rx,y:spec.y+dy,z:spec.z+rz};
  }

  function selectFantasyStructureSpecs({worldSize,townCenter,townHalfSize,sea,biomeAt,terrainHeight,hash,avoid=[]}){
    const selected=[];
    for(const family of STRUCTURE_FAMILIES){
      let best=null,bestScore=-1;
      for(let x=52;x<worldSize-52;x+=19)for(let z=52;z<worldSize-52;z+=19){
        if(biomeAt(x,z)!==family.biome)continue;
        if(Math.hypot(x-townCenter,z-townCenter)<townHalfSize+105)continue;
        if(selected.some(s=>Math.hypot(x-s.x,z-s.z)<92))continue;
        if(avoid.some(s=>Math.hypot(x-s.x,z-s.z)<family.radius+(s.radius||8)+12))continue;
        const y=terrainHeight(x,z),r=family.radius;
        if(y<=sea+1||y>39)continue;
        const heights=[terrainHeight(x-r,z-r),terrainHeight(x+r,z-r),terrainHeight(x-r,z+r),terrainHeight(x+r,z+r),terrainHeight(x-r,z),terrainHeight(x+r,z),terrainHeight(x,z-r),terrainHeight(x,z+r),y];
        const relief=Math.max(...heights)-Math.min(...heights);
        if(relief>6)continue;
        const score=hash(x+family.biome*1709,z+family.biome*2903)-relief*.035;
        if(score>bestScore){bestScore=score;best={x,y,z};}
      }
      if(!best)continue;
      const townDx=townCenter-best.x,townDz=townCenter-best.z;
      const rotation=Math.abs(townDx)>Math.abs(townDz)?(townDx>0?3:1):(townDz>0?0:2);
      const stateRoll=hash(best.x+4409,best.z+7727);
      const state=stateRoll>.72?'corrupted':stateRoll>.38?'occupied':'ruined';
      const spec={id:'major_fantasy_'+family.type,type:family.type,name:family.name,x:best.x,y:best.y,z:best.z,major:true,radius:family.radius,biome:family.biome,theme:family.theme,activity:family.activity,rarity:family.rarity,rotation,state};
      spec.entrance=worldPoint(spec,0,family.radius-2,1);
      spec.approachEnd=worldPoint(spec,0,family.radius+10,1);
      spec.interior=worldPoint(spec,0,1,1);
      spec.reward=worldPoint(spec,0,-family.radius+5,1);
      spec.rewardChest=worldPoint(spec,3,-family.radius+5,1);
      const blueprint=OBJECTIVE_BLUEPRINTS[family.type];
      spec.objectiveMode=blueprint.mode;spec.objectiveIntro=blueprint.intro;
      spec.objectives=blueprint.steps.map((step,index)=>Object.assign({index},step,worldPoint(spec,step.lx,step.lz,1)));
      selected.push(spec);
    }
    return selected;
  }

  function buildFantasyStructures({specs,setBlock,B,worldHeight,terrainHeight}){
    const built=[];
    for(const spec of specs){
      const put=(lx,dy,lz,id)=>{const p=worldPoint(spec,lx,lz,dy);if(p.y>0&&p.y<worldHeight)setBlock(p.x,p.y,p.z,id);};
      const box=(x1,y1,z1,x2,y2,z2,id)=>{for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)for(let z=z1;z<=z2;z++)put(x,y,z,id);};
      const clear=(x1,z1,x2,z2,height=12)=>box(x1,1,z1,x2,height,z2,B.AIR);
      const prep=(radius,floor)=>{for(let x=-radius;x<=radius;x++)for(let z=-radius;z<=radius;z++){for(let y=-3;y<0;y++)put(x,y,z,B.DIRT);put(x,0,z,floor);}clear(-radius,-radius,radius,radius,22);};
      const lamp=(x,z,h=2)=>{put(x,1,z,B.COBBLE);put(x,h,z,B.LANTERN);};
      const doorway=(halfWidth,z,height=4)=>{for(let x=-halfWidth;x<=halfWidth;x++)for(let y=1;y<=height;y++)put(x,y,z,B.AIR);};
      if(spec.type==='ruined_keep'){
        prep(15,B.GRASS);box(-11,1,-11,11,1,11,B.COBBLE);
        for(let y=2;y<=8;y++)for(let i=-11;i<=11;i++){
          if((i+y)%7!==0){put(i,y,-11,y%3?B.COBBLE:B.BRICK);put(-11,y,i,y%3?B.COBBLE:B.BRICK);put(11,y,i,y%3?B.COBBLE:B.BRICK);}
          if(i%5!==2)put(i,y,11,y%3?B.COBBLE:B.BRICK);
        }
        doorway(2,11,5);box(-4,2,-8,4,2,8,B.PLANKS);box(-3,3,-8,3,7,-8,B.BRICK);
        for(const [x,z] of [[-9,-9],[9,-9],[-9,9],[9,9]])box(x-1,2,z-1,x+1,12,z+1,B.COBBLE);
        box(-2,2,-9,2,2,-7,B.BRICK);lamp(-6,5);lamp(6,5);
      }else if(spec.type==='overgrown_temple'){
        prep(14,B.GRASS);for(let z=-11;z<=11;z++)for(let x=-5;x<=5;x++)put(x,0,z,(Math.abs(x)===5||z%5===0)?B.COBBLE:B.BRICK);
        for(const z of [-10,-4,2,8])for(const x of [-6,6])box(x-1,1,z-1,x+1,6,z+1,z%4?B.COBBLE:B.BRICK);
        box(-7,6,-11,7,6,-7,B.BRICK);box(-4,1,-10,4,4,-10,B.BRICK);doorway(2,-10,4);
        for(const [x,z] of [[-8,-8],[8,-6],[-8,0],[8,4],[-7,10]]){box(x,1,z,x,4,z,B.LOG);box(x-2,5,z-2,x+2,5,z+2,B.LEAVES);}
        box(-3,1,-8,3,1,-5,B.BRICK);lamp(-4,8);lamp(4,2);put(0,2,-4,B.LANTERN);
      }else if(spec.type==='arcane_tower'){
        prep(13,B.SAND);for(let y=1;y<=20;y++)for(let x=-6;x<=6;x++)for(let z=-6;z<=6;z++)if(Math.max(Math.abs(x),Math.abs(z))===6&&(x*x+z*z<70))put(x,y,z,y%4===0?B.TERRACOTTA:B.BRICK);
        doorway(2,6,5);for(let y=2;y<=18;y++)put((y%4)-2,y,Math.floor((y-2)/4)%2?2:-2,B.COBBLE);
        box(-7,20,-7,7,20,7,B.TERRACOTTA);for(const [x,z] of [[-6,-6],[6,-6],[-6,6],[6,6]])put(x,21,z,B.LANTERN);
        box(-2,1,-4,2,1,-2,B.BRICK);put(0,2,0,B.DIAMOND_ORE);lamp(-9,8);lamp(9,8);
      }else if(spec.type==='giant_hall'){
        prep(16,B.SNOW);box(-10,1,-13,10,1,13,B.PLANKS);
        for(const x of [-10,10])for(let z=-13;z<=13;z+=4)box(x-1,2,z-1,x+1,9,z+1,B.LOG);
        for(let z=-13;z<=13;z++){put(-10,9,z,B.LOG);put(10,9,z,B.LOG);for(let x=-9;x<=9;x++)put(x,10+Math.floor((10-Math.abs(x))/3),z,x%4===0?B.LOG:B.PLANKS);}
        box(-10,2,-13,10,8,-13,B.COBBLE);box(-10,2,13,10,6,13,B.LOG);doorway(2,13,5);
        box(-4,2,-10,4,3,-7,B.ICE);for(const z of [-7,0,7]){lamp(-7,z,3);lamp(7,z,3);}put(0,2,3,B.CAMPFIRE);
      }else if(spec.type==='witch_enclave'){
        prep(14,B.GRASS);for(let z=-12;z<=12;z++)for(let x=-2;x<=2;x++)put(x,1,z,z%3===0?B.LOG:B.PLANKS);
        for(const [hx,hz] of [[-7,-6],[7,-2],[-6,7]]){
          for(const [x,z] of [[hx-3,hz-3],[hx+3,hz-3],[hx-3,hz+3],[hx+3,hz+3]])box(x,1,z,x,3,z,B.LOG);
          box(hx-3,4,hz-3,hx+3,4,hz+3,B.PLANKS);box(hx-3,5,hz-3,hx+3,5,hz+3,B.LEAVES);put(hx,4,hz+3,B.AIR);put(hx,2,hz,B.CAMPFIRE);
        }
        for(const [x,z] of [[-3,-10],[3,-7],[-3,-2],[3,3],[-3,9]])put(x,2,z,B.LANTERN);
        box(-2,1,-10,2,1,-7,B.COBBLE);put(0,2,-5,B.WATER);
      }
      // Keep a three-block-wide, four-block-high route open from entrance to reward.
      for(let z=spec.radius-2;z>=-spec.radius+5;z--)for(let x=-1;x<=1;x++)for(let y=1;y<=4;y++)put(x,y,z,B.AIR);
      if(spec.state==='corrupted'){
        for(const [x,z] of [[-9,-7],[9,-7],[-9,7],[9,7]]){box(x,1,z,x,4,z,B.TERRACOTTA);put(x,5,z,B.DIAMOND_ORE);}
      }else if(spec.state==='occupied'){
        put(-5,1,5,B.CAMPFIRE);for(let y=1;y<=4;y++)put(7,y,4,B.LOG);put(6,4,4,B.TERRACOTTA);put(6,3,4,B.TERRACOTTA);
      }else{
        for(const [x,z] of [[-7,10],[8,7],[-9,-2],[7,-8]]){put(x,1,z,B.COBBLE);if((Math.abs(x+z)&1)===0)put(x,2,z,B.BRICK);}
      }
      // Distinct readable stations turn each interior into a short spatial objective route.
      for(const objective of spec.objectives||[]){
        const local=OBJECTIVE_BLUEPRINTS[spec.type].steps[objective.index];
        put(local.lx,1,local.lz,B.COBBLE);
        if(spec.type==='giant_hall')put(local.lx,2,local.lz,B.CAMPFIRE);
        else if(spec.type==='arcane_tower')put(local.lx,2,local.lz,B.DIAMOND_ORE);
        else if(spec.type==='overgrown_temple'){put(local.lx,2,local.lz,B.LOG);put(local.lx,3,local.lz,B.LEAVES);}
        else if(spec.type==='witch_enclave')put(local.lx,2,local.lz,objective.id==='cauldron'?B.WATER:B.TERRACOTTA);
        else put(local.lx,2,local.lz,objective.id==='standard'?B.TERRACOTTA:B.LOG);
      }
      put(3,1,-spec.radius+5,B.CHEST);
      if(terrainHeight){
        const end=worldPoint(spec,0,spec.radius+10,0),rawEnd=terrainHeight(end.x,end.z),endY=Math.max(spec.y-8,Math.min(spec.y+8,rawEnd));
        for(let step=0;step<=12;step++){
          const z=spec.radius-2+step,floorY=Math.round(spec.y+(endY-spec.y)*(step/12));
          for(let x=-1;x<=1;x++){
            const p=worldPoint(spec,x,z,0);
            for(let y=Math.max(1,floorY-3);y<floorY;y++)setBlock(p.x,y,p.z,B.DIRT);
            setBlock(p.x,floorY,p.z,step%4===0?B.BRICK:B.COBBLE);
            for(let y=floorY+1;y<=Math.min(worldHeight-1,floorY+4);y++)setBlock(p.x,y,p.z,B.AIR);
          }
        }
      }
      built.push(spec);
    }
    return built;
  }

  return {STRUCTURE_FAMILIES,OBJECTIVE_BLUEPRINTS,selectFantasyStructureSpecs,buildFantasyStructures,worldPoint};
});
