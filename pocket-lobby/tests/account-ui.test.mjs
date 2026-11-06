import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('account screen flushes progress, clears switched-character cache and shows recovery once',async()=>{
 const nodes=new Map(),storage=new Map(['player-state','avatar','room','cloud-pending'].map(key=>['pocket-lobby:'+key,'old-character'])),events=[];
 class Node{constructor(){this.value='';this.hidden=false;this.listeners={};this.dataset={};}querySelectorAll(){return [];}querySelector(){return new Node();}setAttribute(){}addEventListener(name,fn){this.listeners[name]=fn;}showModal(){this.open=true;}close(){this.open=false;this.listeners.close?.();}}
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};let reloads=0;
 const context=vm.createContext({document:{getElementById:get},localStorage:{removeItem:key=>storage.delete(key)},AbortSignal,location:{reload:()=>reloads++},navigator:{clipboard:{writeText:async()=>{}}},fetch:async(url,options)=>{
  if(url.endsWith('/status'))return Response.json({account:null});
  events.push(url);assert.equal(options.credentials,'same-origin');return Response.json({account:{username:'Hero'},recoveryCode:'a'.repeat(64)});
 },towerPauseForAccount:()=>events.push('pause'),towerSaveNow:()=>events.push('save'),playerCloud:{flush:async()=>events.push('flush')},towerMultiplayer:{disconnect:()=>events.push('disconnect'),reconnect:()=>events.push('reconnect')}});context.window=context;
 vm.runInContext(fs.readFileSync(new URL('../public/accounts.js',import.meta.url),'utf8'),context);await context.towerAccounts.open('register');
 get('accountUsername').value='Hero';get('accountPassword').value='long secret passphrase';await get('accountForm').onsubmit({preventDefault(){}});
 assert.deepEqual(events,['pause','save','flush','disconnect','/api/account/register']);assert.equal(storage.size,0);assert.equal(get('accountPassword').value,'');assert.equal(get('accountRecoveryResult').hidden,false);assert.equal(get('accountRecoveryCode').value,'a'.repeat(64));assert.equal(reloads,0);
 get('accountDialog').close();assert.equal(reloads,1);
});
