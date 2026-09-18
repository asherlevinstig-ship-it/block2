const test=require('node:test');
const assert=require('node:assert/strict');

test('personal bounty badge persists, updates its value, and clears when no longer wanted',async()=>{
  const {renderBountyStatus}=await import('../../client/js/bounty-status.mjs');
  const classes=new Set(['hidden']);
  const element={textContent:'',classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}};
  renderBountyStatus(element,{karma:-25,value:25});
  assert.equal(classes.has('hidden'),false);
  assert.match(element.textContent,/WANTED · 25 gold/);
  renderBountyStatus(element,{karma:-50,value:50});
  assert.match(element.textContent,/WANTED · 50 gold/);
  renderBountyStatus(element,{karma:0,value:0});
  assert.equal(classes.has('hidden'),true);
  assert.equal(element.textContent,'');
  renderBountyStatus(element,null);
  assert.equal(classes.has('hidden'),true);
});
