import { validateBandScore } from './band-timeline.js';
import {parseBandLrc,buildBandCues,computeVocalLineSpans} from './band-cues.js';
export const BAND_TRACKS=Object.freeze([
 ['anime_op_we_are','We Are!','one-piece'],['anime_op_over_the_top','OVER THE TOP','one-piece'],['anime_op_overtaken','Overtaken','one-piece'],['anime_op_one_day','One day','one-piece'],
 ['anime_db_chala','CHA-LA HEAD-CHA-LA','dragon-ball'],['anime_db_makafushigi','Makafushigi Adventure!','dragon-ball'],['anime_db_dandan','DAN DAN 心魅かれてく','dragon-ball'],
 ['anime_nr_blue_bird','Blue Bird','naruto'],['anime_nr_silhouette','Silhouette','naruto'],['anime_nr_sign','Sign','naruto']
].map(([id,title,theme])=>Object.freeze({id,title,theme})));
export const GENERAL_BAND_TRACKS=Object.freeze([
 ['track_0','《游京》- 星火社','general','./audio/youjing.mp3'],
 ['track_1','《秋意浓》- 张学友','general','./audio/qiuyinong.mp3'],
 ['track_2','《烂泥》- 草东没有派对','general','./audio/lanni.mp3'],
 ['track_3','《鬼》- 草东没有派对','general','./audio/gui.mp3'],
 ['track_4','《偏爱》- 张芸京','general','./audio/pianai.mp3'],
 ['track_5','《海鸥》- 逃跑计划','general','./audio/haiou.mp3'],
 ['preset_1','CYBER CRYSTAL FLOW','general',''],
 ['preset_2','NEO SYNTH WAVE 80S','general',''],
 ['preset_3','DEEP SUB BASS 808','general','']
].map(([id,title,theme,src])=>Object.freeze({id,title,theme,src})));
export const ALL_BAND_TRACKS=Object.freeze([...BAND_TRACKS,...GENERAL_BAND_TRACKS]);

export async function loadBandAnalysis(id,{signal}={}){
 if(!ALL_BAND_TRACKS.some(t=>t.id===id))return null;
 const response=await fetch(`./output/lu-band/${id}/score.json`,{signal}).catch(()=>null);if(!response?.ok)return null;
 const score=await response.json(),checked=validateBandScore(score);
 if(!checked.ok||score.trackId!==id||score.source!=='analysis'||!/^[a-f0-9]{64}$/.test(score.sourceSha256))throw new Error('声部谱面数据未通过校验');
 let lyrics=[],translatedLyrics=[];
 try{
  const [lrc,zhLrc]=await Promise.all([
   fetch(`./output/audio/${id}.lrc`,{signal}).catch(()=>null),
   fetch(`./output/audio/${id}.zh.lrc`,{signal}).catch(()=>null)
  ]);
  if(lrc?.ok)lyrics=parseBandLrc(await lrc.text());
  if(zhLrc?.ok){
   const parsedZh=parseBandLrc(await zhLrc.text());
   if(parsedZh.length===lyrics.length&&parsedZh.every((l,i)=>Math.abs(l.time-lyrics[i].time)<.01))translatedLyrics=parsedZh;
  }
 }catch(error){if(error.name==='AbortError')throw error;}
 score.lyrics=lyrics;score.translatedLyrics=translatedLyrics;score.vocalLineSpans=computeVocalLineSpans(score,lyrics);
 score.stageCues=buildBandCues(score,lyrics);
 return score;
}

export function synthesizeBandScoreForTrack(track,{lyrics=[],translatedLyrics=[],theme='one-piece'}={}){
 if(!track)return null;
 const trackId=track.type||'custom',title=track.title||'自定义曲目';
 const buffer=track.buffer||null;
 const duration=Math.max(12,Number((buffer?.duration||(track.isPreset?24:180)).toFixed(4)));
 const bpm=trackId==='preset_3'?100:trackId==='preset_2'?118:124;
 const step=.1,steps=Math.floor(duration/step);
 const vocalsEnv=[],drumsEnv=[],bassEnv=[],otherEnv=[];
 const vocalsOnsets=[],drumsOnsets=[],bassOnsets=[],otherOnsets=[];
 const vocalsEvents=[],drumsEvents=[],bassEvents=[],otherEvents=[];
 const ch0=buffer?.numberOfChannels>0?buffer.getChannelData(0):null;
 const ch1=buffer?.numberOfChannels>1?buffer.getChannelData(1):ch0;
 const sr=buffer?.sampleRate||44100;
 for(let i=0;i<=steps;i++){
  const t=Number(Math.min(duration,i*step).toFixed(4));
  if(t>=duration){
   vocalsEnv.push({time:t,value:0});drumsEnv.push({time:t,value:0});bassEnv.push({time:t,value:0});otherEnv.push({time:t,value:0});
   continue;
  }
  let vVal=.38,dVal=.42,bVal=.4,oVal=.45;
  if(ch0){
   const s0=Math.min(ch0.length-1,Math.floor(t*sr)),len=Math.min(1024,ch0.length-s0);
   let midSq=0,sideSq=0,diffSq=0,lowAcc=0,lowSq=0;
   for(let k=0;k<len;k++){
    const l=ch0[s0+k],r=ch1[s0+k],m=.5*(l+r),s=.5*(l-r);
    lowAcc=lowAcc*.92+m*.08;
    const prev=k>0?.5*(ch0[s0+k-1]+ch1[s0+k-1]):m;
    midSq+=m*m;sideSq+=s*s;lowSq+=lowAcc*lowAcc;diffSq+=(m-prev)*(m-prev);
   }
   const n=Math.max(1,len);
   bVal=Math.min(1,Math.pow(Math.sqrt(lowSq/n)*4.8,.8));
   dVal=Math.min(1,Math.pow(Math.sqrt(diffSq/n)*9.5,.78));
   vVal=Math.min(1,Math.pow(Math.max(0,Math.sqrt(midSq/n)-Math.sqrt(lowSq/n)*.55)*3.6,.8));
   oVal=Math.min(1,Math.pow((Math.sqrt(sideSq/n)*2.4+Math.sqrt(midSq/n))*2.1,.8));
  }else{
   const beatPos=t*(bpm/60),phase=beatPos%1;
   dVal=phase<.22?.88:.24;
   bVal=.45+.38*Math.abs(Math.sin(beatPos*Math.PI*.5));
   vVal=.42+.4*Math.max(0,Math.sin(t*.85));
   oVal=.48+.34*Math.abs(Math.cos(beatPos*Math.PI*.25));
  }
  vocalsEnv.push({time:t,value:Number(vVal.toFixed(4))});
  drumsEnv.push({time:t,value:Number(dVal.toFixed(4))});
  bassEnv.push({time:t,value:Number(bVal.toFixed(4))});
  otherEnv.push({time:t,value:Number(oVal.toFixed(4))});
 }
 const beatSec=60/bpm;
 for(let b=0,t=0;t<duration-.2;b++,t+=beatSec*.5){
  const start=Number(t.toFixed(4)),end=Number(Math.min(duration-.01,t+Math.min(.22,beatSec*.38)).toFixed(4));
  if(end<=start)continue;
  const idx=Math.min(drumsEnv.length-1,Math.floor(t/step));
  const dE=drumsEnv[idx]?.value||.5,bE=bassEnv[idx]?.value||.5,oE=otherEnv[idx]?.value||.5;
  if(b%2===0||dE>.52){
   const midi=b%4===0?36:(b%4===2?38:42),vel=Number(Math.max(.35,Math.min(.98,dE)).toFixed(4));
   drumsEvents.push({start,end,midi,velocity:vel,confidence:.85});
   drumsOnsets.push({time:start,strength:vel});
  }
  if(b%2===0){
   const bassScale=[36,38,41,43,45,48],midi=bassScale[(Math.floor(b/2))%bassScale.length];
   const bEnd=Number(Math.min(duration-.01,t+beatSec*.88).toFixed(4));
   if(bEnd>start){
    const vel=Number(Math.max(.35,Math.min(.96,bE)).toFixed(4));
    bassEvents.push({start,end:bEnd,midi,velocity:vel,confidence:.86});
    bassOnsets.push({time:start,strength:vel});
   }
  }
  const otherScale=[55,60,64,67,72,76,79,84],oMidi=otherScale[b%otherScale.length];
  const oEnd=Number(Math.min(duration-.01,t+beatSec*(b%3===0?.92:.44)).toFixed(4));
  if(oEnd>start){
   const vel=Number(Math.max(.32,Math.min(.95,oE)).toFixed(4));
   otherEvents.push({start,end:oEnd,midi:oMidi,velocity:vel,confidence:.84});
   otherOnsets.push({time:start,strength:vel});
  }
 }
 const usableLyrics=(lyrics||[]).filter(l=>Number.isFinite(l?.time)&&l.time<duration-.2);
 if(usableLyrics.length){
  const vScale=[60,62,64,67,69,72,74,76];
  usableLyrics.forEach((line,idx)=>{
   const lineStart=Math.max(0,Number(line.time)||0);
   const lineStop=Math.min(duration-.02,Number(usableLyrics[idx+1]?.time??duration));
   const span=Math.max(.4,Math.min(4.2,lineStop-lineStart-.12));
   const notesCount=Math.max(2,Math.min(8,Math.ceil((line.text||'').length/2)));
   const noteDur=span/notesCount;
   for(let k=0;k<notesCount;k++){
    const s=Number((lineStart+k*noteDur).toFixed(4)),e=Number(Math.min(duration-.01,s+noteDur*.86).toFixed(4));
    if(e<=s)continue;
    const midi=vScale[(idx*3+k)%vScale.length];
    vocalsEvents.push({start:s,end:e,midi,velocity:.86,confidence:.9});
    vocalsOnsets.push({time:s,strength:.86});
   }
  });
 }else{
  for(let b=0,t=.5;t<duration-.4;b++,t+=beatSec*2){
   const s=Number(t.toFixed(4)),e=Number(Math.min(duration-.01,t+beatSec*1.4).toFixed(4));
   if(e<=s)continue;
   vocalsEvents.push({start:s,end:e,midi:60+(b%5)*2,velocity:.82,confidence:.88});
   vocalsOnsets.push({time:s,strength:.82});
  }
 }
 const sections=[];
 for(let s=0;s<duration;s+=8){
  const e=Number(Math.min(duration,s+8).toFixed(4));
  if(e<=s)break;
  const idx=Math.floor(s/8);
  const lead=['vocals','other','vocals','bass'][idx%4];
  sections.push({start:Number(s.toFixed(4)),end:e,lead,active:['vocals','drums','bass','other'],label:'全曲库自适应编配'});
 }
 const score={
  version:1,source:'analysis',synthesized:true,title,trackId,theme,instrumental:false,duration,
  sourceSha256:'0'.repeat(64),originalAudio:track.src||'',bpmEstimate:bpm,
  stems:[
   {id:'vocals',label:'人声／主旋律',audio:track.src||'',events:vocalsEvents,envelope:vocalsEnv,onsets:vocalsOnsets},
   {id:'bass',label:'低音',audio:track.src||'',events:bassEvents,envelope:bassEnv,onsets:bassOnsets},
   {id:'drums',label:'鼓／打击',audio:track.src||'',events:drumsEvents,envelope:drumsEnv,onsets:drumsOnsets},
   {id:'other',label:'共享伴奏',audio:track.src||'',events:otherEvents,envelope:otherEnv,onsets:otherOnsets}
  ],
  sections,lyrics:usableLyrics,translatedLyrics:translatedLyrics||[]
 };
 score.vocalLineSpans=computeVocalLineSpans(score,usableLyrics);
 score.stageCues=buildBandCues(score,usableLyrics);
 return validateBandScore(score).ok?score:null;
}

export async function verifyBandSource(score,src,signal){
 if(score?.synthesized)return true;
 if(!src)return false;const response=await fetch(src,{signal});if(!response.ok)return false;
 const data=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',data);
 const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 return hash===score.sourceSha256;
}
