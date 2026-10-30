import {stepSpring, SPRINGS} from './perceptual-math.js';
import {haptic} from './motion-adapter.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const hermit = t => t * t * (3 - 2 * t);
let stageTransitionTimer=0;
export function runStageViewTransition(callback) {
  // Engine state and DOM mutations must finish before this function returns.
  const result=callback();
  const disabled=new URLSearchParams(location.search).get('transitions');
  if(reduced.matches||['off','0'].includes(disabled)||/(?:^|;\s*)lu_transitions=(?:off|0)(?:;|$)/.test(document.cookie)||document.documentElement.dataset.luInputModality==='keyboard')return result;
  if(!document.body.classList.contains('lu-mode-transitioning'))document.body.classList.add('lu-mode-transitioning');
  clearTimeout(stageTransitionTimer);stageTransitionTimer=setTimeout(()=>document.body.classList.remove('lu-mode-transitioning'),280);
  return result;
}
window.luRunStageTransition=runStageViewTransition;

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
  const formatted = typeof text === 'string' ? text.replace(/》\s*-\s*/g, '》 · ') : text;
  if (!el || el.textContent === formatted) return;
  el.textContent = formatted;
  el.getAnimations().forEach(a => { if (a.id === 'lu-lyric-focus') a.cancel(); });
  if (formatted && !reduced.matches) {
    const a = el.animate([{opacity:.3,filter:'blur(2.5px)',transform:'translateY(3px)'},{opacity:1,filter:'blur(0px)',transform:'translateY(0)'}], {duration:180,easing:'cubic-bezier(.16,1,.3,1)'});
    a.id = 'lu-lyric-focus';
  }
}

const INDICATOR_GROUPS = [
  '.lu-festival-switch',
  '.lue-facet-tabs',
  '#kineticModeSwitcher',
  '.inspector-tabs',
  '.material-families',
  '#avatarGroupTabs',
  '.lu-apple-aspect-group',
  '#contentModeGroup',
  '#layerModeGroup',
  '#adhesionCraftGroup',
  '#morphFreqGroup',
  '#fovModeGroup',
  '#camMotionGroup',
  '#orbitModeGroup',
  '#textColorModeGroup',
  '#kineticEngineModeGroup',
  '#avatarDistGroup',
  '#imageDistGroup',
  '#luIntroThemeSelect'
].join(',');

function isItemActive(btn) {
  return btn.classList.contains('active')
    || btn.getAttribute('aria-selected') === 'true'
    || btn.getAttribute('aria-pressed') === 'true'
    || btn.dataset.active === 'true';
}

function attachLumnoIndicator(container, index, cleanups) {
  if (!container || container.dataset.lumnoIndicator) return;
  container.dataset.lumnoIndicator = 'init';
  const anchorName = `--lu-active-anchor-${index}`;
  container.style.setProperty('--lu-group-anchor', anchorName);
  const indicator = document.createElement('span');
  indicator.className = 'lu-lumno-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  container.prepend(indicator);

  const getButtons = () => Array.from(container.querySelectorAll(':scope > button'));
  let rafId = 0;

  const sync = () => {
    rafId = 0;
    const buttons = getButtons();
    const active = buttons.find(isItemActive);
    buttons.forEach(b => {
      if (b === active) b.style.setProperty('anchor-name', anchorName);
      else b.style.removeProperty('anchor-name');
    });
    if (!active || !active.offsetWidth || !container.offsetWidth) {
      indicator.style.opacity = '0';
      return;
    }
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    if (cRect.width < 2 || aRect.width < 2) return;
    const scaleX = cRect.width / container.offsetWidth || 1;
    const scaleY = cRect.height / container.offsetHeight || 1;
    const x = (aRect.left - cRect.left) / scaleX - container.clientLeft;
    const y = (aRect.top - cRect.top) / scaleY - container.clientTop;
    const w = aRect.width / scaleX;
    const h = aRect.height / scaleY;

    indicator.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    indicator.style.width = `${w.toFixed(2)}px`;
    indicator.style.height = `${h.toFixed(2)}px`;
    indicator.style.opacity = '1';
    if (container.dataset.lumnoIndicator !== 'ready') {
      indicator.getBoundingClientRect();
      container.dataset.lumnoIndicator = 'ready';
    }
  };

  const schedule = () => {
    if (!rafId) rafId = requestAnimationFrame(sync);
  };

  const mo = new MutationObserver(schedule);
  mo.observe(container, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'aria-selected', 'aria-pressed', 'data-active', 'hidden']
  });
  const ro = new ResizeObserver(schedule);
  ro.observe(container);
  getButtons().forEach(b => ro.observe(b));
  document.fonts?.ready?.then(schedule);
  schedule();

  cleanups.push(() => {
    cancelAnimationFrame(rafId);
    mo.disconnect();
    ro.disconnect();
    indicator.remove();
    delete container.dataset.lumnoIndicator;
  });
}

function installLumnoIndicators(cleanups) {
  let counter = 0;
  const scan = () => {
    document.querySelectorAll(INDICATOR_GROUPS).forEach(el => {
      if (!el.dataset.lumnoIndicator) attachLumnoIndicator(el, ++counter, cleanups);
    });
  };
  scan();
  const bodyMo = new MutationObserver(scan);
  bodyMo.observe(document.body, {childList: true, subtree: true});
  cleanups.push(() => bodyMo.disconnect());
}

function installLumnoDockMagnification(cleanups) {
  const dock = document.querySelector('#luAppleDock');
  if (!dock) return;

  const tip = document.createElement('div');
  tip.className = 'lu-lumno-dock-tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.dataset.visible = 'false';
  dock.appendChild(tip);

  const getItems = () => Array.from(
    dock.querySelectorAll('.lu-apple-transport-cluster > button:not([hidden]), .lu-festival-switch > button:not([hidden]), .lu-apple-actions-cluster > button:not([hidden])')
  ).filter(b => b.offsetWidth > 0 && b.offsetHeight > 0);

  const clearMagnification = () => {
    dock.querySelectorAll('button').forEach(b => {
      b.style.removeProperty('--dock-scale');
      b.style.removeProperty('--dock-rise');
      b.style.removeProperty('--dock-shift');
      b.style.removeProperty('--dock-glow');
    });
    tip.dataset.visible = 'false';
  };

  const onMove = e => {
    if (e.pointerType !== 'mouse' || reduced.matches || window.innerWidth <= 760) {
      clearMagnification();
      return;
    }
    const items = getItems();
    if (!items.length) return;
    const dockRect = dock.getBoundingClientRect();
    const mx = e.clientX - dockRect.left;
    const my = e.clientY - dockRect.top;

    const centers = items.map(btn => {
      const r = btn.getBoundingClientRect();
      return {
        btn,
        x: r.left - dockRect.left + r.width / 2,
        y: r.top - dockRect.top + r.height / 2,
        top: r.top - dockRect.top
      };
    });

    let nearestIdx = -1;
    let nearestDist = Infinity;
    centers.forEach((c, idx) => {
      const d = Math.hypot(mx - c.x, my - c.y);
      if (d < nearestDist && d < 64) {
        nearestDist = d;
        nearestIdx = idx;
      }
    });

    centers.forEach((c, idx) => {
      const diff = idx - nearestIdx;
      if (nearestIdx < 0 || Math.abs(diff) > 2) {
        c.btn.style.removeProperty('--dock-scale');
        c.btn.style.removeProperty('--dock-rise');
        c.btn.style.removeProperty('--dock-shift');
        c.btn.style.removeProperty('--dock-glow');
        return;
      }
      const s = hermit(Math.max(0, 1 - Math.abs(mx - c.x) / 148));
      const dir = Math.sign(diff);
      const shift = dir === 0 ? 0 : dir * 5 * s * (1 - s) / Math.abs(diff);
      c.btn.style.setProperty('--dock-scale', (1 + 0.14 * s).toFixed(3));
      c.btn.style.setProperty('--dock-rise', `${(-3.5 * s).toFixed(1)}px`);
      c.btn.style.setProperty('--dock-shift', `${shift.toFixed(1)}px`);
      c.btn.style.setProperty('--dock-glow', s.toFixed(2));
    });

    if (nearestIdx >= 0) {
      const target = centers[nearestIdx];
      const label = (target.btn.getAttribute('title') || target.btn.getAttribute('aria-label') || target.btn.textContent || '').trim();
      const playlistOpen = !document.querySelector('#applePlaylistPopover')?.hidden;
      const recordOpen = !document.querySelector('#appleRecordPopover')?.hidden;
      if (label && !playlistOpen && !recordOpen) {
        tip.textContent = label.replace(/（.*?）|\(.*?\)/g, '').trim() || label;
        tip.style.setProperty('--tip-x', `${Math.max(44, Math.min(dockRect.width - 44, target.x)).toFixed(1)}px`);
        tip.style.setProperty('--tip-y', `${Math.max(-8, target.top - 10).toFixed(1)}px`);
        tip.dataset.visible = 'true';
      } else {
        tip.dataset.visible = 'false';
      }
    } else {
      tip.dataset.visible = 'false';
    }
  };

  dock.addEventListener('pointermove', onMove, {passive: true});
  dock.addEventListener('pointerleave', clearMagnification, {passive: true});
  dock.addEventListener('pointerdown', () => { tip.dataset.visible = 'false'; }, {passive: true});
  cleanups.push(() => {
    dock.removeEventListener('pointermove', onMove);
    dock.removeEventListener('pointerleave', clearMagnification);
    clearMagnification();
    tip.remove();
  });
}

const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const INTRO_DITHER_PALETTES = {
  'one-piece': [[8, 40, 56], [28, 96, 118], [107, 197, 209], [238, 212, 148]],
  'dragon-ball': [[7, 29, 53], [32, 92, 82], [127, 216, 174], [239, 196, 98]],
  naruto: [[48, 38, 51], [116, 96, 152], [182, 158, 212], [248, 232, 206]]
};

function installLumnoIntroDither(cleanups) {
  const overlay = document.querySelector('#luIntroOverlay');
  if (!overlay) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'lu-intro-dither-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  overlay.prepend(canvas);

  const render = () => {
    const w = 480, h = 300;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const theme = overlay.dataset.theme || document.body.dataset.luTheme || 'one-piece';
    const pal = INTRO_DITHER_PALETTES[theme] || INTRO_DITHER_PALETTES['one-piece'];
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let y = 0; y < h; y++) {
      const ny = (y / h) * 2 - 1;
      const row = (y & 3) * 4;
      for (let x = 0; x < w; x++) {
        const nx = (x / w) * 2 - 1;
        const radial = Math.min(1, Math.hypot(nx * 0.92, ny * 0.98));
        const wave = 0.5 + 0.5 * Math.sin(nx * 3.4 + ny * 2.2);
        const bayer = (BAYER_4X4[row + (x & 3)] / 16 - 0.5) * 0.28;
        const tone = Math.max(0, Math.min(0.999, radial * 0.72 + wave * 0.28 + bayer));
        const idx = Math.min(pal.length - 1, Math.floor(tone * pal.length));
        const [r, g, b] = pal[idx];
        const edgeMask = Math.max(0, Math.min(1, (radial - 0.28) / 0.64));
        const p = (y * w + x) * 4;
        data[p] = r;
        data[p + 1] = g;
        data[p + 2] = b;
        data[p + 3] = Math.round(edgeMask * 42);
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  render();
  const mo = new MutationObserver(render);
  mo.observe(overlay, {attributes: true, attributeFilter: ['data-theme']});
  cleanups.push(() => {
    mo.disconnect();
    canvas.remove();
  });
}

const STAGE_SIGNATURES = {
  'band:cream': ['CREAM PRISM', '奶油棱镜'],
  'band:island': ['SUNSET ISLAND', '日落海岛'],
  'band:shell': ['PEARL SHELL', '珍珠贝壳'],
  slot: ['KINETIC CUBE', '机械魔方'],
  gravity: ['ZERO GRAVITY', '反重力场'],
  off: ['PURE STAGE', '纯享舞台']
};

function installLumnoMastheadAndOpticsHUD(cleanups) {
  const brandTitle = document.querySelector('.master-deck-hud .brand-section .brand-title');
  const brandTag = document.querySelector('.master-deck-hud .brand-section .brand-tag');
  const hud = document.querySelector('.master-deck-hud');
  const inspector = document.querySelector('#inspectorPanel');

  // Tighten CJK corner brackets in brand title ('『 律 』LÜ' -> '『律』LÜ')
  const brandTitleSpan = brandTitle?.querySelector(':scope > span:not(.brand-tag)');
  if (brandTitleSpan) {
    brandTitleSpan.textContent = '『律』LÜ';
  }

  // Ensure every icon-only button with a [title] also exposes an explicit [aria-label]
  document.querySelectorAll('button[title]:not([aria-label])').forEach(b => {
    const t = b.getAttribute('title')?.trim();
    if (t) b.setAttribute('aria-label', t);
  });

  const syncStageSignature = () => {
    const isBand = document.body.classList.contains('lu-band-mode');
    const look = document.body.dataset.festivalLook || 'cream';
    const activeModeBtn = document.querySelector('#kineticModeSwitcher .kinetic-mode-btn.active');
    const rawMode = isBand ? 'band' : (activeModeBtn?.dataset.mode || window.kineticLyricsManager?.mode || 'slot');
    const key = rawMode === 'band' ? `band:${look}` : rawMode;
    const [en, zh] = STAGE_SIGNATURES[key] || STAGE_SIGNATURES.slot;
    document.body.dataset.luStageSignature = key;
    if (brandTag && brandTag.dataset.sigKey !== key) {
      brandTag.dataset.sigKey = key;
      brandTag.innerHTML = `<span class="brand-tag-en">${en}</span><span class="brand-tag-sep" aria-hidden="true">·</span><span class="brand-tag-zh">${zh}</span>`;
    }
  };

  syncStageSignature();
  const bodyMo = new MutationObserver(syncStageSignature);
  bodyMo.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'data-festival-look', 'data-lu-theme']
  });
  const switcher = document.querySelector('#kineticModeSwitcher');
  if (switcher) {
    bodyMo.observe(switcher, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-checked']
    });
  }
  cleanups.push(() => bodyMo.disconnect());

  // Top-right Quick Optics Inspector Pill (#luQuickOpticsBtn)
  if (hud && inspector && !document.querySelector('#luQuickOpticsBtn')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'luQuickOpticsBtn';
    btn.className = 'lu-quick-optics-btn';
    btn.setAttribute('aria-controls', 'inspectorPanel');
    btn.setAttribute('aria-pressed', String(!inspector.classList.contains('collapsed')));
    btn.title = '切换三维材质与光学实验室抽屉';
    btn.innerHTML = '<span class="lu-optics-gem" aria-hidden="true">✦</span><span>光学材质</span>';
    hud.appendChild(btn);

    const syncOpticsState = () => {
      const open = !inspector.classList.contains('collapsed');
      btn.setAttribute('aria-pressed', String(open));
      btn.classList.toggle('active', open);
    };
    const toggleOptics = e => {
      e.stopPropagation();
      const willOpen = inspector.classList.contains('collapsed');
      if (willOpen && document.body.classList.contains('lue-core-open')) {
        document.querySelector('#lueDrawerCloseBtn')?.click();
      }
      inspector.classList.toggle('collapsed', !willOpen);
      document.body.classList.toggle('inspector-open', willOpen);
      syncOpticsState();
    };
    btn.addEventListener('click', toggleOptics);
    const inspMo = new MutationObserver(syncOpticsState);
    inspMo.observe(inspector, { attributes: true, attributeFilter: ['class'] });
    cleanups.push(() => {
      inspMo.disconnect();
      btn.removeEventListener('click', toggleOptics);
      btn.remove();
    });
  }

  // Upgrade .lu-pet-hint into structured tactile keycaps
  const enhanceStageTextAndHint = () => {
    const hint = document.querySelector('.lu-pet-hint');
    if (hint && hint.dataset.lumnoKeycaps !== 'true') {
      hint.dataset.lumnoKeycaps = 'true';
      hint.setAttribute('aria-label', '点按进退，按住独奏，拖动换位');
      hint.innerHTML = '<kbd>点按</kbd><span>进退</span><i aria-hidden="true">·</i><kbd>按住</kbd><span>独奏</span><i aria-hidden="true">·</i><kbd>拖动</kbd><span>换位</span>';
    }
  };
  enhanceStageTextAndHint();
  const stageWrap = document.querySelector('#stageWrap');
  if (stageWrap) {
    const hintMo = new MutationObserver(enhanceStageTextAndHint);
    hintMo.observe(stageWrap, { childList: true, subtree: true });
    cleanups.push(() => hintMo.disconnect());
  }
}

function installLumnoPointerSpotlight(cleanups) {
  const SURFACE_SELECTOR = '#luAppleDock, #performanceCapsule, #lueCoreDrawer, #inspectorPanel, .lu-intro-theme-select, #luQuickOpticsBtn, .master-deck-hud .brand-section';
  let activeSurface = null;

  const onPointerMove = e => {
    if (e.pointerType === 'touch' || reduced.matches) return;
    const surface = e.target.closest?.(SURFACE_SELECTOR);
    if (activeSurface && activeSurface !== surface) {
      activeSurface.style.setProperty('--lu-spot-opacity', '0');
    }
    activeSurface = surface || null;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    surface.style.setProperty('--lu-spot-x', `${x.toFixed(1)}px`);
    surface.style.setProperty('--lu-spot-y', `${y.toFixed(1)}px`);
    surface.style.setProperty('--lu-spot-opacity', '1');
  };

  const onPointerLeave = () => {
    if (activeSurface) {
      activeSurface.style.setProperty('--lu-spot-opacity', '0');
      activeSurface = null;
    }
  };

  document.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('blur', onPointerLeave, { passive: true });
  cleanups.push(() => {
    document.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('blur', onPointerLeave);
    onPointerLeave();
  });
}

export function installPerceptualUI({isPlaying = () => false} = {}) {
  document.documentElement.classList.add('lu-perceptual-ui');
  document.documentElement.dataset.luInputModality = 'pointer';
  const cleanups = [], presses = new Map(), pointers = new Map();
  const onModalityKey = e => {
    if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'].includes(e.key)) {
      document.documentElement.dataset.luInputModality = 'keyboard';
    }
  };
  const onModalityPointer = () => {
    document.documentElement.dataset.luInputModality = 'pointer';
  };
  document.addEventListener('keydown', onModalityKey, true);
  document.addEventListener('pointerdown', onModalityPointer, true);
  cleanups.push(() => {
    document.removeEventListener('keydown', onModalityKey, true);
    document.removeEventListener('pointerdown', onModalityPointer, true);
  });
  const selector = '.lu-apple-icon-btn,.lu-apple-play-btn,#luAppleOrbBtn,.kinetic-mode-btn,.lue-facet-tab,.lu-festival-switch button,.lu-intro-theme,#luQuickOpticsBtn';
  function press(button, value) {
    if (!button || button.disabled) return;
    // Tactile keys use their own 120ms vertical press, including native keyboard
    // :active. Do not also spring-scale their face or label out of its keycap.
    if (getComputedStyle(button).getPropertyValue('--lu-button-material').trim() === 'tactile') return;
    const face = button.querySelector('svg,.face,.lu-theme-art') || button;
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

  installLumnoIndicators(cleanups);
  installLumnoDockMagnification(cleanups);
  installLumnoIntroDither(cleanups);
  installLumnoMastheadAndOpticsHUD(cleanups);
  installLumnoPointerSpotlight(cleanups);

  // Observe only actual scroll containers. Recalculate after content/viewport changes.
  for (const el of document.querySelectorAll('#applePlaylistList,#avatarPresetGrid,.lue-facet-panels,.inspector-body')) {
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
    const sound = e => { if (e.target.closest('#luAppleOrbBtn,#appleOrderModeBtn,.lu-festival-switch button') && !isPlaying()) haptic.click('soft'); };
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
