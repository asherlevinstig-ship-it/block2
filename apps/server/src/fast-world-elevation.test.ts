import { describe, expect, it } from "vitest";
import { fastWorldGroundHeight as height, rapidPracticeCollisionCellSolid } from "@blockcraft/protocol";
import { Block, resolvePlayerMotion, resolveSweptHorizontalMotion, stepPlayerNetcode, voxelRaycast, type WorldBlockReader } from "@blockcraft/voxel-world";
import { findLootLanding } from "./loot-placement.js";
import { moveMobSafely, walkableMobSpawn } from "./mob-navigation.js";
import { terrainImpact } from "./combat-impact.js";
const reader: WorldBlockReader = Object.assign((x:number,y:number,z:number)=>rapidPracticeCollisionCellSolid(x,y,z)?Block.Stone:Block.Air,{groundHeight:height});
describe("Fast World shared Greenwood elevation",()=>{
 it("preserves town, other regions and the combat clearing",()=>{
  for(const [x,z] of [[99.5,106.5],[150,106],[180,60],[123.5,90.5],[126,91.5]]) expect(height(x!,z!)).toBe(8);
  expect(height(124,80)).toBeGreaterThan(9.5);
 });
 it("walks up and down without losing support or changing horizontal speed",()=>{
  let pose={x:106,y:height(106,102),z:102,verticalVelocity:0};
  for(let i=0;i<300;i++){
   const before=pose;pose=stepPlayerNetcode(pose,{strafe:1,forward:0},5.8,1/60,reader);
   expect(pose.x-before.x).toBeCloseTo(5.8/60,8);
   expect(pose.y).toBeCloseTo(height(pose.x,pose.z),8);
   expect(Math.abs(pose.y-before.y)).toBeLessThan(.08);
  }
 });
 it("keeps segmented replay and long dodges on the same surface",()=>{
  const start={x:108,y:height(108,102),z:102};
  const dash=resolveSweptHorizontalMotion(start,{x:12,z:0},reader);
  let replay=start;for(let i=0;i<60;i++)replay=resolvePlayerMotion(replay,{x:.2,y:0,z:0},reader);
  expect(dash.x).toBeCloseTo(replay.x,8);expect(dash.y).toBeCloseTo(replay.y,8);
 });
 it("retains town walls and does not teleport airborne actors to the ground",()=>{
  const wall=resolveSweptHorizontalMotion({x:40.5,y:8,z:106},{x:-3,z:0},reader);
  expect(wall.x).toBeGreaterThanOrEqual(40);
  const airborne=resolvePlayerMotion({x:114,y:12,z:102},{x:.1,y:-.1,z:0},reader);
  expect(airborne.y).toBeCloseTo(11.9);expect(airborne.grounded).toBe(false);
 });
 it("grounds mobs and loot at the same height as players",()=>{
  const spawn=walkableMobSpawn({x:114,y:8,z:102},reader);
  expect(spawn.y).toBeCloseTo(height(spawn.x,spawn.z));
  const mob=moveMobSafely(spawn,{x:2,z:0},reader);
  expect(mob.y).toBeCloseTo(height(mob.x,mob.z));
  const loot=findLootLanding(mob,{...mob,x:mob.x+.85},reader);
  expect(loot.y).toBeCloseTo(height(loot.x,loot.z));
 });
 it("hits the visible slope with cursor rays and projectiles",()=>{
  const hit=voxelRaycast({x:124,y:14,z:80},{x:0,y:-1,z:0},20,reader)!;
  expect(hit.distance).toBeCloseTo(14-height(124,80),3);
  const impact=terrainImpact({x:110,y:8.3,z:102},{x:120,y:8.3,z:102},reader);
  expect(impact).not.toBeNull();expect(impact!.point.y).toBeCloseTo(height(impact!.point.x,impact!.point.z),2);
  expect(voxelRaycast({x:124,y:14,z:80},{x:0,y:1,z:0},3,reader)).toBeNull();
 });
});
