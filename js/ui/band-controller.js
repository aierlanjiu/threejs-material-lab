import {createBandScene} from './band-scene.js?v=20261030-sprites-all';
import {createBandDemoScore} from '../audio/band-timeline.js';
import {compileBandParts,sampleBandEnsemble,bandPartScore,bandRoster} from '../audio/band-parts.js?v=20261029-shell-live';
import {loadBandAnalysis,verifyBandSource} from '../audio/band-library.js?v=20261029-shell-live';
import {songBindingSummary} from '../audio/band-song-parts.js';
import {sampleBandLyric} from '../audio/band-cues.js';
import {loadBandSettings} from './band-settings.js';
import {createBandControls,createPyroSoundToggle} from './band-controls.js';
import {drawBandScore,drawBandPulse} from './band-score.js';
import {bandRecordingLayout} from './band-recording-layout.js';
import {setupBandScoreDisclosure} from './band-score-disclosure.js';
import {createBandConductor} from '../audio/band-conductor.js';
import {createBandMemberInteractions} from './band-member-interactions.js';
import {createBandPyroAudio} from '../audio/band-pyro-audio.js';
import {stageEffectsAt} from '../audio/band-effects-timeline.js';
import {focusLyricText} from './lu-perceptual-ui.js';

export async function createBandController({stage,state,getTime,getLyric=()=>'',getTrackLyrics=null,getProceduralScore=()=>null,pauseMusic=()=>{},monitorStem=null,mixer=null,getEffectsContext=()=>state.audioCtx,getEffectsOutput=()=>state.masterOutput||state.analyser,restartAudio=()=>{},cubeDesign=null,requestMode=null}){
 const $=id=>document.getElementById(id),host=document.createElement('div');host.className='lu-band-scene';host.hidden=true;stage.append(host);
 const panel=document.createElement('section');panel.className='lu-band-score';panel.hidden=true;panel.setAttribute('aria-label','乐队分谱');panel.innerHTML='<div class="lu-band-score-heading"><strong>主旋律</strong><small>待接入</small></div><canvas role="img" aria-label="乐队成员分谱"></canvas>';stage.append(panel);
 const scoreDisclosure=setupBandScoreDisclosure(panel);
 const scoreHeading=panel.querySelector('strong'),scoreSource=panel.querySelector('small'),scoreCanvas=panel.querySelector('canvas');
 const status=document.createElement('div');status.className='lu-band-status';status.hidden=true;stage.append(status);
 const lyric=document.createElement('p');lyric.className='lu-band-lyric';lyric.hidden=true;
 lyric.innerHTML='<span class="lu-band-lyric-orig"></span><span class="lu-band-lyric-zh" hidden></span>';
 stage.append(lyric);
 const lyricOrigEl=lyric.querySelector('.lu-band-lyric-orig'),lyricZhEl=lyric.querySelector('.lu-band-lyric-zh');
 const interactionHost=document.createElement('div');interactionHost.hidden=true;stage.append(interactionHost);
 const scene=await createBandScene(host,{safeTop:130,safeBottom:85,cubeDesign}),reduced=matchMedia('(prefers-reduced-motion:reduce)'),settings=loadBandSettings();
 const pyroAudio=createBandPyroAudio({getContext:getEffectsContext,getOutput:getEffectsOutput});
 const pyroToggle=createPyroSoundToggle(stage,{settings,onChange:()=>frame()});pyroToggle.button.hidden=true;
 let enabled=false,score=null,sourceKey='',controller=null,theme='',focus=null,demo=false,demoPlaying=false,demoOffset=0,demoOrigin=0,frameId,lastDraw=0,loadError='',disposed=false,parts=[],partScore=null,lastSnapshot=null,lastRecording=null;
 let proceduralRevision=-1,lastProceduralScore=null,promoStepping=false;
 let lastUiSync=-Infinity,lastScoreTitle='',lastScoreSource='',lastStatus='',lastLyricProg=NaN;
 const cadence={frames:0,uiSyncs:0};
 let conductor=null,conductScore=null,conductTheme='',conductReady=false,conductRevision=0,conductError='',listening='mix',soloActor=null;
 const demoScore=createBandDemoScore(),currentScore=()=>{if(demo)return demoScore;const track=state.playlist[state.currentTrackIndex];if(!track?.isPreset)return score;const generated=getProceduralScore();return generated?.trackId===track.type?generated:null;};
 const clock=()=>demo?(demoPlaying?Math.min(32,demoOffset+(performance.now()-demoOrigin)/1000):demoOffset):getTime();
 const canConduct=()=>Boolean(enabled&&!demo&&mixer&&conductReady&&listening==='mix'&&(!currentScore()?.rendered||mixer.diagnostics.ready));
 const conductorPart=id=>parts.find(p=>p.id===id&&p.stemId);
 const memberInteractions=createBandMemberInteractions(interactionHost,{
  onToggle:id=>{const part=conductorPart(id);if(canConduct()&&part)conductor.toggle(part.stemId);},
  onSoloStart:id=>{const part=conductorPart(id);if(canConduct()&&part){soloActor=id;conductor.soloStart(part.stemId);}},
  onSoloEnd:()=>{if(!disposed){soloActor=null;conductor?.soloEnd();}},
  onDragStart:(id,x,y)=>{scene.startDrag(id,x,y);mixer?.setSpatial?.(scene.spatial);},
  onDragMove:(id,x,y)=>{scene.moveDrag(id,x,y);mixer?.setSpatial?.(scene.spatial);frame();},
  onDragEnd:(id,options)=>{scene.endDrag(id,options);mixer?.setSpatial?.(scene.spatial);frame();}
 });
 const releaseCanvas=()=>memberInteractions.cancel();
 async function prepareConduct(data){
  if(conductScore===data&&conductTheme===state.theme)return;conductScore=data;conductTheme=state.theme;conductReady=false;conductError='';conductor=null;soloActor=null;const token=++conductRevision;
  if(!mixer)return;
  mixer.setTheme?.(state.theme);mixer.setEnabled(enabled&&!demo&&listening==='mix');
  if(!data||data.source==='demo'){await mixer.configure(null);return;}
  conductor=createBandConductor({score:data,getTime,isPlaying:()=>state.isPlayingMusic,isGroupAudible:(group,at)=>[0,.04,.08,.12].some(offset=>sampleBandEnsemble(data,parts,at+offset).parts.some(p=>p.stemId===group&&p.activity>.18)),onSchedule:(policy,at,options)=>{
   const ctx=state.audioCtx;if(ctx)mixer.setPolicy(policy,ctx.currentTime+Math.max(0,at-getTime()),options);
  }});
  conductor.setGroups(parts.filter(p=>p.stemId).map(p=>p.stemId));
  try{const preparation=mixer.configure(data);if(data.hybrid&&enabled&&!demo)restartAudio();await preparation;if(token!==conductRevision||disposed)return;mixer.setSpatial?.(scene.spatial);conductReady=true;if(enabled&&!demo)restartAudio();frame();}
  catch(error){if(token===conductRevision&&!disposed){conductError=error.name==='AbortError'?'':'声轨准备失败，保留原曲';console.warn('Band conductor:',error);if(enabled&&!demo)restartAudio();frame();}}
 }
 const controls=createBandControls($('bandArrangementControls'),{settings,getTheme:()=>state.theme,getScore:currentScore,
  onChange:(_,options)=>{if(options.rebuildParts)rebuildParts();frame();},onFocus:id=>{focus=id;frame();},onListen:monitorStem?async id=>{
   const stem=id==='mix'?{id:'mix'}:currentScore()?.stems.find(s=>s.id===id);if(!stem)throw new Error('该声部尚未接入');listening=id;conductor?.resetTransport();mixer?.setEnabled(enabled&&id==='mix');try{await monitorStem(stem);}catch(error){listening='mix';mixer?.setEnabled(enabled);await monitorStem({id:'mix'});throw error;}
  }:null});
 function rebuildParts(){parts=compileBandParts(currentScore(),state.theme,settings.overrides);partScore=bandPartScore(currentScore(),parts);controls.setParts(parts);memberInteractions.setParts(parts);conductor?.setGroups(parts.filter(p=>p.stemId).map(p=>p.stemId));prepareConduct(currentScore()).catch(console.warn);if(demo){monitorStem?.({id:'mix'}).catch(console.warn);controls.setListening('mix');}}
 async function syncTrack(){
  const track=state.playlist[state.currentTrackIndex],preferShell=settings.stageLook==='shell'&&state.theme==='one-piece',key=`${track?.type}|${track?.title||''}|${track?.src||''}|${preferShell}`;if(key===sourceKey)return;
  releaseCanvas();scene.resetPositions();sourceKey=key;controller?.abort();controller=new AbortController();const signal=controller.signal;score=null;loadError='本曲音轨与分谱尚未接入';rebuildParts();
  if(track?.isPreset){loadError=getProceduralScore()?'':'播放预设后读取生成器实际事件';if(enabled)frame();return;}
  try{
   const loaded=await loadBandAnalysis(track?.type,{signal,preferShell});if(signal.aborted)return;
   if(loaded&&await verifyBandSource(loaded,track.src,signal)){score=loaded;loadError='';}
   else if(loaded)loadError='音频与谱面源文件不匹配，请重新分析';
  }catch(error){
   if(!signal.aborted){
    console.warn('Band analysis:',error);loadError='本曲分谱无法读取；演员保持休止';
   }
  }
  if(!signal.aborted){rebuildParts();if(enabled)frame();}
 }
 async function syncScene(){if(theme===state.theme)return;theme=state.theme;focus=null;await scene.configure(theme);rebuildParts();controls.setFocus(null,false);}
 function frame(now=performance.now(),forceUi=true){
  if(!enabled||!parts.length||promoStepping)return;const data=currentScore();if(data?.source==='procedural'&&(lastProceduralScore!==data||proceduralRevision!==data.revision)){lastProceduralScore=data;proceduralRevision=data.revision;rebuildParts();}
  const uiDue=forceUi||now-lastUiSync>=32;if(uiDue){lastUiSync=now;cadence.uiSyncs++;}cadence.frames++;
  const time=clock();conductor?.tick();const conducting=conductor?.snapshot;
  const solo=conducting?.soloGroup?(parts.find(p=>p.id===soloActor&&p.stemId===conducting.soloGroup)||parts.find(p=>p.stemId===conducting.soloGroup))?.id:null;
  const sampled=sampleBandEnsemble(data,parts,time,solo||focus);
  if((data?.hybrid&&!conductReady)||(data?.rendered&&(!conductReady||!mixer?.diagnostics.ready)))for(const sample of sampled.parts){if(parts.find(p=>p.id===sample.id)?.technique==='voice')continue;for(const key of ['activity','energy','attack','notePulse'])sample[key]=0;sample.notes=[];}
  if(canConduct())for(const sample of sampled.parts){const gain=conductor.gain(sample.stemId);sample.userMuted=!gain;for(const key of ['activity','energy','attack','notePulse'])sample[key]*=gain;if(!gain)sample.notes=[];}
  for(const sample of sampled.parts)sample.idle=state.isPlayingMusic&&time<(data?.duration||0);
  const effectsFrame=stageEffectsAt(data,time,settings.effects||'auto',reduced.matches?null:conducting?.effect);
  pyroAudio.update({score:data,time,playing:state.isPlayingMusic&&!demo,enabled:settings.pyroSound!==false&&enabled&&!reduced.matches,mode:settings.effects,narrow:scene.narrow,fx:effectsFrame});if(uiDue)pyroToggle.render();
  const activeFocus=solo||focus;
  const interactiveCameraPose=activeFocus&&!reduced.matches?{focusId:activeFocus,focusMix:solo?.58:.38,zoom:solo?1.26:1.12}:null;
  scene.update(sampled,{settings,focus:activeFocus,reduced:reduced.matches,score:data,parts,easterEgg:conducting?.effect,effectsFrame,cameraPose:interactiveCameraPose});mixer?.setSpatial?.(scene.spatial);if(uiDue)controls.updateSamples(sampled);
  const section=data?.sections.find(s=>s.start<=time&&time<s.end)?.label||'';
  if(uiDue||scene.dragging)memberInteractions.update({visible:enabled&&!demo,enabled:Boolean(enabled&&!demo&&listening==='mix'),members:scene.memberProjections,
   mutedIds:parts.filter(p=>conducting?.muted.includes(p.stemId)).map(p=>p.id),soloId:solo,
   pendingIds:parts.filter(p=>conducting?.pending.includes(p.stemId)).map(p=>p.id),remainingBeats:conducting?.remainingBeats||0,
   beatsPerBar:conducting?.beatsPerBar||4,isPlaying:state.isPlayingMusic});
  const part=parts.find(p=>p.id===focus)||sampled.leadPart||parts[0];
  const playing=sampled.parts.filter(p=>p.activity>.18).length;
  if(uiDue){
  drawBandScore(scoreCanvas,partScore,sampled.time,part.id,{width:(stage.clientWidth<=600?stage.clientWidth-24:360)-24,height:72});
  const title=`${part.name} · ${demo?part.instrument:part.label}`,source=demo?'编排演示':data?part.sourceLabel:'待接入';
  if(title!==lastScoreTitle){scoreHeading.textContent=title;lastScoreTitle=title;}if(source!==lastScoreSource){scoreSource.textContent=source;lastScoreSource=source;}
  const binding=songBindingSummary(data);
  const shellPending=settings.stageLook==='shell'&&!scene.diagnostics.stage.shell?.ready;
  const nextStatus=shellPending?(scene.diagnostics.stage.shell?.error||'正在载入珍珠贝壳舞台与分层角色'):(data?.hybrid&&!conductReady)||(data?.rendered&&(!conductReady||!mixer?.diagnostics.ready))?(conductError||mixer?.diagnostics.error||'正在准备乐队 · 原曲继续播放'):demo?`编排演示 · 未绑定当前歌曲 · ${playing}/${parts.length} 演奏`:
   data?.source==='arrangement'?`${data.title} · ${section} · ${playing}/${parts.length} 演奏${data.rendered?' · 新合唱待制作':''}${conducting?.remainingBeats?` · 手动接管 ${Math.ceil(conducting.remainingBeats/conducting.beatsPerBar)} 小节`:solo?' · 临时独奏':' · 自动演出'}`:
   data?`${data.title} · ${binding.estimated?`${binding.estimated} 组家族模型估计`:`${binding.verified} 声部已核验 · ${binding.pending} 待校验`}${binding.unresolved.length?' · 其余保留原曲':''} · ${playing} 演奏`:
   loadError||'正在读取本曲分谱';
  if(nextStatus!==lastStatus){status.textContent=nextStatus;lastStatus=nextStatus;}
  }
  const rawLyric=demo?null:getLyric();
  const scoreLyric=!demo&&data?.lyrics?.length?sampleBandLyric(data,sampled.time):null;
  const lctx=typeof rawLyric==='object'&&rawLyric!==null?rawLyric:{
   activeText:typeof rawLyric==='string'&&rawLyric?rawLyric:(scoreLyric?.activeText||''),
   originalText:scoreLyric?.originalText||(typeof rawLyric==='string'?rawLyric:''),
   translatedText:scoreLyric?.translatedText||'',
   bilingual:Boolean(scoreLyric?.bilingual),
   progressInLine:scoreLyric?.progressInLine??0
  };
  const origText=lctx.originalText||lctx.activeText||'';
  const zhText=lctx.bilingual?(lctx.translatedText||lctx.secondaryText||''):(scoreLyric?.bilingual?scoreLyric.translatedText:'');
  const isBilingual=Boolean(origText&&zhText&&origText!==zhText);
  const prog=Math.max(0,Math.min(1,Number.isFinite(lctx.progressInLine)?lctx.progressInLine:(scoreLyric?.progressInLine??0)));
  if(!Number.isFinite(lastLyricProg)||Math.abs(prog-lastLyricProg)>=.002){lyric.style.setProperty('--lyric-progress',`${(prog*100).toFixed(1)}%`);lastLyricProg=prog;}
  const bilingualValue=isBilingual?'true':'false';if(lyric.dataset.bilingual!==bilingualValue)lyric.dataset.bilingual=bilingualValue;
  focusLyricText(lyricOrigEl,origText);
  focusLyricText(lyricZhEl,isBilingual?zhText:'');
  if(lyricZhEl.hidden!==!isBilingual)lyricZhEl.hidden=!isBilingual;
  const lyricHidden=!enabled||demo||!origText;if(lyric.hidden!==lyricHidden)lyric.hidden=lyricHidden;
  const combinedLyric=isBilingual?`${origText} · ${zhText}`:origText;
  lastSnapshot={time:sampled.time,trackId:data?.trackId||null,source:demo?'demo':data?'analysis':'pending',partId:part.id,formation:scene.formation,playing,lyric:combinedLyric,lyricOriginal:origText,lyricTranslated:isBilingual?zhText:'',bilingual:isBilingual,lyricProgress:prog,
   conductor:conducting?{solo:solo?parts.find(p=>p.id===solo)?.name:null,muted:conducting.muted.length,effect:conducting.effect?.label||null}:null};
 }
 function tick(now){if(disposed)return;frameId=requestAnimationFrame(tick);if(!enabled||promoStepping||document.hidden||now-lastDraw<8)return;lastDraw=now;
  if(!state.isRecording&&scene.captureActive)scene.endCapture();
  if(demo&&state.isPlayingMusic){demo=false;demoPlaying=false;$('bandDemoStart').textContent='开始编排演示';rebuildParts();}
  if(demoPlaying&&clock()>=32){demoOffset=32;demoPlaying=false;$('bandDemoStart').textContent='重播编排演示';}
  if(lastRecording!==state.isRecording){lastRecording=state.isRecording;controls.setDisabled(state.isRecording);$('bandDemoStart').disabled=state.isRecording;$('bandDemoExit').disabled=state.isRecording;}
  syncScene().catch(console.error);if(!demo)syncTrack();frame(now,false);
 }
 async function setEnabled(value){enabled=value;document.body.classList.toggle('lu-band-mode',value);scene.setActive(value);panel.hidden=!value;status.hidden=!value;interactionHost.hidden=!value||demo;mixer?.setEnabled(value&&!demo&&listening==='mix');$('bandStageSelect').value=value?'band':'matrix';$('bandControlsExtra').hidden=!value;
  pyroToggle.button.hidden=!value;if(!value)pyroAudio.stop();
  const formation=$('formationSelect');if(formation)formation.value=state.formationMode;
  if(value){await syncScene();if(!demo)await syncTrack();if(conductReady)restartAudio();frame();}else{releaseCanvas();conductor?.resetTransport();listening='mix';monitorStem?.({id:'mix'}).catch(console.warn);controls.setListening('mix');if(demoPlaying)demoOffset=clock();demoPlaying=false;lyric.hidden=true;}
 }
 $('bandStageSelect').addEventListener('change',()=>requestMode?requestMode($('bandStageSelect').value==='band'?'band':'slot'):setEnabled($('bandStageSelect').value==='band'));
 $('bandDemoStart').addEventListener('click',()=>{if(state.isRecording)return;if(state.isPlayingMusic)pauseMusic();if(demoPlaying){demoOffset=clock();demoPlaying=false;$('bandDemoStart').textContent='继续编排演示';}
  else{if(demoOffset>=32)demoOffset=0;demo=true;demoPlaying=true;demoOrigin=performance.now();$('bandDemoStart').textContent='暂停编排演示';rebuildParts();}frame();});
 $('bandDemoExit').addEventListener('click',()=>{demo=false;demoPlaying=false;demoOffset=0;$('bandDemoStart').textContent='开始编排演示';rebuildParts();frame();});
 function drawRecording(ctx){
  // One scene snapshot supplies the WebGL, score and lyric layers for this frame.
  const width=ctx.canvas.width,height=ctx.canvas.height,layout=bandRecordingLayout(width,height),sx=layout.scale,sy=sx;
  scene.setCaptureSize(width,height,layout.logicalWidth,layout.logicalHeight);
  ctx.clearRect(0,0,width,height);scene.drawTo(ctx,width,height);
  const {width:pw,x:px,y:py,height:ph}=layout.score;
  ctx.save();ctx.fillStyle='#111116ee';ctx.fillRect(px,py,pw,ph);ctx.strokeStyle='#ede2cf88';ctx.lineWidth=sx;ctx.strokeRect(px,py,pw,ph);
  ctx.fillStyle='#ede2cf';ctx.font=`${12*Math.min(sx,sy)}px sans-serif`;ctx.fillText(panel.querySelector('strong').textContent,px+12*sx,py+20*sy,pw*.64);
  ctx.textAlign='right';ctx.fillStyle='#cbbb9e';ctx.fillText(panel.querySelector('small').textContent,px+pw-12*sx,py+20*sy,pw*.36);ctx.textAlign='left';
  if(!layout.narrow)ctx.drawImage(panel.querySelector('canvas'),px+12*sx,py+30*sy,pw-24*sx,72*sy);
  else{ctx.fillStyle='#cbbb9e';ctx.font=`${9*sx}px sans-serif`;ctx.fillText('演奏声部',px+12*sx,py+34*sy,80*sx);
   drawBandPulse(ctx,partScore,lastSnapshot?.time||0,lastSnapshot?.partId,{x:px+100*sx,y:py+25*sy,width:pw-112*sx,height:13*sy,scale:sx});}
  ctx.fillStyle='#111116cc';ctx.fillRect(0,height-48*sy,width,48*sy);ctx.fillStyle='#ede2cf';ctx.font=`${11*Math.min(sx,sy)}px sans-serif`;ctx.fillText(status.textContent,12*sx,height-14*sy,width-24*sx);
  if(lastSnapshot?.conductor){const c=lastSnapshot.conductor,text=c.effect||`指挥 · ${c.solo?`${c.solo}临时主奏`:`${c.muted}组休止`}`;ctx.textAlign='left';ctx.font=`${11*Math.min(sx,sy)}px sans-serif`;ctx.fillStyle='#111116e8';ctx.fillRect(px,py+ph+4*sy,Math.min(pw,ctx.measureText(text).width+24*sx),25*sy);ctx.fillStyle='#ede2cf';ctx.fillText(text,px+12*sx,py+ph+21*sy,pw-24*sx);}
  if(lastSnapshot?.lyricOriginal){
   ctx.textAlign='center';
   if(lastSnapshot.bilingual&&lastSnapshot.lyricTranslated){
    ctx.fillStyle='#fff4dc';ctx.font=`500 ${18*Math.min(sx,sy)}px sans-serif`;
    ctx.fillText(lastSnapshot.lyricOriginal,width/2,height-80*sy,width-24*sx);
    ctx.fillStyle='#d6e8f5';ctx.font=`500 ${14*Math.min(sx,sy)}px sans-serif`;
    ctx.fillText(lastSnapshot.lyricTranslated,width/2,height-56*sy,width-24*sx);
   }else{
    ctx.fillStyle='#ede2cf';ctx.font=`${20*Math.min(sx,sy)}px sans-serif`;
    ctx.fillText(lastSnapshot.lyricOriginal,width/2,height-62*sy,width-24*sx);
   }
  }ctx.restore();
 }
 async function renderPromoFrame({time=0,theme:nextTheme=null,score:customScore=null,formation=null,mutedStems=[],soloStem=null,soloActorId=null,effects='auto',easterEgg=null,cameraPose=null}={}){
  promoStepping=true;
  if(!enabled){enabled=true;document.body.classList.toggle('lu-band-mode',true);scene.setActive(true);}
  panel.hidden=true;status.hidden=true;lyric.hidden=true;interactionHost.hidden=true;pyroToggle.button.hidden=true;
  if(nextTheme&&nextTheme!==theme){state.theme=nextTheme;theme=nextTheme;await scene.configure(theme);parts=compileBandParts(customScore||currentScore()||score,theme,settings.overrides);}
  const data=customScore||currentScore()||score;
  if(data&&(!parts.length||parts[0]?.id?.split('/')[0]!==theme))parts=compileBandParts(data,theme,settings.overrides);
  const activeFocus=soloActorId||null;
  const sampled=sampleBandEnsemble(data,parts,time,activeFocus);
  for(const sample of sampled.parts){
   const isMuted=mutedStems.includes(sample.stemId);
   const isSoloed=Boolean(soloStem&&sample.stemId===soloStem);
   const isDuck=Boolean(soloStem&&sample.stemId!==soloStem);
   sample.userMuted=isMuted;sample.idle=true;
   if(isMuted){for(const key of ['activity','energy','attack','notePulse'])sample[key]=0;sample.notes=[];}
   else if(isDuck){for(const key of ['activity','energy','attack','notePulse'])sample[key]*=.22;}
   else if(isSoloed){sample.activity=Math.min(1,Math.max(.84,sample.activity*1.35));sample.energy=Math.min(1,Math.max(.82,sample.energy*1.30));sample.lead=true;}
  }
  const frameSettings={...settings,formation:formation||settings.formation,effects:effects||settings.effects,lightMode:'multi',contrast:true};
  const effectsFrame=stageEffectsAt(data,time,frameSettings.effects,easterEgg);
  scene.update(sampled,{settings:frameSettings,focus:activeFocus,reduced:false,score:data,parts,easterEgg,effectsFrame,cameraPose});
  return scene.diagnostics;
 }
 requestAnimationFrame(tick);
 return {setEnabled,drawRecording,renderPromoFrame,setCaptureSize:(w,h,lw,lh)=>scene.setCaptureSize(w,h,lw,lh),endCapture:()=>{promoStepping=false;scene.endCapture();},resetTransport(options){releaseCanvas();pyroAudio.stop();conductor?.resetTransport(options);},resetPerformance(){releaseCanvas();pyroAudio.stop();conductor?.restartPerformance();},get enabled(){return enabled;},get canvas(){return scene.canvas;},get diagnostics(){return {...scene.diagnostics,cadence:{...cadence},pyroAudio:pyroAudio.diagnostics,enabled,source:currentScore()?.source||'pending',trackId:currentScore()?.trackId,selectionKey:sourceKey,arrangementVersion:currentScore()?.arrangement?.version,time:clock(),focus,settings,binding:songBindingSummary(currentScore()),conductor:conductor?{...conductor.snapshot,ready:conductReady,error:conductError,audio:mixer?.diagnostics}:null,parts:parts.map(p=>({id:p.id,stem:p.stemId,events:p.events.length,bindingStatus:p.bindingStatus,partId:p.partId,instrumentId:p.instrumentId,shared:p.shared,technique:p.technique})),snapshot:lastSnapshot,loadError};},
  dispose(){disposed=true;releaseCanvas();pyroAudio.dispose();pyroToggle.dispose();++conductRevision;controller?.abort();cancelAnimationFrame(frameId);memberInteractions.dispose();mixer?.dispose();scoreDisclosure.dispose();scene.dispose();host.remove();panel.remove();status.remove();lyric.remove();interactionHost.remove();}};
}
