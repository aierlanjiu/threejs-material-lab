import {matchesInstrumentFamily} from '../avatar/instrument-manifest.js';
// Events are appended at the same instant that the audio generator starts a source.
// This is an event log of actual generated sound, not a guessed score for an MP3.
export function createProceduralBandLog(track,{duration=180,bpm=124}={}){
 const definitions=[
  {id:'drums',label:'合成鼓组',instrumentId:'drums',actors:{'one-piece':'sanji','dragon-ball':'krillin',naruto:'sakura'}},
  {id:'synth-bass',label:'电子低音合成器',instrumentId:'synthesizer',actors:{'one-piece':'law','dragon-ball':'cell',naruto:'pain'}}
 ];
 const stems=definitions.map(d=>({...d,events:[],envelope:[],onsets:[],generator:true}));
 const score={version:1,source:'procedural',title:track.title,trackId:track.type,duration,bpmEstimate:bpm,revision:0,
  generatorEvidence:'audio-source-start-event-log-v1',stems,sections:[],generatorParts:definitions};
 let lastTime=-1;
 function append({stemId,time,duration:noteDuration,frequency=null,midi=36,velocity=1}){
  const stem=stems.find(s=>s.id===stemId);
  if(!stem||!Number.isFinite(time)||time<0||!Number.isFinite(noteDuration)||noteDuration<=0)throw new Error('Invalid procedural audio event');
  if(time<lastTime-.1){for(const s of stems){s.events.length=0;s.envelope.length=0;s.onsets.length=0;}}
  lastTime=time;
  const note=frequency===null?midi:Math.round(69+12*Math.log2(frequency/440));
  if(!Number.isFinite(note)||note<0||note>127)throw new Error('Invalid generated frequency');
  const end=Math.min(score.duration,time+noteDuration),value=Math.max(0,Math.min(1,velocity));
  if(end<=time)return;
  stem.events.push({start:time,end,midi:note,velocity:value,confidence:1});
  stem.onsets.push({time,strength:value});
  // The envelope follows the actual scheduled gain decay, without invented notes.
  const points=[{time,value},{time:end,value:0}];
  stem.envelope=stem.envelope.filter(p=>p.time<time).concat(points);
  score.revision++;
 }
 return {score,append};
}

export function generatedPartsForTheme(score,theme,roles,instruments){
 const valid=score?.generatorEvidence==='audio-source-start-event-log-v1'&&score.source==='procedural';
 return roles.map(role=>{
  const binding=valid&&score.generatorParts.find(p=>`${theme}/${p.actors[theme]}`===role.id),stem=binding&&score.stems.find(s=>s.id===binding.id);
  const instrument=instruments[binding?.instrumentId],matching=binding&&matchesInstrumentFamily(role,binding.instrumentId);
  return {...role,partId:binding?.id||null,stemId:matching?stem.id:null,instrumentId:matching?binding.instrumentId:null,
   instrumentAssetRole:instrument?.assetRole||null,label:matching?binding.label:'未绑定',technique:matching?instrument.technique:role.technique,
   sourceLabel:matching?'生成器实际事件':binding?'原 pet 乐器不匹配，保持休止':'本预设没有对应声部',bindingStatus:matching?'verified':binding?'instrument-mismatch':'unbound',shared:false,
   events:matching?stem.events:[],percussion:matching&&binding.instrumentId==='drums',source:'procedural'};
 });
}
