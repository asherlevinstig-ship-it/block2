import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {socialRooms} from '../public/shared-world.js';
import {moonwood} from '../public/moonwood.js';
import {roomEnvironments,environmentProfiles,environmentForRoom} from '../public/world-environment-catalog.js';

test('every playable area has a new environment and every artwork file is packaged',()=>{
 const rooms=[...new Set([...Object.keys(socialRooms),...Object.keys(moonwood.areas)])];
 assert.deepEqual(Object.keys(roomEnvironments).sort(),rooms.sort());
 for(const room of rooms){const environment=environmentForRoom(room);assert(environment?.asset,room);assert(!environment.asset.includes('hud-night'));assert(environment.position>=0&&environment.position<=1);assert(environmentProfiles[environment.theme]);}
 for(const profile of Object.values(environmentProfiles)){
  const bytes=readFileSync(new URL('../public/'+profile.asset,import.meta.url));
  if(profile.asset.endsWith('.webp')){assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}
  else assert.equal(bytes[0],137);
 }
});
test('indoor and underground areas do not inherit outdoor sky or falling-leaf effects',()=>{
 for(const room of ['home','hub','lounge','market','bakery','armory','tailor','furnishings','store','factionHall','millCellar','crystaldeep','depthsVault']){
  const environment=environmentForRoom(room);assert(!environment.sky,room);assert(!environment.leaves,room);assert(!environment.oak,room);
 }
 assert(environmentForRoom('pond').water);assert.notEqual(environmentForRoom('pond').asset,environmentForRoom('outside').asset);
 assert.equal(environmentForRoom('unreleased-room'),null);
});
