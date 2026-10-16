import {instrumentById,instrumentsForTheme} from '../avatar/instrument-manifest.js';

export const BOLERO_TRACK=Object.freeze({id:'arrangement_bolero',title:'波莱罗 · 十人改编',theme:'one-piece',
 src:'./output/lu-band-arrangement/bolero-trial/bolero-pet-ensemble.mp3',score:'./output/lu-band-arrangement/bolero-trial/web/score.json'});
export function validateArrangement(score){
 if(score?.arrangement?.version===2)return validateHybridArrangement(score);
 const a=score?.arrangement,errors=[],actors=new Set(),stems=new Set();
 if(score?.source!=='arrangement'||a?.version!==1||a?.provenance!=='rendered-midi-events-v1'||a?.mixMode!=='independent-stems')errors.push('改编来源无效');
 if(!Array.isArray(a?.parts)||a.parts.length!==10||score?.stems?.length!==10)errors.push('改编须有十条独立声轨');
 if(a?.theme!=='one-piece'||a?.takeoverBars!==4||score?.timeSignature?.[0]!==3||score?.timeSignature?.[1]!==4)errors.push('改编编制或拍号无效');
 for(const part of a?.parts||[]){
  const actor=instrumentById(part.actorId),stem=score.stems?.find(s=>s.id===part.stemId);
  if(!actor||actor.theme!==a.theme||actor.instrumentKind!==part.instrumentId||stem?.instrumentId!==part.instrumentId)errors.push('角色与实际配器不匹配');
  if(!stem?.audio||!/^[a-f0-9]{64}$/.test(stem.audioSha256||'')||!stem.events?.length||!['voice','keys','pluck','strike','wind','sustain'].includes(part.technique))errors.push('缺少独立音轨或合成事件');
  if(actors.has(part.actorId)||stems.has(part.stemId))errors.push('改编声轨不得共享');
  actors.add(part.actorId);stems.add(part.stemId);
 }
 return {ok:!errors.length,errors};
}
export function validateHybridArrangement(score){
 const a=score?.arrangement,h=score?.hybrid,errors=[],ids=new Set();
 if(score?.source!=='arrangement'||a?.provenance!=='source-derived-sample-events-v1'||a?.mixMode!=='original-plus-synth'||a?.takeoverBars!==4||h?.version!==1)errors.push('混合编配来源无效');
 if(!/^[a-f0-9]{64}$/.test(score?.sourceSha256||''))errors.push('缺少原曲摘要');
 const originals=new Set(h?.originalStems?.map(s=>s.id)||[]);
 for(const s of h?.originalStems||[])if(!s.audio||!/^[a-f0-9]{64}$/.test(s.audioSha256||''))errors.push('缺少原曲控制声轨');
 for(const theme of ['one-piece','dragon-ball','naruto']){
  const parts=a?.themes?.[theme]||[];
  if(parts.length!==instrumentsForTheme(theme).length)errors.push('角色编制不完整');
  for(const p of parts){const actor=instrumentById(p.actorId),s=score.stems?.find(s=>s.id===p.stemId);
   if(!actor||actor.theme!==theme||actor.instrumentKind!==p.instrumentId||s?.instrumentId!==p.instrumentId||p.stemId!==p.actorId||ids.has(p.stemId))errors.push('角色与独立乐器不匹配');
   ids.add(p.stemId);
   if(p.originalStemId&&(!originals.has(p.originalStemId)||p.originalStemId!==p.instrumentId))errors.push('不得削弱不对应的原曲乐器');
   if(!['voice','keys','pluck','strike','wind','sustain'].includes(p.technique))errors.push('演奏方式无效');
   if(p.instrumentId==='vocals'&&s?.events?.length)errors.push('原唱不得伪装为合成人声音符');
  }
 }
 const mix=h?.mix;
 if(!mix||!Object.values(mix).every(v=>Number.isFinite(v)&&v>=0&&v<=1)||!(mix.original>mix.synth&&mix.originalFloor>0&&mix.originalFloor<1&&mix.soloBed>0&&mix.soloBed<mix.original))errors.push('原曲优先与保留背景的混音规则无效');
 if(ids.size!==score?.stems?.length)errors.push('独立声部数量不一致');
 return {ok:!errors.length,errors};
}
export function arrangementPartsForTheme(score,theme,roles){
 if(score?.arrangement?.version===2){const valid=validateArrangement(score).ok;
  return roles.map(role=>{const p=valid&&score.arrangement.themes[theme]?.find(p=>p.actorId===role.id),s=p&&score.stems.find(s=>s.id===p.stemId);
   return {...role,partId:p?`hybrid-${s.id}`:null,stemId:s?.id||null,instrumentId:p?.instrumentId||null,
    technique:p?.technique||role.technique,label:role.instrument,sourceLabel:p?.instrumentId==='vocals'?'原唱 · 波形活动':p?'独立采样演奏 · 自动编配':'休止',
    bindingStatus:p?'composed':'unbound',events:s?.events||[],activitySource:p?.activitySource,
    percussion:s?.percussion||false,shared:false,source:'arrangement'};
  });
 }
 const valid=validateArrangement(score).ok&&theme===score.arrangement.theme;
 return roles.map(role=>{
  const part=valid&&score.arrangement.parts.find(p=>p.actorId===role.id),stem=part&&score.stems.find(s=>s.id===part.stemId);
  return {...role,partId:part?`arranged-${stem.id}`:null,stemId:stem?.id||null,instrumentId:part?.instrumentId||null,
   technique:part?.technique||role.technique,label:stem?.label||'休止',sourceLabel:part?'独立改编声轨 · 按谱演奏':'本次为海贼王十人改编',
   bindingStatus:part?'composed':'unbound',events:stem?.events||[],percussion:stem?.id==='drums',shared:false,source:'arrangement'};
 });
}
