import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// game.js is split into classic scripts that share one scope. The parts load before game.js,
// so they may only declare things: a statement that runs on load would run before the game state exists.
const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const parts=['game-lobby.js','game-camera.js','game-map.js'];
const declared=source=>[...source.matchAll(/^(?:async )?function (\w+)\(|^(?:const|let) (\w+)/gm)].map(match=>match[1]??match[2]);

test('the game.js parts hold only declarations',()=>{
  for(const name of parts){
    const opening=read(name).split('\n').filter(line=>line&&!/^[ \t}]/.test(line)&&!line.startsWith('//'));
    assert.equal(opening.shift(),"'use strict';",name);
    for(const line of opening)assert.match(line,/^(?:async function|function|const|let) /,name+': '+line.slice(0,60));
  }
});

test('nothing is declared in both a part and game.js',()=>{
  const main=new Set(declared(read('game.js')));
  const seen=new Set();
  for(const name of parts)for(const id of declared(read(name))){
    assert.ok(!main.has(id),id+' is declared in game.js and '+name);
    assert.ok(!seen.has(id),id+' is declared in two parts');
    seen.add(id);
  }
});

test('the loader and the test harness load every part before game.js',()=>{
  const loader=read('player-cloud.js'),harness=fs.readFileSync(new URL('./helpers/game-client.mjs',import.meta.url),'utf8');
  for(const name of parts){
    assert.ok(loader.indexOf("'"+name+"'")>-1&&loader.indexOf("'"+name+"'")<loader.indexOf("script.src='game.js'"),name+' in loader');
    assert.ok(harness.indexOf("'"+name+"'")>-1&&harness.indexOf("'"+name+"'")<harness.indexOf("'game.js'"),name+' in harness');
  }
});
