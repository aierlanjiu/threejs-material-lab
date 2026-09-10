// LÜ adapter: official scene definitions -> official capture -> shared cube texture.
// No private URL tuples, SVG path reconstruction, or substitute character geometry.
let sdkPromise;
const records=new Map();
const atlasImages=new Map();
const atlasMetrics=new Map();
const definitionsPromise=fetch(new URL('./avatar-presets.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('角色定义加载失败');return r.json();});
const storageKey='lu-oneworks-definition-v1-';
function readSaved(key){try{return JSON.parse(localStorage.getItem(storageKey+key)||'null');}catch{return null;}}
function sdk(){return sdkPromise??=import('./vendor/oneworks.js?v=20260911-motion');}
function clipFor(def,emote){
  const height=def.scene.face.height, yaw=def.scene.view.yaw, pitch=def.scene.view.pitch;
  const upbeat=['happy','sing','surprised'].includes(emote);
  const wink=emote==='wink';
  return {anchor:'absolute',durationMs:4000,playback:'loop',keyframes:[
    {atMs:0,patch:{view:{yaw,pitch},face:{height,leftEyeHeight:height,rightEyeHeight:height}}},
    {atMs:900,easing:'ease-in-out',patch:{view:{yaw:yaw+(upbeat?.22:.13),pitch:pitch-(upbeat?.16:.035)},face:{height:upbeat?Math.min(112,height*1.12):height,leftEyeHeight:wink?3:height,rightEyeHeight:height}}},
    {atMs:1750,easing:'ease-in-out',patch:{view:{yaw:yaw-.08,pitch:pitch+.045},face:{height,leftEyeHeight:height,rightEyeHeight:height}}},
    {atMs:2450,patch:{face:{height}}},
    {atMs:2570,patch:{face:{height:3,leftEyeHeight:3,rightEyeHeight:3}}},
    {atMs:2730,patch:{face:{height,leftEyeHeight:height,rightEyeHeight:height}}},
    {atMs:3600,easing:'ease-in-out',patch:{view:{yaw,pitch},face:{height}}}
  ]};
}
async function createRecord(key,useSaved=true){
  const [api,definitions]=await Promise.all([sdk(),definitionsPromise]);
  const definition=api.parseAvatarDefinition((useSaved&&readSaved(key))||definitions[key]);
  const host=document.createElement('div');
  host.style.cssText='position:fixed;left:-2048px;top:0;width:256px;height:256px;pointer-events:none';
  host.setAttribute('aria-hidden','true');document.body.append(host);
  const avatar=api.createAvatar(host,{definition,theme:'light',interactive:false});await avatar.ready;
  const record={avatar,host,definition,busy:false,last:-Infinity,emote:null,frames:0,errors:0};
  await avatar.play(clipFor(definition,'normal'));avatar.pause();
  return record;
}
export async function renderOfficialAvatar(key,canvas,time,emote='normal',reduced=false){
  if(!readSaved(key)){
    const mode=['happy','sing','surprised'].includes(emote)?'happy':emote==='wink'?'wink':'normal';
    const id=key+'-'+mode;
    if(!atlasImages.has(id))atlasImages.set(id,(async()=>{const image=new Image();image.src=new URL('./avatar-atlas-v2/'+id+'.png?v=20260911-motion',import.meta.url).href;await image.decode();return image;})());
    const atlas=await atlasImages.get(id),frames=64,columns=8,size=atlas.width/columns;
    const phase=reduced?0:(time%4)/4*frames,index=Math.floor(phase),next=(index+1)%frames;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,256);
    ctx.globalAlpha=reduced?1:1-(phase-index);
    ctx.drawImage(atlas,index%columns*size,Math.floor(index/columns)*size,size,size,0,0,256,256);
    if(!reduced){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=phase-index;ctx.drawImage(atlas,next%columns*size,Math.floor(next/columns)*size,size,size,0,0,256,256);}
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    atlasMetrics.set(key,{key,preset:key==='agent'?'fox':key,frames:(atlasMetrics.get(key)?.frames||0)+1,errors:0,mode:'official-atlas'});
    return true;
  }
  return renderLive(key,canvas,time,emote,reduced);
}
async function renderLive(key,canvas,time,emote,reduced){
  if(!records.has(key))records.set(key,createRecord(key));
  const r=await records.get(key);
  if(r.busy||time-r.last<1/24||(reduced&&r.frames>0))return false;
  r.busy=true;r.last=time;
  try{
    const api=await sdk();
    const resolved=api.resolveAvatarAnimationFrame(r.definition,clipFor(r.definition,emote),reduced?0:(time*1000)%4000);
    r.avatar.setDefinition({...r.definition,scene:resolved.scene});
    // The public controller commits the resolved scene before capture on the next frame.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const blob=await r.avatar.capture({format:'svg',size:256,background:'transparent',frame:'square'});
    const url=URL.createObjectURL(blob);
    try{const img=new Image();img.src=url;await img.decode();const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,256);ctx.drawImage(img,0,0,256,256);r.frames++;}
    finally{URL.revokeObjectURL(url);}
    return true;
  }catch(error){r.errors++;throw error;}finally{r.busy=false;}
}
export async function diagnostics(){return [...atlasMetrics.values(),...await Promise.all([...records.entries()].map(async([key,p])=>{const r=await p;return{key,frames:r.frames,errors:r.errors,preset:r.definition.scene.entity.preset,mode:'live'};}))];}
// Authoring-time export. Each tile is a public SDK capture of the same saved definition.
export async function exportAvatarAtlas(key,emote){
  if(!records.has(key))records.set(key,createRecord(key,false));
  const r=await records.get(key),api=await sdk();r.avatar.stop();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;const ctx=canvas.getContext('2d');
  for(let index=0;index<64;index++){
    const resolved=api.resolveAvatarAnimationFrame(r.definition,clipFor(r.definition,emote),index*4000/64);
    r.avatar.setDefinition({...r.definition,scene:resolved.scene});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const blob=await r.avatar.capture({format:'svg',size:256,background:'transparent',frame:'square'});
    const url=URL.createObjectURL(blob);
    try{const image=new Image();image.src=url;await image.decode();ctx.drawImage(image,index%8*256,Math.floor(index/8)*256,256,256);}finally{URL.revokeObjectURL(url);}
  }
  return canvas.toDataURL('image/png');
}
window.addEventListener('storage',event=>{
  if(!event.key?.startsWith(storageKey))return;
  const key=event.key.slice(storageKey.length);
  const old=records.get(key);records.delete(key);old?.then(r=>{r.avatar.destroy();r.host.remove();});
});
