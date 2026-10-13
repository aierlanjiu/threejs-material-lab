export const BAND_FORMATIONS=Object.freeze([
 ['arc','弧形合奏'],['terrace','错层阶梯'],['ring','声部环阵'],['wings','双翼对答'],['solo','独奏前台']
].map(([id,label])=>Object.freeze({id,label})));
const clamp=(x,min=0,max=1)=>Math.max(min,Math.min(max,x));
export const bandEase=x=>{x=clamp(x);return x*x*(3-2*x);};
export function formationAt(time,score,requested='auto'){
 const fixed=BAND_FORMATIONS.find(f=>f.id===requested);if(fixed)return {id:fixed.id,previousId:fixed.id,nextId:fixed.id,mix:1,phase:0,auto:false};
 const t=Math.max(0,Number.isFinite(time)?time:0),period=16,index=Math.floor(t/period),phase=t-index*period;
 const id=BAND_FORMATIONS[index%5].id,previousId=index?BAND_FORMATIONS[(index+4)%5].id:id,nextId=BAND_FORMATIONS[(index+1)%5].id;
 return {id,previousId,nextId,mix:index?bandEase(phase/1.6):1,phase,auto:true};
}
// Stable slot order keeps formations readable during morphs. Units are cube edges.
export function layoutBand(count,formation,narrow=false,leadIndex=0,spread=1){
 count=Math.max(1,Math.min(32,Math.round(count)));leadIndex=clamp(Math.round(leadIndex),0,count-1);spread=clamp(spread,.8,3);
 const positions=[];
 if(narrow){
  const rows=Math.ceil(count/2);
  for(let i=0;i<count;i++){
   const row=Math.floor(i/2),side=i%2?1:-1;
   let x=side*1.30,y=(rows-1-row)*1.82+.85,z=(i%2)*.12;
   if(formation==='arc')z=-.2*Math.cos(row/(Math.max(1,rows-1))*Math.PI);
   if(formation==='terrace'){y+=side*.15;x+=side*(row%2?-.06:.06);}
   if(formation==='ring'){x*=.90+.14*Math.sin(row/Math.max(1,rows-1)*Math.PI);z=-.1*Math.cos(row);}
   if(formation==='wings'){x+=side*.12;z=side*.18;}
   positions.push([x*spread,y*spread,z*spread]);
  }
  if(count%2)positions[count-1][0]=0;
  if(formation==='solo'&&count>1){
   // A clear front slot plus a compact three-column gallery behind it.
   let slot=0;for(let i=0;i<count;i++)if(i!==leadIndex){const r=Math.floor(slot/3),c=slot%3;positions[i]=[(c-1)*2.5*spread,(3-r)*1.72*spread+.9,-.4];slot++;}
   positions[leadIndex]=[0,.75,1.5];
  }
  return positions;
 }
 if(formation==='ring'){
  for(let i=0;i<count;i++){const angle=Math.PI/2+i/count*Math.PI*2,z=Math.sin(angle)*5.2;positions.push([Math.cos(angle)*6.4*spread,.9+Math.max(0,-z)*.12,z*spread]);}return positions;
 }
 if(formation==='terrace'){
  const rowSizes=count===10?[4,3,3]:count===9?[3,3,3]:Array.from({length:Math.ceil(count/4)},(_,r)=>Math.min(4,count-r*4));let slot=0;
  rowSizes.forEach((size,row)=>{for(let c=0;c<size;c++){positions[slot++]=[(c-(size-1)/2)*2.68*spread+(row%2?.18:0),.85+row*.75,(1.6-row*2.8)*spread];}});return positions;
 }
 if(formation==='wings'){
  const wingSize=Math.ceil(count/2);for(let i=0;i<count;i++){const wing=i<wingSize?-1:1,k=i%wingSize,row=Math.floor(k/3),column=k%3;positions.push([wing*(row?2.8+column*2.6:1.4+column*2.6)*spread,.9+row*.65,(1.6-row*3.2)*spread]);}return positions;
 }
 const columns=Math.min(5,count),rows=Math.ceil(count/columns);
 for(let i=0;i<count;i++){
  const row=Math.floor(i/columns),rowCount=Math.min(columns,count-row*columns),column=i%columns;
  let x=(column-(rowCount-1)/2)*2.68,y=.85+row*.48,z=1.5-row*3.2;
  if(formation==='arc'){z+=Math.abs(x)*.16;y+=Math.abs(x)*.025;}
  if(formation==='terrace'){y+=((column+row)%3)*.30;z+=row%2?.35:0;}
  if(formation==='ring'){z+=(row?1:-1)*Math.cos(column/Math.max(1,rowCount-1)*Math.PI*2)*.75;x*=.94;}
  if(formation==='wings'){if(x)x+=Math.sign(x)*.65;z+=Math.abs(x)*.12;y+=Math.abs(x)*.045;}
  positions.push([x*spread,y,z*spread]);
 }
 if(formation==='solo'&&count>1){
  let slot=0;for(let i=0;i<count;i++)if(i!==leadIndex){const row=Math.floor(slot/5),c=slot%5,rowCount=Math.min(5,count-1-row*5);positions[i]=[(c-(rowCount-1)/2)*2.68*spread,1+row*.6,-.8-row*2.9];slot++;}
  positions[leadIndex]=[0,.8,4.1*spread];
 }
 return positions;
}
const pose=()=>({position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
export function sampleBandMotion(sample,time,bpm=120,{technique='pluck',index=0,actorMotion=1,instrumentMotion=1,reduced=false}={}){
 const result={actor:pose(),instrument:pose(),group:pose()};
 const active=clamp(sample.activity||0);if(reduced||!active)return result;
 const beat=Math.max(0,time)*(Number.isFinite(bpm)&&bpm>0?bpm:120)/60,phase=beat*Math.PI*2+index*.71;
 const attack=clamp(sample.attack||0),a=clamp(actorMotion,0,2),m=clamp(instrumentMotion,0,2);
 const sway=Math.sin(phase*.5)*active,breath=Math.sin(phase*.25)*active;
 result.actor.position=[sway*.035*a,Math.abs(breath)*.035*a,0];
 result.actor.rotation=[-active*.03*a,sway*.035*a,sway*.025*a];
 const p=result.instrument;
 if(technique==='strike'){
  p.position[1]=-attack*.09*m;p.rotation[0]=attack*.19*m;p.rotation[2]=Math.sin(index)*attack*.12*m;
  p.scale=[1+attack*.035*m,1-attack*.055*m,1+attack*.025*m];
  result.actor.rotation[0]-=attack*.038*a;
 }else if(technique==='pluck'){
  p.position[0]=attack*.035*m;p.rotation[2]=(attack*.15+sway*.025)*m;p.rotation[1]=sway*.055*m;
  result.actor.position[1]-=attack*.028*a;
 }else if(technique==='keys'){
  p.position[1]=-attack*.045*m;p.rotation[0]=(attack*.085+breath*.025)*m;p.rotation[2]=sway*.025*m;
 }else if(technique==='sustain'){
  p.position[1]=(active*.05+breath*.025)*m;p.rotation[1]=breath*.08*m;p.rotation[2]=sway*.04*m;
 }else if(technique==='wind'){
  p.position[1]=breath*.04*m;p.rotation[2]=(breath*.055+attack*.04)*m;p.rotation[0]=-active*.05*m;
  result.actor.rotation[0]=-breath*.045*a;
 }else if(technique==='voice'){
  p.position[1]=breath*.025*m;p.rotation[0]=-active*.04*m;
  result.actor.position[1]+=active*.025*a;result.actor.rotation[1]=breath*.05*a;
 }
 return result;
}
