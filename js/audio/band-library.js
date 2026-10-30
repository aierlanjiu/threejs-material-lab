import { validateBandScore } from './band-timeline.js';
import {parseBandLrc,buildBandCues,computeVocalLineSpans} from './band-cues.js';
import {validateSongBindings,applyStoredSongReview} from './band-song-parts.js';
import {validateFamilyBindings} from './band-family-bindings.js';
import {BOLERO_TRACK,validateArrangement} from './band-arrangement.js?v=20261029-shell-live';
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
export const ALL_BAND_TRACKS=Object.freeze([...BAND_TRACKS,...GENERAL_BAND_TRACKS,BOLERO_TRACK]);

export async function loadBandAnalysis(id,{signal,preferHybrid=true,preferShell=false}={}){
 if(!ALL_BAND_TRACKS.some(t=>t.id===id))return null;
 if(preferShell&&id==='anime_op_one_day'){
  const response=await fetch('./assets/band-shell-performance/score.json',{signal});if(!response.ok)throw Error('珍珠贝壳独立声部尚未就绪');
  const score=await response.json(),checked=validateArrangement(score),timeline=validateBandScore(score);
  if(!checked.ok||!timeline.ok||score.trackId!==id)throw Error([...checked.errors,...timeline.errors].join('；'));
  return attachLyrics(score,id,signal);
 }
 if(id===BOLERO_TRACK.id){
  const response=await fetch(BOLERO_TRACK.score,{signal});if(!response.ok)throw new Error('改编声轨尚未就绪');
  const score=await response.json(),checked=validateArrangement(score),timeline=validateBandScore(score);
  if(!checked.ok||!timeline.ok||score.trackId!==id)throw new Error([...checked.errors,...timeline.errors].join('；'));
  score.lyrics=[];score.translatedLyrics=[];score.stageCues=buildBandCues(score,[]);return score;
 }
 if(preferHybrid&&!id.startsWith('preset_')){
  const response=await fetch(`./assets/band-audio/scores/${id}.json`,{signal});
  if(response.ok){const score=await response.json(),checked=validateArrangement(score),timeline=validateBandScore(score);
   if(!checked.ok||!timeline.ok||score.trackId!==id)throw new Error([...checked.errors,...timeline.errors].join('；'));
   return attachLyrics(score,id,signal);
  }
  if(response.status!==404)throw new Error('本曲混合编配无法读取');
 }
 let directory=`./output/lu-band-song-parts/${id}`;
 let response=await fetch(`${directory}/score.json`,{signal}).catch(error=>{if(error.name==='AbortError')throw error;return null;});
 if(!response?.ok){
  if(response&&response.status!==404)throw new Error('逐曲声部文件无法读取');
  directory=`./output/lu-band/${id}`;
  response=await fetch(`${directory}/score.json`,{signal}).catch(error=>{if(error.name==='AbortError')throw error;return null;});
 }
 if(!response?.ok)return null;
 const scoreText=await response.text();let score=JSON.parse(scoreText);const checked=validateBandScore(score);
 if(!checked.ok||score.trackId!==id||score.source!=='analysis'||score.synthesized||!/^[a-f0-9]{64}$/.test(score.sourceSha256)||/^0+$/.test(score.sourceSha256))throw new Error('声部谱面数据未通过校验');
 if(directory.includes('lu-band-song-parts')&&!validateSongBindings(score).ok)throw new Error('逐曲声部绑定未通过校验');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scoreText));score.analysisSha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const familyResponse=await fetch(`${directory}/family-bindings.json`,{signal}).catch(error=>{if(error.name==='AbortError')throw error;return null;});
 if(familyResponse?.ok){const family=await familyResponse.json();const checked=validateFamilyBindings(score,family);if(!checked.ok)throw new Error(checked.errors.join('；'));score.familyBindings=family;
  const measured=score.sections;score.sections=family.sections.map(section=>{
   const mid=(section.start+section.end)/2,source=measured.find(s=>s.start<=mid&&mid<s.end)||measured[0]||{};
   const voice=score.stems.find(s=>s.id==='vocals'),points=voice?.envelope.filter(p=>section.start<=p.time&&p.time<section.end)||[];
   const vocalShare=points.filter(p=>p.value>.3).length/Math.max(1,points.length);
   return {...source,start:section.start,end:section.end,label:section.label==='间奏'&&vocalShare>.3?'过渡（有人声）':section.label,annotationSource:'AGY candidate, signal-checked'};
  });
 }
 try{score=applyStoredSongReview(score,globalThis.localStorage);}catch{}
 if(score.songBindings?.parts.some(p=>p.status==='verified')||score.familyBindings){
  const reviewedIds=new Set([...score.songBindings.parts.filter(p=>p.status==='verified').map(p=>p.stemId),...(score.familyBindings?.parts||[]).map(p=>p.stemId)]);
  await Promise.all(score.stems.filter(s=>reviewedIds.has(s.id)).map(async stem=>{
   const response=await fetch(stem.audio,{signal:signal||AbortSignal.timeout(20000)});if(!response.ok)throw new Error('已核验声部音轨无法读取');
   const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
   const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==stem.audioSha256)throw new Error('声部音轨发生变化，需要重新校验');
  }));
 }
 score.analysisDirectory=directory;
 return attachLyrics(score,id,signal);
}
async function attachLyrics(score,id,signal){
 let lyrics=[],translatedLyrics=[];
 try{
  const [lrc,zhLrc]=await Promise.all([
   fetch(`./output/audio/${id}.lrc`,{signal}).catch(()=>null),
   id.startsWith('anime_')&&id!=='anime_op_overtaken'?fetch(`./output/audio/${id}.zh.lrc`,{signal}).catch(()=>null):Promise.resolve(null)
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

// Actual songs require attributable audio and events. Use the explicit demo for examples.
export function synthesizeBandScoreForTrack(){return null;}

export async function verifyBandSource(score,src,signal){
 if(score?.synthesized||!/^[a-f0-9]{64}$/.test(score?.sourceSha256||'')||/^0+$/.test(score.sourceSha256))return false;
 if(!src)return false;const response=await fetch(src,{signal:signal||AbortSignal.timeout(20000)});if(!response.ok)return false;
 const data=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',data);
 const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 return hash===score.sourceSha256;
}
