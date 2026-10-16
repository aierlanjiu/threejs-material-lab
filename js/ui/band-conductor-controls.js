// Stitch direction; AGY component implementation, integrated and reviewed by codex.
const STYLE_ID = 'lu-conductor-style';
const CSS = `
.lu-conductor { background: #111116; color: #ede2cf; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif; border: 1px solid #2a2a35; border-radius: 8px; padding: 8px; max-height: 210px; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; }
.lu-conductor * { box-sizing: border-box; }
.lu-conductor-bar { display: flex; gap: 8px; align-items: center; }
.lu-conductor-btn { height: 44px; min-width: 44px; padding: 0 12px; background: #181820; color: #ede2cf; border: 1px solid #2e2e3a; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
.lu-conductor-btn:active, .lu-conductor-btn[aria-pressed="true"] { background: #cbbb9e; color: #111116; border-color: #cbbb9e; }
.lu-conductor-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.lu-conductor-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
.lu-conductor-scroll::-webkit-scrollbar { display: none; }
.lu-conductor-actor { flex: 0 0 auto; min-height: 44px; padding: 0 12px; background: linear-gradient(0deg,#cbbb9e33 0%,#cbbb9e33 calc(var(--signal,0)*100%),#171720 calc(var(--signal,0)*100%)); color: #ede2cf; border: 1px solid #2e2e3a; border-radius: 6px; font-size: 12px; cursor: pointer; user-select: none; touch-action:pan-x; }
.lu-conductor-actor.solo { background: #cbbb9e; color: #111116; border-color: #cbbb9e; font-weight: 600; }
.lu-conductor-actor.muted { opacity: 0.35; }
.lu-conductor-actor.pending { border-style: dashed; border-color: #cbbb9e; }
.lu-conductor-actor:disabled { opacity: 0.25; cursor: not-allowed; }
.lu-conductor-status { font-size: 11px; color: #8c8c99; min-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lu-conductor-meta { margin-left: auto; font-size: 12px; color: #cbbb9e; }
.lu-conductor button:focus-visible{outline:2px solid #cbbb9e;outline-offset:2px}
@media(max-width:600px){.lu-conductor{padding:4px;gap:3px}.lu-conductor-bar{display:none}.lu-conductor-scroll{padding-bottom:0}.lu-conductor-scroll .lu-conductor-btn{flex:none;padding:0 8px;font-size:11px}.lu-conductor-status{font-size:10px;line-height:14px;min-height:14px}}
`;

export function createConductorControls(host, { onToggle, onSoloStart, onSoloEnd, onAll, onRestore } = {}) {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const root = document.createElement('div');
  root.className = 'lu-conductor';
  root.innerHTML = `
    <div class="lu-conductor-bar">
      <button type="button" class="lu-conductor-btn lu-btn-all">全队进入</button>
      <button type="button" class="lu-conductor-btn lu-btn-restore">恢复合奏</button>
      <span class="lu-conductor-meta"></span>
    </div>
    <div class="lu-conductor-scroll" role="toolbar" aria-label="声轨成员"></div>
    <div class="lu-conductor-status" role="status" aria-live="polite"></div>
  `;
  host.appendChild(root);

  const [btnAll, btnRestore] = [root.querySelector('.lu-btn-all'), root.querySelector('.lu-btn-restore')];
  const [scroll, statusEl, metaEl] = [root.querySelector('.lu-conductor-scroll'), root.querySelector('.lu-conductor-status'), root.querySelector('.lu-conductor-meta')];
  const compact=matchMedia('(max-width:600px)'),bar=root.querySelector('.lu-conductor-bar');
  const layout=()=>{if(compact.matches)scroll.prepend(btnAll,btnRestore);else bar.prepend(btnAll,btnRestore);};
  compact.addEventListener('change',layout);layout();

  btnAll.onclick = () => onAll?.();
  btnRestore.onclick = () => onRestore?.();

  const actors = new Map();
  let activeSoloId = null;
  let partsKey = '';
  const releases = new Set();
  const releaseAll = () => { for(const release of releases)release(); };
  window.addEventListener('blur',releaseAll);

  function bindActorEvents(btn, id) {
    let timer = null;
    let isLongPress = false;
    let down = false;
    let origin = null;

    const startSolo = (e) => {
      if(down)return;
      down = true;
      origin=e?{x:e.clientX,y:e.clientY}:null;
      isLongPress = false;
      if (e?.pointerId !== undefined) {
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      }
      timer = setTimeout(() => {
        isLongPress = true;
        activeSoloId = id;
        onSoloStart?.(id);
      }, 350);
    };

    const stopSolo = (e, cancel = false) => {
      if(!down)return;
      down=false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (e?.pointerId !== undefined) {
        try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      if (isLongPress) {
        isLongPress = false;
        if (activeSoloId === id) {
          activeSoloId = null;
          onSoloEnd?.(id);
        }
      } else if (!cancel) {
        onToggle?.(id);
      }
    };

    btn.onpointerdown = (e) => { if (e.button === 0) startSolo(e); };
    btn.onpointerup = (e) => stopSolo(e);
    btn.onpointercancel = (e) => stopSolo(e, true);
    btn.onlostpointercapture = (e) => stopSolo(e, true);
    btn.onpointermove = e => {if(down&&origin&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>10)stopSolo(e,true);};
    btn.onblur = () => stopSolo(null, true);
    btn.onclick = e => {if(e.detail===0&&!down)onToggle?.(id);};
    releases.add(()=>stopSolo(null,true));

    btn.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        onToggle?.(id);
      } else if (e.key === ' ' && !e.repeat && !timer) {
        e.preventDefault();
        startSolo();
      } else if (e.key === 'Escape' && (isLongPress || timer)) {
        e.preventDefault();
        stopSolo(null, true);
        if (activeSoloId === id) {
          activeSoloId = null;
          onSoloEnd?.(id);
        }
      }
    };
    btn.onkeyup = (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        stopSolo();
      }
    };
  }

  return {
    setParts(parts = []) {
      const valid = parts.filter(p => p && p.stemId && (p.bindingStatus === 'estimated' || p.bindingStatus === 'verified'));
      const key=JSON.stringify(valid.map(p=>[p.id,p.stemId,p.label,p.shared]));if(key===partsKey)return;partsKey=key;
      releaseAll();releases.clear();
      scroll.innerHTML = '';
      actors.clear();
      valid.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lu-conductor-actor';
        btn.textContent = `${p.name} · ${p.label}${p.shared?' · 共享声轨':''}`;
        btn.dataset.actorId=p.id;btn.dataset.stemId=p.stemId;
        btn.setAttribute('aria-pressed', 'true');
        bindActorEvents(btn, p.id);
        scroll.appendChild(btn);
        actors.set(p.id, { btn, stemId: p.stemId });
      });
      layout();
    },

    update(snapshot = {}) {
      const { ready = false, beat, section, soloId, soloGroup, muted = [], pending = [], message, pendingLabel, levels={} } = snapshot;
      if(!ready)releaseAll();
      
      root.querySelectorAll('button').forEach(b => { b.disabled = !ready; });

      const text=pendingLabel||message||'点按下一拍进入/休止，长按临时主奏';
      if (statusEl.textContent !== text) {
        statusEl.textContent = text;
      }

      if (metaEl) {
        metaEl.textContent = beat != null ? `${section ? section + ' · ' : ''}B${beat}` : '';
      }

      const mutedSet = new Set(muted);
      const pendingSet = new Set(pending);

      actors.forEach(({ btn, stemId }, id) => {
        const isSolo = soloGroup?soloGroup===stemId:soloId === id;
        const isMuted = soloGroup?!isSolo:mutedSet.has(stemId);
        btn.classList.toggle('solo', isSolo);
        btn.classList.toggle('muted', !isSolo && isMuted);
        btn.classList.toggle('pending', pendingSet.has(stemId));
        btn.setAttribute('aria-pressed', String(!isMuted));
        btn.style.setProperty('--signal',levels[id]||0);
      });

      btnAll.setAttribute('aria-pressed', String(muted.length === 0));
    },

    dispose() {
      compact.removeEventListener('change',layout);
      releaseAll();releases.clear();window.removeEventListener('blur',releaseAll);
      if (activeSoloId) {
        onSoloEnd?.(activeSoloId);
        activeSoloId = null;
      }
      actors.clear();
      root.remove();
    }
  };
}
