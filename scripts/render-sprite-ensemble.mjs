import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {spriteActionFrame,drawSpriteAction} from '../js/avatar/sprite-actions.js';

const require=createRequire(import.meta.url),{createCanvas,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'output/sprite-animation-20261030');
const bundle=JSON.parse(fs.readFileSync(path.join(root,'assets/band-pet-actions/manifest.json'),'utf8'));
const actors=await Promise.all(bundle.actors.map(async pet=>({...pet,image:await loadImage(path.join(root,'assets/band-pet-actions',pet.asset))})));
const canvas=createCanvas(1600,800),ctx=canvas.getContext('2d'),cell=createCanvas(320,320),c=cell.getContext('2d');
const video=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-vcodec','png','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'all-cast-actions.mp4')],{stdio:['pipe','inherit','inherit']});
const done=once(video,'close');
for(let frame=0;frame<300;frame++){
 const time=frame/30,action=time<4?'play':time<8?'accent':'rest';
 ctx.fillStyle='#edf0e6';ctx.fillRect(0,0,1600,800);ctx.textAlign='center';ctx.fillStyle='#294b37';ctx.font='26px "Heiti TC", sans-serif';ctx.fillText('十位角色 · 完整人物逐帧',800,36);
 actors.forEach((pet,index)=>{const x=(index%5)*320,y=50+Math.floor(index/5)*360;drawSpriteAction(c,pet.image,pet,spriteActionFrame(pet,time%4,{action}));ctx.drawImage(cell,x,y);ctx.font='22px "Heiti TC", sans-serif';ctx.fillText(pet.name,x+160,y+333);});
 ctx.font='22px "Heiti TC", sans-serif';ctx.fillText(action==='play'?'普通演奏':action==='accent'?'重拍动作':'休止',800,785);
 if([0,127,248].includes(frame))fs.writeFileSync(path.join(out,`all-cast-${action}.png`),canvas.toBuffer('image/png'));
 if(!video.stdin.write(canvas.toBuffer('image/png')))await once(video.stdin,'drain');
}
video.stdin.end();const [code]=await done;if(code!==0)throw Error('Ensemble video failed');
console.log(path.join(out,'all-cast-actions.mp4'));
