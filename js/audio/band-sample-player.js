// The same performed events drive audio and character motion. Samples are
// shared between songs; each character has its own gain bus and note sources.
export async function verifiedAudio(ctx, item, signal) {
  const response=await fetch(item.audio,{signal});
  if(!response.ok)throw new Error('乐队音频资源无法读取');
  const bytes=await response.arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==item.audioSha256)throw new Error('乐队音频摘要不一致');
  return ctx.decodeAudioData(bytes);
}

export function createBandSamplePlayer(ctx,output){
  let parts=[],banks=null,buffers=new Map(),timer=null,transport=null,scheduled=0;
  const voices=new Set(),buses=new Map(),cursors=new Map();
  function stop(){
    clearInterval(timer);timer=null;transport=null;cursors.clear();
    for(const voice of voices){try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();}
    voices.clear();
  }
  function sampleFor(part,pitch){const bank=banks.banks[part.bank];
    return bank.samples.reduce((best,s)=>Math.abs(s.midi-pitch)<Math.abs(best.midi-pitch)?s:best,bank.samples[0]);
  }
  function play(part,e,at,elapsed=0){
    const bank=banks.banks[part.bank],sample=sampleFor(part,e.midi),buffer=buffers.get(sample.audio);
    if(!buffer||e.end-e.start-elapsed<.015)return;
    const rate=bank.percussion?1:2**((e.midi-sample.midi)/12),source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=buffer;source.playbackRate.value=rate;
    source.loop=Boolean(bank.sustain);source.loopStart=sample.loopStart;source.loopEnd=sample.loopEnd;
    const start=Math.max(ctx.currentTime+.002,at),length=e.end-e.start-elapsed;
    const level=e.velocity*.27,release=part.percussion?.07:.16;
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+.012);
    gain.gain.setValueAtTime(level,start+Math.max(.013,length));gain.gain.linearRampToValueAtTime(0,start+length+release);
    source.connect(gain);gain.connect(buses.get(part.id));
    let offset=elapsed*rate;
    if(bank.sustain&&offset>sample.loopStart)offset=sample.loopStart+(offset-sample.loopStart)%(sample.loopEnd-sample.loopStart);
    else offset=Math.min(offset,Math.max(0,buffer.duration-.03));
    const voice={source,gain};voices.add(voice);
    source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();};
    source.start(start,offset);source.stop(start+length+release+.01);scheduled++;
  }
  function pump(horizon=globalThis.document?.hidden?3:.35){
    if(!transport)return;
    const {at,offset,duration,loop}=transport;
    const now=offset+ctx.currentTime-at,limit=now+horizon;
    for(const part of parts){const cursor=cursors.get(part.id);
      let guard=0;
      while(guard++<part.events.length+1){
        if(cursor.index>=part.events.length){if(!loop||!part.events.length)break;cursor.index=0;cursor.cycle++;}
        const event=part.events[cursor.index],time=event.start+cursor.cycle*duration;
        if(time>limit)break;
        if(time>=now-.06)play(part,event,at+time-offset);
        cursor.index++;
      }
    }
  }
  return {
    async configure(score,theme,signal){
      stop();for(const bus of buses.values())bus.disconnect();buses.clear();buffers.clear();
      const response=await fetch(score.hybrid.bankManifest,{signal});if(!response.ok)throw new Error('乐器音色清单无法读取');banks=await response.json();
      const ids=new Set(score.arrangement.themes[theme].map(p=>p.stemId));
      parts=score.stems.filter(p=>ids.has(p.id)&&p.instrumentId!=='vocals');
      const needed=new Map();
      for(const part of parts){const bus=ctx.createGain();bus.gain.value=0;bus.connect(output);buses.set(part.id,bus);
        for(const e of part.events){const sample=sampleFor(part,e.midi);needed.set(sample.audio,sample);}}
      // Bound decode pressure instead of starting hundreds of decoders together.
      const queue=[...needed.values()];let next=0;
      await Promise.all(Array.from({length:4},async()=>{while(next<queue.length){const s=queue[next++];buffers.set(s.audio,await verifiedAudio(ctx,s,signal));}}));
    },
    start(at,offset,duration,loop){stop();transport={at,offset,duration,loop};
      for(const part of parts){let index=0;while(index<part.events.length&&part.events[index].start<offset){
        const e=part.events[index];if(e.end>offset&&!part.percussion)play(part,e,at,offset-e.start);index++;}
        cursors.set(part.id,{index,cycle:0});}
      pump();timer=setInterval(()=>pump(),40);
    },
    get buses(){return buses;},pump,stop,
    get diagnostics(){return {scheduled,activeVoices:voices.size,decodedSamples:buffers.size,running:Boolean(transport)};},
    dispose(){stop();for(const bus of buses.values())bus.disconnect();buses.clear();buffers.clear();}
  };
}
