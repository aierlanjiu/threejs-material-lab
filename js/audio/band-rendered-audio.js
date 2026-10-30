// Sample-aligned rendering of packaged stems with a bounded two-chunk cache.
// The original track remains a transparent fallback while a seek is loading.
export function createRenderedStemAudio({getContext,getOutput,getTime=()=>0}){
 let score=null,enabled=false,ready=false,disposed=false,abort=null,transport=null,timer=null,originalGain=null,generation=0,error='';
 let policy={muted:[],soloGroup:null},restoreTime=null,spatial={};
 const cache=new Map(),pending=new Map(),failed=new Set(),scheduled=new Set(),sources=new Set(),buses=new Map();
 const parts=()=>score?.stems.filter(s=>s.chunks?.length)||[];
 const audible=(id,p=policy)=>!p.muted.includes(id)&&(!p.soloGroup||p.soloGroup===id);
 function param(p,value,at=getContext().currentTime){p.cancelScheduledValues(at);p.setTargetAtTime(value,at,.015);}
 function bed(value,at){if(originalGain)param(originalGain.gain,value,at);}
 function applyPolicy(at=getContext().currentTime){
  for(const [id,bus] of buses){
   param(bus.gain.gain,enabled&&audible(id)?1:0,at);
   if(restoreTime!==null&&transport){const restoreAt=transport.at+restoreTime-transport.offset;
    if(restoreAt>at){bus.gain.gain.setValueAtTime(enabled&&audible(id)?1:0,restoreAt-.001);bus.gain.gain.linearRampToValueAtTime(enabled?1:0,restoreAt+.045);}}
  }
 }
 function applySpatial(){for(const [id,bus] of buses){const sp=spatial[id]||{};param(bus.depth.gain,sp.depthGain??1);if(bus.pan)param(bus.pan.pan,sp.pan??0);}}
 async function verifiedChunk(item){
  let last;
  for(let attempt=0;attempt<2;attempt++){
   try{const response=await fetch(item.audio,{signal:abort.signal});if(!response.ok)throw Error(`HTTP ${response.status}`);
    const bytes=await response.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==item.audioSha256)throw Error('声部片段摘要不一致');
    const buffer=await getContext().decodeAudioData(bytes);
    if(Math.abs(buffer.duration-item.duration)>.06)throw Error('声部片段时长不一致');
    return buffer;
   }catch(e){last=e;if(e.name==='AbortError'||attempt||!String(e).includes('HTTP'))break;}
  }throw last;
 }
 function loadChunk(index){
  if(cache.has(index))return Promise.resolve(cache.get(index));
  if(pending.has(index))return pending.get(index);
  if(failed.has(index))return Promise.reject(Error('声部片段读取失败，请重新选择歌曲后重试'));
  const promise=Promise.all(parts().map(async stem=>[stem.id,await verifiedChunk(stem.chunks[index])]))
   .then(entries=>{const buffers=new Map(entries);if(!disposed)cache.set(index,buffers);return buffers;})
   .catch(e=>{failed.add(index);throw e;}).finally(()=>pending.delete(index));
  pending.set(index,promise);return promise;
 }
 function position(){if(!transport)return null;const raw=transport.offset+Math.max(0,getContext().currentTime-transport.at);return {raw,cycle:Math.floor(raw/score.duration),song:raw%score.duration};}
 function scheduleChunk(index,cycle,buffers){
  if(!transport||!enabled)return;
  const key=`${cycle}:${index}`;
  const current=position(),isCurrent=current&&index===Math.floor(current.song/score.rendered.chunkSeconds)&&cycle===current.cycle;
  if(scheduled.has(key)){if(isCurrent){ready=true;error='';bed(0);}return;}
  const item=parts()[0].chunks[index],target=transport.at+cycle*score.duration+item.start-transport.offset;
  const ctx=getContext(),at=Math.max(target,ctx.currentTime+.025),skip=at-target;
  if(skip>=item.duration-.002)return;
  for(const [id,buffer] of buffers){const node=ctx.createBufferSource();node.buffer=buffer;node.connect(buses.get(id).gain);
   const duration=Math.min(item.duration-skip,buffer.duration-skip);if(duration<=0)continue;
   sources.add(node);node.onended=()=>{sources.delete(node);node.disconnect();};node.start(at,skip,duration);}
  scheduled.add(key);
  const pos=position();if(pos&&index===Math.floor(pos.song/score.rendered.chunkSeconds)&&cycle===pos.cycle){ready=true;error='';bed(0,at);}
 }
 function tick(){
  if(!transport||!enabled||disposed)return;
  const pos=position();if(!transport.loop&&pos.raw>=score.duration){clearInterval(timer);timer=null;return;}
  const count=parts()[0].chunks.length,index=Math.min(count-1,Math.floor(pos.song/score.rendered.chunkSeconds));
  if(!scheduled.has(`${pos.cycle}:${index}`)){ready=false;bed(1);}
  const wanted=[[index,pos.cycle]];if(index+1<count)wanted.push([index+1,pos.cycle]);else if(transport.loop)wanted.push([0,pos.cycle+1]);
  const token=generation;
  for(const [idx,cycle] of wanted){
   if(failed.has(idx))continue;
   if(cache.has(idx))scheduleChunk(idx,cycle,cache.get(idx));
   else loadChunk(idx).then(buffers=>{if(token===generation)scheduleChunk(idx,cycle,buffers);}).catch(e=>{if(token!==generation||e.name==='AbortError')return;error=e.message;if(idx===index){ready=false;bed(1);}console.warn('珍珠贝壳声部:',e.message);});
  }
  for(const key of cache.keys())if(!wanted.some(([idx])=>idx===key))cache.delete(key);
 }
 function clearSources(){for(const node of sources){try{node.stop();}catch{}node.disconnect();}sources.clear();scheduled.clear();}
 function stop(){++generation;clearInterval(timer);timer=null;transport=null;clearSources();originalGain?.disconnect();originalGain=null;ready=cache.size>0;}
 return {
  async configure(data){score=data;abort=new AbortController();const ctx=getContext();
   for(const stem of parts()){const gain=ctx.createGain(),depth=ctx.createGain(),pan=ctx.createStereoPanner?.();gain.gain.value=0;depth.gain.value=1;gain.connect(depth);if(pan){depth.connect(pan);pan.connect(getOutput());}else depth.connect(getOutput());buses.set(stem.id,{gain,depth,pan});}
   await loadChunk(0);ready=true;applySpatial();
  },
  start(source,offset,duration,loop=false,advanceOffset=false){stop();const ctx=getContext(),prepared=ctx.currentTime;
   originalGain=ctx.createGain();originalGain.gain.value=1;source.connect(originalGain).connect(getOutput());
   const at=ctx.currentTime+.08,actualOffset=(offset+(advanceOffset?ctx.currentTime-prepared:0))%duration;
   transport={at,offset:actualOffset,loop};ready=false;applyPolicy();applySpatial();tick();timer=setInterval(tick,100);return {at,offset:actualOffset};
  },
  stop,
  setEnabled(value){enabled=Boolean(value);if(!enabled){clearInterval(timer);timer=null;clearSources();bed(1);}applyPolicy();},
  setPolicy(value,at,{restoreTime:restore=null}={}){policy={muted:[...value.muted],soloGroup:value.soloGroup};restoreTime=restore;applyPolicy(at);},
  setSpatial(value){spatial=value||{};applySpatial();},
  get diagnostics(){return {source:'rendered-stems',ready,playing:Boolean(transport),contextState:getContext().state,contextTime:getContext().currentTime,enabled,trackId:score?.trackId,error,policy,restoreSongTime:restoreTime,
   loaded:[...buses.keys()],cachedChunks:[...cache.keys()],pendingChunks:[...pending.keys()],
   decodedBytes:[...cache.values()].reduce((n,chunk)=>n+[...chunk.values()].reduce((s,b)=>s+b.length*b.numberOfChannels*4,0),0),
   bed:originalGain?.gain.value??1,coefficients:Object.fromEntries([...buses].map(([id,b])=>[id,b.gain.gain.value]))};},
  dispose(){disposed=true;abort?.abort();stop();cache.clear();for(const b of buses.values()){b.gain.disconnect();b.depth.disconnect();b.pan?.disconnect();}buses.clear();}
 };
}
