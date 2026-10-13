// Stage geometry and animation derive from the song clock, including after a seek.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const stageSpec=narrow=>narrow?
 {shape:'rectangular',levels:5,width:13,back:-12,front:10,step:.85}:
 {shape:'semicircular',levels:4,width:32,back:-5,front:11,step:.7,radii:[16,12.3,8.6,4.9]};
export function stageHeightAt(x,z,narrow){
 const s=stageSpec(narrow);
 if(narrow){if(Math.abs(x)>s.width/2||z<s.back||z>s.front)return 0;
  return .35+Math.min(4,Math.max(0,Math.floor((s.front-z)/4.4)))*s.step;}
 const r=Math.hypot(x,z-s.back);if(z<s.back||r>s.radii[0])return 0;
 return .35+s.radii.filter(radius=>r<=radius).slice(1).length*s.step;
}
export function stageBandLayout(count,formation,narrow=false,leadIndex=0,spread=1){
 const s=stageSpec(narrow),slots=[],order=Array.from({length:count},(_,i)=>i);
 if(formation==='solo'&&leadIndex>0){[order[0],order[leadIndex]]=[order[leadIndex],order[0]];}
 if(narrow){
  for(let i=0;i<count;i++){const row=Math.floor(i/2),side=i%2?1:-1;
   let x=side*2.85*clamp(spread,.85,1.15),z=8-row*4.4;
   if(i===count-1&&count%2)x=0;
   if(formation==='wings')x+=side*.35;
   if(formation==='arc'||formation==='ring')z+=i%2?.25:-.25;
   if(formation==='solo'&&i===0)x=-.6;
   slots.push([x,stageHeightAt(x,z,true),z]);}
 }else{
  // Three musicians at the apron, three in the middle, four on the rear terrace.
  const sizes=count===10?[3,3,4]:count===9?[3,3,3]:[Math.min(3,count),Math.min(3,Math.max(0,count-3)),Math.max(0,count-6)];
  let index=0;
  sizes.forEach((size,row)=>{const radius=[14.5,10.6,7.05][row];
   for(let col=0;col<size;col++){let x=(col-(size-1)/2)*(row===2?3.8:5.8)*clamp(spread,.85,1.15);
    if(row===0)x=[0,-5.8,5.8][col]*clamp(spread,.85,1.15);
    if(formation==='wings')x+=Math.sign(x)*.55;
    if(formation==='ring')x*=.92;
    if(formation==='solo'&&row===0){x=(col-1)*5.2;if(col===0)x=0;if(col===1)x=-6;}
    x=clamp(x,-radius+.6,radius-.6);
    const z=s.back+Math.sqrt(radius*radius-x*x)+(formation==='terrace'?(col%2?.15:-.15):0);
    slots[index++]=[x,stageHeightAt(x,z,false),z];}
  });
 }
 const result=Array(count);order.forEach((id,slot)=>result[id]=slots[slot]);return result;
}
export function petFrameAt(time,bpm,activity,{reduced=false,speed=1,index=0}={}){
 if(reduced||activity<.12||speed<=0)return 0;
 const phase=Math.floor(Math.max(0,time)*(Number.isFinite(bpm)&&bpm>0?bpm:120)/60*2*speed+index*.37);
 return [1,2,3,2][phase%4];
}
const cues=new WeakMap();
function energyAt(score,time){
 if(!score?.stems?.length||time<0||time>=score.duration)return 0;
 let total=0,weight=0;
 for(const stem of score.stems){const envelope=stem.envelope||[];if(!envelope.length)continue;
  let lo=0,hi=envelope.length;while(lo<hi){const mid=(lo+hi)>>1;if(envelope[mid].time<=time)lo=mid+1;else hi=mid;}
  const a=envelope[Math.max(0,lo-1)],b=envelope[Math.min(envelope.length-1,lo)];
  const value=a.value+(b.value-a.value)*clamp((time-a.time)/Math.max(.001,b.time-a.time));
  const w=stem.id==='drums'?1.3:stem.id==='vocals'?1.1:1;total+=value*w;weight+=w;}
 return weight?total/weight:0;
}
export function stageClimaxAt(score,time,mode='auto'){
 if(mode==='off'||!score||time<0||time>=score.duration)return {energy:0,intensity:0,bursts:[]};
 if(!cues.has(score)){
  const values=[];for(let t=0;t<score.duration;t+=.5)values.push(energyAt(score,t));values.sort((a,b)=>a-b);
  const threshold=Math.max(.35,values[Math.floor(values.length*.82)]||1),period=240/(score.bpmEstimate||120),bursts=[];
  for(let t=period;t<score.duration;t+=period)if(energyAt(score,t)>threshold)bursts.push(t);
  cues.set(score,{threshold,bursts,period});
 }
 const cue=cues.get(score),energy=energyAt(score,time),intensity=mode==='preview'?1:clamp((energy-cue.threshold)/.18);
 const starts=mode==='preview'?Array.from({length:3},(_,i)=>Math.floor(time/cue.period)*cue.period-i*cue.period):cue.bursts;
 return {energy,intensity,bursts:starts.filter(t=>t>=0&&time>=t&&time-t<2.6).slice(-3)};
}
