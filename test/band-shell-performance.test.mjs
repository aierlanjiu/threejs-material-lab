import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateBandScore} from '../js/audio/band-timeline.js';
import {validateArrangement} from '../js/audio/band-arrangement.js';
import {compileBandParts,sampleBandEnsemble} from '../js/audio/band-parts.js';
import {createRenderedStemAudio} from '../js/audio/band-rendered-audio.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const score=JSON.parse(fs.readFileSync(path.join(root,'assets/band-shell-performance/score.json')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const durations=new Map();
test('packaged performance owns nine real tracks and leaves the missing choir silent',()=>{
 assert.deepEqual(validateBandScore(score),{ok:true,errors:[]});assert.deepEqual(validateArrangement(score),{ok:true,errors:[]});
 const parts=compileBandParts(score,'one-piece');assert.equal(parts.length,10);assert.equal(parts[0].stemId,null);assert.equal(parts[0].events.length,0);
 assert.equal(new Set(parts.filter(p=>p.stemId).map(p=>p.stemId)).size,9);
 for(const stem of score.stems.filter(s=>s.chunks)){
  assert.equal(hash(fs.readFileSync(path.join(root,stem.audio))),stem.audioSha256);
  for(const chunk of stem.chunks){assert.equal(hash(fs.readFileSync(path.join(root,chunk.audio))),chunk.audioSha256);durations.set(chunk.audioSha256,chunk.duration);}
 }
 assert.equal(score.stems.reduce((n,s)=>n+(s.chunks?.length||0),0),207);
 assert.equal(new Set(score.stems.filter(s=>s.audio).map(s=>s.audioSha256)).size,9);
 for(const time of [0,15,70,100,170,230,266])assert.equal(sampleBandEnsemble(score,parts,time).parts[0].activity,0);
 const broken=structuredClone(score);broken.stems[1].chunks[2].start+=.1;assert.equal(validateArrangement(broken).ok,false);
});

function audioContext(){
 const context={currentTime:0,sampleRate:44100,starts:[]};
 const parameter=(initial=1)=>({value:initial,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},setTargetAtTime(v,at){if(at<=context.currentTime+.001)this.value=v;else this.future=[v,at];},linearRampToValueAtTime(v,at){this.ramp=[v,at];}});
 const node=()=>({connect(next){return next;},disconnect(){}});
 context.createGain=()=>({...node(),gain:parameter()});context.createStereoPanner=()=>({...node(),pan:parameter(0)});
 context.createBufferSource=()=>({...node(),start(at,offset,duration){context.starts.push({at,offset,duration});},stop(){}});
 context.decodeAudioData=async bytes=>{const duration=durations.get(hash(new Uint8Array(bytes)));assert(duration>0);return {duration,sampleRate:44100,length:Math.round(duration*44100),numberOfChannels:2};};
 return context;
}
const waitFor=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('audio scheduler timeout');};
test('chunked playback synchronizes voices, mutes independently, seeks and bounds its cache',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async url=>{const bytes=fs.readFileSync(path.join(root,url));return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
 const ctx=audioContext(),mixer=createRenderedStemAudio({getContext:()=>ctx,getOutput:()=>({}),getTime:()=>0});
 try{
  mixer.setEnabled(true);await mixer.configure(score);const start=mixer.start(ctx.createBufferSource(),0,score.duration);
  await waitFor(()=>mixer.diagnostics.ready&&mixer.diagnostics.pendingChunks.length===0);
  const first=ctx.starts.filter(s=>s.offset===0&&s.at===start.at);assert.equal(first.length,9);
  assert.equal(mixer.diagnostics.loaded.length,9);assert(mixer.diagnostics.cachedChunks.length<=2);
  assert(mixer.diagnostics.decodedBytes<90*1024*1024);
  mixer.setPolicy({muted:['one-piece/sanji'],soloGroup:null},ctx.currentTime);
  assert.equal(mixer.diagnostics.coefficients['one-piece/sanji'],0);assert.equal(mixer.diagnostics.coefficients['one-piece/zoro'],1);
  mixer.setPolicy({muted:[],soloGroup:'one-piece/zoro'},ctx.currentTime);
  assert.equal(Object.values(mixer.diagnostics.coefficients).filter(v=>v===1).length,1);
  const seek=mixer.start(ctx.createBufferSource(),65,score.duration);await waitFor(()=>mixer.diagnostics.ready&&mixer.diagnostics.pendingChunks.length===0);
  assert.deepEqual(mixer.diagnostics.cachedChunks.sort(),[5,6]);
  ctx.currentTime=seek.at+12.9;await waitFor(()=>mixer.diagnostics.cachedChunks.includes(7)&&mixer.diagnostics.pendingChunks.length===0);
  assert(mixer.diagnostics.cachedChunks.length<=2);
  mixer.setEnabled(false);assert(Object.values(mixer.diagnostics.coefficients).every(v=>v===0));
 }finally{mixer.dispose();globalThis.fetch=originalFetch;}
});
