import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {readWaystation,useWaystation} from '../server/waystation.mjs';
import {waystationSites} from '../public/waystation.js';
import {normalizeState} from '../server/player-state.mjs';
import {autoRoomPath,autoTilePath} from '../server/auto-motion.mjs';
import {boot} from './helpers/game-client.mjs';

test('Beaconwatch connects to a walkable public Waystation with both projects',()=>{
 const state=normalizeState({location:'waystation',position:{x:1,y:6},adventure:{discovered:['waystation']}});
 assert(state.adventure.discovered.includes('waystation'));
 const [door]=autoRoomPath('beaconwatch','waystation',state);
 assert(autoTilePath('beaconwatch',{x:1,y:5},door.tile,state));
 for(const p of Object.values(waystationSites))assert(autoTilePath('waystation',door.arrival,{x:p.x-1,y:p.y},state));
 const game=boot(state);
 game.run("receiveWaystation({fire:8,supplies:12,revision:20});draw(2000);showHudMap()");
 assert.deepEqual(game.errors,[]);
 assert.match(game.nodes.get('worldMap').innerHTML,/Old Waystation/);
});

test('shared timber contributions are atomic and unlock public services once complete',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const state=normalizeState({location:'waystation',position:{x:4,y:5},avatar:{name:'Ari',hair:0,outfit:0},health:60,woodcutting:{timber:20}});
 const insert=sql.prepare("INSERT INTO tower_players VALUES (?,?,1,'create',0)");
 insert.run('a',JSON.stringify(state));insert.run('b',JSON.stringify({...state,avatar:{...state.avatar,name:'Bea'}}));
 const row=id=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(id);
 const act=(id,site,kind,operation)=>useWaystation(db,row(id),JSON.parse(row(id).state_json),{kind,site,operation},1000);
 await assert.rejects(act('a','fire','rest','early'),/Finish rebuilding/);
 await assert.rejects(act('a','supplies','donate','distance'),/Walk beside/);
 await act('a','fire','donate','first');
 await assert.rejects(act('a','fire','donate','first'),/still needs/);
 for(let i=1;i<8;i++)await act('b','fire','donate','fire-'+i);
 assert.deepEqual(await readWaystation(db),{fire:8,supplies:0,last:{site:'fire',name:'Bea'},revision:8});
 await assert.rejects(act('a','fire','donate','overflow'),/still needs/);
 assert.equal(JSON.parse(row('a').state_json).woodcutting.timber,19);
 assert.equal(JSON.parse((await act('a','fire','rest','heal')).state_json).health,100);
 const update=sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?');
 update.run(JSON.stringify({...JSON.parse(row('a').state_json),position:{x:7,y:4}}),'a');
 for(let i=0;i<12;i++)await act('a','supplies','donate','supply-'+i);
 assert.equal(JSON.parse((await act('a','supplies','buy','bread')).state_json).meals.towerBread,1);
});
