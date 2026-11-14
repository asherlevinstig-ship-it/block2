import test from 'node:test';
import assert from 'node:assert/strict';
import {willowbankDeer,createWillowbankFlock} from '../public/willowbank-wildlife.js';
import {normalizeState} from '../server/player-state.mjs';
import {boot} from './helpers/game-client.mjs';

test('hoofprints precede some crossings and deer cross the inland trail before disappearing',()=>{
  assert.deepEqual(willowbankDeer(4500),{tracks:true,deer:null});
  assert.equal(willowbankDeer(46500).tracks,false);
  assert(willowbankDeer(10000).deer.x<3);
  assert(willowbankDeer(13500).deer.x>3);
  assert.equal(willowbankDeer(17000).deer,null);
  const game=boot(normalizeState({location:'willowbank',position:{x:3,y:10}}));
  game.run("window.playerCloud.combatNow=()=>13000;draw(13000)");
  assert.deepEqual(game.errors,[]);
});

test('nearby walkers startle birds and a flock returns after the bank is quiet',()=>{
  const flock=createWillowbankFlock(),near=[{x:12,y:13}];
  assert(flock(0,[]).every(bird=>bird.flight===0));
  flock(100,near);
  assert(flock(450,near).every(bird=>bird.flight>0));
  assert.equal(flock(20000,near).length,0);
  assert.equal(flock(20100,[]).length,3);
});
