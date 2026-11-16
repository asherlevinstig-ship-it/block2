import test from 'node:test';
import assert from 'node:assert/strict';
import {windPhase,windFor} from '../public/wind.js';
import {outdoorWeather} from '../public/outdoor-weather.js';

const PHASE=240000;

test('wind strength follows the weather day and eases between phases',()=>{
 for(const [index,phase] of ['dawn','clear','wind','rain','clear'].entries()){
  const settled=index*PHASE+PHASE/2;
  assert.equal(outdoorWeather('waystation',settled).phase,phase);
  assert.equal(windPhase(settled).strength,outdoorWeather('waystation',settled).wind,phase);
 }
 let previous=windPhase(0).strength;
 for(let now=500;now<=5*PHASE;now+=500){
  const {strength,gust,lean}=windPhase(now);
  assert(Math.abs(strength-previous)<.05,'strength jumps at '+now);
  assert(gust>=0&&gust<=1&&strength>=0&&strength<=1);
  assert.equal(lean,strength*gust);
  previous=strength;
 }
 assert.equal(windPhase(-3*PHASE+1234).strength,windPhase(2*PHASE+1234).strength);
});

test('wind reaches open-air maps only',()=>{
 for(const room of ['outside','trail','willowbank','quarry','beaconwatch','emberwood'])assert(windFor(room,0),room);
 for(const room of ['home','hub','market','roots','crystaldeep','depthsVault','nowhere'])assert.equal(windFor(room,0),null,room);
});
