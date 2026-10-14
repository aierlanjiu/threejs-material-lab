// Stage geometry and animation derive from the song clock, including after a seek.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const stageSpec=narrow=>narrow?
 {shape:'rectangular',levels:3,width:14.4,back:-5.2,front:7.1,step:1.08,fronts:[7.1,2.9,-1.3],widths:[14.4,13.6,12.8],rigHeight:13.2}:
 {shape:'semicircular',levels:4,width:28,back:-4.8,front:9.2,step:.72,radii:[14,10.4,6.8,3.2],rigHeight:9.5};
export function stageHeightAt(x,z,narrow){
 const s=stageSpec(narrow);
 if(narrow){if(Math.abs(x)>s.width/2||z<s.back||z>s.front)return 0;
  const level=s.fronts.filter(front=>z<=front).length-1;
  return Math.abs(x)<=s.widths[level]/2?.35+level*s.step:0;}
 const r=Math.hypot(x,z-s.back);if(z<s.back||r>s.radii[0])return 0;
 return .35+s.radii.filter(radius=>r<=radius).slice(1).length*s.step;
}
export function stageBandLayout(count,formation,narrow=false,leadIndex=0,spread=1){
 const slots=[],order=Array.from({length:count},(_,i)=>i),factor=clamp(spread,.85,1.05);
 if(formation==='solo'&&leadIndex>0&&leadIndex<count)[order[0],order[leadIndex]]=[order[leadIndex],order[0]];
 const row=(xs,z)=>xs.forEach((x,i)=>slots.push([x*factor,typeof z==='function'?z(x,i):z]));
 const spaced=(size,gap)=>Array.from({length:size},(_,i)=>(i-(size-1)/2)*gap);
 const arc=(size,radius,gap)=>row(spaced(size,gap),x=>stageSpec(false).back+Math.sqrt(radius*radius-x*x));
 if(narrow){
  if(formation==='solo'){
   row([0],6.45);const middle=count===10?5:4;row(spaced(middle,middle===5?2.52:3.15),1.25);row(spaced(count-1-middle,3.0),-3.0);
  }else if(formation==='wings'){
   for(let i=0;i<count;i++){const side=i<Math.ceil(count/2)?-1:1,k=i%Math.ceil(count/2),x=[4.35,2.35,5.05,2.35,5.05][k],z=[5.65,.60,1.75,-3.45,-2.50][k];slots.push([side*x*factor,z]);}
  }else if(formation==='ring'){
   row([-2.1,2.1],6.0);row(spaced(count===10?4:3,count===10?3.20:4.25),1.75);row(spaced(4,3.05),-3.1);
  }else if(formation==='arc'){
   const front=count===10?4:3;row(spaced(front,front===4?3.1:4.2),x=>6.4-Math.abs(x)*.38);row(spaced(3,3.8),1.15);row(spaced(count-front-3,3.8),-2.8);
  }else{row([0,-3.9,3.9],5.5);row(spaced(count===10?4:3,count===10?3.25:3.9),1.35);row(spaced(3,3.9),-2.85);}
 }else{
  if(formation==='solo'){
   row([0],8.15);arc(5,9.45,3.7);arc(count-6,5.85,2.8);
  }else if(formation==='wings'){
   for(let i=0;i<count;i++){const side=i<Math.ceil(count/2)?-1:1,k=i%Math.ceil(count/2);slots.push([side*[4.6,3.0,8.0,2.6,5.1][k]*factor,[7.2,3.85,.2,-.55,-1.1][k]]);}
  }else if(formation==='ring'){
   row([0,-5.5,5.5],x=>7.8-Math.abs(x)*.16);row([-8.1,-2.3,2.3,8.1],x=>Math.abs(x)>5?.25:3.7);row(spaced(count-7,3.8),-.8);
  }else if(formation==='arc'){
   arc(5,12.8,4.0);arc(count-5,8.9,3.25);
  }else{row([0,-4.8,4.8],x=>7.6-Math.abs(x)*.15);row([-4.8,0,4.8],x=>3.85-Math.abs(x)*.16);arc(count-6,5.65,2.85);}
 }
 if(formation==='arc'){const front=narrow?(count===10?4:3):5;slots.splice(0,front,...slots.slice(0,front).sort((a,b)=>Math.abs(a[0])-Math.abs(b[0])||a[0]-b[0]));}
 const result=Array(count);order.forEach((id,slot)=>{const [x,z]=slots[slot];result[id]=[x,stageHeightAt(x,z,narrow),z];});return result;
}

export function petFrameAt(time,bpm,activity,{reduced=false,speed=1,index=0,attack=0}={}){
 if(reduced||activity<.12||speed<=0)return 0;
 if(attack>.45)return 3;
 const phase=Math.floor(Math.max(0,time)*(Number.isFinite(bpm)&&bpm>0?bpm:120)/60*2*speed+index*.37);
 return [1,2][phase%2];
}
const cues=new WeakMap();
export function stageLightingAt(score,time,fx,reduced=false){
 const opening=clamp(time/3),ending=score?.duration?clamp((score.duration-time)/5):1;
 const climax=reduced?0:fx.intensity;
 const start=fx.bursts.at(-1),impact=reduced||start===undefined?0:clamp(1-(time-start)/.42);
 return {lift:reduced?.55:(.42+fx.energy*.34+climax*.24)*(.70+.30*opening)*(.55+.45*ending),climax,
  impact,cameraShift:reduced?0:Math.sin(time*.14)*.11,cameraLift:reduced?0:Math.sin(time*.11)*.065};
}
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
  cues.set(score,{threshold,bursts:score.stageCues?.choruses.length?score.stageCues.bursts:bursts,period});
 }
 const cue=cues.get(score),energy=energyAt(score,time),chorus=score.stageCues?.choruses.find(c=>time>=c.start&&time<c.end);
 const chorusPower=chorus?Math.min(clamp((time-chorus.start)/.35),clamp((chorus.end-time)/2))*.9:0;
 const intensity=mode==='preview'?1:score.stageCues?.choruses.length?chorusPower:clamp((energy-cue.threshold)/.18);
 const starts=mode==='preview'?Array.from({length:3},(_,i)=>Math.floor(time/cue.period)*cue.period-i*cue.period):cue.bursts;
 return {energy,intensity,bursts:starts.filter(t=>t>=0&&time>=t&&time-t<2.6).slice(-3)};
}
