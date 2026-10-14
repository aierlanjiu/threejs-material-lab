const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const percentile=(a,p)=>{const v=[...a].sort((x,y)=>x-y);return v[Math.floor((v.length-1)*p)]||0;};
export function parseBandLrc(text){
 const offset=Number(/\[offset:\s*([+-]?\d+)\]/i.exec(text)?.[1]||0)/1000,lines=[];
 for(const line of text.split('\n')){const content=line.replace(/\[[^\]]*\]/g,'').trim();if(!content)continue;
  for(const m of line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)){const time=Number(m[1])*60+Number(m[2])+Number(`0.${m[3]||0}`)+offset;if(time>=0)lines.push({time,text:content});}
 }return lines.sort((a,b)=>a.time-b.time);
}
export function buildBandCues(score,lyrics=[]){
 const drums=score.stems.find(s=>s.id==='drums'),vocals=score.stems.find(s=>s.id==='vocals'),duration=score.duration;
 const usable=lyrics.filter(l=>l.time<duration&&!/前奏|间奏|器乐|无人声|intro|instrumental|outro/i.test(l.text));
 const normal=l=>l.text.toLowerCase().replace(/[\p{P}\p{Z}\s]/gu,''),groups=new Map();
 for(const l of usable){const text=normal(l);if(text.length<6)continue;if(!groups.has(text))groups.set(text,[]);groups.get(text).push(l.time);}
 const repeats=usable.filter(l=>groups.get(normal(l))?.some(t=>Math.abs(t-l.time)>18));
 const energy=(stem,start,end)=>mean((stem?.envelope||[]).filter(p=>p.time>=start&&p.time<end).map(p=>p.value));
 const windows=[];
 for(let t=0;t<duration;t+=2){const end=Math.min(duration,t+8),drumEnergy=energy(drums,t,end),voice=energy(vocals,t,end),total=mean(score.stems.map(s=>energy(s,t,end)));
  const onsets=(drums?.onsets||[]).filter(o=>o.time>=t&&o.time<end&&o.strength>.55),lines=usable.filter(l=>l.time>=t&&l.time<end),repeated=repeats.filter(l=>l.time>=t&&l.time<end);
  windows.push({start:t,end,total,drumEnergy,voice,density:onsets.length/(end-t),lines:lines.length,repeat:repeated.length});
 }
 const highEnergy=percentile(windows.map(w=>w.total),.62),highDrums=percentile(windows.map(w=>w.density),.52);
 const candidates=[];for(const w of windows){const musical=w.total>=highEnergy*.90&&w.drumEnergy>.12&&w.density>=highDrums*.8&&w.voice>.12;
  const repetition=w.repeat>=2||(w.repeat>=1&&w.lines>=3);if(musical&&repetition)candidates.push({...w,confidence:clamp(.54+w.repeat*.07+Math.max(0,w.total-highEnergy)*.3,.55,.88)});
 }
 const merged=[];for(const c of candidates){const previous=merged.at(-1);if(previous&&c.start<=previous.end+2){previous.end=Math.min(duration,Math.max(previous.end,c.end));previous.confidence=Math.max(previous.confidence,c.confidence);}else merged.push({start:c.start,end:c.end,confidence:c.confidence});}
 const onsets=drums?.onsets||[],snap=time=>{const nearby=onsets.filter(o=>Math.abs(o.time-time)<.6&&o.strength>.55);return nearby.length?nearby.reduce((a,b)=>Math.abs(a.time-time)<Math.abs(b.time-time)?a:b).time:time;};
 const choruses=merged.filter(c=>c.end-c.start>=8).map((c,index)=>{
  const first=repeats.find(l=>l.time>=c.start&&l.time<c.start+5),start=snap(first?.time??c.start);let end=c.end,weak=0;
  const limit=Math.min(duration,start+34,merged[index+1]?.start??duration);
  for(let t=end;t<limit;t+=2){const w=windows.find(w=>w.start>=t);if(!w||w.total<highEnergy*.78||w.voice<.1||w.density<highDrums*.65)weak++;else weak=0;
   if(weak>=2)break;end=Math.min(limit,t+2);}
  return {...c,start,end:Math.min(duration,end),kind:'chorus-candidate'};
 }).filter(c=>c.end-c.start>=6);
 const segments=[],bursts=[];let cursor=0;
 for(const chorus of choruses){const build=Math.max(cursor,chorus.start-5);
  if(build>cursor)segments.push({start:cursor,end:build,formation:'arc',kind:'verse'});
  if(chorus.start>build)segments.push({start:build,end:chorus.start,formation:'wings',kind:'build'});
  segments.push({...chorus,formation:'ring'});cursor=chorus.end;
  bursts.push(chorus.start);let last=chorus.start;
  const period=240/(score.bpmEstimate||120);
  for(const onset of onsets)if(onset.time>chorus.start+period*.9&&onset.time<chorus.end-1&&onset.strength>.72&&onset.time-last>period*.95){bursts.push(onset.time);last=onset.time;}
 }
 if(cursor<duration)segments.push({start:cursor,end:duration,formation:choruses.length?'terrace':'arc',kind:'verse'});
 if(!choruses.length){segments.length=0;let current=null;
  for(const w of windows){const lifted=w.total>=highEnergy&&w.density>=highDrums,formation=lifted?'terrace':'arc';
   if(!current){current={start:0,end:duration,formation,kind:'energy-phrase'};segments.push(current);}else if(formation!==current.formation&&w.start-current.start>=8){current.end=w.start;current={start:w.start,end:duration,formation,kind:'energy-phrase'};segments.push(current);}}
 }
 return {source:choruses.length?'lrc-repetition-and-drum-onsets':'energy-fallback',choruses,segments,bursts,lyricLines:usable.length,repeatedLines:repeats.length};
}
