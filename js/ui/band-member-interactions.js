export function createBandMemberInteractions(host, { onToggle, onSoloStart, onSoloEnd, onDragStart, onDragMove, onDragEnd } = {}) {
  if (!host) return { setParts() {}, update() {}, dispose() {} };

  host.classList.add('lu-band-member-interactions');

  const hintEl = document.createElement('div');
  const setClass = (el, name, value) => { if (el.classList.contains(name) !== value) el.classList.toggle(name, value); };
  hintEl.className = 'lu-pet-hint';
  hintEl.setAttribute('role', 'status');
  hintEl.textContent = '点按进退 · 按住独奏 · 拖动换位';
  host.appendChild(hintEl);

  let hintTimer = null, hintShown = false, clearing = false;
  const returned = new Map();
  let lastMuted = new Set();

  let partsMap = new Map();
  const buttonMap = new Map();
  const activePointers = new Map();
  let keyHoldStates = new Map();
  let lastPointerUpTime = 0;
  let currentView = { enabled: true, visible: true };

  function clearAllGestures(cancelled = true) {
    if(clearing) return;
    clearing = true;
    for (const [pointerId, state] of activePointers.entries()) {
      if (state.holdTimer) {
        clearTimeout(state.holdTimer);
        state.holdTimer = null;
      }
      if (state.isDragging && onDragEnd) {
        onDragEnd(state.id, { cancelled: true });
      }
      if (state.isSolo && onSoloEnd) {
        onSoloEnd(state.id);
      }
      if (state.btn) {
        state.btn.classList.remove('lu-pet-pressed', 'lu-pet-solo-active', 'lu-pet-dragging');
        try {
          state.btn.releasePointerCapture(pointerId);
        } catch (_) {}
      }
    }
    activePointers.clear();

    for (const [id, keyState] of keyHoldStates.entries()) {
      if (keyState.timer) clearTimeout(keyState.timer);
      if (keyState.isSolo && onSoloEnd) {
        onSoloEnd(id);
      }
      const btnRecord = buttonMap.get(id);
      if (btnRecord) {
        btnRecord.btn.classList.remove('lu-pet-pressed', 'lu-pet-solo-active');
      }
    }
    keyHoldStates.clear();
    clearing = false;
  }

  function handleWindowBlur() {
    clearAllGestures(true);
  }

  function handleDocumentKeyDown(e) {
    if (e.key === 'Escape') {
      clearAllGestures(true);
    }
  }

  window.addEventListener('blur', handleWindowBlur);
  document.addEventListener('keydown', handleDocumentKeyDown);

  function setParts(parts) {
    partsMap = new Map((parts || []).map(p => [p.id, p]));
    for (const [id, item] of buttonMap.entries()) {
      const p = partsMap.get(id);
      if (p) {
        item.btn.setAttribute('aria-label', p.name || p.label || id);
        item.lastAriaLabel = null;
        item.nameSpan.textContent = p.label || p.name || id;
      }
    }
  }

  function createButton(id) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lu-pet-hit';
    btn.dataset.actorId = id;

    const badge = document.createElement('span');
    badge.className = 'lu-pet-badge';
    badge.setAttribute('aria-hidden', 'true');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'lu-pet-name';

    const statusSpan = document.createElement('span');
    statusSpan.className = 'lu-pet-status';

    badge.appendChild(nameSpan);
    badge.appendChild(statusSpan);
    btn.appendChild(badge);

    btn.addEventListener('pointerdown', (e) => {
      if (!currentView.enabled || currentView.visible === false) return;
      if(e.button!==0 || activePointers.size || keyHoldStates.size) return;
      e.preventDefault();
      btn.focus({preventScroll:true});
      try {
        btn.setPointerCapture(e.pointerId);
      } catch (_) {}

      btn.classList.add('lu-pet-pressed');

      const state = {
        id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        btn,
        isSolo: false,
        isDragging: false,
        holdTimer: null,
        startTime: Date.now()
      };

      state.holdTimer = setTimeout(() => {
        if (state.isDragging) return;
        state.isSolo = true;
        btn.classList.add('lu-pet-solo-active');
        if (onSoloStart) onSoloStart(id);
      }, 350);

      activePointers.set(e.pointerId, state);
    });

    btn.addEventListener('pointermove', (e) => {
      const state = activePointers.get(e.pointerId);
      if (!state) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      const dist = Math.hypot(dx, dy);

      if (!state.isDragging && dist > 10) {
        if (state.holdTimer) {
          clearTimeout(state.holdTimer);
          state.holdTimer = null;
        }
        if (state.isSolo) {
          state.isSolo = false;
          btn.classList.remove('lu-pet-solo-active');
          if (onSoloEnd) onSoloEnd(id);
        }
        state.isDragging = true;
        btn.classList.add('lu-pet-dragging');
        if (onDragStart) onDragStart(id, e.clientX, e.clientY);
      }

      if (state.isDragging) {
        if (onDragMove) onDragMove(id, e.clientX, e.clientY);
      }
    });

    btn.addEventListener('pointerup', (e) => {
      const state = activePointers.get(e.pointerId);
      if (!state) return;

      if (state.holdTimer) {
        clearTimeout(state.holdTimer);
        state.holdTimer = null;
      }

      try {
        btn.releasePointerCapture(e.pointerId);
      } catch (_) {}

      btn.classList.remove('lu-pet-pressed');

      if (state.isDragging) {
        btn.classList.remove('lu-pet-dragging');
        if (onDragEnd) onDragEnd(id, { cancelled: false });
      } else if (state.isSolo) {
        state.isSolo = false;
        btn.classList.remove('lu-pet-solo-active');
        if (onSoloEnd) onSoloEnd(id);
      } else {
        lastPointerUpTime = Date.now();
        if (onToggle) onToggle(id);
      }

      activePointers.delete(e.pointerId);
    });

    function handlePointerCancel(e) {
      const state = activePointers.get(e.pointerId);
      if (!state) return;

      if (state.holdTimer) {
        clearTimeout(state.holdTimer);
        state.holdTimer = null;
      }

      try {
        btn.releasePointerCapture(e.pointerId);
      } catch (_) {}

      btn.classList.remove('lu-pet-pressed');

      if (state.isDragging) {
        btn.classList.remove('lu-pet-dragging');
        if (onDragEnd) onDragEnd(id, { cancelled: true });
      }
      if (state.isSolo) {
        state.isSolo = false;
        btn.classList.remove('lu-pet-solo-active');
        if (onSoloEnd) onSoloEnd(id);
      }

      activePointers.delete(e.pointerId);
    }

    btn.addEventListener('pointercancel', handlePointerCancel);
    btn.addEventListener('lostpointercapture', handlePointerCancel);

    btn.addEventListener('click', (e) => {
      if(e.detail!==0) {e.preventDefault();return;}
      if (Date.now() - lastPointerUpTime < 400) {
        e.preventDefault();
        return;
      }
      if (!currentView.enabled || currentView.visible === false) return;
      if (onToggle) onToggle(id);
    });

    btn.addEventListener('keydown', (e) => {
      if (!currentView.enabled || currentView.visible === false) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (e.repeat || activePointers.size || keyHoldStates.size) return;
        e.preventDefault();
        btn.classList.add('lu-pet-pressed');
        const keyState = {
          isSolo: false,
          timer: setTimeout(() => {
            keyState.isSolo = true;
            btn.classList.add('lu-pet-solo-active');
            if (onSoloStart) onSoloStart(id);
          }, 350)
        };
        keyHoldStates.set(id, keyState);
      } else if (e.key === 'Escape') {
        clearAllGestures(true);
      }
    });

    btn.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        btn.classList.remove('lu-pet-pressed');
        const keyState = keyHoldStates.get(id);
        if (!keyState) return;
        clearTimeout(keyState.timer);
        if (keyState.isSolo) {
          keyState.isSolo = false;
          btn.classList.remove('lu-pet-solo-active');
          if (onSoloEnd) onSoloEnd(id);
        } else {
          lastPointerUpTime = Date.now();
          if (onToggle) onToggle(id);
        }
        keyHoldStates.delete(id);
      }
    });

    btn.addEventListener('blur', () => {
      btn.classList.remove('lu-pet-pressed');
      const keyState = keyHoldStates.get(id);
      if (keyState) {
        clearTimeout(keyState.timer);
        if (keyState.isSolo) {
          keyState.isSolo = false;
          btn.classList.remove('lu-pet-solo-active');
          if (onSoloEnd) onSoloEnd(id);
        }
        keyHoldStates.delete(id);
      }
    });

    host.appendChild(btn);
    const record = { btn, badge, nameSpan, statusSpan };
    buttonMap.set(id, record);
    return record;
  }

  function update(view) {
    if (!view) return;
    const visible = view.visible !== false;
    const enabled = view.enabled !== false;
    currentView = { ...view, visible, enabled };
    if(visible && enabled && !hintShown){hintShown=true;hintTimer=setTimeout(()=>hintEl.classList.add('lu-pet-hint-fade'),5000);}

    if (!enabled || !visible) {
      clearAllGestures(true);
    }

    currentView = { ...view, visible, enabled };
    const display = visible ? '' : 'none';
    if (host.style.display !== display) host.style.display = display;

    const members = view.members || [];
    const mutedIds = new Set(view.mutedIds || []);
    const pendingIds = new Set(view.pendingIds || []);
    const soloId = view.soloId || null;
    const remainingBeats = view.remainingBeats || 0;
    const beatsPerBar = view.beatsPerBar || 4;

    const hostW = host.clientWidth || host.offsetWidth || 390;
    const hostH = host.clientHeight || host.offsetHeight || 844;
    const currentIds = new Set(members.map(m => m.id));
    // Match the fixed 76 × 18px footnote in lu-band.css, without measuring DOM each frame.
    const badgeWidth = 76, badgeHeight = 18, badgeGap = 3, edge = 6;
    const layouts = [];

    for (const [id, record] of buttonMap.entries()) {
      if (!currentIds.has(id)) {
        record.btn.remove();
        buttonMap.delete(id);
      }
    }

    for (const member of members) {
      const id = member.id;
      let record = buttonMap.get(id);
      if (!record) {
        record = createButton(id);
      }

      const { btn, nameSpan, statusSpan } = record;
      const part = partsMap.get(id);
      const name = part?.name || id;
      if (nameSpan.textContent !== name) nameSpan.textContent = name;

      const bounds = member.bounds || { left: -0.1, right: 0.1, top: 0.1, bottom: -0.1 };
      const pxLeft = ((bounds.left + 1) / 2) * hostW;
      const pxRight = ((bounds.right + 1) / 2) * hostW;
      const pxTop = ((1 - bounds.top) / 2) * hostH;
      const pxBottom = ((1 - bounds.bottom) / 2) * hostH;

      const rawW = Math.abs(pxRight - pxLeft);
      const rawH = Math.abs(pxBottom - pxTop);
      const halfPixel = value => Math.round(value * 2) / 2;
      const btnW = halfPixel(Math.max(44, rawW));
      const btnH = halfPixel(Math.max(44, rawH));
      const cx = (pxLeft + pxRight) / 2;
      const cy = (pxTop + pxBottom) / 2;
      const btnLeft = halfPixel(cx - btnW / 2);
      const btnTop = halfPixel(cy - btnH / 2);

      const isClipped = btnLeft + btnW < 0 || btnLeft > hostW || btnTop + btnH < 0 || btnTop > hostH;
      if (isClipped) {
        setClass(btn, 'lu-pet-clipped', true);
      } else {
        setClass(btn, 'lu-pet-clipped', false);
        for (const [key, prop, value] of [['lastLeft', 'left', btnLeft], ['lastTop', 'top', btnTop], ['lastW', 'width', btnW], ['lastH', 'height', btnH]]) {
          if (record[key] !== value) { btn.style[prop] = `${value}px`; record[key] = value; }
        }
      }

      const isMuted = mutedIds.has(id);
      const isSolo = soloId === id;
      const isPending = pendingIds.has(id);
      const isAudible = isSolo || (!soloId && !isMuted);
      if(lastMuted.has(id) && !isMuted && !soloId && remainingBeats<=0) returned.set(id,performance.now()+1500);

      const pressed = isAudible ? 'true' : 'false';
      if (record.lastPressed !== pressed) { btn.setAttribute('aria-pressed', pressed); record.lastPressed = pressed; }
      if (record.lastDisabled !== !enabled) { btn.disabled = !enabled; record.lastDisabled = !enabled; }

      let statusText = '';
      let statusClass = '';
      if (isSolo) {
        statusText = '独奏';
        statusClass = 'lu-pet-status-solo';
      } else if (isPending) {
        statusText = '下一拍';
        statusClass = 'lu-pet-status-pending';
      } else if (isMuted) {
        statusClass = 'lu-pet-status-muted';
        if (remainingBeats > 0) {
          const bpb = beatsPerBar > 0 ? beatsPerBar : 4;
          const bars = Math.ceil(remainingBeats / bpb);
          statusText = `休止 · ${bars}小节`;
        } else {
          statusText = '休止';
        }
      }

      if (!statusText && (returned.get(id)||0)>performance.now()) statusText = '自动接回';
      if (record.lastStatusText !== statusText) { statusSpan.textContent = statusText; record.lastStatusText = statusText; }
      const nextStatusClass = `lu-pet-status${statusClass ? ' '+statusClass : ''}`;
      if (record.lastStatusClass !== nextStatusClass) { statusSpan.className = nextStatusClass; record.lastStatusClass = nextStatusClass; }
      const statusDisplay = statusText ? '' : 'none';
      if (statusSpan.style.display !== statusDisplay) statusSpan.style.display = statusDisplay;
      const showBadge = Boolean(isSolo || isPending || isMuted || (returned.get(id)||0)>performance.now());
      setClass(btn, 'lu-pet-show-badge', showBadge);
      const label = statusSpan.textContent || (isAudible ? '已加入' : '休止');
      const ariaLabel = `${part?.name || id} · ${part?.label || ''} · ${label}`;
      if (record.lastAriaLabel !== ariaLabel) { btn.setAttribute('aria-label', ariaLabel); record.lastAriaLabel = ariaLabel; }

      const badgeLeft = Math.max(edge, Math.min(hostW - badgeWidth - edge, cx - badgeWidth / 2));
      const badgeOffset = halfPixel(badgeLeft + badgeWidth / 2 - btnLeft);
      if (record.lastBadgeOffset !== badgeOffset) { btn.style.setProperty('--pet-badge-left', `${badgeOffset}px`); record.lastBadgeOffset = badgeOffset; }
      layouts.push({ id, btn, isClipped,
        left: btnLeft, right: btnLeft + btnW, top: btnTop, bottom: btnTop + btnH,
        badge: { left: badgeLeft, right: badgeLeft + badgeWidth, top: btnTop + btnH + badgeGap, bottom: btnTop + btnH + badgeGap + badgeHeight },
        showing: showBadge || document.activeElement === btn,
        priority: document.activeElement === btn ? 2 : isSolo ? 1 : 0 });
    }

    // Re-evaluate as the camera or a dragged pet moves. A crowded label yields to the pets.
    const overlaps = (a, b) => a.left < b.right + 2 && a.right > b.left - 2 && a.top < b.bottom + 2 && a.bottom > b.top - 2;
    const placed = [];
    for (const layout of [...layouts].sort((a, b) => b.priority - a.priority)) {
      const blocked = layout.isClipped || layout.badge.bottom > hostH - edge ||
        layouts.some(other => other.id !== layout.id && !other.isClipped && overlaps(layout.badge, other)) ||
        placed.some(other => overlaps(layout.badge, other));
      setClass(layout.btn, 'lu-pet-badge-blocked', blocked);
      if (!blocked && layout.showing) placed.push(layout.badge);
    }
    lastMuted=mutedIds;
  }

  function dispose() {
    clearTimeout(hintTimer);
    clearAllGestures(true);
    window.removeEventListener('blur', handleWindowBlur);
    document.removeEventListener('keydown', handleDocumentKeyDown);
    hintEl.remove();
    for (const record of buttonMap.values()) {
      record.btn.remove();
    }
    buttonMap.clear();
    partsMap.clear();
    activePointers.clear();
    keyHoldStates.clear();
  }

  return { setParts, update, dispose, cancel:clearAllGestures };
}
