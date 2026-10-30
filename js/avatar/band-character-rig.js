// Character-space rig. Left/right always mean the character's own anatomy.
export const RIG_W=512,RIG_H=640;
export const RIG_ROLES={
 luffy:{name:'路飞',action:'握麦、手势与口型排练',kind:'voice',shoulders:[[.64,.08],[.27,.08]]},
 zoro:{name:'索隆',action:'左手换把压弦、右手拨弦',kind:'bass'},
 nami:{name:'娜美',action:'左手低音按钮、右手琴键与风箱',kind:'accordion',shoulders:[[.73,.12],[.20,.12]]},
 sanji:{name:'山治',action:'双手交替抬槌、击打与回弹',kind:'drums'},
 chopper:{name:'乔巴',action:'双槌交替击打不同琴条',kind:'marimba'},
 robin:{name:'罗宾',action:'双手交错拨动不同琴弦',kind:'harp'},
 usopp:{name:'乌索普',action:'左手换把、右手扫弦',kind:'guitar'},
 ace:{name:'艾斯',action:'吹嘴接触、上下键组指法',kind:'saxophone'},
 law:{name:'罗',action:'双手分区移动与下键回弹',kind:'keys'},
 shanks:{name:'香克斯',action:'左手按弦、右手连续运弓',kind:'cello',shoulders:[[.65,.13],[.26,.13]]}
};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const strikeLift=age=>age<-.20||age>.28?28:age<-.09?lerp(28,85,smooth((age+.20)/.11)):age<-.018?lerp(85,0,smooth((age+.09)/.072)):age<=.025?0:age<.12?lerp(0,55,smooth((age-.025)/.095)):lerp(55,28,smooth((age-.12)/.16));
const xy=(b,u,v)=>{const q=[b.x+b.width*u,b.y+b.height*v];if(!b.angle)return q;const r=rotatePoint([q[0]-b.pivot[0],q[1]-b.pivot[1]],b.angle);return [r[0]+b.pivot[0]+b.translation[0],r[1]+b.pivot[1]+b.translation[1]];};
export function rotatePoint(p,angle){const c=Math.cos(angle),s=Math.sin(angle);return [p[0]*c-p[1]*s,p[0]*s+p[1]*c];}

export function solveTwoBone(shoulder,target,upper,fore,pole){
 const dx=target[0]-shoulder[0],dy=target[1]-shoulder[1],raw=Math.hypot(dx,dy);
 const distance=clamp(raw,Math.abs(upper-fore)+.001,upper+fore-.001),ux=raw>.00001?dx/raw:0,uy=raw>.00001?dy/raw:1;
 const wrist=[shoulder[0]+ux*distance,shoulder[1]+uy*distance];
 const along=(upper*upper-fore*fore+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 const mid=[shoulder[0]+ux*along,shoulder[1]+uy*along];
 const candidates=[1,-1].map(sign=>[mid[0]-uy*height*sign,mid[1]+ux*height*sign]);
 candidates.sort((a,b)=>Math.hypot(a[0]-pole[0],a[1]-pole[1])-Math.hypot(b[0]-pole[0],b[1]-pole[1]));
 return {shoulder,elbow:candidates[0],wrist,reachError:Math.abs(raw-distance)};
}

export function characterLayout(actor){
 const rig=actor.rig,body=actor.layers.body.rect,head=actor.layers.head.rect;
 const bodyHeight=.45*RIG_H,bodyWidth=body[2]/body[3]*bodyHeight,cx=(rig.center??.5)*RIG_W,neck=rig.bodyNeck??[.5,.01];
 const b={x:cx-neck[0]*bodyWidth,y:.5*RIG_H-neck[1]*bodyHeight,width:bodyWidth,height:bodyHeight};
 const hs=Math.min(.80*RIG_W/head[2],(b.y-.025*RIG_H)/(head[3]*rig.neck[1]));
 const h={x:cx-rig.neck[0]*head[2]*hs,y:.528*RIG_H-rig.neck[1]*head[3]*hs,width:head[2]*hs,height:head[3]*hs};
 const p=rig.prop,r=actor.layers.instrument.rect,pw=p[2]?p[2]*RIG_W:p[3]*RIG_H*r[2]/r[3],ph=p[3]?p[3]*RIG_H:pw*r[3]/r[2];
 const prop={x:p[0]*RIG_W-pw/2,y:p[1]*RIG_H-ph/2,width:pw,height:ph};
 const s=RIG_ROLES[actor.id].shoulders??[[.73,.14],[.27,.14]],mouth=xy(h,...rig.mouth);
 if(actor.id==='ace'){prop.pivot=xy(prop,.07,.04);prop.translation=[mouth[0]-prop.pivot[0],mouth[1]-prop.pivot[1]];prop.angle=.32;}
 return {body:b,head:h,prop,center:cx,fit:rig.scale??.90,shoulders:s.map(q=>xy(b,...q)),mouth};
}

function recentNotes(events,time){
 let lo=0,hi=events.length;while(lo<hi){const m=(lo+hi)>>1;if(events[m].start<=time+.18)lo=m+1;else hi=m;}
 const found=[];for(let i=lo-1;i>=0&&events[i].start>=time-2.5;i--){const n=events[i];if(n.end>=time-.35)found.push({...n,index:i});}
 return found.sort((a,b)=>Math.abs(a.start-time)-Math.abs(b.start-time));
}
export function rehearsalSample(id,time){
 const kind=RIG_ROLES[id].kind,events=[];
 const interval=kind==='cello'?1:kind==='saxophone'||kind==='voice'?.7:.35;
 for(let i=0;i<Math.floor(7/interval);i++){
  const start=.5+i*interval,pitch=kind==='drums'?[42,38,42,49][i%4]:kind==='bass'?[40,43,45,47,52,45][i%6]:[60,64,67,72,69,65,62,57][i%8];
  events.push({start,end:start+(kind==='cello'?1.0:kind==='saxophone'?.55:.23),midi:pitch,velocity:.85});
 }
 return {events,activity:time>=.32&&time<7.8?1:0,bpm:120,rehearsal:true};
}

export function sampleCharacterRig(actor,time,sample={},reduced=false){
 const layout=characterLayout(actor),kind=RIG_ROLES[actor.id].kind,events=sample.events??sample.notes??[];
 const activity=reduced||sample.userMuted?0:clamp(sample.activity??0,0,1),notes=activity?recentNotes(events,time):[];
 const note=['drums','marimba'].includes(kind)?notes[0]:notes.find(n=>n.start<=time);
 const velocity=note?clamp(note.velocity>1?note.velocity/127:note.velocity??.8,0,1):0;
 const age=note?time-note.start:100,held=note&&time>=note.start&&time<=note.end;
 const pluck=age>=0&&age<.26?Math.sin(Math.PI*clamp(age/.17,0,1))*Math.exp(-age*7):0;
 const pulse=held?Math.exp(-Math.max(0,age)*8):0,pitch=note?.midi??60;
 let fingeringPitch=pitch;
 if(note){let j=note.index+1;while(j<events.length&&events[j].start<note.start+.06)j++;const next=events[j];if(next&&next.start>=time&&next.start-time<.12&&next.start-note.end<.30)fingeringPitch=lerp(pitch,next.midi,smooth((time-next.start+.12)/.12));}
 const enabled=Boolean(activity&&note),p=layout.prop;
 let targets,angles=[2.2,1.4],bellows=0,bow=0,mouth=0,percussionLift=null,bowPhase=0,handNotes=null;
 switch(kind){
  case 'bass':case 'guitar':{
   const slide=enabled?clamp((fingeringPitch-(kind==='bass'?40:60))/24,0,1):.3;
   targets=[xy(p,lerp(kind==='bass'?.82:.69,.57,slide),lerp(.24,.47,slide)),xy(p,.32,.66+pluck*.10)];angles=[2.7,1.4+pluck*.4];break;}
  case 'accordion':{
   bellows=enabled?32*(.5-.5*Math.cos(time*Math.PI*1.3)):0;
   targets=[xy(p,.91,.48),xy(p,.13,.48+pulse*.035)];targets[0][0]+=bellows/2;targets[1][0]-=bellows/2;angles=[2.7,1.45];break;}
  case 'drums':case 'marimba':{
   handNotes=[0,1].map(i=>notes.find(n=>kind==='drums'?(i===0?[37,38,40,45,47,48,49,50,51,57].includes(n.midi):[42,44,46].includes(n.midi)):n.index%2===i));
   const crash=handNotes[0]?.midi===49,u=kind==='drums'?[crash?.80:.64,.20]:[.69,.30];
   targets=[xy(p,u[0],kind==='drums'?(crash?.07:.32):.36),xy(p,u[1],kind==='drums'?.11:.36)];
   percussionLift=[0,0];for(let i=0;i<2;i++){const n=handNotes[i],active=enabled&&n;percussionLift[i]=active?strikeLift(time-n.start):28;if(kind==='marimba'&&active)targets[i][0]+=((n.midi%7)-3)*5;}
   angles=kind==='drums'?[2.25,.90]:[1.8,1.34];break;}
  case 'harp':{
   const u=enabled?clamp((pitch-55)/28,0,1):.4;
   targets=[xy(p,.44+u*.30,.35),xy(p,.35+u*.28,.61)];targets[note?(note.index%2):0][0]-=pluck*18;angles=[.2,.3];break;}
  case 'keys':{
   targets=[xy(p,.72,.105),xy(p,.28,.105)];if(enabled){const hand=pitch>=64?0:1;targets[hand][0]+=(pitch-(hand?57:69))*3;targets[hand][1]+=pulse*8;}angles=[1.52,1.62];break;}
  case 'saxophone':{
   targets=[xy(p,.39,.31),xy(p,.40,.61)];targets[0][1]+=pulse*4;targets[1][1]+=pulse*3;angles=[1.9,1.0];mouth=held?.45:0;break;}
  case 'cello':{
   const n=note,phase=n?clamp((time-n.start)/Math.max(.2,n.end-n.start),0,1):.5;
   bowPhase=enabled?(phase-.5)*(n.index%2?1:-1):0;
   targets=[xy(p,.59,enabled?.20+clamp((pitch-48)/36,0,1)*.22:.26),xy(p,.56,.62)];angles=[2.6,0];break;}
  default:{
   targets=[xy(p,.49,.20),[layout.shoulders[1][0]-32,layout.shoulders[1][1]+80]];
   if(enabled){targets[1][0]-=20*Math.sin(time*2);targets[1][1]-=22*(.5+.5*Math.sin(time*2));mouth=held?.5+.5*Math.sin(time*19)**2:0;}angles=[1.9,1.3];break;}
 }
 const arms=targets.map((contact,i)=>{
  const hand=actor.rigParts?.[i?'rightHand':'leftHand'];
  const source=hand?[(hand.contact[0]-hand.a[0])*hand.rect[2],(hand.contact[1]-hand.a[1])*hand.rect[3]]:[0,30];
  let handAngle=angles[i]-Math.atan2(source[1],source[0]);
  if(hand?.toolAxis&&kind==='cello'){const [a,b]=hand.toolAxis;handAngle=-Math.atan2((b[1]-a[1])*hand.rect[3],(b[0]-a[0])*hand.rect[2]);}
  const scale=hand?.scale??1;let offset=rotatePoint(source.map(v=>v*scale),handAngle);
  const wrist=[contact[0]-offset[0],contact[1]-offset[1]],shoulder=layout.shoulders[i],side=i===0?1:-1;
  const upper=actor.bones?.upper??82,fore=actor.bones?.fore??80;
  // Limit preparatory lifts and bow travel to the fixed skeleton's workspace.
  // Impact points stay on their surfaces; neither bones nor wrists stretch.
  const reach=upper+fore-(['drums','marimba'].includes(kind)?.1:3);let toolLine=null;
  if(['drums','marimba'].includes(kind)){
   const amount=percussionLift[i];wrist[1]-=amount*.12;handAngle+=side*(amount/85)*.70;offset=rotatePoint(source.map(v=>v*scale),handAngle);
   const dx=wrist[0]-shoulder[0],dy=Math.sqrt(Math.max(0,reach*reach-dx*dx));
   wrist[1]=clamp(wrist[1],shoulder[1]-dy,shoulder[1]+dy);contact[0]=wrist[0]+offset[0];contact[1]=wrist[1]+offset[1];
  }else if(kind==='cello'&&i===1){
   const offsets=hand.toolAxis.map(q=>rotatePoint([(q[0]-hand.a[0])*hand.rect[2]*scale,(q[1]-hand.a[1])*hand.rect[3]*scale],handAngle));
   wrist[1]=contact[1]-offsets[0][1];const dy=wrist[1]-shoulder[1],dx=Math.sqrt(Math.max(0,reach*reach-dy*dy));
   const lo=Math.max(contact[0]-offsets[1][0]+4,shoulder[0]-dx),hi=Math.min(contact[0]-offsets[0][0]-4,shoulder[0]+dx);
   const middle=(lo+hi)/2;wrist[0]=middle+bowPhase*Math.min(80,Math.max(0,hi-lo));bow=wrist[0]-middle;
   toolLine=offsets.map(q=>[wrist[0]+q[0],wrist[1]+q[1]]);
  }
  const pole=kind==='accordion'?[shoulder[0]+side*140,shoulder[1]+30]:['bass','guitar'].includes(kind)&&i===0?[(shoulder[0]+wrist[0])/2,Math.max(shoulder[1],wrist[1])+85]:[shoulder[0]+side*62,shoulder[1]+88];
  const solved=solveTwoBone(shoulder,wrist,upper,fore,pole);
  return {...solved,side:i===0?'left':'right',contact,handAngle,handScale:scale,toolLine,contactError:Math.hypot(solved.wrist[0]-wrist[0],solved.wrist[1]-wrist[1])};
 });
 return {layout,arms,bellows,bow,mouthOpen:kind==='voice'?mouth:0,enabled,headAngle:enabled&&kind!=='saxophone'?.025*Math.sin(time*3):0,note:note?{start:note.start,midi:pitch,index:note.index}:null,strikeNotes:handNotes?.map(n=>n?{start:n.start,midi:n.midi}:null),velocity};
}
