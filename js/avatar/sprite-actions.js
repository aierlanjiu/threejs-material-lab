// Intact cels only. Song time selects pixels; bodies and limbs are never warped.
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
