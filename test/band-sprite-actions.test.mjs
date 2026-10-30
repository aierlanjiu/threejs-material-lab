import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spriteActionFrame,spritePerformanceFrame,loadBandActionPets} from '../js/avatar/sprite-actions.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../assets/band-pet-actions/one-piece/zoro/manifest.json',import.meta.url),'utf8'));

test('sample has 16 distinct intact cels and a separate original rest',()=>{
 assert.equal(manifest.frameCount,17);assert.equal(manifest.frames.length,16);
 assert.equal(new Set(manifest.frames.map(frame=>frame.sha256)).size,16);
 assert.deepEqual(manifest.clips.rest,[0]);
 const play=new Set(manifest.clips.play),accent=new Set(manifest.clips.accent);
 assert.equal(play.size,8);assert.equal(accent.size,8);assert([...accent].every(frame=>!play.has(frame)));
 for(const clip of Object.values(manifest.clips))assert(clip.every(frame=>Number.isInteger(frame)&&frame>=0&&frame<manifest.frameCount));
});
test('cel sequence follows time, freezes at rest and supports reduced motion',()=>{
 assert.equal(spriteActionFrame(manifest,1.3),spriteActionFrame(manifest,1.3));
 assert.equal(spriteActionFrame(manifest,3,{action:'rest'}),0);
 assert.equal(spriteActionFrame(manifest,3,{reduced:true}),0);
 assert.equal(spriteActionFrame(manifest,3,{speed:0}),0);
 assert.equal(spriteActionFrame(manifest,-3),manifest.clips.play[0]);
 assert.equal(spriteActionFrame(manifest,NaN),manifest.clips.play[0]);
 assert.equal(spriteActionFrame(manifest,1/manifest.fps),manifest.clips.play[1]);
 assert.equal(spriteActionFrame(manifest,0,{action:'accent'}),manifest.clips.accent[0]);
});

test('all ten approved characters have independent expanded actions and valid atlas frames',async()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../assets/band-pet-actions/manifest.json',import.meta.url),'utf8'));
 const pets=await loadBandActionPets(async()=>({ok:true,json:async()=>data}));assert.equal(pets.size,10);
 for(const pet of pets.values()){
  assert.equal(pet.frameCount,17);assert.equal(pet.newCelCount,16);
  assert.equal(new Set(pet.clips.play).size,8);assert.equal(new Set(pet.clips.accent).size,8);
  const seen=new Set();
  for(let step=0;step<800;step++){const time=step/100,frame=spritePerformanceFrame(pet,time,120,.8);seen.add(frame.action);assert(frame.frame>=0&&frame.frame<17);assert.deepEqual(frame,spritePerformanceFrame(pet,time,120,.8));}
  assert.deepEqual(seen,new Set(['accent','play']));
  assert.equal(spritePerformanceFrame(pet,1,120,0).frame,0);
  assert.equal(spritePerformanceFrame(pet,1,120,1,{reduced:true}).frame,0);
  assert.equal(spritePerformanceFrame(pet,1,120,1,{speed:0}).frame,0);
 }
});
