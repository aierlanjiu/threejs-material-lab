import {bandEffectsTimeline} from './band-effects-timeline.js';
const noiseCache = new WeakMap();
function noiseFor(ctx) {
  if (!noiseCache.has(ctx)) {
    const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);let seed=78413;
    for(let i=0;i<d.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;d[i]=(seed/4294967296*2-1)*(.72+.28*Math.sin(i/ctx.sampleRate*117)**12);}
    noiseCache.set(ctx,b);
  }
  return noiseCache.get(ctx);
}

// All nodes belong to this effects bus. Music never passes through its compressor.
export function schedulePyroVoice(ctx,output,{kind='jet',at=ctx.currentTime,duration=1,pan=0,power=1,offset=0}={}) {
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),panner=ctx.createStereoPanner();
  source.buffer=noiseFor(ctx);source.loop=true;filter.type=kind==='air'?'lowpass':'bandpass';filter.frequency.value=kind==='air'?850:2200;filter.Q.value=kind==='air'?.5:.65;panner.pan.value=pan;
  source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(output);
  const end=at+Math.max(.06,duration),level=(kind==='jet'?.36:kind==='salvo'?.32:.16)*power;
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.035);
  gain.gain.setValueAtTime(level,Math.max(at+.04,end-Math.min(.35,duration*.45)));
  if(level>0)gain.gain.exponentialRampToValueAtTime(.0001,end);else gain.gain.setValueAtTime(0,end);
  source.start(at,(offset+Math.abs(pan)*.71)%2);source.stop(end+.02);
  const nodes=[source,filter,gain,panner];let ended=false;
  const dispose=()=>{if(ended)return;ended=true;nodes.forEach(n=>n.disconnect());};source.onended=dispose;
  return {gain,end,stop(now=ctx.currentTime){if(ended)return;gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(.0001,now,.012);try{source.stop(now+.06);}catch{}},get ended(){return ended;}};
}

export function createBandPyroAudio({getContext,getOutput}) {
  let ctx=null,bus=null,limiter=null,voices=[],scoreRef=null,modeRef='',narrowRef=false,lastSong=null,lastAudio=null,wasPlaying=false,seen=new Set(),emitted=0;
  function stop(){if(ctx)voices.forEach(v=>v.stop());voices=[];seen.clear();wasPlaying=false;lastSong=lastAudio=null;}
  function update({score,time,playing,enabled=true,mode='auto',narrow=false,fx=null}) {
    if(!score||!enabled||!playing||mode==='off'){if(wasPlaying||voices.length)stop();return;}
    const next=getContext();if(!next||next.state!=='running')return;
    if(ctx!==next){stop();bus?.disconnect();limiter?.disconnect();ctx=next;bus=ctx.createGain();bus.gain.value=.28;limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-14;limiter.ratio.value=8;limiter.attack.value=.002;limiter.release.value=.15;bus.connect(limiter);limiter.connect(getOutput());}
    const now=ctx.currentTime,jump=lastSong!==null&&Math.abs((time-lastSong)-(now-lastAudio))>.35;
    if(scoreRef!==score||modeRef!==mode||narrowRef!==narrow||jump||!wasPlaying){stop();scoreRef=score;modeRef=mode;narrowRef=narrow;}
    wasPlaying=true;lastSong=time;lastAudio=now;voices=voices.filter(v=>!v.ended);
    const timeline=bandEffectsTimeline(score),period=240/(score.bpmEstimate||120);
    const bursts=mode==='preview'?Array.from({length:3},(_,i)=>(Math.floor(time/period)+i)*period):timeline.bursts;
    const windows=mode==='preview'?[{start:0,end:score.duration}]:timeline.windows;
    const activeWindows=[...windows];
    if(fx?.fountainWindow && !windows.some(w=>w.start<=fx.fountainWindow.start&&w.end>=fx.fountainWindow.end))activeWindows.push(fx.fountainWindow);
    const fire=(id,event)=>{if(seen.has(id)||voices.length>=48)return;seen.add(id);voices.push(schedulePyroVoice(ctx,bus,event));emitted++;};
    for(const w of activeWindows){if(w.end<=time||w.start>time+1.2)continue;const start=Math.max(time,w.start),count=narrow?6:8;
      for(let i=0;i<count;i++){const rank=Math.floor(Math.abs(i-(count-1)/2)),begin=Math.max(start,w.start+rank*.11);if(begin>=w.end)continue;
        fire(`jet:${w.start}:${i}`,{kind:'jet',at:now+Math.max(0,begin-time)+.012,duration:w.end-begin+.32,pan:(i/(count-1)*2-1)*.8,power:1/Math.sqrt(count),offset:begin-w.start});}
    }
    for(const b of [...new Set([...bursts,...(fx?.bursts||[])])])for(const [delay,kind,power] of [[.48,'salvo',.8],[.72,'air',.7],[1.18,'air',.55]]){
      const t=b+delay;if(t<time-.025||t>time+1.2||t>=score.duration)continue;
      fire(`${kind}:${t}`,{kind,at:now+Math.max(0,t-time)+.012,duration:kind==='air'?1.25:.38,pan:delay===.72?-.45:delay===1.18?.45:0,power});
    }
  }
  return {update,stop,get diagnostics(){return {enabled:wasPlaying,voices:voices.filter(v=>!v.ended).length,emitted,score:scoreRef?.trackId||null,independentBus:true};},dispose(){stop();bus?.disconnect();limiter?.disconnect();}};
}
