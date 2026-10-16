import {createBandScene} from './band-scene.js';
import {compileBandParts,sampleBandEnsemble,bandPartScore} from '../audio/band-parts.js';
import {loadBandSettings} from './band-settings.js';
import {createBandControls,createPyroSoundToggle} from './band-controls.js';
import {createBandPyroAudio} from '../audio/band-pyro-audio.js';
import {stageEffectsAt} from '../audio/band-effects-timeline.js';
import {focusLyricText} from './lu-perceptual-ui.js';
import {createBandDemoScore} from '../audio/band-timeline.js';
import {BAND_TRACKS,GENERAL_BAND_TRACKS,loadBandAnalysis,verifyBandSource} from '../audio/band-library.js';
import {songBindingSummary} from '../audio/band-song-parts.js';
import {sampleBandLyric} from '../audio/band-cues.js';
import {drawBandScore} from './band-score.js';
import {setupBandScoreDisclosure} from './band-score-disclosure.js';
import {createBandAudioSources} from '../audio/band-audio-source.js';
const $=id=>document.getElementById(id),audio=$('bandAudio'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
document.documentElement.classList.add('lu-perceptual-ui');
const settings=loadBandSettings('lu_band_study_v2');
let effectsContext=null,effectsOutput=null;
function ensureStudyAudio(){if(effectsContext)return;const C=window.AudioContext||window.webkitAudioContext;effectsContext=new C();effectsOutput=effectsContext.createGain();effectsContext.createMediaElementSource(audio).connect(effectsOutput);effectsOutput.connect(effectsContext.destination);}
const pyroAudio=createBandPyroAudio({getContext:()=>effectsContext,getOutput:()=>effectsOutput});
const pyroToggle=createPyroSoundToggle($('bandStudyScene'),{settings,storageKey:'lu_band_study_v2',onChange:()=>draw()});
const audioSources=createBandAudioSources();
const scoreDisclosure=setupBandScoreDisclosure($('bandScoreCanvas').closest('.lu-band-score'));
const lyricEl=$('bandLyric'),lyricOrigEl=lyricEl?.querySelector('.lu-band-lyric-orig'),lyricZhEl=lyricEl?.querySelector('.lu-band-lyric-zh');
let controls,parts=[],partScore=null,scene,score=createBandDemoScore(),theme='one-piece',focus=null,playing=false,offset=0,origin=0,lastDraw=0,loadRevision=0,pendingAudioTime=null,audioSourceUrl='',lastLyricSnapshot=null;
const clock=()=>score.source==='analysis'?(pendingAudioTime??audio.currentTime):(playing?Math.min(score.duration,offset+(performance.now()-origin)/1000):offset);
function loading(value){for(const id of ['bandPlay','bandSeek','bandTrack','bandTheme'])$(id).disabled=value;$('bandListen').disabled=value||score.source==='demo';}
async function replaceAudio(src,time=0){
 pendingAudioTime=time;audio.pause();
 try{
  // Native media streaming is preferred; the development server needs a Blob fallback.
  const resolved=await audioSources.resolve(src);audioSourceUrl=src;
  await new Promise((resolve,reject)=>{
   const cleanup=()=>{clearTimeout(timer);audio.removeEventListener('loadedmetadata',ready);audio.removeEventListener('error',failed);};
   const ready=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(new Error('声部音频无法读取'));};
   const timer=setTimeout(failed,15000);audio.addEventListener('loadedmetadata',ready,{once:true});audio.addEventListener('error',failed,{once:true});audio.src=resolved;audio.load();
  });
  audio.currentTime=Math.min(time,Number.isFinite(audio.duration)?audio.duration:time);
 }finally{pendingAudioTime=null;}
}
const format=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function rebuildParts(){parts=compileBandParts(score,theme,settings.overrides);partScore=bandPartScore(score,parts);controls?.setParts(parts);}
async function loadTracks(){
 $('bandTrack').replaceChildren(new Option('编排演示 · 未绑定歌曲','demo'));
 for(const track of BAND_TRACKS.filter(t=>t.theme===theme)){
  try{const response=await fetch(`./output/lu-band/${track.id}/score.json`,{method:'HEAD'});if(response.ok)$('bandTrack').append(new Option(track.title,track.id));}catch{}
 }
 const generalGroup=document.createElement('optgroup');
 generalGroup.label='通用曲目 · 乐队编配';
 for(const track of GENERAL_BAND_TRACKS.filter(t=>t.src)){
  generalGroup.append(new Option(track.title,track.id));
 }
 if(generalGroup.children.length)$('bandTrack').append(generalGroup);
}
function stop(){pyroAudio.stop();if(score.source==='analysis')audio.pause();else offset=clock();playing=false;$('bandPlay').textContent=score.source==='demo'?'开始演示':'播放主题曲';}
async function chooseTrack(){
 stop();const revision=++loadRevision,id=$('bandTrack').value;$('bandDownloads').replaceChildren();focus=null;offset=0;audio.pause();audio.removeAttribute('src');loading(true);
 if(id==='demo')score=createBandDemoScore();
 else{
  try{
   let loaded=await loadBandAnalysis(id,{preferHybrid:false});
   if(revision!==loadRevision)return;
   if(!loaded)throw new Error('该曲尚未处理完成');
   if(!await verifyBandSource(loaded,loaded.originalAudio))throw new Error('音源摘要与分谱不一致');
   score=loaded;
   if(score.originalAudio)await replaceAudio(score.originalAudio);
  }catch(error){$('bandStatus').textContent=error.message;loading(false);return;}
 }
 if(revision!==loadRevision)return;loading(false);$('bandPlay').textContent=score.source==='demo'?'开始演示':'播放主题曲';
 $('bandSeek').max=score.duration;$('bandSeek').value=0;$('bandListen').value='mix';$('bandListen').disabled=score.source==='demo'||Boolean(score.synthesized);
 $('bandListen').replaceChildren(new Option('完整混音','mix'));
 if(score.source==='analysis')for(const stem of score.stems)if(stem.audio)$('bandListen').append(new Option(stem.label,stem.id));
 if(score.source==='analysis'){
  const files=score.songBindings?[['score.json','逐曲声部 JSON']]:[['score.mid','下载 MIDI'],['score.musicxml','下载 MusicXML'],['score.json','声部事件 JSON']];
  for(const [file,label] of files){const a=document.createElement('a');a.href=`${score.analysisDirectory}/`+file;a.textContent=label;a.download='';$('bandDownloads').append(a);}
 }
 rebuildParts();draw();
}
function draw(){
 if(!scene||!parts.length)return;const time=clock(),frame=sampleBandEnsemble(score,parts,time,focus),part=parts.find(p=>p.id===focus)||frame.leadPart||parts[0];
 const effectsFrame=stageEffectsAt(score,time,settings.effects);pyroToggle.render();
 pyroAudio.update({score,time,playing:playing&&score.source==='analysis',enabled:settings.pyroSound!==false&&!reduced.matches,mode:settings.effects,narrow:innerWidth<600,fx:effectsFrame});
 scene.update(frame,{settings,focus,reduced:reduced.matches,score,parts,effectsFrame});controls.updateSamples(frame);drawBandScore($('bandScoreCanvas'),partScore,frame.time,part.id);
 $('bandScoreTitle').textContent=`${part.name} · ${score.source==='demo'?part.instrument:part.label}`;$('bandScoreSource').textContent=score.source==='demo'?'编排演示':part.sourceLabel;
 const binding=songBindingSummary(score),status=score.source==='demo'?'编排演示 · 未绑定当前歌曲':`${score.title} · ${binding.estimated?`${binding.estimated} 组家族模型估计`:`${binding.verified} 声部已核验 · ${binding.pending} 待校验`}${binding.unresolved.length?' · 其余保留原曲':''}`;
 $('bandStatus').textContent=`${status} · ${frame.parts.filter(s=>s.activity>.18).length}/${parts.length} 演奏`;$('bandTime').textContent=`${format(time)} / ${format(score.duration)}`;$('bandSeek').value=time;
 if(lyricEl){
  const lctx=score.source==='analysis'?sampleBandLyric(score,time):null;
  const origText=lctx?.originalText||'';
  const zhText=lctx?.bilingual?lctx.translatedText:'';
  const prog=lctx?.progressInLine??0;
  lyricEl.style.setProperty('--lyric-progress',`${(prog*100).toFixed(1)}%`);
  lyricEl.dataset.bilingual=lctx?.bilingual?'true':'false';
  focusLyricText(lyricOrigEl,origText);
  if(lyricZhEl){focusLyricText(lyricZhEl,zhText);lyricZhEl.hidden=!lctx?.bilingual;}
  lyricEl.hidden=score.source==='demo'||!origText;
  lastLyricSnapshot=lctx;
 }
 if(time>=score.duration&&playing)stop();
}
function tick(now){requestAnimationFrame(tick);if(now-lastDraw<33)return;lastDraw=now;if(!document.hidden)draw();}
$('bandTheme').addEventListener('change',async()=>{stop();theme=$('bandTheme').value;focus=null;loading(true);await scene.configure(theme);await loadTracks();await chooseTrack();controls.setFocus(null,false);});
$('bandTrack').addEventListener('change',chooseTrack);
$('bandPlay').addEventListener('click',async()=>{ensureStudyAudio();await effectsContext.resume();if(playing){stop();return;}if(clock()>=score.duration){offset=0;audio.currentTime=0;}if(score.source==='analysis'){try{await audio.play();}catch{ $('bandStatus').textContent='音频无法播放，请检查本地文件';return;}}else origin=performance.now();playing=true;$('bandPlay').textContent=score.source==='demo'?'暂停演示':'暂停主题曲';});
$('bandSeek').addEventListener('input',()=>{const value=Number($('bandSeek').value);if(score.source==='analysis')audio.currentTime=value;else{offset=value;origin=performance.now();}draw();});
$('bandListen').addEventListener('change',async()=>{if(score.source!=='analysis')return;const time=clock(),wasPlaying=playing;loading(true);try{await replaceAudio($('bandListen').value==='mix'?score.originalAudio:score.stems.find(s=>s.id===$('bandListen').value).audio,time);if(wasPlaying)await audio.play();}catch(error){stop();$('bandStatus').textContent=error.message;}finally{loading(false);draw();}});
audio.addEventListener('ended',stop);audio.addEventListener('error',()=>{playing=false;$('bandStatus').textContent='音频加载失败，请检查本机曲目与声部文件';});
try{
 scene=await createBandScene($('bandStudyScene'),{safeTop:130,safeBottom:48});scene.setActive(true);await scene.configure(theme);
 controls=createBandControls($('bandStudyControls'),{settings,getTheme:()=>theme,getScore:()=>score,storageKey:'lu_band_study_v2',
  onChange:(_,options)=>{if(options.rebuildParts)rebuildParts();draw();},onFocus:id=>{focus=id;draw();}});
 scene.canvas.addEventListener('band-member-select',event=>controls.setFocus(event.detail));
 rebuildParts();await loadTracks();$('bandListen').disabled=true;draw();requestAnimationFrame(tick);
 window.luBandStudy={get diagnostics(){return {...scene.diagnostics,pyroAudio:pyroAudio.diagnostics,time:clock(),playing,focus,source:score.source,trackId:score.trackId,audioSourceUrl,audioMode:audioSources.mode,settings,lyric:lastLyricSnapshot,binding:songBindingSummary(score),parts:parts.map(p=>({id:p.id,stem:p.stemId,events:p.events.length,bindingStatus:p.bindingStatus,instrumentId:p.instrumentId,shared:p.shared}))};}};
 window.addEventListener('pagehide',()=>{pyroAudio.dispose();pyroToggle.dispose();effectsContext?.close();scoreDisclosure.dispose();scene.dispose();audioSources.dispose();},{once:true});
}
catch(error){console.error('Band study:',error);$('bandStatus').textContent='乐队预览无法加载，请检查浏览器图形支持与网络';}
