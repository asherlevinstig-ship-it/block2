import test from 'node:test';
import assert from 'node:assert/strict';
import {mixColor,shoreDistance,drawWaterBed,drawWaterTile} from '../public/water-art.js';

test('water colours blend between the shallows and the deep',()=>{
  assert.equal(mixColor('#000000','#ffffff',0),'#000000');
  assert.equal(mixColor('#000000','#ffffff',1),'#ffffff');
  assert.equal(mixColor('#102030','#304050',.5),'#203040');
  assert.equal(mixColor('#102030','#304050',4),'#304050');
});

test('shore distance is measured to the nearest dry tile and ignores the map edge',()=>{
  const distance=shoreDistance(6,2,x=>x>=2);
  assert.equal(distance(2,.5),0);
  assert.equal(distance(3.5,.5),1.5);
  assert.equal(distance(5.5,.5),3.5);
  assert.equal(shoreDistance(2,2,()=>true)(1,1),Infinity);
});

test('the water bed covers only wet tiles and darkens away from the bank',()=>{
  const drawn=[];
  drawWaterBed({cols:6,rows:1,wet:x=>x>=2,surface:(x,y,w,d,z,color)=>drawn.push({x,color}),shallow:'#aaaaaa',deep:'#222222',reach:2,cells:2,bands:4});
  assert.equal(drawn.length,16);
  assert.ok(drawn.every(cell=>cell.x>1.9));
  const near=drawn.find(cell=>cell.x<2.1).color,far=drawn.at(-1).color;
  assert.equal(far,'#222222');
  assert.ok(parseInt(near.slice(1,3),16)>parseInt(far.slice(1,3),16));
});

test('a single water tile can be painted against a shared shoreline',()=>{
  const drawn=[];
  drawWaterTile({x:8,y:3,distance:shoreDistance(12,10,x=>x===8),surface:(x,y,w,d,z,color)=>drawn.push({x,z,color}),z:.12,shallow:'#aaaaaa',deep:'#222222',reach:.5,cells:4,bands:4});
  assert.equal(drawn.length,16);
  assert.ok(drawn.every(cell=>cell.z===.12&&cell.x>7.9&&cell.x<9));
  const edge=drawn.find(cell=>cell.x<8).color,middle=drawn.find(cell=>cell.x>8.2&&cell.x<8.3).color;
  assert.ok(parseInt(edge.slice(1,3),16)>parseInt(middle.slice(1,3),16));
});
