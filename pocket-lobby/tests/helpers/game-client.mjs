import * as loungeUI from '../../public/lounge-ui.js';
import {publicPlayerState} from '../../server/gambling.mjs';
import {drawEnvironmentFx} from '../../public/environment-fx.js';
import * as essenceUI from '../../public/essences.js';
import {normalizeState} from '../../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../../server/gameplay.mjs';
import * as progressionUI from '../../public/progression.js';
import {createTowerCharacterRenderer} from '../../public/character-art.js';
import * as clothes from '../../public/wardrobe.js';
import * as depthsUI from '../../public/depths.js';
import * as commissions from '../../public/commissions.js';
import * as rulesUI from '../../public/character-rules.js';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as fishing from '../../public/fishing.js';
import * as hunting from '../../public/hunting.js';
import * as art from '../../public/combat-art.js';
import * as fx from '../../public/combat-fx.js';
import * as quests from '../../public/quests.js';
import * as historyRules from '../../public/first-visit.js';
import * as shopUI from '../../public/shop-ui.js';
import * as woodUI from '../../public/woodcutting.js';
import * as craftingUI from '../../public/crafting.js';
import * as sharedWorld from '../../public/shared-world.js';
import * as jobs from '../../public/jobs.js';
const root=new URL('../../public/',import.meta.url);
const towerMeta=JSON.parse(fs.readFileSync(new URL('art/tower-adventurer.json',root),'utf8'));
const towerAtlasData={data:new Uint8ClampedArray(towerMeta.width*towerMeta.height*4)};
const noop=()=>{};
const drawing=new Proxy({createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]??((...args)=>{for(const a of args)if(typeof a==='number')assert(Number.isFinite(a),'Invalid draw coordinate: '+String(k));})});
class Node {
  constructor(){this.children=[];this.style={setProperty:noop};this.dataset={};this.hidden=true;this.value='';this.classList={toggle:noop,add:noop,remove:noop};this.firstChild={textContent:''};this.selectors=new Map();}
  append(...items){for(const item of items){if(typeof item==='object')item.parent=this;this.children.push(item);}}
  appendChild(item){this.append(item);}
  replaceChildren(...items){this.children=[...items];}
  getContext(){return drawing;}
  addEventListener(){}
  setAttribute(){}
  removeAttribute(){}
  querySelector(selector){if(!this.selectors.has(selector))this.selectors.set(selector,new Node());return this.selectors.get(selector);}
  querySelectorAll(){return [];}
  closest(){return null;}
  focus(){}
  scrollIntoView(){}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);}
  showModal(){this.open=true;}
  close(){this.open=false;}
  getBoundingClientRect(){return {left:0,top:0,width:540,height:349};}
}
export function boot(saved){
  const nodes=new Map(),storage=new Map(),frames=[],saves=[],errors=[];
  const html=fs.readFileSync(new URL('index.html',root),'utf8');
  for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set(id,new Node());
  nodes.get('profile').children=[new Node(),new Node()];
  const context=vm.createContext({drawEnvironmentFx,...loungeUI,...essenceUI,...progressionUI,...fishing,...hunting,...art,...fx,...quests,...historyRules,...shopUI,...clothes,...woodUI,...craftingUI,...sharedWorld,...jobs,...rulesUI,...commissions,...depthsUI,
    document:{getElementById:id=>{assert(nodes.has(id),'Missing HTML element '+id);return nodes.get(id);},createElement:()=>new Node(),querySelectorAll:()=>[],querySelector:()=>null,addEventListener:noop,activeElement:new Node()},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
    matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>frames.push(fn),performance:{now:()=>1000},setTimeout:noop,clearTimeout:noop,
    console:{...console,error:(...items)=>errors.push(items)},Intl,Date,
    towerCharacterArt:createTowerCharacterRenderer({metadata:towerMeta,atlases:{normal:towerAtlasData,armour:towerAtlasData},createCanvas:()=>new Node()}),
    towerInitialState:saved,playerCloud:{enqueue:s=>saves.push(structuredClone(s)),attach:noop},addEventListener:noop,
  });
  context.window=context;
  for(const file of ['moonwood.js','fishing-moments.js','game.js'])vm.runInContext(fs.readFileSync(new URL(file,root),'utf8').replace('export const moonwood','const moonwood'),context,{filename:file});
  frames.shift()(1000);
  return {context,nodes,saves,frames,errors,read:expression=>vm.runInContext(expression,context),run:expression=>vm.runInContext(expression,context)};
}










