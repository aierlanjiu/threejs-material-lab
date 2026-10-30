import {instrumentById,instrumentFamily} from '../avatar/instrument-manifest.js';

export const FAMILY_LABELS=Object.freeze({vocals:'人声',bass:'低音拨弦',percussion:'打击乐',plucked_strings:'拨弦',keys:'键盘',winds:'管乐',bowed_strings:'弓弦'});
const digest=value=>/^[a-f0-9]{64}$/.test(value||'')&&!/^0+$/.test(value);
const compatible=(actor,family)=>actor&&(family==='bass'?actor.musicalFamily==='plucked_strings':actor.musicalFamily===instrumentFamily(family));
export function validateFamilyBindings(score,data){
 const errors=[];
 if(data?.version!==1||data?.method!=='AST-family-classification-and-measured-stem-events-v1')errors.push('模型绑定版本或方法无效');
 if(!digest(data?.sourceSha256)||data.sourceSha256!==score?.sourceSha256||data.trackId!==score?.trackId)errors.push('模型绑定音源不一致');
 if(!Array.isArray(data?.parts))return {ok:false,errors:[...errors,'缺少模型声部']};
 if(!score.stems.every(s=>data.audioDigests?.[s.id]===s.audioSha256))errors.push('模型绑定与分轨摘要不一致');
 if(!Array.isArray(data.sections)||!data.sections.length||data.sections.some((s,i)=>!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.end<=s.start||Math.abs(s.start-(i?data.sections[i-1].end:0))>.01)||Math.abs(data.sections.at(-1)?.end-score.duration)>.06)errors.push('模型段落时间无效');
 const ids=new Set(),actors=new Set();
 for(const part of data.parts){
  const stem=score.stems.find(s=>s.id===part.stemId);
  if(!part.id||ids.has(part.id))errors.push('重复模型声部');ids.add(part.id);
  if(!stem||part.instrumentId!==stem.instrumentId||!FAMILY_LABELS[part.familyId]||part.status!=='estimated')errors.push('模型声部无效');
  if(part.evidence?.audioSha256!==stem?.audioSha256||!digest(part.evidence?.classificationSha256)||part.evidence?.revision!=='f826b80d28226b62986cc218e5cec390b1096902'||!(part.evidence?.score>=.1&&part.evidence.score<=1))errors.push('缺少可追溯的音频分类证据');
  if(!Array.isArray(part.activeIntervals)||!part.activeIntervals.length||part.activeIntervals.some(([a,b])=>!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a||b>score.duration+.01))errors.push('模型声部活动区间无效');
  for(const theme of ['one-piece','dragon-ball','naruto']){
   const id=part.actors?.[theme];if(id===null)continue;
   const actor=instrumentById(`${theme}/${id}`),key=actor?.id;
   if(!compatible(actor,part.familyId)||actors.has(key))errors.push('模型演员家族不匹配或重复');actors.add(key);
  }
 }
 return {ok:!errors.length,errors};
}
export function familyPartsForTheme(score,theme,roles){
 const data=score?.familyBindings;
 const valid=data&&validateFamilyBindings(score,data).ok;
 return roles.map(role=>{
  const binding=valid&&data.parts.find(part=>`${theme}/${part.actors[theme]}`===role.id);
  const stem=binding&&score.stems.find(s=>s.id===binding.stemId);
  const decision=binding&&score.songBindings?.parts.find(part=>part.stemId===binding.stemId&&part.review&&['verified','rejected','absent'].includes(part.status));
  const usable=Boolean(binding&&!decision);
  return {...role,partId:usable?binding.id:null,stemId:usable?stem.id:null,instrumentId:usable?binding.familyId:null,
   familyId:usable?binding.familyId:null,label:usable?FAMILY_LABELS[binding.familyId]:'未绑定',
   bindingStatus:usable?'estimated':decision?.status||'unbound',sourceLabel:usable?`家族模型估计${binding.sharedAudio?' · 共享伴奏，联动控制':''}`:'尚无可靠的对应声部',
   modelIntervals:usable?binding.activeIntervals:[],activitySource:usable?binding.activitySource:null,
   shared:Boolean(usable&&binding.sharedAudio),events:usable?stem.events:[],percussion:usable&&binding.familyId==='percussion',source:score?.source||'pending'};
 });
}
export function modelFamilySummary(score){
 const data=score?.familyBindings;if(!data||!validateFamilyBindings(score,data).ok)return null;
 const reviewed=score.songBindings?.parts.filter(p=>p.status==='verified')||[];
 return {ready:false,readyForConducting:data.parts.length>0||reviewed.length>0,verified:reviewed.length,estimated:data.parts.filter(p=>!score.songBindings?.parts.some(r=>r.stemId===p.stemId&&r.review&&['verified','absent','rejected'].includes(r.status))).length,pending:0,rejected:0,
  unresolved:score.stems.filter(s=>!data.parts.some(p=>p.stemId===s.id)).map(s=>({stemId:s.id,reason:'保留原曲，未分配演员'})),mismatches:[],
  reason:'家族模型估计已接入；共享伴奏联动控制，尚非逐乐器人工听辨'};
}
