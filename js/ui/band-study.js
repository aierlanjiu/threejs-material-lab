import {createBandScene} from './band-scene.js';
import {compileBandParts,sampleBandEnsemble,bandPartScore} from '../audio/band-parts.js';
import {loadBandSettings} from './band-settings.js';
import {createBandControls} from './band-controls.js';
import {createBandDemoScore} from '../audio/band-timeline.js';
import {BAND_TRACKS,loadBandAnalysis} from '../audio/band-library.js';
import {drawBandScore} from './band-score.js';
import {setupBandScoreDisclosure} from './band-score-disclosure.js';
import {createBandAudioSources} from '../audio/band-audio-source.js';
const $=id=>document.getElementById(id),audio=$('bandAudio'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
const settings=loadBandSettings('lu_band_study_v2');
const audioSources=createBandAudioSources();
const scoreDisclosure=setupBandScoreDisclosure($('bandScoreCanvas').closest('.lu-band-score'));
let controls,parts=[],partScore=null,scene,score=createBandDemoScore(),theme='one-piece',focus=null,playing=false,offset=0,origin=0,lastDraw=0,loadRevision=0,pendingAudioTime=null,audioSourceUrl='';
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
}
function stop(){if(score.source==='analysis')audio.pause();else offset=clock();playing=false;$('bandPlay').textContent=score.source==='demo'?'开始演示':'播放主题曲';}
async function chooseTrack(){
 stop();const revision=++loadRevision,id=$('bandTrack').value;$('bandDownloads').replaceChildren();focus=null;offset=0;audio.pause();audio.removeAttribute('src');loading(true);
 if(id==='demo')score=createBandDemoScore();
 else{try{const loaded=await loadBandAnalysis(id);if(revision!==loadRevision)return;if(!loaded)throw new Error('该曲尚未处理完成');score=loaded;await replaceAudio(score.originalAudio);}catch(error){$('bandStatus').textContent=error.message;loading(false);return;}}
 if(revision!==loadRevision)return;loading(false);$('bandPlay').textContent=score.source==='demo'?'开始演示':'播放主题曲';
 $('bandSeek').max=score.duration;$('bandSeek').value=0;$('bandListen').value='mix';$('bandListen').disabled=score.source==='demo';
 if(score.source==='analysis')for(const [file,label] of [['score.mid','下载 MIDI'],['score.musicxml','下载 MusicXML'],['score.json','声部事件 JSON']]){const a=document.createElement('a');a.href=`./output/lu-band/${score.trackId}/${file}`;a.textContent=label;a.download='';$('bandDownloads').append(a);}
 rebuildParts();draw();
}
function draw(){
 if(!scene||!parts.length)return;const time=clock(),frame=sampleBandEnsemble(score,parts,time,focus),part=parts.find(p=>p.id===focus)||frame.leadPart||parts[0];
 scene.update(frame,{settings,focus,reduced:reduced.matches,score,parts});controls.updateSamples(frame);drawBandScore($('bandScoreCanvas'),partScore,frame.time,part.id);
 $('bandScoreTitle').textContent=`${part.name} · ${part.instrument}`;$('bandScoreSource').textContent=score.source==='demo'?'编排演示':part.shared||part.stemId==='other'?'共享音轨 · 编配':'自动转写 · 待校谱';
 const status=score.source==='demo'?'编排演示 · 未绑定当前歌曲':`${score.title} · 自动编配`;
 $('bandStatus').textContent=`${status} · ${frame.parts.filter(s=>s.activity>.18).length}/${parts.length} 演奏`;$('bandTime').textContent=`${format(time)} / ${format(score.duration)}`;$('bandSeek').value=time;
 if(time>=score.duration&&playing)stop();
}
function tick(now){requestAnimationFrame(tick);if(now-lastDraw<33)return;lastDraw=now;if(!document.hidden)draw();}
$('bandTheme').addEventListener('change',async()=>{stop();theme=$('bandTheme').value;focus=null;loading(true);await scene.configure(theme);await loadTracks();await chooseTrack();controls.setFocus(null,false);});
$('bandTrack').addEventListener('change',chooseTrack);
$('bandPlay').addEventListener('click',async()=>{if(playing){stop();return;}if(clock()>=score.duration){offset=0;audio.currentTime=0;}if(score.source==='analysis'){try{await audio.play();}catch{ $('bandStatus').textContent='音频无法播放，请检查本地文件';return;}}else origin=performance.now();playing=true;$('bandPlay').textContent=score.source==='demo'?'暂停演示':'暂停主题曲';});
$('bandSeek').addEventListener('input',()=>{const value=Number($('bandSeek').value);if(score.source==='analysis')audio.currentTime=value;else{offset=value;origin=performance.now();}draw();});
$('bandListen').addEventListener('change',async()=>{if(score.source!=='analysis')return;const time=clock(),wasPlaying=playing;loading(true);try{await replaceAudio($('bandListen').value==='mix'?score.originalAudio:score.stems.find(s=>s.id===$('bandListen').value).audio,time);if(wasPlaying)await audio.play();}catch(error){stop();$('bandStatus').textContent=error.message;}finally{loading(false);draw();}});
audio.addEventListener('ended',stop);audio.addEventListener('error',()=>{playing=false;$('bandStatus').textContent='音频加载失败，请检查本机曲目与声部文件';});
try{
 scene=await createBandScene($('bandStudyScene'),{safeTop:130,safeBottom:48});scene.setActive(true);await scene.configure(theme);
 controls=createBandControls($('bandStudyControls'),{settings,getTheme:()=>theme,getScore:()=>score,storageKey:'lu_band_study_v2',
  onChange:(_,options)=>{if(options.rebuildParts)rebuildParts();draw();},onFocus:id=>{focus=id;draw();}});
 scene.canvas.addEventListener('band-member-select',event=>controls.setFocus(event.detail));
 rebuildParts();await loadTracks();$('bandListen').disabled=true;draw();requestAnimationFrame(tick);
 window.luBandStudy={get diagnostics(){return {...scene.diagnostics,time:clock(),playing,focus,source:score.source,trackId:score.trackId,audioSourceUrl,audioMode:audioSources.mode,settings,parts:parts.map(p=>({id:p.id,stem:p.stemId,events:p.events.length,shared:p.shared}))};}};
 window.addEventListener('pagehide',()=>{scoreDisclosure.dispose();scene.dispose();audioSources.dispose();},{once:true});
}
catch(error){console.error('Band study:',error);$('bandStatus').textContent='乐队预览无法加载，请检查浏览器图形支持与网络';}
