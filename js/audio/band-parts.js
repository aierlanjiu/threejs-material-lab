import {instrumentById} from '../avatar/instrument-manifest.js';
import {sampleBandFrame} from './band-timeline.js';

// These are stage arrangements of measured notes, not additional separated instruments.
const definitions={
 'one-piece':[
  ['luffy','vocals','voice',0,127,0,99],['zoro','bass','pluck',0,127,0,99],
  ['nami','other','keys',55,76,0,99],['sanji','drums','strike',0,127,0,99],
  ['chopper','other','strike',72,127,0,.62],['robin','other','sustain',60,96,.34,99],
  ['usopp','other','pluck',48,77,0,.9],['ace','other','wind',67,92,.18,99],
  ['law','other','keys',48,88,0,99],['shanks','other','sustain',36,65,.38,99]
 ],
 'dragon-ball':[
  ['goku','vocals','voice',0,127,0,99],['vegeta','other','pluck',40,76,0,.9],
  ['bulma','other','keys',50,90,0,99],['krillin','drums','strike',36,38,0,99],
  ['piccolo','other','wind',74,127,.3,99],['frieza','other','sustain',62,127,.7,99],
  ['cell','other','keys',36,72,0,.65],['gohan','other','keys',55,90,.3,99],
  ['buu','bass','wind',0,127,0,99],['trunks','other','keys',60,84,0,.75]
 ],
 naruto:[
  ['naruto','vocals','voice',0,127,0,99],['sasuke','other','pluck',40,76,0,.9],
  ['sakura','drums','strike',38,38,0,99],['itachi','other','wind',62,88,.25,99],
  ['gaara','drums','strike',36,36,0,99],['ninja-06','other','wind',78,127,0,.7],
  ['madara','drums','strike',36,42,0,99],['jiraiya','other','pluck',48,76,0,.65],
  ['pain','bass','keys',0,127,0,99]
 ]
};
export const BAND_ROSTERS=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([theme,list])=>[
 theme,Object.freeze(list.map(([id,stem,technique,minPitch,maxPitch,minLength,maxLength])=>Object.freeze({
  ...instrumentById(`${theme}/${id}`),stem,technique,minPitch,maxPitch,minLength,maxLength
 })))
])));
export const bandRoster=theme=>BAND_ROSTERS[theme]||BAND_ROSTERS['one-piece'];
export const BAND_TECHNIQUES=Object.freeze([
 ['voice','歌唱'],['pluck','拨弦'],['strike','击打'],['sustain','延音'],['keys','键盘'],['wind','吹奏']
].map(([id,label])=>Object.freeze({id,label})));

export function compileBandParts(score,theme,overrides={}){
 const parts=bandRoster(theme).map(role=>{
  const custom=overrides[role.id]||{},stemId=custom.stem||role.stem,stem=score?.stems.find(s=>s.id===stemId);
  const events=(stem?.events||[]).filter(e=>custom.stem||(
   e.midi>=role.minPitch&&e.midi<=role.maxPitch&&e.end-e.start>=role.minLength&&e.end-e.start<=role.maxLength));
  return {...role,id:role.id,label:role.instrument,stemId,technique:custom.technique||role.technique,
   sourceLabel:stemId==='other'?'共享伴奏 · 演出编配':stemId==='drums'?'鼓起音估计':stem?.label||'待接入',
   shared:false,events,percussion:stemId==='drums',source:score?.source||'pending'};
 });
 // Give shared-source notes a deterministic owner, instead of cloning the same line.
 for(const stem of score?.stems||[]){
  const group=parts.filter(p=>p.stemId===stem.id),automatic=group.filter(p=>!overrides[p.id]?.stem);
  group.forEach(p=>p.shared=group.length>1);
  if(automatic.length<2)continue;
  const candidates=automatic.map(p=>new Set(p.events)),assigned=automatic.map(()=>[]);
  stem.events.forEach((event,eventIndex)=>{
   const eligible=automatic.map((p,i)=>candidates[i].has(event)?i:-1).filter(i=>i>=0);if(!eligible.length)return;
   const duration=event.end-event.start,chord=(stem.events[eventIndex-1]&&Math.abs(stem.events[eventIndex-1].start-event.start)<.035)||(stem.events[eventIndex+1]&&Math.abs(stem.events[eventIndex+1].start-event.start)<.035);
   const priority=part=>part.technique==='strike'?(duration<.65&&event.midi>=72?2.5:1):
    part.technique==='keys'?(chord?2.2:.6):part.technique==='sustain'?(duration>.5&&event.midi<67?2.6:1.2):
    part.technique==='wind'?(duration>.35?2.0:1.0):part.technique==='pluck'?(duration<.6?1.8:1.0):1;
   const best=Math.max(...eligible.map(i=>priority(automatic[i]))),owners=eligible.filter(i=>priority(automatic[i])===best);
   const owner=owners[(Math.floor(event.start*4)+event.midi+eventIndex)%owners.length];assigned[owner].push(event);
  });
  automatic.forEach((p,i)=>p.events=assigned[i]);
 }
 return parts.map(part=>{let end=0;return {...part,endPrefix:part.events.map(e=>(end=Math.max(end,e.end))),
  sectionWeights:(score?.sections||[]).map(section=>part.events.reduce((sum,e)=>sum+Math.max(0,Math.min(e.end,section.end)-Math.max(e.start,section.start))*e.velocity,0))};});
}

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
function upperBound(events,time){let lo=0,hi=events.length;while(lo<hi){const mid=(lo+hi)>>1;if(events[mid].start<=time)lo=mid+1;else hi=mid;}return lo;}
export function sampleBandPart(part,time,sourceFrame,duration=Infinity){
 const empty={id:part.id,stemId:part.stemId,activity:0,energy:0,attack:0,notePulse:0,notes:[],lead:false};
 if(time>=duration||time<0)return empty;
 const source=sourceFrame.stems[part.stemId]||{energy:0},tail=part.percussion?.2:.42;
 let level=0,attack=0;const notes=[];
 for(let i=upperBound(part.events,time)-1;i>=0;i--){
  if(part.endPrefix[i]<time-tail)break;
  const e=part.events[i],dt=time-e.start;
  if(dt<.25)attack=Math.max(attack,e.velocity*Math.exp(-dt*16));
  if(time<e.end){notes.push(e);level=Math.max(level,e.velocity*smooth(dt/.085));}
  else if(time-e.end<tail)level=Math.max(level,e.velocity*(1-smooth((time-e.end)/tail)));
 }
 const activity=smooth(level*1.65)*(.35+.65*source.energy);
 return {...empty,notes,activity,energy:source.energy,attack:clamp(attack*1.8),notePulse:clamp(level*1.65)};
}
export function sampleBandEnsemble(score,parts,time,focus=null){
 const frame=score?sampleBandFrame(score,time):{time,source:'pending',stems:{},section:null,lead:null};
 const samples=parts.map(p=>sampleBandPart(p,frame.time,frame,score?.duration||0));
 const sectionIndex=score?.sections.indexOf(frame.section)??-1;
 const leaderAt=index=>{let winner=-1,best=0;const source=score?.sections[index]?.lead;
  for(let i=0;i<parts.length;i++)if(parts[i].stemId===source){const weight=(parts[i].sectionWeights[index]||0)*(parts[i].technique==='voice'?1.25:parts[i].technique==='keys'?.72:1);if(weight>best){best=weight;winner=i;}}return winner;};
 let leadIndex=focus?parts.findIndex(p=>p.id===focus):leaderAt(sectionIndex);
 if(leadIndex>=0)samples[leadIndex].lead=true;
 return {...frame,parts:samples,leadIndex,previousLeadIndex:focus?leadIndex:leaderAt(sectionIndex-1),nextLeadIndex:focus?leadIndex:leaderAt(sectionIndex+1),leadPart:leadIndex>=0?parts[leadIndex]:null};
}
export function bandPartScore(score,parts){return score?{...score,stems:parts.map(p=>({id:p.id,label:p.label,events:p.events,percussion:p.percussion,polyphonic:['keys','pluck'].includes(p.technique)}))}:null;}
