import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {spriteActionFrame,drawSpriteAction} from '../js/avatar/sprite-actions.js';
import {petFrameAt} from '../js/audio/band-stage-layout.js';

const require=createRequire(import.meta.url),{createCanvas,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'output/sprite-animation-20261030');fs.mkdirSync(out,{recursive:true});
const id=process.argv[2]||'zoro',dir=path.join(root,'assets/band-pet-actions/one-piece',id),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const original=await loadImage(path.join(root,`assets/band-pets/one-piece/${id}.webp`)),expanded=await loadImage(path.join(dir,manifest.asset));
const paneWidth=Math.max(640,manifest.frameWidth*2),canvas=createCanvas(paneWidth*2,800),ctx=canvas.getContext('2d'),actor=createCanvas(paneWidth,640),a=actor.getContext('2d');
const video=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-vcodec','png','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,`${id}-comparison.mp4`)],{stdio:['pipe','inherit','inherit']});
const done=once(video,'close');
const frameUse={play:new Set(),accent:new Set(),rest:new Set()};
for(let index=0;index<300;index++){
 const time=index/30,action=time<4?'play':time<8?'accent':'rest',local=time%4;
 const next=spriteActionFrame(manifest,local,{action}),old=petFrameAt(local,120,action==='rest'?0:1,{attack:action==='accent'&&local%.5<.09?.8:0});frameUse[action].add(next);
 ctx.fillStyle='#edf0e6';ctx.fillRect(0,0,canvas.width,800);ctx.fillStyle='#253e33';ctx.font='30px sans-serif';ctx.textAlign='center';ctx.fillText('Original · 4 cels',paneWidth/2,52);ctx.fillText('Whole-character cels · 16 new poses',paneWidth*1.5,52);
 ctx.drawImage(original,old*256,0,256,320,(paneWidth-512)/2,85,512,640);
 drawSpriteAction(a,expanded,manifest,next);ctx.drawImage(actor,paneWidth,85);
 ctx.font='24px sans-serif';ctx.fillStyle='#526f59';ctx.fillText(action==='play'?'Playing':action==='accent'?'Accent':'Rest',paneWidth,770);
 if([0,120,240].includes(index))fs.writeFileSync(path.join(out,`${id}-${action}-comparison.png`),canvas.toBuffer('image/png'));
 if(!video.stdin.write(canvas.toBuffer('image/png')))await once(video.stdin,'drain');
}
video.stdin.end();const [code]=await done;if(code!==0)throw Error('ffmpeg failed '+code);
fs.writeFileSync(path.join(out,`${id}-video-evidence.json`),JSON.stringify({id,seconds:10,fps:30,frames:300,uniqueNewCels:manifest.frames.length,clipFrames:Object.fromEntries(Object.entries(frameUse).map(([key,values])=>[key,[...values]])),renderMode:'intact-sprite-sequence',audio:false},null,2));
console.log(path.join(out,`${id}-comparison.mp4`));
