import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateBandScore,sampleBandFrame,createBandDemoScore} from '../js/audio/band-timeline.js';
import {BAND_TRACKS} from '../js/audio/band-library.js';

const demo=createBandDemoScore();
assert.equal(validateBandScore(demo).ok,true);
const paused=sampleBandFrame(demo,12.3);
sampleBandFrame(demo,29);sampleBandFrame(demo,0);
assert.deepEqual(sampleBandFrame(demo,12.3),paused,'seek must not retain a later pose');
assert.equal(sampleBandFrame(demo,-1).time,0);
assert.equal(sampleBandFrame(demo,Infinity).time,0);
assert.equal(sampleBandFrame(demo,8).lead,'other','section boundary selects the new performer');
const ended=sampleBandFrame(demo,100);
assert.equal(ended.time,32);assert.equal(ended.lead,null);
for(const stem of Object.values(ended.stems))assert.deepEqual(stem,{energy:0,attack:0,notes:[]});
const invalid=structuredClone(demo);invalid.stems[0].events[0].end=NaN;
assert.equal(validateBandScore(invalid).ok,false,'nonfinite events must be rejected');
const fixture={...demo,duration:2,sections:[{start:0,end:2,lead:'vocals',active:['vocals'],label:'test'}],stems:[{
 id:'vocals',label:'test',events:[{start:.5,end:1,midi:60,velocity:.8,confidence:.7}],
 envelope:[{time:0,value:0},{time:1,value:1},{time:2,value:0}],onsets:[{time:.5,strength:1}]
}]};
assert.equal(sampleBandFrame(fixture,.5).stems.vocals.energy,.5);
assert.equal(sampleBandFrame(fixture,.5).stems.vocals.attack,1);
assert.equal(sampleBandFrame(fixture,.7).stems.vocals.attack,0);
assert.equal(sampleBandFrame(fixture,1).stems.vocals.notes.length,0,'notes have exclusive end');

if(process.argv.includes('--analysis'))for(const {id} of BAND_TRACKS){
 const score=JSON.parse(readFileSync(new URL(`../output/lu-band/${id}/score.json`,import.meta.url)));
 assert.deepEqual(validateBandScore(score),{ok:true,errors:[]},id);
 const hash=createHash('sha256').update(readFileSync(new URL(`../output/audio/${id}.mp3`,import.meta.url))).digest('hex');
 assert.equal(score.sourceSha256,hash,id);assert.equal(score.musicxmlError,null,id);
 assert.deepEqual(new Set(score.stems.map(s=>s.id)),new Set(['vocals','bass','drums','other']));
 for(const time of [0,.75,8,score.duration/2,score.duration]){
  const frame=sampleBandFrame(score,time);sampleBandFrame(score,score.duration);
  assert.deepEqual(sampleBandFrame(score,time),frame,id);
 }
 if(id==='anime_op_overtaken'){
  assert.equal(score.instrumental,true);const voice=score.stems.find(s=>s.id==='vocals');
  assert.equal(voice.events.length,0);assert.ok(voice.envelope.every(p=>p.value===0));
  assert.ok(score.sections.every(s=>s.lead!=='vocals'));
 }
 console.log(`PASS ${id}: source verified, four stems, timeline and MusicXML`);
}
console.log('PASS band timeline boundaries, interpolation, pause/seek determinism and invalid input');
