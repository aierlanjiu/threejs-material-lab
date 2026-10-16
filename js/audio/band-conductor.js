const copy=policy=>({muted:[...policy.muted],soloGroup:policy.soloGroup||null});
export function nextBandBeat(score,time){
 const beats=score?.beatTimes||[];let lo=0,hi=beats.length;
 while(lo<hi){const mid=(lo+hi)>>1;if(beats[mid]<time+.025)lo=mid+1;else hi=mid;}
 return lo<beats.length?beats[lo]:Math.ceil((time+.025)/(60/(score?.bpmEstimate||120)))*(60/(score?.bpmEstimate||120));
}
function nearestBeat(score,time){
 const beats=score?.beatTimes||[],period=60/(score?.bpmEstimate||120);
 if(!beats.length){const index=Math.round(time/period);return {index,error:Math.abs(time-index*period)};}
 let lo=0,hi=beats.length;while(lo<hi){const mid=(lo+hi)>>1;if(beats[mid]<time)lo=mid+1;else hi=mid;}
 const index=lo>0&&(lo===beats.length||time-beats[lo-1]<beats[lo]-time)?lo-1:lo;
 return {index,error:Math.abs(time-beats[Math.min(index,beats.length-1)])};
}
export function createBandConductor({score,getTime,isPlaying,isGroupAudible=()=>true,onSchedule=()=>{},onAward=()=>{}}){
 let groups=new Set(),active={muted:[],soloGroup:null},pending=null,previousSolo=null,lastTime=null,streak=[],soloChain=new Set(),effect=null,restoreTime=null;
 const period=60/(score?.bpmEstimate||120),beatsPerBar=score?.timeSignature?.[0]||4,takeoverBeats=(score?.arrangement?.takeoverBars||0)*beatsPerBar;
 const awarded=new Set(),history=[];
 function award(id,label,time){if(awarded.has(id))return;awarded.add(id);effect={id,label,time,end:time+5};onAward(effect);}
 function commit(command,allowAward=true){
  const before=active;active=copy(command.policy);restoreTime=command.restoreTime??null;pending=null;
  if(!allowAward||!command.playing)return;
  const event=command.event,at=command.time;
  const gain=(p,g)=>p.soloGroup?(p.soloGroup===g?1:0):p.muted.includes(g)?0:1;
  if(event.type==='join'&&gain(before,event.group)===0&&gain(active,event.group)===1&&isGroupAudible(event.group,at)){
   if(event.beat.error>.14)streak=[];
   else{if(streak.length&&event.beat.index!==streak.at(-1).beat+1)streak=[];streak.push({beat:event.beat.index,group:event.group});
    if(streak.length>=4&&new Set(streak.slice(-4).map(s=>s.group)).size===4)award('on-beat','合拍登场',at);}
  }
  if(event.type==='solo'&&active.soloGroup&&active.soloGroup!==before.soloGroup&&isGroupAudible(active.soloGroup,at)){soloChain.add(active.soloGroup);if(soloChain.size>=3)award('relay','主奏接力',at);}
  if(event.type==='all'&&(before.muted.length||before.soloGroup)&&score.duration-at<=12&&score.duration-at>0)award('curtain','全员谢幕',at);
 }
 function queue(policy,event,{restoreAt=null,immediate=false}={}){
  const time=getTime(),playing=isPlaying(),at=playing&&!immediate?nextBandBeat(score,time):time;
  if(takeoverBeats&&['join','mute'].includes(event.type))restoreAt=at+takeoverBeats*period;
  const command={policy:copy(policy),time:at,playing,restoreTime:restoreAt,event:{...event,inputTime:time,beat:nearestBeat(score,time)}};
  pending=command;history.push({...command,policy:copy(policy)});if(history.length>200)history.shift();
  onSchedule(copy(policy),at,{restoreTime:restoreAt});if(!playing||immediate)commit(command,playing);return true;
 }
 const intended=()=>pending?.policy||active;
 function resetTransport({preserveChoices=false}={}){
  if(pending)commit(pending,false);
  if(previousSolo){active=copy(previousSolo.policy);restoreTime=previousSolo.restoreTime;}
  if(takeoverBeats&&!preserveChoices){active={muted:[],soloGroup:null};restoreTime=null;}
  previousSolo=null;active.soloGroup=null;streak=[];soloChain.clear();effect=null;lastTime=getTime();onSchedule(copy(active),getTime(),{restoreTime});
 }
 function restartPerformance(keepChoices=false){if(!keepChoices||takeoverBeats)active={muted:[],soloGroup:null};pending=null;previousSolo=null;restoreTime=null;streak=[];soloChain.clear();effect=null;awarded.clear();history.length=0;lastTime=getTime();onSchedule(copy(active),getTime(),{restoreTime:null});}
 return {
  setGroups(ids){groups=new Set(ids);active.muted=active.muted.filter(id=>groups.has(id));if(active.soloGroup&&!groups.has(active.soloGroup))active.soloGroup=null;},
  toggle(group){if(!groups.has(group))return false;const policy=copy(intended()),muted=new Set(policy.muted);const joining=muted.has(group);if(joining)muted.delete(group);else muted.add(group);policy.muted=[...muted];return queue(policy,{type:joining?'join':'mute',group});},
  soloStart(group){if(!groups.has(group))return false;if(!previousSolo)previousSolo={policy:copy(intended()),restoreTime:pending?pending.restoreTime:restoreTime};return queue({...copy(intended()),soloGroup:group},{type:'solo',group});},
  soloEnd(){if(!previousSolo)return false;const previous=previousSolo;previousSolo=null;const expired=previous.restoreTime!==null&&getTime()>=previous.restoreTime;
   return queue(expired?{muted:[],soloGroup:null}:previous.policy,{type:'restore'},{restoreAt:expired?null:previous.restoreTime,immediate:true});},
  all(){previousSolo=null;return queue({muted:[],soloGroup:null},{type:'all'});},
  restore(){return previousSolo?this.soloEnd():this.all();},
  resetTransport,
  restartPerformance,
  tick(){const time=getTime();if(lastTime!==null&&time<lastTime-.3){if(isPlaying()&&lastTime>score.duration-1&&time<1)restartPerformance(true);else resetTransport();}lastTime=time;if(pending&&time>=pending.time)commit(pending);
   if(restoreTime!==null&&time>=restoreTime&&!previousSolo){const at=restoreTime;active={muted:[],soloGroup:null};restoreTime=null;onSchedule(copy(active),at,{restoreTime:null});history.push({time:at,event:{type:'auto-return'},policy:copy(active)});}
   if(effect&&time>=effect.end)effect=null;},
  gain(group){return active.soloGroup?(active.soloGroup===group?1:0):active.muted.includes(group)?0:1;},
  get snapshot(){const time=getTime();return {muted:[...active.muted],soloGroup:active.soloGroup,pending:pending?[...new Set([...pending.policy.muted,...active.muted,pending.policy.soloGroup].filter(Boolean))]:[],pendingTime:pending?.time??null,
   beat:nearestBeat(score,time).index%beatsPerBar+1,beatsPerBar,restoreTime:pending?pending.restoreTime:restoreTime,
   remainingBeats:Math.max(0,((pending?pending.restoreTime:restoreTime)??time)-time)/period,
   effect:effect?{...effect}:null,awarded:[...awarded],history:[...history]};}
 };
}
