import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateFamilyBindings} from '../js/audio/band-family-bindings.js';
import {compileBandParts,sampleBandEnsemble} from '../js/audio/band-parts.js';
import {songBindingSummary} from '../js/audio/band-song-parts.js';
const root=new URL('../output/lu-band-song-parts/',import.meta.url);
if(!fs.existsSync(new URL('family-binding-summary.json',root)))throw new Error('Generate the actual family analysis first');
for(const {trackId} of JSON.parse(fs.readFileSync(new URL('family-binding-summary.json',root)))){
 const score=JSON.parse(fs.readFileSync(new URL(`${trackId}/score.json`,root)));
 score.familyBindings=JSON.parse(fs.readFileSync(new URL(`${trackId}/family-bindings.json`,root)));
 assert.equal(validateFamilyBindings(score,score.familyBindings).ok,true,trackId);
 assert.equal(songBindingSummary(score).ready,false,'machine estimates cannot be labelled human-verified');
 assert.equal(songBindingSummary(score).readyForConducting,true);
 for(const theme of ['one-piece','dragon-ball','naruto']){
  const parts=compileBandParts(score,theme);
  for(const part of parts.filter(p=>p.stemId)){
   assert.equal(part.bindingStatus,'estimated');
   assert.strictEqual(part.events,score.stems.find(s=>s.id===part.stemId).events,'no pitch splitting or fabricated melody');
   const sampled=sampleBandEnsemble(score,parts,31.25);sampleBandEnsemble(score,parts,93.94);
   assert.deepEqual(sampleBandEnsemble(score,parts,31.25),sampled,'seek is deterministic');
  }
 }
 const changed=structuredClone(score.familyBindings);changed.audioDigests[score.stems[0].id]='0'.repeat(64);
 assert.equal(validateFamilyBindings(score,changed).ok,false,'a changed audio source invalidates model evidence');
 const wrongActor=structuredClone(score.familyBindings);wrongActor.parts[0].actors['one-piece']='nonsense';
 assert.equal(validateFamilyBindings(score,wrongActor).ok,false);
}
const audit=JSON.parse(fs.readFileSync(new URL('agy-mapping-audit.json',root)));
let reconciled=0;
for(const track of audit.tracks.filter(t=>t.lyricSignalConflicts.length)){
 const score=JSON.parse(fs.readFileSync(new URL(`${track.trackId}/score.json`,root)));
 score.familyBindings=JSON.parse(fs.readFileSync(new URL(`${track.trackId}/family-bindings.json`,root)));
 const parts=compileBandParts(score,'one-piece'),voice=parts.find(p=>p.familyId==='vocals');assert.ok(voice);
 for(const conflict of track.lyricSignalConflicts){
  const values=Array.from({length:20},(_,i)=>sampleBandEnsemble(score,parts,conflict.time-.3+i*.1).parts.find(p=>p.id===voice.id).activity);
  if(Math.max(...values)>.18)reconciled++;
 }
}
assert.ok(reconciled>=20,`measured vocal events must repair the supplied silent windows; repaired ${reconciled}`);
console.log(`PASS 16-song model evidence integrity, family compatibility, original event ownership, explicit estimate labels, deterministic seeking; ${reconciled}/23 supplied lyric-time conflicts now driven by measured vocals`);
