// Intact cels only. Song time selects pixels; bodies and limbs are never warped.
export async function loadBandActionPets(fetcher=globalThis.fetch){
 const url=new URL('../../assets/band-pet-actions/manifest.json',import.meta.url);
 const response=await fetcher(url);if(!response.ok)throw Error(`Character actions HTTP ${response.status}`);
 const data=await response.json(),result=new Map();
 for(const actor of data.actors){
  if(result.has(actor.id)||!actor.clips?.rest?.length||!actor.clips?.play?.length||!actor.clips?.accent?.length)throw Error('Invalid character action manifest');
  for(const clip of Object.values(actor.clips))if(clip.some(frame=>!Number.isInteger(frame)||frame<0||frame>=actor.frameCount))throw Error('Invalid character action frame');
  result.set(actor.id,{...actor,asset:new URL(actor.asset,url).href});
 }
 return result;
}

export function spritePerformanceFrame(manifest,time,bpm,activity,{reduced=false,speed=1,index=0}={}){
 if(reduced||speed<=0||activity<.12)return {action:'rest',frame:manifest.clips.rest[0]};
 const tempo=(Number.isFinite(bpm)&&bpm>0?bpm:120)/120;
 const safeTime=Math.max(0,Number.isFinite(time)?time:0),bar=2/tempo,barAge=safeTime%bar;
 const accentDuration=Math.min(bar*.65,manifest.clips.accent.length/(manifest.fps*tempo*speed));
 const action=barAge<accentDuration?'accent':'play',local=action==='accent'?barAge:safeTime+index*.07;
 return {action,frame:spriteActionFrame(manifest,local,{action,speed:tempo*speed})};
}

export function spriteActionFrame(manifest,time,{action='play',reduced=false,speed=1}={}){
 const frames=manifest.clips[reduced||speed<=0?'rest':action]||manifest.clips.rest;
 const step=Math.floor(Math.max(0,Number.isFinite(time)?time:0)*manifest.fps*Math.max(0,speed));
 return frames[step%frames.length];
}

export function drawSpriteAction(ctx,image,manifest,frame){
 if(!Number.isInteger(frame)||frame<0||frame>=manifest.frameCount)throw Error('Sprite frame out of bounds');
 ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
 const scale=Math.min(ctx.canvas.width/manifest.frameWidth,ctx.canvas.height/manifest.frameHeight);
 const w=manifest.frameWidth*scale,h=manifest.frameHeight*scale;
 ctx.drawImage(image,frame*manifest.frameWidth,0,manifest.frameWidth,manifest.frameHeight,(ctx.canvas.width-w)/2,(ctx.canvas.height-h)/2,w,h);
}
