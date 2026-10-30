import {loadBandActionPets,spritePerformanceFrame,drawSpriteAction} from '../avatar/sprite-actions.js';
import {INSTRUMENTS} from '../avatar/instrument-manifest.js';
// Isolated production review. No changes to the concert or main player.
const $=id=>document.getElementById(id);
const AUDIO='output/lu-band-arrangement/one-day-shell-v1/';
const W=768,H=640,OFFSET=65,LENGTH=30;
let manifest,arrangement,actors=[],selected='luffy',lyrics=[];
let context,buffers=new Map(),gains=new Map(),sources=[],playing=false,position=0,anchor=0,solo=null;
const muted=new Set(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let sprites=new Map(),actionPets;
function getTime(){return playing?Math.min(LENGTH,Math.max(0,context.currentTime-anchor)):position;}
function gate(id,time){
 if(id==='luffy')return 0; // No new choir is present in this instrumental review.
 if(muted.has(id)||(solo&&solo!==id))return 0;
 const part=arrangement?.parts.find(p=>p.id===id);if(!part)return 0;
 let value=0;
 for(const note of part.events){if(note.start>time)break;const age=time-note.start;if(age>=0&&time<note.end+.10)value=Math.max(value,(note.velocity/127)*Math.exp(-age*5));}
 return value;
}
function draw(actor,canvas,time=OFFSET){
 const image=sprites.get(actor.id);if(!image)return;
 const pet=actionPets.get('one-piece/'+actor.id),frame=spritePerformanceFrame(pet,time,arrangement?.bpmEstimate||120,gate(actor.id,time),{reduced});
 drawSpriteAction(canvas.getContext('2d'),image,pet,frame.frame);
}
function select(id){selected=id;const actor=actors.find(a=>a.id===id);$('actorName').textContent=`${actor.name} · ${actor.instrument}`;document.querySelectorAll('.actor').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));$('layerInfo').textContent=`${actor.name}：完整人物17帧（16个新增姿态）；当前音乐仍为旧器乐制作稿。`;}
function refreshGains(){for(const part of arrangement.parts){const audible=!muted.has(part.id)&&(!solo||solo===part.id);gains.get(part.id)?.gain.setValueAtTime(audible?1:0,context.currentTime);const row=document.querySelector(`[data-track="${part.id}"]`);row?.querySelector('.mute').setAttribute('aria-pressed',String(muted.has(part.id)));row?.querySelector('.solo').setAttribute('aria-pressed',String(solo===part.id));}window.shellPerformanceReview.solo=solo;window.shellPerformanceReview.muted=[...muted];}
function stopSources(){for(const source of sources){try{source.stop();}catch{}}sources=[];}
function pause(){position=getTime();playing=false;stopSources();$('play').textContent='继续试听';}
async function play(){
 $('fullAudio').pause();
 $('play').disabled=true;
 try{
  context??=new AudioContext();await context.resume();
  if(buffers.size!==9){$('status').textContent='正在解码九轨30秒音频…';await Promise.all(arrangement.parts.map(async part=>{const response=await fetch(AUDIO+`solo-30s/${part.id}.mp3`);if(!response.ok)throw Error(`${part.id} HTTP ${response.status}`);buffers.set(part.id,await context.decodeAudioData(await response.arrayBuffer()));}));}
  if(position>=LENGTH-.01)position=0;
  stopSources();const start=context.currentTime+.08;anchor=start-position;
  for(const part of arrangement.parts){const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(part.id);source.connect(gain).connect(context.destination);gains.set(part.id,gain);source.start(start,position,LENGTH-position);sources.push(source);}
  playing=true;refreshGains();$('play').textContent='暂停';$('status').textContent='九轨已共用同一起播时刻；和声与音色等待试听确认。';
  Object.assign(window.shellPerformanceReview,{audioReady:true,bufferCount:buffers.size,sampleRates:[...buffers.values()].map(b=>b.sampleRate),startTime:start});
 }catch(error){$('error').textContent=String(error);playing=false;stopSources();}finally{$('play').disabled=false;}
}
function parseLrc(text){return text.split('\n').flatMap(line=>{const match=line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);return match?[{time:+match[1]*60+ +match[2],text:match[3]}]:[];});}
function clock(value){return `${Math.floor(value/60).toString().padStart(2,'0')}:${Math.floor(value%60).toString().padStart(2,'0')}`;}
let lastPaint=0;
function frame(now){
 if(now-lastPaint>33){lastPaint=now;const t=getTime();if(playing&&t>=LENGTH){pause();position=LENGTH;$('play').textContent='重新试听';}
  const actor=actors.find(a=>a.id===selected);if(actor)draw(actor,$('actorCanvas'),OFFSET+t);
  $('seek').value=t;$('time').textContent=`${clock(OFFSET+t)} / ${clock(OFFSET+LENGTH)}`;
  $('lyric').textContent=[...lyrics].reverse().find(l=>l.time<=OFFSET+t)?.text??'';
  if(window.shellPerformanceReview)Object.assign(window.shellPerformanceReview,{position:t,selected,playing});
 }requestAnimationFrame(frame);
}
async function init(){
 window.shellPerformanceReview={ready:false,audioReady:false,sourceOffset:OFFSET,choirDelivered:false};
 try{
  [actionPets,arrangement]=await Promise.all([loadBandActionPets(),fetch(AUDIO+'arrangement.json').then(r=>r.json())]);
  actors=INSTRUMENTS.filter(actor=>actor.theme==='one-piece').map(actor=>({...actor,id:actor.id.split('/')[1]}));
  await Promise.all(actors.map(async actor=>{const image=new Image();image.src=actionPets.get('one-piece/'+actor.id).asset;await image.decode();sprites.set(actor.id,image);}));
  lyrics=parseLrc(await fetch(AUDIO+'anime_op_one_day.lrc').then(r=>r.text()));
  for(const actor of actors){const button=document.createElement('button');button.className='actor';button.dataset.id=actor.id;button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',`查看${actor.name}`);const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;button.append(canvas);const label=document.createElement('span');label.textContent=actor.name;button.append(label);button.onclick=()=>select(actor.id);$('roster').append(button);draw(actor,canvas);}
  for(const part of arrangement.parts){const row=document.createElement('div');row.className='track';row.dataset.track=part.id;const title=document.createElement('span');title.textContent=part.name;const small=document.createElement('small');small.textContent=part.instrument;title.append(small);row.append(title);for(const [type,label] of [['mute','静音'],['solo','独奏']]){const b=document.createElement('button');b.className=type;b.textContent=label;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',`${part.name}${label}`);b.onclick=()=>{if(type==='mute'){if(muted.has(part.id))muted.delete(part.id);else muted.add(part.id);}else solo=solo===part.id?null:part.id;refreshGains();};row.append(b);}$('tracks').append(row);}
  select('luffy');$('play').disabled=false;$('play').textContent='播放试听';$('status').textContent='十位角色与九轨索引已就绪，点击播放解码试听音频。';
  Object.assign(window.shellPerformanceReview,{ready:true,actorCount:actors.length,renderMode:'sprite-sequence',spriteFrameCount:17,instrumentCount:arrangement.parts.length});
  requestAnimationFrame(frame);
 }catch(error){$('error').textContent=String(error);}
}
$('play').onclick=()=>playing?pause():play();
$('stop').onclick=()=>{pause();position=0;$('play').textContent='播放试听';};
$('clear').onclick=()=>{muted.clear();solo=null;refreshGains();};
$('seek').oninput=()=>{const wasPlaying=playing;if(wasPlaying)pause();position=+$('seek').value;if(wasPlaying)play();};
$('fullAudio').src=AUDIO+$('fullMode').value;
$('fullMode').onchange=()=>{const audio=$('fullAudio'),time=audio.currentTime;audio.pause();audio.src=AUDIO+$('fullMode').value;audio.addEventListener('loadedmetadata',()=>{audio.currentTime=Math.min(time,audio.duration);},{once:true});};
$('fullAudio').onplay=()=>{if(playing)pause();};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause();});
init();
