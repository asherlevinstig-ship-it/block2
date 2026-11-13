import {playerMaxHealth} from './food-buffs.js';
import {manaAvailable,normalizeVitals} from './player-vitals.js';

export const galleryLightSites={
  lightSource:{x:3,y:4,label:'Moonbeam source'},
  lightMirrorA:{x:5,y:4,label:'Turn first mirror'},
  lightMirrorB:{x:5,y:6,label:'Turn second mirror'},
  lightShrine:{x:4,y:6,label:'Recovery shrine'},
  lightAlcove:{x:8,y:6,label:'Treasure alcove'}
};
export const galleryLightReward={gold:35,health:25,mana:30};

export function galleryLightPath(run){
  const {lightSource,lightMirrorA,lightMirrorB,lightShrine,lightAlcove}=galleryLightSites;
  if(!run?.galleryLight?.first)return [lightSource,lightMirrorA,{x:5,y:2}];
  const turn=run.galleryLight.second;
  return [lightSource,lightMirrorA,lightMirrorB,turn===2?lightShrine:turn===1?lightAlcove:{x:5,y:7}];
}

export function galleryLightReceiver(light){
  if(!light?.first)return null;
  return light.second===2?'lightShrine':light.second===1?'lightAlcove':null;
}

export function normalizeGalleryLight(value,cleared){
  if(value===undefined)return undefined;
  if(!value||cleared<2||typeof value.first!=='boolean'||![0,1,2].includes(value.second)||
    (value.claimed!==undefined&&(!galleryLightReceiver(value)||value.claimed!==galleryLightReceiver(value)))){
    throw new Error('Invalid Shell Gallery light puzzle.');
  }
  return {first:value.first,second:value.second,...(value.claimed?{claimed:value.claimed}:{})};
}

export function useGalleryLight(state,id,now){
  const run=state.depthsRun,site=Object.hasOwn(galleryLightSites,id)?galleryLightSites[id]:null,p=state.position;
  if(state.location!=='depthsGallery'||run?.cleared!==2||!site||!p||Math.abs(site.x-p.x)+Math.abs(site.y-p.y)!==1){
    throw new Error('Travel beside the mirror or receiver after defeating the Shell Warden.');
  }
  const light={first:false,second:0,...run.galleryLight};
  if(light.claimed)throw new Error('Choose another discovery. The moonbeam has already been spent.');
  if(id==='lightMirrorA'||id==='lightMirrorB'){
    if(id==='lightMirrorA')light.first=!light.first;
    else light.second=(light.second+1)%3;
  }else{
    if(id!==galleryLightReceiver(light)){
      throw new Error('Choose a receiver lit by both mirrors.');
    }
    if(id==='lightShrine'){
      const mana=manaAvailable(state.vitals,now);
      if(state.health>=playerMaxHealth(state,now)&&mana>=100)throw new Error('Your hearts and mana are already full.');
      state.health=Math.min(playerMaxHealth(state,now),state.health+galleryLightReward.health);
      state.vitals={...normalizeVitals(state.vitals),mana:Math.min(100,mana+galleryLightReward.mana),manaAt:now};
    }
    light.claimed=id;
  }
  run.galleryLight=light;
}
