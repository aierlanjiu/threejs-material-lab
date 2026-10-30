import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBandMixer} from '../js/audio/band-mixer.js';

const bytes=new Uint8Array([1,2,3,4]);
const digest=createHash('sha256').update(bytes).digest('hex');
function fixture(t,kind='hybrid'){
 const output={connections:new Set()},starts=[];
 const parameter=()=>({value:1,cancelScheduledValues(){},cancelAndHoldAtTime(){},setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}});
 const node=()=>({connections:new Set(),connect(next){this.connections.add(next);return next;},disconnect(){this.connections.clear();},stop(){},start(){starts.push(this);}});
 const ctx={currentTime:0,state:'running',sampleRate:44100,createGain:()=>({...node(),gain:parameter()}),createBufferSource:()=>({...node(),buffer:{duration:60,length:2646000}}),decodeAudioData:async()=>({duration:60,length:2646000,numberOfChannels:2})};
 let track={type:'song-a'},bankWait=null;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async url=>{if(String(url)==='memory:bank'&&bankWait)await bankWait;return {ok:true,json:async()=>({banks:{}}),arrayBuffer:async()=>bytes.buffer};};
 const score=kind==='hybrid'?{trackId:'song-a',duration:60,hybrid:{bankManifest:'memory:bank',originalStems:[],mix:{original:.64,soloBed:.075,synth:.25,soloSynth:.9,originalFloor:.35}},arrangement:{themes:{'one-piece':[]}},stems:[]}:
  {trackId:'song-a',duration:60,arrangement:{mixMode:'independent-stems'},rendered:{chunkSeconds:60},stems:[{id:'bass',chunks:[{start:0,duration:60,audio:'memory:chunk',audioSha256:digest}]}]};
 const mixer=createBandMixer({getContext:()=>ctx,getOutput:()=>output,getTrack:()=>track,getTime:()=>0});mixer.setEnabled(true);
 t.after(()=>{mixer.dispose();globalThis.fetch=originalFetch;});
 function routes(source,seen=new Set(),gain=1){
  if(source===output)return [gain];if(seen.has(source))return [];
  const visited=new Set(seen);visited.add(source);
  return [...source.connections].flatMap(next=>routes(next,visited,gain*(source.gain?.value??1)));
 }
 return {mixer,score,ctx,starts,routes,switchTrack:()=>{track={type:'upload-decoded'};},waitBank:promise=>{bankWait=promise;}};
}

for(const kind of ['hybrid','rendered']){
 test(`${kind}: clearing a prepared engine keeps one original audio path`,async t=>{
  const f=fixture(t,kind);await f.mixer.configure(f.score);const source=f.ctx.createBufferSource();f.mixer.start(source,0,60);
  await f.mixer.configure(null);
  assert.deepEqual(f.routes(source),[1],'configure(null) must leave a unity-gain original path');
  f.mixer.stop();await f.mixer.configure(null);assert.deepEqual(f.routes(source),[],'stop must not be undone by later configuration');
 });
 test(`${kind}: a decoded next track bypasses stale engines before controller sync`,async t=>{
  const f=fixture(t,kind);await f.mixer.configure(f.score);const old=f.ctx.createBufferSource();f.mixer.start(old,0,60);
  f.mixer.setPolicy({muted:[],soloGroup:'bass'},0);
  f.switchTrack();const next=f.ctx.createBufferSource(),count=f.starts.length;f.mixer.start(next,0,60);
  assert.deepEqual(f.routes(next),[1],'next track must not inherit old stem gains or ducking');
  assert.deepEqual(f.routes(old),[]);assert.equal(f.starts.length,count,'no old stem may start for the new track');
  await f.mixer.configure(null);assert.deepEqual(f.routes(next),[1]);assert.equal(f.mixer.diagnostics.ready,false);
 });
}
test('preparing a replacement engine preserves the current original while loading',async t=>{
 const f=fixture(t);await f.mixer.configure(f.score);const source=f.ctx.createBufferSource();f.mixer.start(source,0,60);
 let release;f.waitBank(new Promise(resolve=>{release=resolve;}));const pending=f.mixer.configure({...f.score,trackId:'song-b'});
 assert.deepEqual(f.routes(source),[1],'fallback must survive the entire preparation window');
 release();await pending;assert.deepEqual(f.routes(source),[1]);
});
test('an old asynchronous preparation cannot revive an engine after a track switch',async t=>{
 const f=fixture(t);let release;f.waitBank(new Promise(resolve=>{release=resolve;}));const pending=f.mixer.configure(f.score);
 f.switchTrack();const source=f.ctx.createBufferSource();f.mixer.start(source,0,60);release();await pending;
 assert.equal(f.mixer.diagnostics.ready,false);assert.equal(f.mixer.diagnostics.hybrid,undefined);assert.deepEqual(f.routes(source),[1]);
});
