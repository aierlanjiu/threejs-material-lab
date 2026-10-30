import {spriteActionFrame,drawSpriteAction} from '../avatar/sprite-actions.js';
import {petFrameAt} from '../audio/band-stage-layout.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion:reduce)');
let manifest,original,expanded,playing=false,position=0,action='play',speed=1,last=performance.now();
const loadImage=async url=>{const i=new Image();i.src=url;await i.decode();return i;};
function render(){if(!manifest)return;
 const frame=spriteActionFrame(manifest,position,{action,reduced:reduced.matches});
 drawSpriteAction($('expanded').getContext('2d'),expanded,manifest,frame);
 const oldFrame=petFrameAt(position,120,action==='rest'?0:1,{reduced:reduced.matches,attack:action==='accent'&&position%.5<.09?.8:0}),c=$('original').getContext('2d');
 c.clearRect(0,0,640,640);c.drawImage(original,oldFrame*256,0,256,320,64,0,512,640);
 $('seek').value=position;$('time').textContent=position.toFixed(2)+' s';
 Object.assign(window.spriteAnimationReview,{position,playing,action,frame,reduced:reduced.matches});
}
function setPlaying(value){playing=Boolean(value)&&!reduced.matches;last=performance.now();$('play').textContent=playing?'暂停':'播放';render();}
function setAction(value){action=value;position=0;document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===action)));render();}
window.spriteAnimationReview={ready:false,setPlaying,setAction,setTime:value=>{position=Math.max(0,Math.min(6,value));render();}};
try{[manifest,original,expanded]=await Promise.all([fetch('./assets/band-pet-actions/one-piece/zoro/manifest.json').then(r=>{if(!r.ok)throw Error('角色索引载入失败');return r.json();}),loadImage('./assets/band-pets/one-piece/zoro.webp'),loadImage('./assets/band-pet-actions/one-piece/zoro/zoro-actions.webp')]);
 Object.assign(window.spriteAnimationReview,{ready:true,frameCount:manifest.frameCount,uniqueNewCels:manifest.frames.length});$('play').disabled=false;setPlaying(!reduced.matches);
}catch(e){$('error').textContent=String(e);window.spriteAnimationReview.error=String(e);}
$('play').onclick=()=>setPlaying(!playing);document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>setAction(b.dataset.action));
$('seek').oninput=()=>{setPlaying(false);position=+$('seek').value;render();};$('slow').onclick=()=>{speed=speed===1?.4:1;$('slow').setAttribute('aria-pressed',String(speed!==1));};
reduced.addEventListener('change',()=>{if(reduced.matches)setPlaying(false);render();});
function frame(now){if(playing){position=(position+(now-last)/1000*speed)%6;render();}last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
