import {createBandScene} from './band-scene.js';
import {createBandDemoScore} from '../audio/band-timeline.js';
import {compileBandParts,sampleBandEnsemble,bandPartScore,bandRoster} from '../audio/band-parts.js';
import {loadBandAnalysis,verifyBandSource,synthesizeBandScoreForTrack} from '../audio/band-library.js';
import {sampleBandLyric} from '../audio/band-cues.js';
import {loadBandSettings} from './band-settings.js';
import {createBandControls} from './band-controls.js';
import {drawBandScore,drawBandPulse} from './band-score.js';
import {bandRecordingLayout} from './band-recording-layout.js';
import {setupBandScoreDisclosure} from './band-score-disclosure.js';

export async function createBandController({stage,state,getTime,getLyric=()=>'',getTrackLyrics=null,pauseMusic=()=>{},monitorStem=null,cubeDesign=null,requestMode=null}){
 const $=id=>document.getElementById(id),host=document.createElement('div');host.className='lu-band-scene';host.hidden=true;stage.append(host);
 const panel=document.createElement('section');panel.className='lu-band-score';panel.hidden=true;panel.setAttribute('aria-label','乐队分谱');panel.innerHTML='<div class="lu-band-score-heading"><strong>主旋律</strong><small>待接入</small></div><canvas role="img" aria-label="乐队成员分谱"></canvas>';stage.append(panel);
 const scoreDisclosure=setupBandScoreDisclosure(panel);
 const status=document.createElement('div');status.className='lu-band-status';status.hidden=true;stage.append(status);
 const lyric=document.createElement('p');lyric.className='lu-band-lyric';lyric.hidden=true;
 lyric.innerHTML='<span class="lu-band-lyric-orig"></span><span class="lu-band-lyric-zh" hidden></span>';
 stage.append(lyric);
 const lyricOrigEl=lyric.querySelector('.lu-band-lyric-orig'),lyricZhEl=lyric.querySelector('.lu-band-lyric-zh');
 const scene=await createBandScene(host,{safeTop:130,safeBottom:85,cubeDesign}),reduced=matchMedia('(prefers-reduced-motion:reduce)'),settings=loadBandSettings();
 let enabled=false,score=null,sourceKey='',controller=null,theme='',focus=null,demo=false,demoPlaying=false,demoOffset=0,demoOrigin=0,frameId,lastDraw=0,loadError='',disposed=false,parts=[],partScore=null,lastSnapshot=null,lastRecording=null;
 const demoScore=createBandDemoScore(),currentScore=()=>demo?demoScore:score;
 const clock=()=>demo?(demoPlaying?Math.min(32,demoOffset+(performance.now()-demoOrigin)/1000):demoOffset):getTime();
 const controls=createBandControls($('bandArrangementControls'),{settings,getTheme:()=>state.theme,getScore:currentScore,
  onChange:(_,options)=>{if(options.rebuildParts)rebuildParts();frame();},onFocus:id=>{focus=id;frame();},onListen:monitorStem?async id=>{
   const stem=id==='mix'?{id:'mix'}:currentScore()?.stems.find(s=>s.id===id);if(!stem)throw new Error('该声部尚未接入');try{await monitorStem(stem);}catch(error){await monitorStem({id:'mix'});throw error;}
  }:null});
 scene.canvas.addEventListener('band-member-select',event=>controls.setFocus(event.detail));
 function rebuildParts(){parts=compileBandParts(currentScore(),state.theme,settings.overrides);partScore=bandPartScore(currentScore(),parts);controls.setParts(parts);if(demo){monitorStem?.({id:'mix'}).catch(console.warn);controls.setListening('mix');}}
 async function syncTrack(){
  const track=state.playlist[state.currentTrackIndex],key=`${track?.type}|${track?.title||''}|${track?.src||''}|${Boolean(track?.buffer)}`;if(key===sourceKey)return;
  sourceKey=key;controller?.abort();controller=new AbortController();const signal=controller.signal;score=null;loadError='本曲音轨与分谱尚未接入';rebuildParts();
  try{
   const loaded=await loadBandAnalysis(track?.type,{signal});if(signal.aborted)return;
   if(loaded&&await verifyBandSource(loaded,track.src,signal)){score=loaded;loadError='';}
   else{
    const fallbackLyrics=getTrackLyrics?getTrackLyrics(track):(track?.lyrics||[]);
    const synthesized=synthesizeBandScoreForTrack(track,{lyrics:fallbackLyrics,translatedLyrics:track?.translatedLyrics||[],theme:state.theme});
    if(synthesized){score=synthesized;loadError='';}
    else if(loaded)loadError='音频与谱面源文件不匹配，请重新分析';
   }
  }catch(error){
   if(!signal.aborted){
    const fallbackLyrics=getTrackLyrics?getTrackLyrics(track):(track?.lyrics||[]);
    const synthesized=synthesizeBandScoreForTrack(track,{lyrics:fallbackLyrics,translatedLyrics:track?.translatedLyrics||[],theme:state.theme});
    if(synthesized){score=synthesized;loadError='';}
    else{console.warn('Band analysis:',error);loadError='本曲分谱无法读取';}
   }
  }
  if(!signal.aborted){rebuildParts();if(enabled)frame();}
 }
 async function syncScene(){if(theme===state.theme)return;theme=state.theme;focus=null;await scene.configure(theme);rebuildParts();controls.setFocus(null,false);}
 function frame(){
  if(!enabled||!parts.length)return;const data=currentScore(),time=clock(),sampled=sampleBandEnsemble(data,parts,time,focus);
  scene.update(sampled,{settings,focus,reduced:reduced.matches,score:data,parts});controls.updateSamples(sampled);
  const part=parts.find(p=>p.id===focus)||sampled.leadPart||parts[0];
  drawBandScore(panel.querySelector('canvas'),partScore,sampled.time,part.id,{width:(stage.clientWidth<=600?stage.clientWidth-24:360)-24,height:72});
  panel.querySelector('strong').textContent=`${part.name} · ${part.instrument}`;panel.querySelector('small').textContent=demo?'编排演示':data?(part.shared||part.stemId==='other'?'共享音轨 · 编配':'自动转写 · 待校谱'):'待接入';
  const playing=sampled.parts.filter(p=>p.activity>.18).length;
  status.textContent=demo?`编排演示 · 未绑定当前歌曲 · ${playing}/${parts.length} 演奏`:
   data?`${data.title} · ${parts.length} 成员 · ${playing} 演奏 · 自动编配`:
   loadError||'正在读取本曲分谱';
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
  lyric.style.setProperty('--lyric-progress',`${(prog*100).toFixed(1)}%`);
  lyric.dataset.bilingual=isBilingual?'true':'false';
  if(lyricOrigEl.textContent!==origText)lyricOrigEl.textContent=origText;
  if(lyricZhEl.textContent!==(isBilingual?zhText:''))lyricZhEl.textContent=isBilingual?zhText:'';
  lyricZhEl.hidden=!isBilingual;
  lyric.hidden=!enabled||demo||!origText;
  const combinedLyric=isBilingual?`${origText} · ${zhText}`:origText;
  lastSnapshot={time:sampled.time,trackId:data?.trackId||null,source:demo?'demo':data?'analysis':'pending',partId:part.id,formation:scene.formation,playing,lyric:combinedLyric,lyricOriginal:origText,lyricTranslated:isBilingual?zhText:'',bilingual:isBilingual,lyricProgress:prog};
 }
 function tick(now){if(disposed)return;frameId=requestAnimationFrame(tick);if(!enabled||document.hidden||now-lastDraw<33)return;lastDraw=now;
  if(!state.isRecording&&scene.captureActive)scene.endCapture();
  if(demo&&state.isPlayingMusic){demo=false;demoPlaying=false;$('bandDemoStart').textContent='开始编排演示';rebuildParts();}
  if(demoPlaying&&clock()>=32){demoOffset=32;demoPlaying=false;$('bandDemoStart').textContent='重播编排演示';}
  if(lastRecording!==state.isRecording){lastRecording=state.isRecording;controls.setDisabled(state.isRecording);$('bandDemoStart').disabled=state.isRecording;$('bandDemoExit').disabled=state.isRecording;}
  syncScene().catch(console.error);if(!demo)syncTrack();frame();
 }
 async function setEnabled(value){enabled=value;document.body.classList.toggle('lu-band-mode',value);scene.setActive(value);panel.hidden=!value;status.hidden=!value;$('bandStageSelect').value=value?'band':'matrix';$('bandControlsExtra').hidden=!value;
  const formation=$('formationSelect');if(formation)formation.value=state.formationMode;
  if(value){await syncScene();if(!demo)await syncTrack();frame();}else{monitorStem?.({id:'mix'}).catch(console.warn);controls.setListening('mix');if(demoPlaying)demoOffset=clock();demoPlaying=false;lyric.hidden=true;}
 }
 $('bandStageSelect').addEventListener('change',()=>requestMode?requestMode($('bandStageSelect').value==='band'?'band':'slot'):setEnabled($('bandStageSelect').value==='band'));
 $('bandDemoStart').addEventListener('click',()=>{if(state.isRecording)return;if(state.isPlayingMusic)pauseMusic();if(demoPlaying){demoOffset=clock();demoPlaying=false;$('bandDemoStart').textContent='继续编排演示';}
  else{if(demoOffset>=32)demoOffset=0;demo=true;demoPlaying=true;demoOrigin=performance.now();$('bandDemoStart').textContent='暂停编排演示';rebuildParts();}frame();});
 $('bandDemoExit').addEventListener('click',()=>{demo=false;demoPlaying=false;demoOffset=0;$('bandDemoStart').textContent='开始编排演示';rebuildParts();frame();});
 function drawRecording(ctx){
  // One scene snapshot supplies the WebGL, score and lyric layers for this frame.
  const width=ctx.canvas.width,height=ctx.canvas.height,layout=bandRecordingLayout(width,height),sx=layout.scale,sy=sx;
  scene.setCaptureSize(width,height,layout.logicalWidth,layout.logicalHeight);
  ctx.clearRect(0,0,width,height);ctx.drawImage(scene.canvas,0,0,width,height);
  const {width:pw,x:px,y:py,height:ph}=layout.score;
  ctx.save();ctx.fillStyle='#111116ee';ctx.fillRect(px,py,pw,ph);ctx.strokeStyle='#ede2cf88';ctx.lineWidth=sx;ctx.strokeRect(px,py,pw,ph);
  ctx.fillStyle='#ede2cf';ctx.font=`${12*Math.min(sx,sy)}px sans-serif`;ctx.fillText(panel.querySelector('strong').textContent,px+12*sx,py+20*sy,pw*.64);
  ctx.textAlign='right';ctx.fillStyle='#cbbb9e';ctx.fillText(panel.querySelector('small').textContent,px+pw-12*sx,py+20*sy,pw*.36);ctx.textAlign='left';
  if(!layout.narrow)ctx.drawImage(panel.querySelector('canvas'),px+12*sx,py+30*sy,pw-24*sx,72*sy);
  else{ctx.fillStyle='#cbbb9e';ctx.font=`${9*sx}px sans-serif`;ctx.fillText('演奏声部',px+12*sx,py+34*sy,80*sx);
   drawBandPulse(ctx,partScore,lastSnapshot?.time||0,lastSnapshot?.partId,{x:px+100*sx,y:py+25*sy,width:pw-112*sx,height:13*sy,scale:sx});}
  ctx.fillStyle='#111116cc';ctx.fillRect(0,height-48*sy,width,48*sy);ctx.fillStyle='#ede2cf';ctx.font=`${11*Math.min(sx,sy)}px sans-serif`;ctx.fillText(status.textContent,12*sx,height-14*sy,width-24*sx);
  if(lastSnapshot?.lyricOriginal){
   ctx.textAlign='center';
   if(lastSnapshot.bilingual&&lastSnapshot.lyricTranslated){
    ctx.fillStyle='#fff4dc';ctx.font=`600 ${18*Math.min(sx,sy)}px sans-serif`;
    ctx.fillText(lastSnapshot.lyricOriginal,width/2,height-80*sy,width-24*sx);
    ctx.fillStyle='#d6e8f5';ctx.font=`500 ${14*Math.min(sx,sy)}px sans-serif`;
    ctx.fillText(lastSnapshot.lyricTranslated,width/2,height-56*sy,width-24*sx);
   }else{
    ctx.fillStyle='#ede2cf';ctx.font=`${20*Math.min(sx,sy)}px sans-serif`;
    ctx.fillText(lastSnapshot.lyricOriginal,width/2,height-62*sy,width-24*sx);
   }
  }ctx.restore();
 }
 requestAnimationFrame(tick);
 return {setEnabled,drawRecording,get enabled(){return enabled;},get canvas(){return scene.canvas;},get diagnostics(){return {...scene.diagnostics,enabled,source:demo?'demo':score?'analysis':'pending',trackId:score?.trackId,time:clock(),focus,settings,parts:parts.map(p=>({id:p.id,stem:p.stemId,events:p.events.length,shared:p.shared,technique:p.technique})),snapshot:lastSnapshot,loadError};},
  dispose(){disposed=true;controller?.abort();cancelAnimationFrame(frameId);scoreDisclosure.dispose();scene.dispose();host.remove();panel.remove();status.remove();lyric.remove();}};
}
