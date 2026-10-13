import { instrumentById, instrumentsForTheme } from '../avatar/instrument-manifest.js';

// Fixed design examples: none of these events are derived from the playing song.
const EXAMPLE_NOTES = [[0,60,1],[1,64,.5],[1.5,67,.5],[2,65,1],[3,62,1]];
export function drawScore(canvas, { family='melody', demo=false, accent='#d0ad80' } = {}) {
  const rect=canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio=Math.min(devicePixelRatio || 1,2);
  canvas.width=Math.round(rect.width*ratio); canvas.height=Math.round(rect.height*ratio);
  const ctx=canvas.getContext('2d'); ctx.scale(ratio,ratio);
  const w=rect.width,h=rect.height, left=18,right=w-12;
  ctx.strokeStyle=demo ? '#ede2cf55':'#ede2cf18'; ctx.lineWidth=1;
  const line=y=>{ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();};
  if (!demo || family==='melody') {
    const y0=Math.max(17,(h-30)/2),gap=6;
    for(let i=0;i<5;i++) line(y0+i*gap);
    if (!demo) return;
    ctx.fillStyle=accent; ctx.strokeStyle=accent; ctx.lineWidth=1.8;
    for(const [time,note] of EXAMPLE_NOTES) {
      const staffStep={60:-2,62:-1,64:0,65:1,67:2}[note];
      const x=left+18+time*(w-65)/4, y=y0+24-staffStep*3;
      ctx.beginPath();ctx.ellipse(x,y,4.5,3,-.35,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(x+4,y);ctx.lineTo(x+4,y-21);ctx.stroke();
      if(note===60) {ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.stroke();}
    }
  } else if (family==='polyphonic') {
    const y0=15, rows=6, step=Math.max(5,(h-26)/rows);
    for(let i=0;i<=rows;i++) line(y0+i*step);
    for(let beat=0;beat<=4;beat++) {const x=left+beat*(right-left)/4;ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,h-10);ctx.stroke();}
    ctx.fillStyle=accent;
    for(const [time,note,length] of EXAMPLE_NOTES) {
      const x=left+time*(right-left)/4,y=y0+(7-(note-60))*step*.6;
      ctx.fillRect(x+2,y,Math.max(6,length*(right-left)/4-4),Math.max(3,step*.65));
      if(time===0||time===2)ctx.fillRect(x+2,y+step*1.7,Math.max(6,length*(right-left)/4-4),Math.max(3,step*.65));
    }
  } else {
    const rows=['高','中','低'],step=Math.max(9,(h-26)/3);
    ctx.font='10px sans-serif';ctx.fillStyle='#cbbb9e';
    rows.forEach((label,i)=>{const y=15+i*step;line(y);ctx.fillText(label,0,y+3);});
    for(let i=0;i<8;i++) {const x=left+8+i*(right-left-16)/8;ctx.strokeStyle='#ede2cf25';ctx.beginPath();ctx.moveTo(x,7);ctx.lineTo(x,h-8);ctx.stroke();}
    ctx.fillStyle=accent;
    for(const [beat,row] of [[0,2],[1,0],[2,1],[3,0],[4,2],[5,0],[6,1],[7,0]])ctx.fillRect(left+4+beat*(right-left-16)/8,11+row*step,7,7);
  }
}

export function createScorePanel(stage, { getTheme=()=>document.body.dataset.luTheme || 'one-piece' }={}) {
  const panel=document.createElement('section'); panel.id='luScorePanel'; panel.className='lu-score-panel';
  panel.setAttribute('aria-label','乐谱'); panel.dataset.size='compact';
  panel.innerHTML='<div class="lu-score-heading"><span class="lu-score-title"></span><span class="lu-score-status">待接入</span><button type="button" class="lu-score-size" aria-label="展开乐谱" aria-expanded="false">↗</button><button type="button" class="lu-score-collapse" aria-label="收起乐谱">−</button></div><div class="lu-score-content"><canvas role="img" aria-label="空谱线，待接入声部与乐谱"></canvas><p class="lu-score-message">待接入声部与乐谱</p></div>';
  stage.append(panel);
  const canvas=panel.querySelector('canvas'), roleSelect=document.querySelector('#scoreRoleSelect');
  const enabledControl=document.querySelector('#scoreVisibleToggle'),demoControl=document.querySelector('#scoreDemoToggle');
  let enabled=true,demo=false,requestedSize='compact',theme='',role,layoutFrame=0;
  const refreshTheme=()=>{
    if(theme===getTheme())return;
    theme=getTheme(); const roles=instrumentsForTheme(theme); role=roles[0];
    if(roleSelect) {roleSelect.replaceChildren(...roles.map(item=>new Option(`${item.name} · ${item.instrument}`,item.id)));roleSelect.value=role.id;}
    const link=document.querySelector('#instrumentStudyLink');if(link)link.href=`./instrument-study.html?theme=${encodeURIComponent(theme)}`;
  };
  const render=()=>{
    refreshTheme(); if(!role)return;
    panel.querySelector('.lu-score-title').textContent=panel.dataset.size==='collapsed' ? '乐谱 · '+(demo?'演示谱':'待接入') : `${role.name} · ${role.instrument}`;
    panel.querySelector('.lu-score-status').textContent=demo?'演示谱':'待接入';
    panel.querySelector('.lu-score-content').dataset.demo=String(demo);
    canvas.setAttribute('aria-label',demo?`${role.name}的${role.family==='percussion'?'打击网格':role.family==='polyphonic'?'钢琴卷帘':'五线谱'}演示，非当前歌曲`:'空谱线，待接入声部与乐谱');
    panel.querySelector('.lu-score-size').setAttribute('aria-expanded',String(panel.dataset.size==='expanded'));
    const locked=panel.dataset.locked==='true',sizeButton=panel.querySelector('.lu-score-size');
    sizeButton.disabled=locked;
    sizeButton.setAttribute('aria-label',locked?'重力模式暂以收起态展示':panel.dataset.size==='expanded'?'缩小乐谱':'展开乐谱');
    sizeButton.title=locked?'重力模式暂以收起态展示':'调整乐谱大小';
    sizeButton.textContent=locked?'—':panel.dataset.size==='expanded'?'↙':'↗';
    drawScore(canvas,{family:role.family,demo,accent:role.accent});
  };
  const layout=()=>{
    layoutFrame=0;
    const intro=document.querySelector('#luIntroOverlay');
    panel.hidden=!enabled || !!(intro && !intro.hidden && getComputedStyle(intro).display!=='none' && !intro.classList.contains('is-done'));
    const rect=stage.getBoundingClientRect(); let size=rect.height<360?'collapsed':requestedSize;
    let top=innerWidth<=600?12:16;
    if(document.body.classList.contains('immersive')){
      const capsule=document.querySelector('#performanceCapsule')?.getBoundingClientRect();
      if(capsule && capsule.bottom>rect.top)top=Math.max(top,capsule.bottom-rect.top+12);
    }
    panel.style.setProperty('--score-top',`${top}px`);
    // Until assembly adds stable lyric projection geometry, gravity reserves its
    // upper half for moving words. This conservative strip cannot cover that area.
    const gravity=window.kineticLyricsManager?.mode==='gravity';
    const link=document.querySelector('#instrumentStudyLink');
    if(link)link.href=`./instrument-study.html?theme=${encodeURIComponent(getTheme())}&mode=${gravity?'gravity':'mechanical'}`;
    panel.dataset.locked=String(gravity);
    if(gravity)size='collapsed';
    panel.dataset.size=size; render();
  };
  const schedule=()=>{if(!layoutFrame)layoutFrame=requestAnimationFrame(layout);};
  panel.querySelector('.lu-score-size').addEventListener('click',()=>{requestedSize=panel.dataset.size==='expanded'?'compact':panel.dataset.size==='collapsed'?'compact':'expanded';schedule();});
  panel.querySelector('.lu-score-collapse').addEventListener('click',()=>{requestedSize='collapsed';schedule();});
  enabledControl?.addEventListener('change',()=>{enabled=enabledControl.checked;schedule();});
  demoControl?.addEventListener('change',()=>{demo=demoControl.checked;schedule();});
  roleSelect?.addEventListener('change',()=>{role=instrumentById(roleSelect.value);render();});
  const bodyObserver=new MutationObserver(schedule);bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class','data-lu-theme']});
  const intro=document.querySelector('#luIntroOverlay');if(intro)bodyObserver.observe(intro,{attributes:true,attributeFilter:['hidden','class','style']});
  const resize=new ResizeObserver(schedule);resize.observe(stage); window.addEventListener('resize',schedule);
  document.querySelector('#kineticModeSwitcher')?.addEventListener('click',schedule);
  schedule();
  return {panel,refresh:schedule,destroy(){bodyObserver.disconnect();resize.disconnect();window.removeEventListener('resize',schedule);panel.remove();if(layoutFrame)cancelAnimationFrame(layoutFrame);}};
}

if(document.querySelector('#scoreVisibleToggle')) {
  const boot=()=>{const stage=document.querySelector('#stageWrap');if(stage)window.luScorePanel=createScorePanel(stage);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
