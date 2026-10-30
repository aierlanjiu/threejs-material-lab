import {loadBandActionPets,spriteActionFrame,drawSpriteAction} from '../avatar/sprite-actions.js';
import {petFrameAt} from '../audio/band-stage-layout.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion:reduce)');
let actors,manifest,original,expanded,selected='zoro',playing=false,position=0,action='play',speed=1,last=performance.now(),revision=0;
const images=new Map();
const loadImage=async url=>{const i=new Image();i.src=url;await i.decode();return i;};
function render(){if(!manifest)return;
 const frame=spriteActionFrame(manifest,position,{action,reduced:reduced.matches});
 drawSpriteAction($('expanded').getContext('2d'),expanded,manifest,frame);
 const oldFrame=petFrameAt(position,120,action==='rest'?0:1,{reduced:reduced.matches,attack:action==='accent'&&position%.5<.09?.8:0}),c=$('original').getContext('2d');
 c.clearRect(0,0,c.canvas.width,c.canvas.height);c.drawImage(original,oldFrame*256,0,256,320,(c.canvas.width-512)/2,0,512,640);
 $('seek').value=position;$('time').textContent=position.toFixed(2)+' s';
 Object.assign(window.spriteAnimationReview,{position,playing,action,frame,selected,reduced:reduced.matches});
}
function setPlaying(value){playing=Boolean(value)&&!reduced.matches;last=performance.now();$('play').textContent=playing?'暂停':'播放';render();}
function setAction(value){action=value;position=0;document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===action)));render();}
async function selectActor(id){
 const pet=actors.get('one-piece/'+id);if(!pet)throw Error('Unknown character');const token=++revision;$('play').disabled=true;
 if(!images.has(id))images.set(id,Promise.all([loadImage(`./assets/band-pets/one-piece/${id}.webp`),loadImage(pet.asset)]));
 try{const loaded=await images.get(id);if(token!==revision)return;[original,expanded]=loaded;manifest=pet;selected=id;position=0;
  $('actorName').textContent=pet.name;$('video').href=`./output/sprite-animation-20261030/${id}-comparison.mp4`;
  $('original').width=$('expanded').width=Math.max(640,pet.frameWidth*2);
  document.querySelectorAll('[data-actor]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.actor===id)));
  Object.assign(window.spriteAnimationReview,{ready:true,selected,frameCount:pet.frameCount,uniqueNewCels:pet.newCelCount});$('play').disabled=false;render();
 }catch(error){images.delete(id);$('error').textContent=String(error);window.spriteAnimationReview.error=String(error);}
}
window.spriteAnimationReview={ready:false,selectActor,setPlaying,setAction,setTime:value=>{position=Math.max(0,Math.min(6,value));render();}};
try{actors=await loadBandActionPets();for(const pet of actors.values()){const button=document.createElement('button');button.dataset.actor=pet.id.split('/')[1];button.textContent=pet.name;button.setAttribute('aria-pressed','false');button.onclick=()=>selectActor(button.dataset.actor);$('roster').append(button);}
 window.spriteAnimationReview.actorCount=actors.size;await selectActor(selected);setPlaying(!reduced.matches);
}catch(e){$('error').textContent=String(e);window.spriteAnimationReview.error=String(e);}
$('play').onclick=()=>setPlaying(!playing);document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>setAction(b.dataset.action));
$('seek').oninput=()=>{setPlaying(false);position=+$('seek').value;render();};$('slow').onclick=()=>{speed=speed===1?.4:1;$('slow').setAttribute('aria-pressed',String(speed!==1));};
reduced.addEventListener('change',()=>{if(reduced.matches)setPlaying(false);render();});
function frame(now){if(playing){position=(position+(now-last)/1000*speed)%6;render();}last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
