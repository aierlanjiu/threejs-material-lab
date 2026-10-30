// Deterministic beat accents derived only from the analysed beat grid and song
// time, so live playback, seeking and offline frame rendering agree exactly.
const clamp=x=>Math.max(0,Math.min(1,x));

export function bandBeatAt(score,time,{decay=.11}={}){
 const none={pulse:0,downbeat:0,index:-1,phase:0,period:60/(score?.bpmEstimate||120)};
 if(!score||!Number.isFinite(time)||time<0)return none;
 const beats=score.beatTimes||[],perBar=score.timeSignature?.[0]||4;
 let index,at,period=none.period;
 if(beats.length){
  let lo=0,hi=beats.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(beats[mid]<=time)lo=mid+1;else hi=mid;}
  index=lo-1;if(index<0)return none;
  at=beats[index];period=Math.max(.2,(beats[index+1]??at+period)-at);
 }else{index=Math.floor(time/period);at=index*period;}
 const age=time-at,pulse=Math.exp(-age/decay);
 return {pulse,downbeat:index%perBar===0?pulse:0,index,phase:clamp(age/period),period};
}
