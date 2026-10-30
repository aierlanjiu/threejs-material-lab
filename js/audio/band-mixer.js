// All-on is the original mix. Muting subtracts the attributable model source;
// solo uses the actual source. Unseparated accompaniment is never duplicated.
import {createBandHybridAudio} from './band-hybrid-audio.js';
import {createRenderedStemAudio} from './band-rendered-audio.js';
export function createBandMixer({getContext,getOutput,getTrack,getTime=()=>0}){
 let trackId='',buffers=new Map(),sources=[],originalGain=null,revision=0,abort=null,ready=false,enabled=false,policy={muted:[],soloGroup:null},independent=false,restoreSongTime=null;
 const buses=new Map(),spatialChains=new Map();
 let hybrid=null,theme='one-piece',spatial={};
 let procedural=false,rendered=null,activeSource=null;
 function setAudioParam(param,value){
  if(!param||!Number.isFinite(value))return;
  const ctx=getContext?.(),now=ctx?.currentTime||0;
  if(ctx?.state==='running'&&typeof param.setTargetAtTime==='function'){
   if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(now);
   else param.cancelScheduledValues?.(now);
   param.setTargetAtTime(value,now,.024);
  }else{
   param.cancelScheduledValues?.(now);
   param.setValueAtTime?.(value,now);
   param.value=value;
  }
 }
 function attachSpatialChain(ctx,id,inputNode,allowSpatial=true){
  const out=getOutput();
  const depth=ctx.createGain();depth.gain.value=1;
  const shelf=typeof ctx.createBiquadFilter==='function'?ctx.createBiquadFilter():null;
  if(shelf){shelf.type='highshelf';shelf.frequency.value=3200;shelf.gain.value=0;}
  const panner=typeof ctx.createStereoPanner==='function'?ctx.createStereoPanner():null;
  if(panner)panner.pan.value=0;
  inputNode.connect(depth);
  let tail=depth;if(shelf){tail.connect(shelf);tail=shelf;}if(panner){tail.connect(panner);tail=panner;}tail.connect(out);
  const chain={depth,shelf,panner,allowSpatial};
  spatialChains.set(id,chain);
  applyChainSpatial(id,chain);
  return chain;
 }
 function applyChainSpatial(id,chain=spatialChains.get(id)){
  if(!chain)return;
  const sp=chain.allowSpatial?(spatial[id]||{pan:0,depthGain:1,shelfDb:0}):{pan:0,depthGain:1,shelfDb:0};
  setAudioParam(chain.depth?.gain,sp.depthGain??1);
  if(chain.shelf)setAudioParam(chain.shelf.gain,sp.shelfDb??0);
  if(chain.panner)setAudioParam(chain.panner.pan,sp.pan??0);
 }
 function gainValue(id){return !enabled?1:policy.soloGroup?(policy.soloGroup===id?1:procedural?.12:0):policy.muted.includes(id)?(procedural?.35:0):1;}
 const bedValue=()=>!enabled?1:independent&&ready?(policy.soloGroup?.075:.64):policy.soloGroup?0:1;
 const autoBedValue=()=>enabled&&independent&&ready?.64:1;
 const coefficient=id=>independent?!enabled?0:policy.soloGroup?(policy.soloGroup===id?.9:0):policy.muted.includes(id)?-.64*.65:.25:gainValue(id)-bedValue();
 function ramp(node,value,at,autoValue=null,autoAt=null){const ctx=getContext(),param=node.gain,now=ctx.currentTime,target=Math.max(now,at);const current=param.value;
  if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);else{param.cancelScheduledValues(now);param.setValueAtTime(current,now);}
  param.setValueAtTime(current,target);param.linearRampToValueAtTime(value,target+.045);
  if(autoAt!==null&&autoAt>target+.045){param.setValueAtTime(value,autoAt);param.linearRampToValueAtTime(autoValue,autoAt+.045);}
 }
 function schedule(at=getContext().currentTime,restoreAt=null){const bed=bedValue(),autoBed=autoBedValue();
  if(restoreAt===null&&restoreSongTime!==null)restoreAt=getContext().currentTime+Math.max(0,restoreSongTime-getTime());
  if(originalGain)ramp(originalGain,bed,at,autoBed,restoreAt);
  for(const item of sources){const coef=coefficient(item.id);ramp(item.gain,coef,at,independent&&enabled?.25:1-autoBed,restoreAt);if(item.chain){item.chain.allowSpatial=coef>=0;applyChainSpatial(item.id,item.chain);}}
  for(const [id,bus] of buses)ramp(bus,gainValue(id),at,1,restoreAt);
 }
 function stopStems(){for(const item of sources){try{item.source.stop();}catch{}item.source.disconnect();item.gain.disconnect();item.chain?.depth?.disconnect();item.chain?.shelf?.disconnect();item.chain?.panner?.disconnect();spatialChains.delete(item.id);}sources=[];}
 function connectOriginal(source,value=1){originalGain?.disconnect();originalGain=getContext().createGain();originalGain.gain.value=value;source.connect(originalGain);originalGain.connect(getOutput());}
 function stop(){rendered?.stop();hybrid?.stop();stopStems();originalGain?.disconnect();originalGain=null;activeSource=null;}
 return {
  setTheme(value){theme=value;},
  async configure(score){
   const restoreOriginal=Boolean(rendered||hybrid)&&activeSource;
   rendered?.dispose();rendered=null;
   hybrid?.dispose();hybrid=null;
   stopStems();if(restoreOriginal)connectOriginal(restoreOriginal);
   const token=++revision;abort?.abort();abort=new AbortController();ready=false;trackId=score?.trackId||'';buffers=new Map();policy={muted:[],soloGroup:null};restoreSongTime=null;independent=score?.arrangement?.mixMode==='independent-stems';procedural=score?.source==='procedural';
   if(originalGain||buses.size)schedule();
   if(!score)return;
   if(score.rendered){const next=createRenderedStemAudio({getContext,getOutput,getTime});rendered=next;next.setEnabled(enabled);next.setSpatial(spatial);await next.configure(score);if(token===revision)ready=true;return;}
   if(score.hybrid){const next=createBandHybridAudio({getContext,getOutput,getTime});hybrid=next;next.setEnabled(enabled);next.setSpatial?.(spatial);await next.configure(score,theme);if(token===revision)ready=true;return;}
   if(score.source==='procedural'){ready=true;return;}
   const ctx=getContext(),loaded=await Promise.all(score.stems.filter(s=>s.audio).map(async stem=>{
    const response=await fetch(stem.audio,{signal:abort.signal});if(!response.ok)throw new Error('指挥声轨无法读取');const bytes=await response.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==stem.audioSha256)throw new Error('指挥音轨摘要不一致');
    const buffer=await ctx.decodeAudioData(bytes);if(Math.abs(buffer.duration-score.duration)>.12)throw new Error('指挥声轨时长不一致');return [stem.id,buffer];
   }));
   if(token!==revision)return;buffers=new Map(loaded);ready=true;
  },
  start(source,offset,duration,loop=false,advanceOffset=false){
   stop();activeSource=source;
   if(trackId!==getTrack()?.type){
    ++revision;abort?.abort();rendered?.dispose();rendered=null;hybrid?.dispose();hybrid=null;
    ready=false;independent=false;procedural=false;trackId='';buffers=new Map();policy={muted:[],soloGroup:null};restoreSongTime=null;
   }
   if(rendered)return rendered.start(source,offset,duration,loop,advanceOffset);
   if(hybrid)return hybrid.start(source,offset,duration,loop,advanceOffset);
   const ctx=getContext(),preparedAt=ctx.currentTime;
   connectOriginal(source,bedValue());
   if(enabled&&ready&&trackId===getTrack()?.type){for(const [id,raw] of buffers){
    let buffer=raw;
    if(raw.length!==source.buffer.length){buffer=ctx.createBuffer(raw.numberOfChannels,source.buffer.length,raw.sampleRate);for(let c=0;c<raw.numberOfChannels;c++)buffer.copyToChannel(raw.getChannelData(c).subarray(0,buffer.length),c);buffers.set(id,buffer);}
    const stem=ctx.createBufferSource(),gain=ctx.createGain(),coef=coefficient(id);stem.buffer=buffer;stem.loop=loop;stem.loopEnd=duration;
    gain.gain.value=coef;stem.connect(gain);const chain=attachSpatialChain(ctx,id,gain,coef>=0);sources.push({id,source:stem,gain,chain});
   }}
   const at=ctx.currentTime+.012,actualOffset=(offset+(advanceOffset?ctx.currentTime-preparedAt:0))%duration;
   for(const item of sources)item.source.start(at,actualOffset);
   if(restoreSongTime!==null)schedule(at,at+Math.max(0,restoreSongTime-actualOffset));
   return {at,offset:actualOffset};
  },
  proceduralBus(id){const ctx=getContext();if(!buses.has(id)){const bus=ctx.createGain();bus.gain.value=gainValue(id);attachSpatialChain(ctx,id,bus,true);buses.set(id,bus);}return buses.get(id);},
  prepareProcedural(id){if(trackId!==id){trackId=id;policy={muted:[],soloGroup:null};for(const bus of buses.values())bus.disconnect();for(const c of spatialChains.values()){c.depth?.disconnect();c.shelf?.disconnect();c.panner?.disconnect();}buses.clear();spatialChains.clear();}procedural=true;ready=true;buffers=new Map();},
  setPolicy(next,audioTime,{restoreTime=null}={}){policy={muted:[...next.muted],soloGroup:next.soloGroup};restoreSongTime=restoreTime;if(rendered)rendered.setPolicy(next,audioTime,{restoreTime});else if(hybrid)hybrid.setPolicy(next,audioTime,{restoreTime});else schedule(audioTime);},
  setSpatial(next={}){if(!next||typeof next!=='object')return;spatial={...spatial,...next};rendered?.setSpatial(spatial);hybrid?.setSpatial?.(spatial);for(const [id,chain] of spatialChains)applyChainSpatial(id,chain);},
  setEnabled(value){enabled=Boolean(value);rendered?.setEnabled(enabled);hybrid?.setEnabled(enabled);if(originalGain||buses.size)schedule();},stop,
  get diagnostics(){if(rendered)return rendered.diagnostics;if(hybrid)return hybrid.diagnostics;return {ready,enabled,trackId,independent,restoreSongTime,loaded:[...buffers.keys()],policy:{...policy},coefficients:Object.fromEntries(sources.map(s=>[s.id,s.gain.gain.value])),bed:originalGain?.gain.value??1,spatial:{...spatial}};},
  dispose(){++revision;abort?.abort();rendered?.dispose();hybrid?.dispose();stop();for(const bus of buses.values())bus.disconnect();for(const c of spatialChains.values()){c.depth?.disconnect();c.shelf?.disconnect();c.panner?.disconnect();}buses.clear();spatialChains.clear();}
 };
}
