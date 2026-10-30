// One renderer for live actors, rehearsal and deterministic clip exports.
import {RIG_W as W,RIG_H as H,sampleCharacterRig} from './band-character-rig.js';
const baseUrl=new URL('../../',import.meta.url);
const usedLayers=a=>[...['body','head','instrument','mouth','faceFront'].map(k=>a.layers[k]).filter(Boolean),...Object.values(a.rigParts)];
export async function loadLayeredBandCast(){
 const response=await fetch(new URL('assets/band-cast-v3/one-piece/manifest.json',baseUrl));if(!response.ok)throw Error('角色骨骼清单无法读取');
 const manifest=await response.json(),images=new Map();
 await Promise.all([...new Set(manifest.actors.flatMap(a=>usedLayers(a).map(l=>l.image)))].map(async source=>{const image=new Image();image.src=new URL(source,baseUrl).href;await image.decode();images.set(source,image);}));
 return createCastRenderer(manifest,images,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});
}
export function createCastRenderer(manifest,images,makeCanvas){
 const textures=new Map();
 for(const actor of manifest.actors)for(const layer of usedLayers(actor)){
  const [x,y,w,h]=layer.rect,c=makeCanvas(w,h),ctx=c.getContext('2d');ctx.drawImage(images.get(layer.image),x,y,w,h,0,0,w,h);
  ctx.globalCompositeOperation='destination-in';ctx.beginPath();for(const [y,x,length] of layer.maskRuns)ctx.rect(x,y,length,1);ctx.fill();textures.set(layer,c);
 }
 const region=(ctx,layer,b)=>ctx.drawImage(textures.get(layer),b.x,b.y,b.width,b.height);
 function bone(ctx,part,start,end){
  if(part.skinRect){
   const t=textures.get(part),u=part.skinRect,r=part.radius,re=r*part.taper,length=Math.hypot(end[0]-start[0],end[1]-start[1]);
   ctx.save();ctx.translate(...start);ctx.rotate(Math.atan2(end[1]-start[1],end[0]-start[0]));ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(length,-re);ctx.arc(length,0,re,-Math.PI/2,Math.PI/2);ctx.lineTo(0,r);ctx.arc(0,0,r,Math.PI/2,Math.PI*1.5);ctx.closePath();ctx.clip();
   ctx.fillStyle=part.baseColor;ctx.fillRect(-r,-r,length+2*r,2*r);
   // UV skinning uses the painted material, excluding exploded-part end faces.
   ctx.save();ctx.translate(-r,r);ctx.rotate(-Math.PI/2);ctx.drawImage(t,u[0]*t.width,u[1]*t.height,u[2]*t.width,u[3]*t.height,0,0,2*r,length+2*r);ctx.restore();
   const shade=ctx.createLinearGradient(0,-r,0,r);shade.addColorStop(0,'rgba(255,255,240,.18)');shade.addColorStop(.45,'rgba(255,255,255,0)');shade.addColorStop(1,'rgba(62,39,19,.22)');ctx.fillStyle=shade;ctx.fillRect(-r,-r,length+2*r,2*r);ctx.restore();return;
  }
  const r=part.rect,a=[part.a[0]*r[2],part.a[1]*r[3]],b=[part.b[0]*r[2],part.b[1]*r[3]],dx=b[0]-a[0],dy=b[1]-a[1];
  const scale=Math.hypot(end[0]-start[0],end[1]-start[1])/Math.hypot(dx,dy),angle=Math.atan2(end[1]-start[1],end[0]-start[0])-Math.atan2(dy,dx);
  ctx.save();ctx.translate(...start);ctx.rotate(angle);ctx.scale(scale,scale);ctx.drawImage(textures.get(part),-a[0],-a[1]);ctx.restore();
 }
 function furBone(ctx,start,end,texture){
  const angle=Math.atan2(end[1]-start[1],end[0]-start[0]),length=Math.hypot(end[0]-start[0],end[1]-start[1]);
  ctx.save();ctx.translate(...start);ctx.rotate(angle);const g=ctx.createLinearGradient(0,-12,0,12);g.addColorStop(0,'#f0c083');g.addColorStop(.45,'#dfac6c');g.addColorStop(1,'#b9824b');ctx.strokeStyle=g;ctx.lineWidth=24;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-2,0);ctx.lineTo(length+2,0);ctx.stroke();
  ctx.beginPath();ctx.roundRect(-8,-12,length+16,24,12);ctx.clip();ctx.globalAlpha=.28;ctx.drawImage(texture,texture.width*.34,texture.height*.73,texture.width*.18,texture.height*.12,-8,-12,length+16,24);ctx.restore();
 }
 function hand(ctx,part,arm){ctx.save();ctx.translate(...arm.wrist);ctx.rotate(arm.handAngle);ctx.scale(arm.handScale,arm.handScale);
  const dx=(part.contact[0]-part.a[0])*part.rect[2],dy=(part.contact[1]-part.a[1])*part.rect[3],length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length,nx=-uy,ny=ux,far=3000,overlap=8;
  if(part.toolGeometry==='drumstick'){
   const gx=(part.grip[0]-part.a[0])*part.rect[2],gy=(part.grip[1]-part.a[1])*part.rect[3];ctx.lineCap='round';ctx.lineWidth=3/arm.handScale;ctx.strokeStyle='#b98c51';ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(dx,dy);ctx.stroke();ctx.lineWidth=1/arm.handScale;ctx.strokeStyle='#efcc86';ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(dx,dy);ctx.stroke();
  }
  ctx.beginPath();ctx.moveTo(nx*far-ux*overlap,ny*far-uy*overlap);ctx.lineTo(-nx*far-ux*overlap,-ny*far-uy*overlap);ctx.lineTo(-nx*far+ux*far,-ny*far+uy*far);ctx.lineTo(nx*far+ux*far,ny*far+uy*far);ctx.closePath();ctx.clip();
  if(part.palmLimit){const d=part.palmLimit;ctx.beginPath();ctx.moveTo(nx*far-ux*overlap,ny*far-uy*overlap);ctx.lineTo(-nx*far-ux*overlap,-ny*far-uy*overlap);ctx.lineTo(-nx*far+ux*d,-ny*far+uy*d);ctx.lineTo(nx*far+ux*d,ny*far+uy*d);ctx.closePath();ctx.clip();}
  ctx.drawImage(textures.get(part),-part.a[0]*part.rect[2],-part.a[1]*part.rect[3]);ctx.restore();}
 function draw(actor,canvas,time,sample,reduced,showJoints=false){
  const ctx=canvas.getContext('2d'),pose=sampleCharacterRig(actor,time,sample,reduced),{body,head,prop,fit,center,mouth}=pose.layout;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.scale(canvas.width/W,canvas.height/H);ctx.translate(W/2,H/2);ctx.scale(fit,fit);ctx.translate(-W/2,-H/2);
  const headDraw=()=>{ctx.save();ctx.translate(center,body.y);ctx.rotate(pose.headAngle);region(ctx,actor.layers.head,{x:head.x-center,y:head.y-body.y,width:head.width,height:head.height});
   if(actor.id==='luffy'&&pose.mouthOpen>.05){const m=actor.layers.mouth,w=head.width*.15,h=w*m.rect[3]/m.rect[2];ctx.globalAlpha=Math.min(1,pose.mouthOpen*2);region(ctx,m,{x:mouth[0]-center-w/2,y:mouth[1]-body.y-h/2,width:w,height:h});}ctx.restore();};
  if(actor.rig.hairBehind)headDraw();region(ctx,actor.layers.body,body);if(!actor.rig.hairBehind)headDraw();
  for(const arm of pose.arms){const part=actor.rigParts[arm.side+'Upper'];if(part)bone(ctx,part,arm.shoulder,arm.elbow);else furBone(ctx,arm.shoulder,arm.elbow,textures.get(actor.rigParts.leftHand));}
  const foreDraw=()=>{for(const arm of pose.arms){const part=actor.rigParts[arm.side+'Fore'];if(part)bone(ctx,part,arm.elbow,arm.wrist);else furBone(ctx,arm.elbow,arm.wrist,textures.get(actor.rigParts.leftHand));}};
  const foreInFront=['zoro','usopp','nami','robin','ace','shanks'].includes(actor.id);
  if(!foreInFront)foreDraw();
  if(actor.id==='nami'){
   const t=textures.get(actor.layers.instrument),sw=t.width,left=.25,right=.78,spread=pose.bellows;
   ctx.drawImage(t,0,0,sw*left,t.height,prop.x-spread/2,prop.y,prop.width*left,prop.height);
   ctx.drawImage(t,sw*left,0,sw*(right-left),t.height,prop.x+prop.width*left-spread/2,prop.y,prop.width*(right-left)+spread,prop.height);
   ctx.drawImage(t,sw*right,0,sw*(1-right),t.height,prop.x+prop.width*right+spread/2,prop.y,prop.width*(1-right),prop.height);
  }else if(prop.angle){ctx.save();ctx.translate(prop.pivot[0]+prop.translation[0],prop.pivot[1]+prop.translation[1]);ctx.rotate(prop.angle);ctx.translate(-prop.pivot[0],-prop.pivot[1]);region(ctx,actor.layers.instrument,prop);ctx.restore();}
  else region(ctx,actor.layers.instrument,prop);
  if(actor.layers.faceFront){ctx.save();ctx.translate(center,body.y);ctx.rotate(pose.headAngle);region(ctx,actor.layers.faceFront,{x:head.x-center,y:head.y-body.y,width:head.width,height:head.height});ctx.restore();}
  if(foreInFront)foreDraw();
  for(const arm of pose.arms)hand(ctx,actor.rigParts[arm.side+'Hand'],arm);
  if(showJoints){ctx.lineWidth=2;for(const arm of pose.arms){ctx.strokeStyle=ctx.fillStyle=arm.side==='left'?'#087f8c':'#be395c';ctx.beginPath();ctx.moveTo(...arm.shoulder);ctx.lineTo(...arm.elbow);ctx.lineTo(...arm.wrist);ctx.stroke();for(const p of [arm.shoulder,arm.elbow,arm.wrist,arm.contact]){ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.fill();}}}
  ctx.restore();return pose;
 }
 return {manifest,textureCount:textures.size,create(id,{width=512}={}){
  const actor=manifest.actors.find(a=>a.actorId===id||a.id===id);if(!actor)return null;const canvas=makeCanvas(width,width*H/W);
  let pose=draw(actor,canvas,0,{activity:0},false),key='';const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let top=canvas.height,bottom=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>20){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return {canvas,rigVersion:3,layerCount:10,asset:new URL(actor.rigParts.leftHand.image,baseUrl).href,baseline:bottom/canvas.height,alphaHeight:(bottom-top)/canvas.height,
   get pose(){return pose;},get actor(){return actor;},
   update(time,input,reduced=false,extra={}){const sample=typeof input==='number'?{...extra,activity:input}:input||{activity:0};const stamp=!reduced&&(sample.activity>0||extra.showJoints)?Math.round(time*30)/30:0;
    const next=[stamp,sample.activity,sample.userMuted,reduced,extra.showJoints,JSON.stringify(sample.notes||[])].join('|');if(next===key)return false;key=next;pose=draw(actor,canvas,stamp,sample,reduced,extra.showJoints);return true;}};
 }};
}
