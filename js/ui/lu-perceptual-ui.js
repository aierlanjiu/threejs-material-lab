import {stepSpring, SPRINGS} from './perceptual-math.js';
import {haptic} from './motion-adapter.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function spring(initial, draw, parameters = SPRINGS.panel) {
  let state = {value: initial, velocity: 0}, target = initial, frame = 0, last = 0;
  function tick(now) {
    const dt = Math.max(0, (now - last) / 1000); last = now;
    state = stepSpring(state, target, dt, parameters);
    if (Math.abs(state.value - target) < .001 && Math.abs(state.velocity) < .005) {
      state = {value: target, velocity: 0}; frame = 0; draw(target, true); return;
    }
    draw(state.value, false); frame = requestAnimationFrame(tick);
  }
  return { set(value) {
    target = value;
    if (reduced.matches) { cancelAnimationFrame(frame); frame = 0; state = {value, velocity: 0}; draw(value, true); }
    else if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
  }, reset(value) { cancelAnimationFrame(frame); frame=0;target=value;state={value,velocity:0}; }, stop() { cancelAnimationFrame(frame); frame = 0; } };
}

export function focusLyricText(el, text) {
  if (!el || el.textContent === text) return;
  el.textContent = text;
  el.getAnimations().forEach(a => { if (a.id === 'lu-lyric-focus') a.cancel(); });
  if (text && !reduced.matches) {
    const a = el.animate([{opacity:.3,filter:'blur(2.5px)',transform:'translateY(3px)'},{opacity:1,filter:'blur(0px)',transform:'translateY(0)'}], {duration:180,easing:'cubic-bezier(.16,1,.3,1)'});
    a.id = 'lu-lyric-focus';
  }
}

export function installPerceptualUI({isPlaying = () => false} = {}) {
  document.documentElement.classList.add('lu-perceptual-ui');
  const cleanups = [], presses = new Map(), pointers = new Map();
  const selector = '.lu-apple-icon-btn,.lu-apple-play-btn,#luAppleOrbBtn,.kinetic-mode-btn,.lue-facet-tab';
  function press(button, value) {
    if (!button || button.disabled) return;
    const face = button.querySelector('svg,.face');
    if (!face) return;
    if (!presses.has(face)) presses.set(face, spring(1, v => { face.style.scale = String(v); }, SPRINGS.button));
    presses.get(face).set(value);
  }
  const down = e => { const b = e.target.closest(selector); if (e.button === 0 && b) { pointers.set(e.pointerId, b); press(b, .92); } };
  const up = e => { press(pointers.get(e.pointerId), 1); pointers.delete(e.pointerId); };
  const key = e => { if (['Enter',' '].includes(e.key) && !e.repeat) press(e.target.closest(selector), e.type === 'keydown' ? .92 : 1); };
  document.addEventListener('pointerdown', down); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  document.addEventListener('keydown', key); document.addEventListener('keyup', key);
  const release = () => { for (const b of pointers.values()) press(b, 1); pointers.clear(); for (const p of presses.values()) p.set(1); };
  window.addEventListener('blur', release);
  cleanups.push(() => { document.removeEventListener('pointerdown', down); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); document.removeEventListener('keydown', key); document.removeEventListener('keyup', key); window.removeEventListener('blur', release); for (const p of presses.values()) p.stop(); });

  // Observe only actual scroll containers. Recalculate after content/viewport changes.
  for (const el of document.querySelectorAll('#applePlaylistList,#avatarPresetGrid,.lue-facet-panels')) {
    el.classList.add('lu-scroll-feather');
    let pending = 0;
    const update = () => { pending = 0; const max = el.scrollHeight - el.clientHeight;
      el.style.setProperty('--lu-fade-top', `${max > 2 && el.scrollTop > 2 ? 22 : 0}px`);
      el.style.setProperty('--lu-fade-bottom', `${max > 2 && el.scrollTop < max - 2 ? 22 : 0}px`);
    };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(update); };
    const ro = new ResizeObserver(schedule), mo = new MutationObserver(schedule);
    ro.observe(el); mo.observe(el, {childList:true,subtree:true,characterData:true});
    el.addEventListener('scroll', schedule, {passive:true});
    const focus = e => { if (e.target !== el) { e.target.scrollIntoView({block:'nearest'}); schedule(); } };
    el.addEventListener('focusin', focus); schedule();
    cleanups.push(() => { cancelAnimationFrame(pending); ro.disconnect(); mo.disconnect(); el.removeEventListener('scroll', schedule); el.removeEventListener('focusin', focus); });
  }

  // Animate the dock's real dimensions; interrupted expansion keeps spring velocity.
  const dock = document.querySelector('#luAppleDock');
  if (dock) {
    let last = dock.getBoundingClientRect(), animating = false;
    const finish = () => { dock.style.removeProperty('width'); dock.style.removeProperty('height'); animating = false; last = dock.getBoundingClientRect(); };
    let doneW = true, doneH = true;
    const width = spring(last.width, (v, done) => { dock.style.width = `${v}px`; doneW = done; if (doneW && doneH) finish(); });
    const height = spring(last.height, (v, done) => { dock.style.height = `${v}px`; doneH = done; if (doneW && doneH) finish(); });
    const change = records => {
      if (!records.some(r => r.attributeName === 'data-dock-state')) return;
      const current = dock.getBoundingClientRect();
      dock.style.removeProperty('width'); dock.style.removeProperty('height'); const target = dock.getBoundingClientRect();
      if (reduced.matches) { last = target; return; }
      dock.style.width = `${animating ? current.width : last.width}px`; dock.style.height = `${animating ? current.height : last.height}px`; doneW = doneH = false; animating = true;
      width.set(target.width); height.set(target.height);
    };
    const mo = new MutationObserver(change); mo.observe(dock, {attributes:true,attributeFilter:['data-dock-state']});
    const resize = () => { width.stop(); height.stop(); finish();width.reset(last.width);height.reset(last.height); }; window.addEventListener('resize', resize);
    cleanups.push(() => { mo.disconnect(); width.stop(); height.stop(); window.removeEventListener('resize', resize); });
  }
  for(const el of document.querySelectorAll('#lueCoreDrawer,#applePlaylistPopover,#appleRecordPopover')) {
    const p=spring(el.hidden?.97:1,value=>{el.style.scale=String(value);});
    const mo=new MutationObserver(()=>p.set(el.hidden?.97:1));mo.observe(el,{attributes:true,attributeFilter:['hidden']});
    if(el.hidden)el.style.scale='.97';
    cleanups.push(()=>{mo.disconnect();p.stop();el.style.removeProperty('scale');});
  }

  // Existing synthesizer, one explicit preference, and no extra click sounds during playback.
  const toolbar = document.querySelector('#lueCoreDrawer .lue-facet-panels');
  if (toolbar) {
    const row = document.createElement('label'); row.className = 'lu-ui-sound-setting';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !haptic.muted;
    row.append(input, document.createTextNode('界面轻音效')); toolbar.append(row);
    input.addEventListener('change', () => { haptic.toggleMute(!input.checked); if (input.checked) haptic.click('soft'); });
    const sound = e => { if (e.target.closest('#luAppleOrbBtn,#appleOrderModeBtn') && !isPlaying()) haptic.click('soft'); };
    document.addEventListener('click', sound); cleanups.push(() => { document.removeEventListener('click', sound); row.remove(); });
  }
  const title = document.querySelector('.lu-apple-track-title');
  if (title) {
    const sheen = () => { title.classList.remove('lu-track-sheen'); requestAnimationFrame(() => title.classList.add('lu-track-sheen')); };
    const mo = new MutationObserver(sheen); mo.observe(title, {childList:true,characterData:true,subtree:true});
    cleanups.push(() => mo.disconnect());
  }
  const scrub = document.querySelector('#appleScrubInput');
  if (scrub) {
    let gesture = null;
    const write = (value, type='input') => { scrub.value=String(value); scrub.dispatchEvent(new Event(type,{bubbles:true})); };
    const seek = e => { const g=gesture,min=Number(scrub.min),max=Number(scrub.max),step=Number(scrub.step)||.1;
      const value=min+Math.max(0,Math.min(1,(e.clientX-g.rect.left-6)/Math.max(1,g.rect.width-12)))*(max-min);
      write(Math.round(value/step)*step);
    };
    const down = e => { if(e.button!==0||scrub.disabled||gesture)return;e.preventDefault();scrub.focus({preventScroll:true});scrub.setPointerCapture(e.pointerId);
      gesture={id:e.pointerId,x:e.clientX,y:e.clientY,value:Number(scrub.value),rect:scrub.getBoundingClientRect(),moved:false};
    };
    const move = e => { if(gesture?.id!==e.pointerId)return;const g=gesture;if(!g.moved&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<4)return;g.moved=true;seek(e); };
    const end = e => { if(gesture?.id!==e.pointerId)return;const g=gesture;
      if(e.type==='pointercancel'){if(g.moved){write(g.value);write(g.value,'change');}}
      else {const thumb=g.rect.left+6+(g.value-Number(scrub.min))/(Number(scrub.max)-Number(scrub.min))*(g.rect.width-12);
        if(g.moved||Math.abs(g.x-thumb)>9){seek(e);write(Number(scrub.value),'change');}}
      gesture=null;try{scrub.releasePointerCapture(e.pointerId);}catch{}
    };
    scrub.addEventListener('pointerdown',down);scrub.addEventListener('pointermove',move);scrub.addEventListener('pointerup',end);scrub.addEventListener('pointercancel',end);
    cleanups.push(()=>{scrub.removeEventListener('pointerdown',down);scrub.removeEventListener('pointermove',move);scrub.removeEventListener('pointerup',end);scrub.removeEventListener('pointercancel',end);});
  }
  return () => cleanups.forEach(fn => fn());
}
