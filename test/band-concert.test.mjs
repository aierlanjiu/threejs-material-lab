import assert from 'node:assert/strict';
import {stageFountainSlots,stageHeightAt,stagePyroAt,stageLightingAt,stageClimaxAt} from '../js/audio/band-stage-layout.js';

for(const narrow of [false,true]){
 const slots=stageFountainSlots(narrow);assert.equal(slots.length,narrow?6:8);
 assert.ok(slots.every(([x,y,z])=>Math.abs(y-stageHeightAt(x,z,narrow)-.09)<1e-9));
 assert.ok(slots.every(([x])=>Math.abs(x)>2),'the lead singer has an open central corridor');
 if(narrow)assert.equal(new Set(slots.map(s=>s[2])).size,1);
 else assert.ok(slots[0][2]<slots[3][2],'the desktop firing line follows the curved stage lip');
 const fx={intensity:.9,energy:.8,bursts:[10]};
 const wave=stagePyroAt(10.1,fx,narrow);assert.equal(wave.mode,'wave');
 assert.equal(wave.powers[0],0);assert.ok(wave.powers[Math.floor(slots.length/2)]>0);
 const salvo=stagePyroAt(10.6,fx,narrow);assert.equal(salvo.mode,'salvo');assert.ok(salvo.powers.every(p=>p>.99));assert.ok(salvo.flash>.99);
 assert.equal(stagePyroAt(10.74,fx,narrow).flash,0,'the flash is limited to a 250ms envelope');
 assert.deepEqual(stagePyroAt(10.8,fx,narrow).airPowers,[1,0]);assert.deepEqual(stagePyroAt(11.3,fx,narrow).airPowers,[1,1]);
 assert.deepEqual(stagePyroAt(10.6,fx,narrow),salvo,'seeking reconstructs firing order and flash');
 assert.ok(stagePyroAt(10.6,fx,narrow,true).powers.every(p=>p===0));
 assert.equal(stagePyroAt(10.6,{...fx,bursts:[]},narrow).flash,0);
}
const score={duration:60,bpmEstimate:120,stageCues:{choruses:[{start:20,end:35}],bursts:[20],segments:[]},stems:[{id:'drums',envelope:[{time:0,value:.4},{time:60,value:.4}],onsets:[{time:22,strength:.9}]},{id:'bass',envelope:[{time:0,value:.5},{time:60,value:.5}],onsets:[{time:22,strength:.7}]}]};
const chorus=stageLightingAt(score,22.05,stageClimaxAt(score,22.05)),verse=stageLightingAt(score,12,stageClimaxAt(score,12));
assert.equal(chorus.section,'chorus');assert.equal(verse.section,'verse');assert.ok(chorus.cameraScale>verse.cameraScale,'the chorus pulls out into the ensemble');assert.ok(chorus.drums>.7&&chorus.bass>.5);
const reduced=stageLightingAt(score,22.05,stageClimaxAt(score,22.05),true);assert.equal(reduced.cameraScale,1);assert.equal(reduced.cameraShift,0);assert.equal(reduced.verse,0);assert.equal(reduced.flash,0);assert.equal(reduced.drums,0);
const preview=stageClimaxAt(score,9.3,'preview');assert.equal(stagePyroAt(9.3,preview).start,8,'preview uses the newest firing cue');
console.log('PASS curved/straight firing slots, center-out wave, full salvo, 250ms flash, double airburst, onset lighting, camera narrative and seek/reduced determinism');
