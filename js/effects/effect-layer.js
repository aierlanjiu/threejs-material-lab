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

// A continuous motion field, not a visibility mask: cool water/energy and pale
// clouds move, warm props stay still, and the composition center stays quiet.
export function sceneFlowWeight(u, v, r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const saturation = max ? (max - min) / max : 0;
  const cool = clamp((b - r - .035) / .20) * clamp((b - g * .72) / .18);
  const cloud = b >= r * .9
    ? clamp(((.299 * r + .587 * g + .114 * b) - .35) / .35) * clamp((.4 - saturation) / .25) : 0;
  const radius = Math.hypot((u - .5) / .5, (v - .48) / .6);
  const edge = clamp((radius - .25) / .65);
  return Math.max(cool, cloud * .7) * edge * edge * (3 - 2 * edge);
}

// One image sampling pipeline, optionally mirrored into clipped curtain halves.
export function createEffectLayer({ box, mounts = [box], store, light = false, fit = 'cover' }) {
  const make = () => document.createElement('canvas');
  const canvases = mounts.map(mount => {
    const canvas = make(); canvas.className = 'lu-effect-canvas';
    canvas.setAttribute('aria-hidden', 'true'); mount.append(canvas); return canvas;
  });
  const frame = make(), previous = make(), sampling = make(), blocks = make(), composed = make(), asciiBase = make(), glyphs = make();
  const ctx = frame.getContext('2d'), sampleCtx = sampling.getContext('2d', { willReadFrequently: true });
  let source, sourceURL, requestedURL, generation = 0, timer, animation, signature, disposed = false, visible = true;
  let w = 1, h = 1, scale = 1, valid = false, flowChunks = [];
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let presentation = store.current, visualTime = 0, lastPaint = 0, fadeStart = 0, composedAlpha = -1;
  const moving = () => flowChunks.length > 0 && presentation.motion && !motionPreference.matches;
  function buildFlowChunks(line, step, sampleOriginal, sprite) {
    flowChunks = [];
    const baseCtx = asciiBase.getContext('2d'), span = Math.max(step * 6, 36);
    for (let y = 0, row = 0; y < h; y += line, row++) for (let x = 0; x < w; x += span) {
      const width = Math.min(span, w - x), height = Math.min(line, h - y);
      let weight = 0;
      for (const position of [.2, .5, .8]) {
        const sx = x + width * position, sy = y + height / 2;
        weight += sceneFlowWeight(sx / w, sy / h, ...sampleOriginal(sx, sy)) / 3;
      }
      const chunk = { x, y, width, height, sx: Math.floor(x * scale), sy: Math.floor(y * scale),
        sw: Math.min(sprite.width - Math.floor(x * scale), Math.ceil(width * scale)),
        sh: Math.min(sprite.height - Math.floor(y * scale), Math.ceil(height * scale)), weight, row };
      if (weight > .08) flowChunks.push(chunk);
      else if (presentation.filter === 'ascii') {
        baseCtx.drawImage(sprite, chunk.sx, chunk.sy, chunk.sw, chunk.sh,
          chunk.x * scale, chunk.y * scale, chunk.width * scale, chunk.height * scale);
      }
    }
  }
  function flowTexture(time) {
    const t = time / 1000, ascii = presentation.filter === 'ascii';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, frame.width, frame.height); ctx.drawImage(asciiBase, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const area of flowChunks) {
      if (ascii) {
        const phase = area.row * .34 + area.x / w * 1.6;
        const dx = (Math.sin(t * .48) * 13 + Math.sin(t * 2.4 + phase) * 9) * area.weight;
        const dy = Math.sin(t * 1.9 + phase) * 2.6 * area.weight;
        ctx.globalAlpha = 1 - (.15 - Math.sin(t * 2.6 - phase) * .15) * area.weight;
        ctx.drawImage(glyphs, area.sx, area.sy, area.sw, area.sh,
          area.x + dx, area.y + dy, area.width, area.height);
      } else {
        // Quantized energy/cloud detail breathes in place; the photograph never shifts.
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = (.025 + Math.sin(t * 1.8 + area.row * .25) * .025) * area.weight;
        ctx.drawImage(asciiBase, area.sx, area.sy, area.sw, area.sh,
          area.x, area.y, area.width, area.height);
      }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; composedAlpha = -1;
  }
  function present(alpha = 1) {
    if (moving()) flowTexture(visualTime);
    // Keep an unmasked copy of the displayed blend so an interrupted fade resumes smoothly.
    if (composedAlpha !== alpha || composed.width !== frame.width || composed.height !== frame.height) {
      composed.width = frame.width; composed.height = frame.height;
      const cc = composed.getContext('2d');
      if (alpha < 1) cc.drawImage(previous, 0, 0, composed.width, composed.height);
      cc.globalAlpha = alpha; cc.drawImage(frame, 0, 0); cc.globalAlpha = 1;
      composedAlpha = alpha;
    }
    for (const canvas of canvases) {
      if (canvas.width !== frame.width) canvas.width = frame.width;
      if (canvas.height !== frame.height) canvas.height = frame.height;
      const out = canvas.getContext('2d');
      out.clearRect(0, 0, canvas.width, canvas.height);
      out.drawImage(composed, 0, 0);
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
    const data = pixels.data, original = data.slice(), lookup = paletteLookup(palette);
    if (lookup) {
      for (let p = 0; p < data.length; p += 4) {
        const color = lookup[Math.round(luminance(data[p], data[p + 1], data[p + 2]) * 255)];
        data[p] = color[0]; data[p + 1] = color[1]; data[p + 2] = color[2];
      }
      sampleCtx.putImageData(pixels, 0, 0);
    }
    const sample = (x, y, input = data) => {
      const p = (Math.min(sampling.height - 1, Math.floor(y / h * sampling.height)) * sampling.width
        + Math.min(sampling.width - 1, Math.floor(x / w * sampling.width))) * 4;
      return [input[p], input[p + 1], input[p + 2]];
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
      buildFlowChunks(line, step, (x, y) => sample(x, y, original), glyphs);
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
      asciiBase.width = frame.width; asciiBase.height = frame.height;
      asciiBase.getContext('2d').drawImage(frame, 0, 0);
      buildFlowChunks(Math.max(12, pixel * 4), Math.max(8, pixel * 2), (x, y) => sample(x, y, original), asciiBase);
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
