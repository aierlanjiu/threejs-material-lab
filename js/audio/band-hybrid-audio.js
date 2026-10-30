import {createBandSamplePlayer,verifiedAudio} from './band-sample-player.js';

// Normalized coefficients are also used by actual audio tests. A missing
// original instrument never causes a different original stem to be attenuated.
export function hybridLevels(score,theme,policy,enabled=true){
 const mix=score.hybrid.mix,parts=score.arrangement.themes[theme]||[];
 const bed=!enabled?1:policy.soloGroup?mix.soloBed:mix.original;
 const gains={},original={};
 for(const part of parts){
  const audible=!policy.soloGroup?!policy.muted.includes(part.stemId):policy.soloGroup===part.stemId;
  gains[part.stemId]=!enabled?0:audible?(policy.soloGroup?mix.soloSynth:mix.synth):0;
  if(part.originalStemId){
   // The recorded singer supplies the independent vocal bus as well.
   const vocal=part.instrumentId==='vocals'?gains[part.stemId]*(policy.soloGroup?1:.45):0;
   original[part.originalStemId]=!enabled?0:policy.soloGroup?vocal:policy.muted.includes(part.stemId)?-bed*(1-mix.originalFloor):vocal;
  }
 }
 return {bed,gains,original};
}

export function createBandHybridAudio({getContext,getOutput,getTime=()=>0}){
 let score=null,theme='one-piece',enabled=false,policy={muted:[],soloGroup:null},restoreTime=null;
 let player=null,buffers=new Map(),sources=[],originalGain=null,abort=null,ready=false,revision=0,spatial={};
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
 function applySourceSpatial(){
  if(!sources.length)return;
  const levels=score?hybridLevels(score,theme,policy,enabled):null;
  for(const item of sources){
   const coef=levels?levels.original[item.id]||0:0;
   const sp=coef<0?{pan:0,depthGain:1,shelfDb:0}:(spatial[item.id]||{pan:0,depthGain:1,shelfDb:0});
   setAudioParam(item.depth?.gain,sp.depthGain??1);
   if(item.shelf)setAudioParam(item.shelf.gain,sp.shelfDb??0);
   if(item.panner)setAudioParam(item.panner.pan,sp.pan??0);
  }
 }
 function ramp(node,value,at,after=null,autoAt=null){const ctx=getContext(),p=node.gain,now=ctx.currentTime,target=Math.max(now,at);
  if(p.cancelAndHoldAtTime)p.cancelAndHoldAtTime(now);else{const v=p.value;p.cancelScheduledValues(now);p.setValueAtTime(v,now);}
  p.setValueAtTime(p.value,target);
  p.linearRampToValueAtTime(value,target+.045);
  if(autoAt!==null&&autoAt>target+.045){p.setValueAtTime(value,autoAt);p.linearRampToValueAtTime(after,autoAt+.045);}
 }
 function schedule(at=getContext().currentTime,restoreAt=null){if(!score)return;
  if(!ready){if(originalGain)ramp(originalGain,1,at);return;}
  if(restoreAt===null&&restoreTime!==null)restoreAt=getContext().currentTime+Math.max(0,restoreTime-getTime());
  const levels=hybridLevels(score,theme,policy,enabled),auto=hybridLevels(score,theme,{muted:[],soloGroup:null},enabled);
  if(originalGain)ramp(originalGain,levels.bed,at,auto.bed,restoreAt);
  for(const [id,bus] of player?.buses||[])ramp(bus,levels.gains[id]||0,at,auto.gains[id]||0,restoreAt);
  for(const item of sources)ramp(item.gain,levels.original[item.id]||0,at,auto.original[item.id]||0,restoreAt);
  applySourceSpatial();
 }
 function stop(){player?.stop();for(const s of sources){try{s.source.stop();}catch{}s.source.disconnect();s.gain.disconnect();s.depth?.disconnect();s.shelf?.disconnect();s.panner?.disconnect();}sources=[];originalGain?.disconnect();originalGain=null;}
 return {
  async configure(data,nextTheme){const token=++revision;abort?.abort();abort=new AbortController();ready=false;stop();player?.dispose();
   score=data;theme=nextTheme;policy={muted:[],soloGroup:null};restoreTime=null;buffers.clear();
   const ctx=getContext();player=createBandSamplePlayer(ctx,getOutput());player.setSpatial?.(spatial);
   const wanted=new Set(score.arrangement.themes[theme].map(p=>p.originalStemId).filter(Boolean));
   const sampleRate=ctx.sampleRate||44100;
   const decoder=typeof OfflineAudioContext==='function'?new OfflineAudioContext(2,1,sampleRate):ctx;
   for(const item of score.hybrid.originalStems.filter(s=>wanted.has(s.id))){
    const b=await verifiedAudio(decoder,item,abort.signal);if(Math.abs(b.duration-score.duration)>.15)throw new Error('原曲控制声轨时长不一致');buffers.set(item.id,b);
   }
   await player.configure(score,theme,abort.signal);player.setSpatial?.(spatial);if(token!==revision)return;ready=true;
  },
  start(source,offset,duration,loop,advanceOffset){stop();const ctx=getContext(),prepared=ctx.currentTime,out=getOutput();
   originalGain=ctx.createGain();const levels=hybridLevels(score,theme,policy,enabled);originalGain.gain.value=ready?levels.bed:1;
   source.connect(originalGain);originalGain.connect(out);
   if(ready){for(const [id,buffer] of buffers){const s=ctx.createBufferSource(),g=ctx.createGain(),depth=ctx.createGain();
     const shelf=typeof ctx.createBiquadFilter==='function'?ctx.createBiquadFilter():null;
     if(shelf){shelf.type='highshelf';shelf.frequency.value=3200;shelf.gain.value=0;}
     const panner=typeof ctx.createStereoPanner==='function'?ctx.createStereoPanner():null;
     if(panner)panner.pan.value=0;
     s.buffer=buffer;s.loop=loop;s.loopEnd=duration;
     g.gain.value=levels.original[id]||0;depth.gain.value=1;
     s.connect(g);g.connect(depth);
     let tail=depth;if(shelf){tail.connect(shelf);tail=shelf;}if(panner){tail.connect(panner);tail=panner;}tail.connect(out);
     sources.push({id,source:s,gain:g,depth,shelf,panner});}}
   const at=ctx.currentTime+.025,actualOffset=(offset+(advanceOffset?ctx.currentTime-prepared:0))%duration;
   for(const [id,bus] of player?.buses||[]){bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(levels.gains[id]||0,ctx.currentTime);}
   applySourceSpatial();
   for(const s of sources)s.source.start(at,actualOffset);
   if(ready&&enabled)player.start(at,actualOffset,duration,loop);
   schedule(at,restoreTime===null?null:at+Math.max(0,restoreTime-actualOffset));return {at,offset:actualOffset};
  },
  setPolicy(next,at,{restoreTime:restore=null}={}){policy={muted:[...next.muted],soloGroup:next.soloGroup};restoreTime=restore;schedule(at);},
  setSpatial(next={}){if(!next||typeof next!=='object')return;spatial={...spatial,...next};player?.setSpatial?.(spatial);applySourceSpatial();},
  setEnabled(value){enabled=Boolean(value);if(!enabled)player?.stop();schedule();},stop,
  get diagnostics(){return {hybrid:true,theme,ready,enabled,trackId:score?.trackId,restoreSongTime:restoreTime,
    policy,levels:score?hybridLevels(score,theme,policy,enabled):null,loaded:[...buffers.keys()],
    bed:originalGain?.gain.value??1,coefficients:Object.fromEntries(sources.map(s=>[s.id,s.gain.gain.value])),
    spatial:{...spatial,...(player?.diagnostics?.spatial||{})},player:player?.diagnostics};},
  dispose(){++revision;abort?.abort();stop();player?.dispose();buffers.clear();}
 };
}
