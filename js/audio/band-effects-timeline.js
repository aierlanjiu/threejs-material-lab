import {stageClimaxAt} from './band-stage-layout.js';
const cache = new WeakMap();
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const t = clamp(x); return t*t*(3-2*t); };

// Shared by the approved close-up and the score-linked stage presentation.
export function energyWingEnvelope(age,{life=4.3}={}) {
  const end=Math.min(4.3,Math.max(0,life)),fadeStart=Math.min(3.25,end*.76);
  const dissolve=smooth((age-fadeStart)/Math.max(.1,end-fadeStart));
  return {power:smooth((age+.6)/.48)*(1-dissolve),spread:smooth((age+.10)/.48),dissolve};
}

export function bandEffectsTimeline(score) {
  if (!score || !(score.duration > 0)) return {bursts:[],windows:[],peak:null};
  if (cache.has(score)) return cache.get(score);
  const period = 240 / (score.bpmEstimate || 120), candidates = score.stageCues?.choruses?.length
    ? score.stageCues.bursts || [] : Array.from({length:Math.floor(score.duration/period)},(_,i)=>(i+1)*period);
  const bursts = [...new Set(candidates.filter(t => t >= 0 && t < score.duration && stageClimaxAt(score,t+.001).bursts.some(b=>Math.abs(b-t)<.01)))].sort((a,b)=>a-b);
  const windows = [];
  const raw = score.stageCues?.choruses?.length ? score.stageCues.choruses : bursts.map(t=>({start:t,end:Math.min(score.duration,t+5.1)}));
  for (const w of [...raw].sort((a,b)=>a.start-b.start)) {
    const previous = windows.at(-1);
    if (previous && w.start <= previous.end) previous.end = Math.max(previous.end, w.end);
    else windows.push({start:w.start,end:Math.min(score.duration,w.end)});
  }
  let peak = null, strength = -1;
  for (const t of bursts) {
    if (t+.72 > score.duration-2.2) continue;
    const energy = [-.2,0,.2,.4,.6].reduce((sum,d)=>sum+stageClimaxAt(score,Math.max(0,t+d)).energy,0)/5;
    if (energy >= strength) { strength=energy; peak=t+.72; }
  }
  const result = {bursts,windows,peak,source:score.stageCues?.source||'score-energy-estimate'}; cache.set(score,result); return result;
}

export function stageEffectsAt(score,time,mode='auto',easterEgg=null) {
  let fx = stageClimaxAt(score,time,mode);
  if (easterEgg && mode!=='off' && time>=easterEgg.time && time<easterEgg.end) {
    fx={...fx,energy:Math.max(fx.energy,.7),intensity:Math.max(fx.intensity,easterEgg.id==='curtain'?1:.75),bursts:[...new Set([...fx.bursts,easterEgg.time])],fountainWindow:{start:easterEgg.time,end:easterEgg.time+3}};
  }
  return fx;
}

export function particleWingState(score,time,{mode='auto',reduced=false}={}) {
  if (!score || mode==='off' || reduced || time<0 || time>=score.duration) return {power:0,spread:0,peak:null};
  const period=720/(score.bpmEstimate||120),peak=mode==='preview'?Math.floor(time/period)*period+.72:bandEffectsTimeline(score).peak;
  if (peak===null) return {power:0,spread:0,peak};
  const age=time-peak;
  return {peak,age,...energyWingEnvelope(age,{life:score.duration-peak})};
}
