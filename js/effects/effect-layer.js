import { PALETTES, clamp, range, luminance } from './effect-settings.js';

const CHARS = '  .,:;-=+xX08S#&@';
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const stops = [0, .4, .74, 1];
function paletteLookup(name) {
  const colors = (Object.hasOwn(PALETTES, name) ? PALETTES[name] : null)?.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  return colors && Array.from({ length: 256 }, (_, i) => {
    const l = i / 255;
    const k = l < .4 ? 0 : l < .74 ? 1 : 2;
    return colors[k].map((c, channel) => c + (colors[k + 1][channel] - c) * (l - stops[k]) / (stops[k + 1] - stops[k]));
  });
}
function liftedInk(rgb, s, tone) {
  const max = Math.max(...rgb), min = Math.min(...rgb);
  const v = max / 255, saturation = max ? (max - min) / max : 0;
  const value = v + (1 - v) * (.24 + .18 * s + .24 * tone);
  const sat = clamp(saturation * (1.16 + .2 * s));
  return rgb.map(c => 255 * value * (1 - (max > min ? (max - c) / (max - min) : 0) * sat));
}
function drawSource(ctx, source, w, h, fit) {
  if (fit === 'fill') {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h); return;
  }
  const scale = Math.max(w / source.naturalWidth, h / source.naturalHeight);
  const sw = source.naturalWidth * scale, sh = source.naturalHeight * scale;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, (w - sw) / 2, (h - sh) / 2, sw, sh);
}

// One image sampling pipeline, optionally mirrored into clipped curtain halves.
export function createEffectLayer({ box, mounts = [box], store, light = false, fit = 'cover' }) {
  const make = () => document.createElement('canvas');
  const canvases = mounts.map(mount => {
    const canvas = make(); canvas.className = 'lu-effect-canvas';
    canvas.setAttribute('aria-hidden', 'true'); mount.append(canvas); return canvas;
  });
  const frame = make(), previous = make(), sampling = make(), blocks = make(), windowMask = make(), composed = make(), asciiBase = make(), glyphs = make();
  const ctx = frame.getContext('2d'), sampleCtx = sampling.getContext('2d', { willReadFrequently: true });
  let source, sourceURL, requestedURL, generation = 0, timer, animation, signature, disposed = false, visible = true;
  let w = 1, h = 1, scale = 1, valid = false, asciiLine = 0;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let presentation = store.current, visualTime = 0, lastPaint = 0, fadeStart = 0, composedAlpha = -1;
  const moving = () => presentation.region === 'window' && presentation.motion && !motionPreference.matches;
  function paintWindow(time) {
    const mw = windowMask.width, mh = windowMask.height, mobile = w < 720;
    const mc = windowMask.getContext('2d');
    mc.clearRect(0, 0, mw, mh);
    const t = time / 1000;
    const isAscii = presentation.filter === 'ascii';
    const breath = (isAscii ? .90 : .78) + Math.sin(t * .65) * .055;
    const windows = [
      { x: (mobile ? .14 : .19) + Math.sin(t * .27) * .04,
        y: (mobile ? .35 : .53) + Math.sin(t * .21) * .065,
        w: isAscii ? (mobile ? .50 : .42) : (mobile ? .44 : .34),
        h: isAscii ? (mobile ? .45 : .54) : (mobile ? .40 : .48), alpha: breath },
      { x: .85 + Math.sin(t * .23 + 1.2) * .025,
        y: (mobile ? .67 : .43) + Math.sin(t * .18 + 2) * .055,
        w: isAscii ? (mobile ? .34 : .28) : (mobile ? .30 : .22),
        h: isAscii ? .34 : .29, alpha: breath * (isAscii ? .70 : .58) }
    ];
    // The background stays anchored; this soft mask limits the effect to the sides.
    mc.filter = `blur(${Math.max(3, mw * .018)}px)`;
    for (const area of windows) {
      mc.globalAlpha = area.alpha; mc.fillStyle = '#fff'; mc.beginPath();
      mc.roundRect((area.x - area.w / 2) * mw, (area.y - area.h / 2) * mh,
        area.w * mw, area.h * mh, Math.min(mw, mh) * .035);
      mc.fill();
    }
    mc.filter = 'none'; mc.globalAlpha = 1;
  }
  function flowGlyphs(time) {
    const t = time / 1000;
    // Reuse the sampled glyph bitmap; move rows, never the underlying photograph.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, frame.width, frame.height); ctx.drawImage(asciiBase, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (let y = 0, row = 0; y < h; y += asciiLine, row++) {
      const sy = Math.floor(y * scale), sh = Math.min(Math.ceil(asciiLine * scale), glyphs.height - sy);
      if (sh <= 0) continue;
      const x = Math.sin(t * .48) * 13 + Math.sin(t * 2.4 + row * .34) * 9;
      const dy = Math.sin(t * 1.9 + row * .38) * 2.6;
      ctx.globalAlpha = .85 + Math.sin(t * 2.6 - row * .28) * .15;
      ctx.drawImage(glyphs, 0, sy, glyphs.width, sh, x, y + dy, w, sh / scale);
      // Wrap only the edge strip, retaining coverage as the characters flow sideways.
      if (x > 0) ctx.drawImage(glyphs, 0, sy, glyphs.width, sh, x - w, y + dy, w, sh / scale);
      else if (x < 0) ctx.drawImage(glyphs, 0, sy, glyphs.width, sh, x + w, y + dy, w, sh / scale);
    }
    ctx.globalAlpha = 1; composedAlpha = -1;
  }
  function present(alpha = 1) {
    if (presentation.filter === 'ascii' && moving() && asciiLine > 0) flowGlyphs(visualTime);
    // Keep an unmasked copy of the displayed blend so an interrupted fade resumes smoothly.
    if (composedAlpha !== alpha || composed.width !== frame.width || composed.height !== frame.height) {
      composed.width = frame.width; composed.height = frame.height;
      const cc = composed.getContext('2d');
      if (alpha < 1) cc.drawImage(previous, 0, 0, composed.width, composed.height);
      cc.globalAlpha = alpha; cc.drawImage(frame, 0, 0); cc.globalAlpha = 1;
      composedAlpha = alpha;
    }
    if (presentation.region === 'window') paintWindow(visualTime);
    for (const canvas of canvases) {
      if (canvas.width !== frame.width) canvas.width = frame.width;
      if (canvas.height !== frame.height) canvas.height = frame.height;
      const out = canvas.getContext('2d');
      out.clearRect(0, 0, canvas.width, canvas.height);
      out.drawImage(composed, 0, 0);
      if (presentation.region === 'window') {
        out.globalCompositeOperation = 'destination-in';
        out.drawImage(windowMask, 0, 0, canvas.width, canvas.height);
        out.globalCompositeOperation = 'source-over';
      }
      canvas.hidden = !store.enabled || !valid;
    }
  }
  function animate(now) {
    animation = 0;
    if (disposed || !valid || !visible || document.hidden || !store.enabled) return;
    const alpha = fadeStart ? clamp((now - fadeStart) / 150) : 1;
    if (now - lastPaint >= 1000 / 24 || fadeStart) {
      if (moving()) visualTime += Math.min(100, Math.max(0, now - lastPaint));
      lastPaint = now; present(alpha);
    }
    if (alpha >= 1) fadeStart = 0;
    if (moving() || fadeStart) animation = requestAnimationFrame(animate);
  }
  function mask(value) {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    (light ? [54, 20, 38] : [44, 20, 50]).forEach((base, i) => {
      const opacity = value <= 50 ? base * (value / 50) ** 1.08 : base + (100 - base) * ((value - 50) / 50) ** 1.08;
      gradient.addColorStop([0, .42, 1][i], `rgba(${light ? '255,255,255' : '0,0,0'},${opacity / 100})`);
    });
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  }
  function render() {
    clearTimeout(timer); timer = 0; cancelAnimationFrame(animation);
    if (disposed || !visible || document.hidden || !source || !w || !h) return;
    if (!store.enabled) { canvases.forEach(c => { c.hidden = true; }); return; }
    const settings = store.current, { filter, palette, strength, size, spacing, inkTone } = settings;
    presentation = settings;
    const nextSignature = `${filter}:${palette}:${sourceURL}`;
    const crossfade = valid && signature !== nextSignature && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    previous.width = frame.width; previous.height = frame.height;
    previous.getContext('2d').drawImage(composed, 0, 0, previous.width, previous.height);
    scale = Math.min(devicePixelRatio || 1, 1.6, 2048 / w, 2048 / h);
    frame.width = Math.max(1, Math.round(w * scale)); frame.height = Math.max(1, Math.round(h * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    sampling.width = Math.max(1, Math.round(w * Math.min(1, 480 / Math.max(w, h))));
    sampling.height = Math.max(1, Math.round(h * Math.min(1, 480 / Math.max(w, h))));
    drawSource(sampleCtx, source, sampling.width, sampling.height, fit);
    let pixels;
    try { pixels = sampleCtx.getImageData(0, 0, sampling.width, sampling.height); }
    catch { valid = false; canvases.forEach(c => { c.hidden = true; }); return; }
    windowMask.width = sampling.width; windowMask.height = sampling.height;
    const data = pixels.data, lookup = paletteLookup(palette);
    if (lookup) {
      for (let p = 0; p < data.length; p += 4) {
        const color = lookup[Math.round(luminance(data[p], data[p + 1], data[p + 2]) * 255)];
        data[p] = color[0]; data[p + 1] = color[1]; data[p + 2] = color[2];
      }
      sampleCtx.putImageData(pixels, 0, 0);
    }
    const sample = (x, y) => {
      const p = (Math.min(sampling.height - 1, Math.floor(y / h * sampling.height)) * sampling.width
        + Math.min(sampling.width - 1, Math.floor(x / w * sampling.width))) * 4;
      return [data[p], data[p + 1], data[p + 2]];
    };
    const s = strength / 100;
    if (filter === 'ascii') {
      const tones = [], count = Math.min(12000, data.length / 4);
      for (let i = 0; i < count; i++) {
        const p = Math.floor(i * data.length / 4 / count) * 4;
        tones.push(luminance(data[p], data[p + 1], data[p + 2]));
      }
      tones.sort((a, b) => a - b);
      const low = tones[Math.floor(count * .08)], high = tones[Math.floor(count * .92)];
      ctx.drawImage(sampling, 0, 0, w, h); mask(settings.mask);
      asciiBase.width = glyphs.width = frame.width; asciiBase.height = glyphs.height = frame.height;
      asciiBase.getContext('2d').drawImage(frame, 0, 0);
      const glyphCtx = glyphs.getContext('2d'); glyphCtx.setTransform(scale, 0, 0, scale, 0, 0);
      const font = Math.round(range(size, 7, w < 720 ? 22 : 24));
      ctx.font = glyphCtx.font = `${font}px monospace`;
      ctx.textAlign = glyphCtx.textAlign = 'center'; ctx.textBaseline = glyphCtx.textBaseline = 'middle';
      const glyphMetrics = [...CHARS].map(c => ctx.measureText(c));
      const step = Math.max(range(spacing, 8, 24), ...glyphMetrics.map(m => m.width * 1.08));
      const at = ctx.measureText('@');
      const line = Math.max(range(spacing, 9, 26), ((at.actualBoundingBoxAscent || font * .8) + (at.actualBoundingBoxDescent || font * .2)) * 1.12, font * 1.04);
      asciiLine = line;
      for (let y = line / 2; y < h; y += line) for (let x = step / 2; x < w; x += step) {
        const rgb = sample(x, y), l = luminance(...rgb), dark = inkTone === 'shadows';
        const raw = dark ? 1 - l : l;
        const normalized = high - low < .025 ? raw : clamp(dark ? (high - l) / (high - low) : (l - low) / (high - low));
        const mix = .72 + .14 * s, t = raw * (1 - mix) + normalized * mix;
        const lev = clamp((t - .22 * s) / (1 - .08 * s - .22 * s));
        const tone = lev * (1 - s) + lev * lev * (3 - 2 * lev) * s;
        const char = CHARS[Math.round(tone * 16)];
        if (tone <= .02 || char === ' ') continue;
        const ink = liftedInk(rgb, s, tone);
        ctx.fillStyle = `rgba(${ink.join(',')},${clamp((.12 + .7 * tone) * (.72 + .28 * s), .06, .94)})`;
        glyphCtx.fillStyle = ctx.fillStyle;
        ctx.fillText(char, x, y); glyphCtx.fillText(char, x, y);
      }
    } else {
      const pixel = Math.max(2, Math.round(range(size, 2, w < 720 ? 7 : 9)));
      const pattern = Math.max(1, Math.round(range(spacing, 1, 4)));
      const levels = Math.max(2, Math.round(range(strength, 8, 2))), blend = range(strength, .32, 1);
      blocks.width = Math.ceil(w / pixel); blocks.height = Math.ceil(h / pixel);
      const blockCtx = blocks.getContext('2d'), output = blockCtx.createImageData(blocks.width, blocks.height);
      for (let y = 0; y < blocks.height; y++) for (let x = 0; x < blocks.width; x++) {
        const rgb = sample(Math.min(w - .01, (x + .5) * pixel), Math.min(h - .01, (y + .5) * pixel));
        const luma = luminance(...rgb) * 255;
        const threshold = (BAYER[Math.floor(y / pattern) % 4][Math.floor(x / pattern) % 4] + .5) / 16;
        const p = (y * blocks.width + x) * 4;
        rgb.forEach((channel, c) => {
          const value = clamp(luma + (channel - luma) * (1.06 + .18 * s), 0, 255);
          const scaled = value / 255 * (levels - 1), integer = Math.floor(scaled);
          const q = integer + (scaled - integer > threshold ? 1 : 0);
          output.data[p + c] = value + (q / (levels - 1) * 255 - value) * blend;
        });
        output.data[p + 3] = 255;
      }
      blockCtx.putImageData(output, 0, 0); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(blocks, 0, 0, blocks.width * pixel, blocks.height * pixel); mask(settings.mask);
    }
    valid = true; signature = nextSignature; composedAlpha = -1;
    fadeStart = crossfade ? performance.now() : 0;
    lastPaint = performance.now(); present(crossfade ? 0 : 1);
    if (moving() || fadeStart) animation = requestAnimationFrame(animate);
  }
  // Coalesce bursts without starving redraws during a continuous slider drag.
  function schedule() { if (!timer) timer = setTimeout(render, 72); }
  const unsubscribe = store.subscribe(schedule);
  const resize = new ResizeObserver(entries => { w = entries[0].contentRect.width; h = entries[0].contentRect.height; schedule(); });
  resize.observe(box);
  const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) schedule(); else cancelAnimationFrame(animation); });
  intersection.observe(box);
  document.addEventListener('visibilitychange', schedule);
  motionPreference.addEventListener('change', schedule);
  return {
    canvases,
    render,
    setLight(next) { light = next; schedule(); },
    async setSource(url) {
      if (requestedURL === url) return;
      requestedURL = url; const token = ++generation;
      const image = new Image(); image.crossOrigin = 'anonymous'; image.src = url;
      try { await image.decode(); } catch { if (token === generation) { requestedURL = null; source = null; valid = false; canvases.forEach(c => { c.hidden = true; }); } return; }
      if (disposed || token !== generation) return;
      source = image; sourceURL = url; render();
    },
    destroy() { disposed = true; generation++; clearTimeout(timer); cancelAnimationFrame(animation); unsubscribe(); resize.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', schedule); motionPreference.removeEventListener('change', schedule); canvases.forEach(c => c.remove()); }
  };
}
