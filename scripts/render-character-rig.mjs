import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createCastRenderer} from '../js/avatar/band-character-renderer.js';
import {rehearsalSample} from '../js/avatar/band-character-rig.js';
const require=createRequire(import.meta.url),{createCanvas,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.resolve(process.env.LU_RIG_OUT||path.join(root,'output/character-rig-rebuild-20261030/render'));
fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/band-cast-v3/one-piece/manifest.json'))),images=new Map();
const layers=manifest.actors.flatMap(a=>[...['body','head','instrument','mouth'].map(k=>a.layers[k]),...Object.values(a.rigParts)]);
await Promise.all([...new Set(layers.map(l=>l.image))].map(async source=>images.set(source,await loadImage(path.join(root,source)))));
const cast=createCastRenderer(manifest,images,createCanvas),sheet=createCanvas(1600,900),sc=sheet.getContext('2d');sc.fillStyle='#f4f2eb';sc.fillRect(0,0,1600,900);
const evidence={fixture:'8s action rehearsal; does not represent source-song transcription',actors:[]};
for(const [index,actor] of manifest.actors.entries()){
 const member=cast.create(actor.id),record={id:actor.id,frames:[],maxContactError:0,maxEdgePixels:0,visualReview:'pending'};
 for(const [label,time] of [['rest',0],['lift',.41],['attack',.5],['rebound',.60],['sustain',1.5]]){
  member.update(time,rehearsalSample(actor.id,time),false);fs.writeFileSync(path.join(out,actor.id+'-'+label+'.png'),member.canvas.toBuffer('image/png'));
  record.frames.push({label,time,arms:member.pose.arms,mouthOpen:member.pose.mouthOpen,bellows:member.pose.bellows,bow:member.pose.bow});
  record.maxContactError=Math.max(record.maxContactError,...member.pose.arms.map(a=>a.contactError));
 }
 member.update(.5,rehearsalSample(actor.id,.5),false);
 const x=(index%5)*320,y=Math.floor(index/5)*450;sc.drawImage(member.canvas,x,y,320,400);sc.fillStyle='#32423a';sc.font='18px sans-serif';sc.fillText(actor.id,x+20,y+426);
 if(process.argv.includes('--clips')){
  const video=path.join(out,actor.id+'-action.mp4');
  const proc=spawn('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-f','rawvideo','-pixel_format','rgba','-video_size','512x640','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',video]);
  let log='';proc.stderr.on('data',chunk=>{log+=chunk;});const done=once(proc,'close');
  for(let i=0;i<240;i++){const time=i/30;member.update(time,rehearsalSample(actor.id,time),false);
   record.maxContactError=Math.max(record.maxContactError,...member.pose.arms.map(a=>a.contactError));const alpha=member.canvas.getContext('2d').getImageData(0,0,512,640).data;let edges=0;
   for(let x=0;x<512;x++)edges+=(alpha[x*4+3]>20)+(alpha[((639*512+x)*4)+3]>20);for(let y=0;y<640;y++)edges+=(alpha[(y*512*4)+3]>20)+(alpha[((y*512+511)*4)+3]>20);record.maxEdgePixels=Math.max(record.maxEdgePixels,edges);
   const frame=createCanvas(512,640),ctx=frame.getContext('2d');ctx.fillStyle='#f4f2eb';ctx.fillRect(0,0,512,640);ctx.drawImage(member.canvas,0,0);const data=ctx.getImageData(0,0,512,640).data;if(!proc.stdin.write(Buffer.from(data.buffer,data.byteOffset,data.byteLength)))await once(proc.stdin,'drain');}
  proc.stdin.end();const [code]=await done;if(code!==0)throw Error(actor.id+': '+log);record.video=video;
  const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',video],{encoding:'utf8'});if(probe.status!==0)throw Error(probe.stderr);const metadata=JSON.parse(probe.stdout),stream=metadata.streams.find(s=>s.codec_type==='video');record.videoMetadata={duration:Number(metadata.format.duration),frames:Number(stream.nb_frames),fps:stream.avg_frame_rate,width:stream.width,height:stream.height,audio:metadata.streams.some(s=>s.codec_type==='audio')};
  if(record.videoMetadata.duration!==8||record.videoMetadata.frames!==240)throw Error(actor.id+' incomplete clip');
  const decode=spawnSync('ffmpeg',['-v','error','-i',video,'-f','null','-'],{encoding:'utf8'});if(decode.status!==0)throw Error(decode.stderr);record.decoded=true;
  if(record.maxContactError>.001||record.maxEdgePixels>0)throw Error(actor.id+' failed geometry/raster checks: '+JSON.stringify({contact:record.maxContactError,edges:record.maxEdgePixels}));
 }
 evidence.actors.push(record);console.log(actor.id,'contact error',record.maxContactError.toFixed(3));
}
fs.writeFileSync(path.join(out,'contact-sheet.png'),sheet.toBuffer('image/png'));
fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
