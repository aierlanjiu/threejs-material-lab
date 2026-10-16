import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateSongBindings,songBindingSummary,SONG_ACTORS,applyStoredSongReview,BAND_REVIEW_KEY} from '../js/audio/band-song-parts.js';
import {compileBandParts,sampleBandEnsemble} from '../js/audio/band-parts.js';
import {loadBandAnalysis,verifyBandSource,synthesizeBandScoreForTrack} from '../js/audio/band-library.js';
import {createBandDemoScore} from '../js/audio/band-timeline.js';

const sha=text=>createHash('sha256').update(text).digest('hex');
const review={reviewer:'synthetic-test-fixture',method:'test fixture only',at:'2026-10-15T00:00:00Z'};
const base=createBandDemoScore();
const makeScore=()=>{
 const score={...structuredClone(base),source:'analysis',trackId:'anime_op_we_are',sourceSha256:sha('test audio'),analysisSha256:sha('test analysis'),validation:{numericalPassed:true}};
 score.stems=score.stems.filter(s=>s.id!=='other').map(s=>({...s,audio:`./test-${s.id}.mp3`,audioSha256:sha(s.id),instrumentId:s.id}));
 score.sections=[];
 score.songBindings={version:1,trackId:score.trackId,sourceSha256:score.sourceSha256,unresolved:[],parts:score.stems.map(s=>({id:s.id,stemId:s.id,instrumentId:s.id,actors:Object.fromEntries(Object.entries(SONG_ACTORS).map(([theme,actors])=>[theme,actors[s.id]])),status:'candidate'}))};
 return score;
};
const candidate=makeScore();assert.equal(validateSongBindings(candidate).ok,true);
for(const theme of Object.keys(SONG_ACTORS))assert.ok(compileBandParts(candidate,theme).every(p=>p.events.length===0),'unreviewed estimates keep every actor at rest');
assert.equal(songBindingSummary(candidate).ready,false);
const verified=makeScore();for(const part of verified.songBindings.parts){part.status='verified';part.review={...review};}
assert.equal(songBindingSummary(verified).ready,false,'sound review cannot substitute instruments baked into the original pet');
const voiceOnly=structuredClone(verified);voiceOnly.stems=voiceOnly.stems.filter(s=>s.id==='vocals');voiceOnly.songBindings.parts=voiceOnly.songBindings.parts.filter(s=>s.id==='vocals');assert.equal(songBindingSummary(voiceOnly).ready,true);
const keyboardOnly=structuredClone(voiceOnly);keyboardOnly.stems[0]={...keyboardOnly.stems[0],id:'piano',instrumentId:'piano'};
keyboardOnly.songBindings.parts=[{...keyboardOnly.songBindings.parts[0],id:'piano',stemId:'piano',instrumentId:'piano',actors:{'one-piece':'law','dragon-ball':'gohan',naruto:'pain'}}];
assert.equal(songBindingSummary(keyboardOnly).ready,true,'piano, synthesizer and organ belong to the keyboard family');
for(const theme of Object.keys(SONG_ACTORS))assert.strictEqual(compileBandParts(keyboardOnly,theme).find(p=>p.stemId==='piano').events,keyboardOnly.stems[0].events);
for(const theme of Object.keys(SONG_ACTORS)){
 const parts=compileBandParts(verified,theme,{[`${theme}/${SONG_ACTORS[theme].bass}`]:{stem:'vocals',technique:'wind'}});
 for(const binding of verified.songBindings.parts){const part=parts.find(p=>p.id===`${theme}/${binding.actors[theme]}`);if(part.bindingStatus==='instrument-mismatch'){assert.equal(part.events.length,0);assert.equal(part.stemId,null);}else{assert.equal(part.stemId,binding.stemId);assert.strictEqual(part.events,verified.stems.find(s=>s.id===binding.stemId).events,'performer uses the entire attributable part, never a pitch-range subset');}}
 const bass=parts.find(p=>p.id===`${theme}/${SONG_ACTORS[theme].bass}`);if(theme!=='dragon-ball')assert.equal(bass.technique,'pluck');else assert.equal(bass.events.length,0,'a wind pet cannot impersonate a plucked string family');
 assert.ok(parts.find(p=>p.instrumentId==='drums')?.events.length,'all drum designs accept the percussion family');
 const sampled=sampleBandEnsemble(verified,parts,4);sampleBandEnsemble(verified,parts,15);assert.deepEqual(sampleBandEnsemble(verified,parts,4),sampled);
 const unbound=parts.filter(p=>!p.partId);assert.ok(unbound.every(p=>p.events.length===0));
}
const missingReview=structuredClone(verified);delete missingReview.songBindings.parts[0].review;assert.equal(validateSongBindings(missingReview).ok,false);
const wrongSource=structuredClone(verified);wrongSource.songBindings.sourceSha256=sha('other recording');assert.equal(validateSongBindings(wrongSource).ok,false);
const wrongInstrument=structuredClone(verified);wrongInstrument.songBindings.parts[0].instrumentId='piano';assert.equal(validateSongBindings(wrongInstrument).ok,false);
const duplicate=structuredClone(verified);duplicate.songBindings.parts[1].actors['one-piece']=duplicate.songBindings.parts[0].actors['one-piece'];assert.equal(validateSongBindings(duplicate).ok,false);
const corrupt=structuredClone(verified);corrupt.songBindings.parts=null;assert.equal(validateSongBindings(corrupt).ok,false);
const rejected=structuredClone(verified);rejected.songBindings.parts[0].status='rejected';assert.equal(songBindingSummary(rejected).ready,false);
const unknown=structuredClone(verified);unknown.songBindings.unresolved=[{stemId:'other',reason:'unknown instruments'}];assert.equal(songBindingSummary(unknown).ready,false);
const numericFail=structuredClone(verified);numericFail.validation.numericalPassed=false;assert.equal(songBindingSummary(numericFail).ready,false);
const state={[`${verified.trackId}:${verified.sourceSha256}`]:{analysisSha256:verified.analysisSha256,audioDigests:Object.fromEntries(verified.stems.map(s=>[s.id,s.audioSha256])),songBindings:verified.songBindings}};
const storage={getItem:key=>key===BAND_REVIEW_KEY?JSON.stringify(state):null};
assert.equal(songBindingSummary(applyStoredSongReview(candidate,storage)).verified,3);
assert.strictEqual(applyStoredSongReview({...candidate,analysisSha256:sha('new events')},storage).songBindings,candidate.songBindings,'changed events invalidate review');
const newAudio=structuredClone(candidate);newAudio.stems[0].audioSha256=sha('changed stem');assert.strictEqual(applyStoredSongReview(newAudio,storage),newAudio,'changed separated audio invalidates review');
assert.equal(synthesizeBandScoreForTrack({type:'custom',title:'real song'}),null);
assert.equal(await verifyBandSource({synthesized:true,sourceSha256:'0'.repeat(64)},'/fake'),false);

const oldFetch=globalThis.fetch;
try{
 globalThis.fetch=async path=>String(path).endsWith('score.json')?new Response(JSON.stringify(candidate)):new Response(null,{status:404});
 const loaded=await loadBandAnalysis('anime_op_we_are');assert.equal(loaded.songBindings.parts.length,3);assert.equal(validateSongBindings(loaded).ok,true);
 globalThis.fetch=async path=>String(path).endsWith('score.json')?new Response('{bad JSON'):new Response(null,{status:404});
 await assert.rejects(loadBandAnalysis('anime_op_we_are'),'corrupt per-song data must not turn into a synthetic score');
 globalThis.fetch=async()=>new Response('test audio');assert.equal(await verifyBandSource(verified,'/original'),true);
 globalThis.fetch=async()=>new Response('changed audio');assert.equal(await verifyBandSource(verified,'/original'),false);
}finally{globalThis.fetch=oldFetch;}
if(process.argv.includes('--analysis')){
 for(const id of JSON.parse(readFileSync(new URL('../output/lu-band-song-parts/audit.json',import.meta.url))).map(s=>s.trackId)){
  const s=JSON.parse(readFileSync(new URL(`../output/lu-band-song-parts/${id}/score.json`,import.meta.url)));assert.equal(validateSongBindings(s).ok,true);assert.equal(songBindingSummary(s).ready,false,'automatic pipeline must never approve listening');
 }
}
console.log('PASS attributable per-song parts, silent unreviewed/unknown actors, exact event ownership, source/instrument integrity, review invalidation, seek and corrupt-data handling');
