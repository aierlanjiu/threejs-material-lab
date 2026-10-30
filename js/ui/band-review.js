import {BAND_TRACKS,GENERAL_BAND_TRACKS,loadBandAnalysis,verifyBandSource} from '../audio/band-library.js';
import {SONG_INSTRUMENTS,BAND_REVIEW_KEY,validateSongBindings,songBindingSummary} from '../audio/band-song-parts.js';
import {instrumentsForTheme,matchesInstrumentFamily} from '../avatar/instrument-manifest.js';

const $=id=>document.getElementById(id),tracks=[...BAND_TRACKS,...GENERAL_BAND_TRACKS.filter(t=>t.src)];
let score=null,revision=0,playerRevision=0;
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
for(const track of tracks)$('reviewTrack').append(new Option(track.title,track.id));
async function listen(url){
 const token=++playerRevision;$('reviewPlayer').pause();$('reviewPlayer').src=url;$('reviewPlayer').load();
 try{await $('reviewPlayer').play();}catch(error){if(token===playerRevision)$('reviewResult').textContent=`试听失败：${error.message}`;}
}
function previewButtons(stem){
 const box=node('div',undefined,'lu-band-controls');
 const clips=stem.reviewClips||[];
 if(clips.length){const select=node('select');select.setAttribute('aria-label',`${stem.label}对照片段`);
  for(const [i,clip] of clips.entries())select.append(new Option(`${clip.start.toFixed(2)}–${clip.end.toFixed(2)} 秒`,String(i)));
  const mix=node('button','听原曲片段'),isolated=node('button','听分离片段');mix.type=isolated.type='button';
  mix.addEventListener('click',()=>listen(clips[Number(select.value)].mix));isolated.addEventListener('click',()=>listen(clips[Number(select.value)].stem));box.append(select,mix,isolated);
 }
 const full=node('button','听完整音轨');full.type='button';full.addEventListener('click',()=>listen(stem.audio));box.append(full);return box;
}
function updateStatus(){
 const summary=songBindingSummary(score);
 $('reviewStatus').textContent=score?`${summary.verified} 人工核验${summary.estimated?` · ${summary.estimated} 家族模型估计`:''} · ${summary.pending} 待校验 · ${summary.unresolved.length} 未分配${summary.mismatches?.length?` · ${summary.mismatches.length} 演员家族不匹配`:''}${score.validation?.numericalPassed===false?' · 分离重建存在误差':''}`:'尚无逐乐器数据';
 $('saveReview').disabled=!score||!validateSongBindings(score).ok;$('exportReview').disabled=!score;
}
function render(){
 const host=$('reviewParts');host.replaceChildren();
 for(const part of score.songBindings.parts){
  const stem=score.stems.find(s=>s.id===part.stemId),card=node('article',undefined,'band-review-card');
  card.append(node('h2',SONG_INSTRUMENTS[part.instrumentId].label));
  card.append(node('p',`${stem.events.length} 个自动事件 · 相对原混音 ${stem.relativeRmsDb} dB · 自动转写仍需核对`, 'band-study-note'));
  card.append(previewButtons(stem));
  const decision=node('select');decision.setAttribute('aria-label',`${SONG_INSTRUMENTS[part.instrumentId].label}校验结果`);
  for(const [id,label] of [['candidate','待校验'],['verified','乐器与演奏时间已核验'],['absent','确认原曲没有该声部'],['rejected','分离或转写不合格']])decision.append(new Option(label,id));decision.value=part.status;
  const note=node('textarea');note.rows=2;note.maxLength=800;note.placeholder='记录串音、遗漏或时间校正依据';note.setAttribute('aria-label',`${SONG_INSTRUMENTS[part.instrumentId].label}校验说明`);note.value=part.review?.note||'';
  const update=()=>{part.status=decision.value;part.review={reviewer:$('reviewer').value.trim(),method:'原混音/分离音轨对照听辨与演奏时间核验',at:new Date().toISOString(),note:note.value.trim()};updateStatus();};
  decision.addEventListener('change',update);note.addEventListener('input',()=>{if(part.review)update();});card.append(decision,note);
  const actors=node('details'),title=node('summary','对应演员');actors.append(title);
  const actorControls=node('div',undefined,'lu-band-controls');
  for(const [theme,label] of [['one-piece','海贼王'],['dragon-ball','龙珠'],['naruto','火影']]){
   const row=node('label',label),select=node('select');select.setAttribute('aria-label',`${SONG_INSTRUMENTS[part.instrumentId].label}${label}演员`);
   for(const actor of instrumentsForTheme(theme))select.append(new Option(`${actor.name}${matchesInstrumentFamily(actor,part.instrumentId)?'':' · 家族不匹配'}`,actor.id.split('/')[1]));select.value=part.actors[theme];
   select.addEventListener('change',()=>{part.actors[theme]=select.value;updateStatus();});row.append(select);actorControls.append(row);
  }actors.append(actorControls,node('p','保留原 pet 形象；按乐器家族匹配，例如架子鼓、军鼓和手鼓均可承接打击乐，钢琴、合成器和风琴均可承接键盘声部。','band-study-note'));card.append(actors);host.append(card);
 }
 const unknown=score.stems.find(s=>s.id==='other');
 if(unknown){const card=node('article',undefined,'band-review-card');card.append(node('h2','剩余伴奏'),previewButtons(unknown),node('p','如果仍包含独立乐器，需要进一步分离并建立声部；整段伴奏不能分配给一件假定乐器。','band-study-note'));
  const row=node('label'),check=node('input');check.type='checkbox';check.setAttribute('aria-label','剩余伴奏已确认仅串音或噪声');check.checked=!score.songBindings.unresolved.length;
  row.append(check,document.createTextNode(' 已听辨确认仅为串音或噪声，没有遗漏独立声部'));
  check.addEventListener('change',()=>{
   score.songBindings.unresolved=check.checked?[]:[{stemId:'other',reason:'剩余伴奏的实际乐器身份尚未确认'}];
   score.songBindings.residualReview=check.checked?{reviewer:$('reviewer').value.trim(),method:'完整剩余伴奏与原混音对照听辨',at:new Date().toISOString()}:null;updateStatus();
  });card.append(row);host.append(card);
 }
 updateStatus();
}
async function choose(){
 const token=++revision;++playerRevision;$('reviewPlayer').pause();$('reviewParts').replaceChildren();score=null;updateStatus();$('reviewResult').textContent='';$('reviewStatus').textContent='正在校验音源…';
 try{
  const loaded=await loadBandAnalysis($('reviewTrack').value,{preferHybrid:false});if(token!==revision)return;
  if(!loaded?.songBindings)throw new Error('本曲逐乐器候选尚未生成。已有四类数据不会自动变成逐乐器声部。');
  if(!await verifyBandSource(loaded,loaded.originalAudio))throw new Error('原曲与分析音源摘要不一致');
  if(token!==revision)return;score=structuredClone(loaded);render();
 }catch(error){if(token===revision){$('reviewStatus').textContent='待处理';$('reviewResult').textContent=error.message;}}
}
$('reviewTrack').addEventListener('change',choose);
$('reviewer').addEventListener('input',updateStatus);
$('saveReview').addEventListener('click',()=>{
 if(!score)return;const reviewer=$('reviewer').value.trim();if(!reviewer){$('reviewResult').textContent='请填写校验人。';return;}
 for(const part of score.songBindings.parts)if(part.status==='verified'&&part.review)part.review.reviewer=reviewer;
 if(score.songBindings.residualReview)score.songBindings.residualReview.reviewer=reviewer;
 const checked=validateSongBindings(score);if(!checked.ok){$('reviewResult').textContent=checked.errors.join('；');return;}
 try{const all=JSON.parse(localStorage.getItem(BAND_REVIEW_KEY)||'{}');all[`${score.trackId}:${score.sourceSha256}`]={analysisSha256:score.analysisSha256,audioDigests:Object.fromEntries(score.stems.map(s=>[s.id,s.audioSha256])),songBindings:score.songBindings};localStorage.setItem(BAND_REVIEW_KEY,JSON.stringify(all));
  const summary=songBindingSummary(score);$('reviewResult').textContent=summary.ready?'本曲校验已保存；乐队舞台将使用核验后的声部与演员。':`已保存当前校验进度；本曲仍未通过完整声部验收：${summary.reason}。`;
 }catch(error){$('reviewResult').textContent=`保存失败：${error.message}`;}
});
$('exportReview').addEventListener('click',()=>{
 if(!score)return;const data={trackId:score.trackId,sourceSha256:score.sourceSha256,analysisSha256:score.analysisSha256,audioDigests:Object.fromEntries(score.stems.map(s=>[s.id,s.audioSha256])),songBindings:score.songBindings};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download=`${score.trackId}-review.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.luBandReview={get diagnostics(){return {trackId:score?.trackId,binding:songBindingSummary(score),parts:score?.songBindings?.parts.map(p=>({id:p.id,status:p.status,actors:p.actors})),audio:$('reviewPlayer').currentSrc};}};
choose();
