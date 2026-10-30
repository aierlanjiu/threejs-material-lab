import {loadLayeredBandCast} from '../avatar/layered-band-cast.js?v=20261030-rig3';
import {rehearsalSample,RIG_ROLES} from '../avatar/band-character-rig.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion:reduce)');
let cast,selected='zoro',members=new Map(),playing=false,position=0,last=performance.now(),speed=1,rest=false;
function render(){const m=members.get(selected);if(!m)return;m.update(position,rest?{activity:0}:rehearsalSample(selected,position),reduced.matches,{showJoints:$('joints').checked});
 const c=$('actor').getContext('2d');c.clearRect(0,0,512,640);c.drawImage(m.canvas,0,0);$('seek').value=position;$('time').textContent=position.toFixed(2)+' / 8.00';
 const error=Math.max(...m.pose.arms.map(a=>a.contactError));$('state').textContent=`${rest?'静止':playing?'正在排练':'已暂停'} · ${reduced.matches?'减少动态 · ':''}青色为自身左臂，红色为自身右臂 · ${error<.01?'关节与接触点已连接':'存在不可达接触点，待修正'}`;
 window.characterRigReview.position=position;window.characterRigReview.selected=selected;window.characterRigReview.playing=playing;window.characterRigReview.pose=m.pose;
}
function select(id){if(!members.has(id))throw Error('Unknown actor: '+id);selected=id;const role=RIG_ROLES[id];$('name').textContent=role.name;$('action').textContent=role.action;
 $('old').src=`./output/shell-live-integration-20261029-233016/browser/strict/final-${role.name}.png`;
 $('download').href=`./output/character-rig-rebuild-20261030/final/${id}-action.mp4`;
 document.querySelectorAll('[data-actor]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.actor===id)));render();}
function setTime(time,options={}){position=Math.max(0,Math.min(8,time));rest=Boolean(options.rest);if(options.joints!==undefined)$('joints').checked=options.joints;render();}
function setPlaying(value){playing=Boolean(value);rest=false;last=performance.now();$('play').textContent=playing?'暂停':'播放动作';render();}
window.characterRigReview={ready:false,selectActor:select,setTime,setPlaying,getCanvas:()=>members.get(selected)?.canvas};
try{cast=await loadLayeredBandCast();for(const a of cast.manifest.actors){const m=cast.create(a.id);members.set(a.id,m);const button=document.createElement('button');button.dataset.actor=a.id;button.setAttribute('aria-label',`查看${a.name}`);const c=document.createElement('canvas');c.width=128;c.height=160;c.getContext('2d').drawImage(m.canvas,0,0,128,160);const label=document.createElement('span');label.textContent=a.name;button.append(c,label);button.onclick=()=>select(a.id);$('roster').append(button);}
 window.characterRigReview.ready=true;window.characterRigReview.actorCount=members.size;window.characterRigReview.rigVersion=3;select(selected);$('play').disabled=false;$('play').textContent='播放动作';
}catch(e){$('error').textContent=String(e);window.characterRigReview.error=String(e);}
$('play').onclick=()=>{if(position>=8)position=0;setPlaying(!playing);};$('rest').onclick=()=>{setPlaying(false);rest=true;render();};$('seek').oninput=()=>{setPlaying(false);setTime(+$('seek').value);};$('speed').onchange=()=>{speed=+$('speed').value;};$('joints').onchange=render;
$('compare').onchange=()=>{$('oldFigure').hidden=!$('compare').checked;$('comparison').style.gridTemplateColumns=$('compare').checked?'':'1fr';};
function frame(now){if(playing){position+=(now-last)/1000*speed;if(position>=8)position%=8;render();}last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
