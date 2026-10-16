import {instrumentById,matchesInstrumentFamily} from '../avatar/instrument-manifest.js';
import {modelFamilySummary} from './band-family-bindings.js';
import {validateArrangement} from './band-arrangement.js';
// Song bindings are evidence, not a distribution of notes between visual roles.
export const BAND_REVIEW_KEY='lu_band_song_review_v1';
export const SONG_INSTRUMENTS=Object.freeze({
 vocals:{label:'主唱',technique:'voice',assetRole:'one-piece/luffy'},
 bass:{label:'贝斯',technique:'pluck',assetRole:'one-piece/zoro'},
 drums:{label:'架子鼓',technique:'strike',assetRole:'one-piece/sanji'},
 guitar:{label:'吉他',technique:'pluck',assetRole:'one-piece/usopp'},
 piano:{label:'钢琴',technique:'keys',assetRole:'dragon-ball/gohan'},
 synthesizer:{label:'合成器',technique:'keys',assetRole:'dragon-ball/cell'}
});
export const SONG_ACTORS=Object.freeze({
 'one-piece':{vocals:'luffy',bass:'zoro',drums:'sanji',guitar:'usopp',piano:'law'},
 'dragon-ball':{vocals:'goku',bass:'buu',drums:'krillin',guitar:'vegeta',piano:'gohan'},
 naruto:{vocals:'naruto',bass:'jiraiya',drums:'sakura',guitar:'sasuke',piano:'pain'}
});

export function validateSongBindings(score){
 const errors=[],binding=score?.songBindings;
 if(!binding)return {ok:false,errors:['缺少逐曲声部绑定']};
 if(binding.version!==1)errors.push('不支持的声部绑定版本');
 if(binding.trackId!==score.trackId||binding.sourceSha256!==score.sourceSha256)errors.push('绑定与歌曲音源不一致');
 if(!/^[a-f0-9]{64}$/.test(score.sourceSha256||'')||/^0+$/.test(score.sourceSha256||''))errors.push('无有效音源摘要');
 if(score.synthesized)errors.push('合成示例不能作为实际歌曲声部');
 const ids=new Set(),owners=new Set();
 if(!Array.isArray(binding.parts))errors.push('声部列表无效');
 for(const part of Array.isArray(binding.parts)?binding.parts:[]){
  if(!part?.id||ids.has(part.id))errors.push('声部 ID 缺失或重复');ids.add(part?.id);
  const stem=score.stems?.find(s=>s.id===part?.stemId);
  if(!stem?.audio||!/^[a-f0-9]{64}$/.test(stem.audioSha256||'')||/^0+$/.test(stem.audioSha256||'')||!Array.isArray(stem.events))errors.push(`${part?.id}: 缺少可追溯音轨或事件`);
  if(stem&&part.instrumentId!==stem.instrumentId)errors.push(`${part.id}: 乐器身份与分析音轨不一致`);
  if(!SONG_INSTRUMENTS[part?.instrumentId])errors.push(`${part?.id}: 乐器身份尚未支持或确认`);
  if(!['candidate','verified','rejected','absent'].includes(part?.status))errors.push(`${part?.id}: 校验状态无效`);
  if(['verified','rejected'].includes(part?.status)&&(!part.review?.reviewer||!part.review?.method||!Number.isFinite(Date.parse(part.review?.at))))errors.push(`${part.id}: 缺少听辨校验记录`);
  if(part?.status==='verified'&&!stem?.events?.length)errors.push(`${part.id}: 缺少可核验的演奏事件`);
  if(!part?.actors||Object.keys(SONG_ACTORS).some(t=>!part.actors[t]))errors.push(`${part?.id}: 缺少主题演员绑定`);
  for(const [theme,actor] of Object.entries(part?.actors||{})){
   if(!SONG_ACTORS[theme]||!instrumentById(`${theme}/${actor}`))errors.push(`${part.id}: 演员不在角色清单`);
   const key=`${theme}/${actor}`;
  if(!['absent','rejected'].includes(part.status)){if(owners.has(key))errors.push(`${part.id}: 演员重复绑定`);owners.add(key);}
  }
 }
 return {ok:errors.length===0,errors};
}

export function applyStoredSongReview(score,storage){
 if(!score?.songBindings||!storage)return score;
 try{
  const stored=JSON.parse(storage.getItem(BAND_REVIEW_KEY)||'{}')[`${score.trackId}:${score.sourceSha256}`];
  if(!stored)return score;
  const current=Object.fromEntries(score.stems.map(s=>[s.id,s.audioSha256]));
  if(score.analysisSha256!==stored.analysisSha256||JSON.stringify(current)!==JSON.stringify(stored.audioDigests))return score;
  const candidate={...score,songBindings:stored.songBindings};
  return validateSongBindings(candidate).ok?candidate:score;
 }catch{return score;}
}

export function songBindingSummary(score){
 if(score?.source==='arrangement'){
  const valid=validateArrangement(score);return {ready:valid.ok,readyForConducting:valid.ok,verified:0,composed:valid.ok?score.stems.length:0,
   pending:0,rejected:0,unresolved:[],mismatches:[],reason:valid.ok?'独立改编声轨 · 按谱演奏':valid.errors.join('；')};
 }
 const model=modelFamilySummary(score);if(model)return model;
 if(score?.source==='procedural'&&score.generatorEvidence==='audio-source-start-event-log-v1'){
  const mismatches=score.generatorParts.flatMap(p=>Object.entries(p.actors).filter(([theme,id])=>!matchesInstrumentFamily(instrumentById(`${theme}/${id}`),p.instrumentId)).map(([theme,id])=>({partId:p.id,actorId:`${theme}/${id}`,instrumentId:p.instrumentId})));
  return {ready:mismatches.length===0,verified:score.generatorParts.length,pending:0,rejected:0,unresolved:[],mismatches,reason:mismatches.length?'生成器实际事件已接入；部分主题缺少匹配乐器的 pet':'生成器实际事件'};
 }
 const checked=validateSongBindings(score);
 if(!checked.ok)return {ready:false,verified:0,pending:0,unresolved:[],reason:checked.errors.join('；')};
 const parts=score.songBindings.parts,verified=parts.filter(p=>p.status==='verified').length;
 const pending=parts.filter(p=>p.status==='candidate').length,rejected=parts.filter(p=>p.status==='rejected').length;
 const unresolved=score.songBindings.unresolved||[];
 const mismatches=parts.filter(p=>p.status==='verified').flatMap(p=>Object.entries(p.actors).filter(([theme,id])=>!matchesInstrumentFamily(instrumentById(`${theme}/${id}`),p.instrumentId)).map(([theme,id])=>({partId:p.id,actorId:`${theme}/${id}`,instrumentId:p.instrumentId})));
 return {ready:score.validation?.numericalPassed===true&&verified>0&&pending===0&&rejected===0&&unresolved.length===0&&mismatches.length===0,verified,pending,rejected,unresolved,mismatches,
  reason:rejected?'有声部分离或转写不合格':mismatches.length?'原 pet 乐器家族与声部不匹配':score.validation?.numericalPassed!==true?'音轨数值一致性未通过':pending||unresolved.length?'声部家族与演奏段落尚待核验':verified?'声部映射已核验':'本曲没有已核验的演奏声部'};
}

export function songPartsForTheme(score,theme,roles){
 const checked=validateSongBindings(score),bindings=checked.ok?score.songBindings.parts:[];
 return roles.map(role=>{
  const binding=bindings.find(p=>`${theme}/${p.actors?.[theme]}`===role.id&&p.status!=='rejected'&&p.status!=='absent');
  const stem=binding&&score.stems.find(s=>s.id===binding.stemId);
  const mismatch=binding?.status==='verified'&&!matchesInstrumentFamily(role,binding.instrumentId);
  const verified=binding?.status==='verified'&&!mismatch,instrument=SONG_INSTRUMENTS[binding?.instrumentId];
  return {...role,id:role.id,partId:binding?.id||null,stemId:verified?stem.id:null,
   instrumentId:verified?binding.instrumentId:null,instrumentAssetRole:verified?instrument.assetRole:null,
   label:verified?instrument.label:'未绑定',technique:verified?instrument.technique:role.technique,
   sourceLabel:verified?`${stem.label} · 已听辨核验`:mismatch?'该声部乐器与原 pet 不匹配，保持休止':binding?'模型分离候选 · 待听辨':'尚无已核验的对应声部',
   bindingStatus:mismatch?'instrument-mismatch':binding?.status||'unbound',candidateStemId:stem?.id||null,
   shared:false,events:verified?stem.events:[],percussion:verified&&binding.instrumentId==='drums',source:score?.source||'pending'};
 });
}
