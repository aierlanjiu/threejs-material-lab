// All-on is the original mix. Muting subtracts the attributable model source;
// solo uses the actual source. Unseparated accompaniment is never duplicated.
import {createBandHybridAudio} from './band-hybrid-audio.js';
export function createBandMixer({getContext,getOutput,getTrack,getTime=()=>0}){
 let trackId='',buffers=new Map(),sources=[],originalGain=null,revision=0,abort=null,ready=false,enabled=false,policy={muted:[],soloGroup:null},independent=false,restoreSongTime=null;
 const buses=new Map();
 let hybrid=null,theme='one-piece';
 let procedural=false;
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
  for(const item of sources)ramp(item.gain,coefficient(item.id),at,independent&&enabled?.25:1-autoBed,restoreAt);
  for(const [id,bus] of buses)ramp(bus,gainValue(id),at,1,restoreAt);
 }
 function stop(){hybrid?.stop();for(const item of sources){try{item.source.stop();}catch{}item.source.disconnect();item.gain.disconnect();}sources=[];originalGain?.disconnect();originalGain=null;}
 return {
  setTheme(value){theme=value;},
  async configure(score){
   hybrid?.dispose();hybrid=null;
   const token=++revision;abort?.abort();abort=new AbortController();ready=false;trackId=score?.trackId||'';buffers=new Map();policy={muted:[],soloGroup:null};restoreSongTime=null;independent=score?.arrangement?.mixMode==='independent-stems';procedural=score?.source==='procedural';
   if(originalGain||buses.size)schedule();
   if(!score)return;
   if(score.hybrid){stop();const next=createBandHybridAudio({getContext,getOutput,getTime});hybrid=next;next.setEnabled(enabled);await next.configure(score,theme);if(token===revision)ready=true;return;}
   if(score.source==='procedural'){ready=true;return;}
   const ctx=getContext(),loaded=await Promise.all(score.stems.filter(s=>s.audio).map(async stem=>{
    const response=await fetch(stem.audio,{signal:abort.signal});if(!response.ok)throw new Error('指挥声轨无法读取');const bytes=await response.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==stem.audioSha256)throw new Error('指挥音轨摘要不一致');
    const buffer=await ctx.decodeAudioData(bytes);if(Math.abs(buffer.duration-score.duration)>.12)throw new Error('指挥声轨时长不一致');return [stem.id,buffer];
   }));
   if(token!==revision)return;buffers=new Map(loaded);ready=true;
  },
  start(source,offset,duration,loop=false,advanceOffset=false){
   if(hybrid)return hybrid.start(source,offset,duration,loop,advanceOffset);
   stop();const ctx=getContext(),preparedAt=ctx.currentTime;
   if(trackId!==getTrack()?.type)policy={muted:[],soloGroup:null};
   originalGain=ctx.createGain();originalGain.gain.value=bedValue();source.connect(originalGain);originalGain.connect(getOutput());
   if(enabled&&ready&&trackId===getTrack()?.type){for(const [id,raw] of buffers){
    let buffer=raw;
    if(raw.length!==source.buffer.length){buffer=ctx.createBuffer(raw.numberOfChannels,source.buffer.length,raw.sampleRate);for(let c=0;c<raw.numberOfChannels;c++)buffer.copyToChannel(raw.getChannelData(c).subarray(0,buffer.length),c);buffers.set(id,buffer);}
    const stem=ctx.createBufferSource(),gain=ctx.createGain();stem.buffer=buffer;stem.loop=loop;stem.loopEnd=duration;
    gain.gain.value=coefficient(id);stem.connect(gain);gain.connect(getOutput());sources.push({id,source:stem,gain});
   }}
   const at=ctx.currentTime+.012,actualOffset=(offset+(advanceOffset?ctx.currentTime-preparedAt:0))%duration;
   for(const item of sources)item.source.start(at,actualOffset);
   if(restoreSongTime!==null)schedule(at,at+Math.max(0,restoreSongTime-actualOffset));
   return {at,offset:actualOffset};
  },
  proceduralBus(id){const ctx=getContext();if(!buses.has(id)){const bus=ctx.createGain();bus.gain.value=gainValue(id);bus.connect(getOutput());buses.set(id,bus);}return buses.get(id);},
  prepareProcedural(id){if(trackId!==id){trackId=id;policy={muted:[],soloGroup:null};for(const bus of buses.values())bus.disconnect();buses.clear();}procedural=true;ready=true;buffers=new Map();},
  setPolicy(next,audioTime,{restoreTime=null}={}){policy={muted:[...next.muted],soloGroup:next.soloGroup};restoreSongTime=restoreTime;if(hybrid)hybrid.setPolicy(next,audioTime,{restoreTime});else schedule(audioTime);},
  setEnabled(value){enabled=Boolean(value);hybrid?.setEnabled(enabled);if(originalGain||buses.size)schedule();},stop,
  get diagnostics(){if(hybrid)return hybrid.diagnostics;return {ready,enabled,trackId,independent,restoreSongTime,loaded:[...buffers.keys()],policy:{...policy},coefficients:Object.fromEntries(sources.map(s=>[s.id,s.gain.gain.value])),bed:originalGain?.gain.value??1};},
  dispose(){++revision;abort?.abort();hybrid?.dispose();stop();for(const bus of buses.values())bus.disconnect();buses.clear();}
 };
}
