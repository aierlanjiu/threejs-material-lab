import assert from 'node:assert/strict';
import {createProceduralBandLog} from '../js/audio/band-procedural.js';
import {compileBandParts,sampleBandEnsemble} from '../js/audio/band-parts.js';
import {songBindingSummary} from '../js/audio/band-song-parts.js';
const log=createProceduralBandLog({type:'preset_1',title:'Generated fixture'},{duration:30,bpm:124});
assert.ok(log.score.stems.every(s=>s.events.length===0),'no fabricated melody before the generator actually emits sound');
log.append({stemId:'drums',time:.12,duration:.16,midi:36,velocity:1});
log.append({stemId:'synth-bass',time:.24,duration:.1,frequency:110,velocity:.4});
log.append({stemId:'drums',time:.6,duration:.14,midi:38,velocity:.7});
assert.equal(log.score.stems[1].events[0].midi,45,'110 Hz is A2, not an arbitrary bass scale');
for(const theme of ['one-piece','dragon-ball','naruto']){
 const parts=compileBandParts(log.score,theme),bound=parts.filter(p=>p.events.length);
 assert.equal(bound.length,2);assert.ok(bound.every(p=>p.instrumentId==='drums'||p.instrumentId==='synthesizer'));
 assert.ok(parts.filter(p=>p.technique==='voice').every(p=>p.events.length===0),'a procedural instrumental beat has no singer');
 assert.strictEqual(bound.find(p=>p.instrumentId==='synthesizer').events,log.score.stems[1].events);
 assert.strictEqual(bound.find(p=>p.instrumentId==='drums').events,log.score.stems[0].events,'drum kit, hand drums and snare use the same attributable percussion events');
 const frame=sampleBandEnsemble(log.score,parts,.28);assert.equal(frame.parts.some(p=>p.activity>0),true);
 assert.ok(sampleBandEnsemble(log.score,parts,1.5).parts.every(p=>p.activity===0),'actors stop after actual generated note ends');
}
assert.equal(songBindingSummary(log.score).ready,true,'percussion and keyboard families match all three original pet themes');
log.append({stemId:'drums',time:.05,duration:.16,midi:36});assert.equal(log.score.stems[1].events.length,0,'restarted/seeked generator cannot leak notes from its previous run');
assert.throws(()=>log.append({stemId:'not-a-source',time:0,duration:.1}));
assert.throws(()=>log.append({stemId:'synth-bass',time:0,duration:.1,frequency:0}));
console.log('PASS procedural source event provenance, exact generated pitch and timing, silent nonexistent vocals, matching actors and restart behavior');
