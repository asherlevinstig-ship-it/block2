import test from 'node:test';
import assert from 'node:assert/strict';
import {outdoorWeather,waystationTraveler} from '../public/outdoor-weather.js';
import {normalizeState} from '../server/player-state.mjs';
import {boot} from './helpers/game-client.mjs';

test('Willowbank mist is confined to dawn and the traveler shelters and returns on the shared clock',()=>{
 const slot=240000;
 assert(outdoorWeather('willowbank',0).mist>0);
 assert.equal(outdoorWeather('willowbank',slot).mist,0);
 assert.equal(outdoorWeather('home',slot*3),null);
 const rain=outdoorWeather('waystation',slot*3);
 assert(rain.rain);
 assert(waystationTraveler(rain).moving);
 assert.deepEqual(waystationTraveler(rain,true),waystationTraveler(outdoorWeather('waystation',slot*3+4000)));
 assert(waystationTraveler(rain,true).sheltered);
 assert(!waystationTraveler(outdoorWeather('waystation',slot*4+4000)).sheltered);
 for(const room of ['willowbank','waystation']){
  const game=boot(normalizeState({location:room,position:{x:1,y:6}}));
  game.run("window.playerCloud.combatNow=()=>725000;receiveWaystation({fire:8,supplies:12,revision:20});draw(2000)");
  assert.deepEqual(game.errors,[]);
 }
});
