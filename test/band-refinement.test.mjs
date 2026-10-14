import assert from 'node:assert/strict';
import {parseBandLrc,buildBandCues} from '../js/audio/band-cues.js';
import {formationAt} from '../js/audio/band-layout.js';
import {stageClimaxAt} from '../js/audio/band-stage-layout.js';
import {createBandAudioSources} from '../js/audio/band-audio-source.js';
import {bandRecordingLayout} from '../js/ui/band-recording-layout.js';

assert.deepEqual(parseBandLrc('[offset:500]\n[00:01.50][00:02.750]hello'),[{time:2,text:'hello'},{time:3.25,text:'hello'}]);
const envelope=Array.from({length:100},(_,time)=>({time,value:time>=20&&time<42||time>=60&&time<82?.8:.12}));
const onsets=Array.from({length:200},(_,i)=>({time:i*.5,strength:i*.5>=20&&i*.5<42||i*.5>=60&&i*.5<82?.95:.2}));
const score={duration:100,bpmEstimate:120,stems:['vocals','drums','bass'].map(id=>({id,envelope,onsets}))};
const lyrics=[{time:22,text:'Repeated chorus line one'},{time:26,text:'Repeated chorus line two'},{time:62,text:'Repeated chorus line one'},{time:66,text:'Repeated chorus line two'}];
score.stageCues=buildBandCues(score,lyrics);
assert.equal(score.stageCues.source,'lrc-repetition-and-drum-onsets');assert.equal(score.stageCues.choruses.length,2);
assert.ok(score.stageCues.choruses.every(c=>c.end>c.start&&c.end<=100));
assert.equal(formationAt(27,score).id,'ring');assert.ok(stageClimaxAt(score,27).intensity>.8);
assert.equal(formationAt(19,score).id,'wings');
const fallback=buildBandCues(score,[]);assert.equal(fallback.source,'energy-fallback');assert.equal(fallback.choruses.length,0);
assert.ok(bandRecordingLayout(1080,1920).score.height<1920*.08);

let calls=[],revoked=[];const api={createObjectURL:()=>`blob:cached-${calls.length}`,revokeObjectURL:value=>revoked.push(value)};
const stream=createBandAudioSources({locationHost:'127.0.0.1',urlApi:api,fetcher:async(src,options)=>{calls.push(options.method||'GET');return new Response(null,{headers:{'Accept-Ranges':'bytes'}});}});
assert.equal(await stream.resolve('/song.mp3'),'/song.mp3');assert.deepEqual(calls,['HEAD']);stream.dispose();
calls=[];const blob=createBandAudioSources({locationHost:'127.0.0.1',urlApi:api,fetcher:async(src,options)=>{calls.push(options.method||'GET');return new Response(options.method==='HEAD'?null:new Blob(['audio']));}});
const first=await blob.resolve('/song.mp3');assert.equal(await blob.resolve('/song.mp3'),first);assert.deepEqual(calls,['HEAD','GET']);assert.equal(blob.mode,'blob-fallback');blob.dispose();assert.ok(revoked.includes(first));
calls=[];const noHead=createBandAudioSources({locationHost:'0.0.0.0',urlApi:api,fetcher:async(src,options)=>{calls.push(options.method||'GET');return new Response(options.method==='HEAD'?null:new Blob(['audio']),{status:options.method==='HEAD'?405:200});}});
assert.match(await noHead.resolve('/song.mp3'),/^blob:/);assert.deepEqual(calls,['HEAD','GET']);noHead.dispose();
console.log('PASS LRC timing, repetition/onset chorus cues, shared formation/FX timing, compact recording and streaming/Blob audio paths');
