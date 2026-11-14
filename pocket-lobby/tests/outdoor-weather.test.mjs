import test from 'node:test';
import assert from 'node:assert/strict';
import {outdoorWeather} from '../public/outdoor-weather.js';
import {waystationRoutines} from '../public/waystation-travelers.js';
import {normalizeState} from '../server/player-state.mjs';
import {boot} from './helpers/game-client.mjs';

test('Willowbank mist is confined to dawn and the traveler shelters and returns on the shared clock',()=>{
 const slot=240000;
 assert(outdoorWeather('willowbank',0).mist>0);
 assert.equal(outdoorWeather('willowbank',slot).mist,0);
 assert.equal(outdoorWeather('home',slot*3),null);
 const rain=outdoorWeather('waystation',slot*3);
 assert(rain.rain);
 const restored={fire:8,supplies:12};
 const phase=(age,weather=rain)=>waystationRoutines(slot*3+age,weather,restored).visitors;
 assert(phase(3000).find(p=>p.id==='porter').crate);
 assert.equal(phase(10000).find(p=>p.id==='porter').activity,'Unloading at the counter');
 assert.equal(phase(20000).find(p=>p.id==='porter').activity,'Sheltering');
 const clear=outdoorWeather('waystation',slot*4+20000);
 assert(phase(20000,clear).find(p=>p.id==='porter').seated);
 assert.equal(phase(30000,clear).find(p=>p.id==='scout').activity,'Heading to Beaconwatch');
 assert(!phase(50000,clear).length);
 for(const room of ['willowbank','waystation']){
  const game=boot(normalizeState({location:room,position:{x:1,y:6}}));
  game.run("window.playerCloud.combatNow=()=>725000;receiveWaystation({fire:8,supplies:12,revision:20});draw(2000)");
  assert.deepEqual(game.errors,[]);
 }
});
