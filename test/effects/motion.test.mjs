import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEffectSettings } from '../../js/effects/effect-settings.js';
import { createEffectLayer } from '../../js/effects/effect-layer.js';

test('window motion reuses sampled frames and stops for static, reduced motion, hidden and destroyed layers', async () => {
  const saved = new Map(), raf = new Map(), listeners = new Map();
  let nextRAF = 0, reads = 0, masks = 0, rectangles = [], clock = 1000, frameAlphas = [];
  const preference = { matches: false, addEventListener: (_, fn) => { preference.change = fn; }, removeEventListener: () => {} };
  const output = [];
  const context = () => ({
    clearRect() {}, fillRect() {}, drawImage(source) { if (source?.getContext?.('2d').hasGlyphs) frameAlphas.push(this.globalAlpha ?? 1); }, putImageData() {}, fillText() { this.hasGlyphs = true; }, beginPath() {}, fill() {},
    roundRect(...args) { rectangles.push(args); },
    createLinearGradient() { return { addColorStop() {} }; },
    measureText() { return { width: 7, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 2 }; },
    setTransform() {},
    set globalCompositeOperation(value) { if (value === 'destination-in') masks++; },
    getImageData(x, y, w, h) {
      reads++;
      const data = new Uint8ClampedArray(w * h * 4);
      for (let p = 0; p < data.length; p += 4) { data[p] = data[p + 1] = data[p + 2] = 40 + (p % 180); data[p + 3] = 255; }
      return { data };
    },
    createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }
  });
  const globals = {
    performance: { now: () => clock },
    document: { hidden: false, createElement() { const ctx = context(); return { width: 1, height: 1, setAttribute() {}, getContext: () => ctx, remove() {} }; }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    Image: class { naturalWidth = 320; naturalHeight = 180; async decode() {} },
    devicePixelRatio: 1,
    matchMedia: () => preference,
    ResizeObserver: class { observe() { this.fn([{ contentRect: { width: 320, height: 180 } }]); } constructor(fn) { this.fn = fn; } disconnect() {} },
    IntersectionObserver: class { observe() { this.fn([{ isIntersecting: true }]); } constructor(fn) { this.fn = fn; } disconnect() {} },
    requestAnimationFrame: fn => { raf.set(++nextRAF, fn); return nextRAF; },
    cancelAnimationFrame: id => raf.delete(id)
  };
  for (const [key, value] of Object.entries(globals)) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  let layer;
  const tick = now => { clock = now; const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(fn => fn(now)); };
  const settle = () => new Promise(resolve => setTimeout(resolve, 90));
  try {
    const store = createEffectSettings({ getItem() { return null; }, setItem() {} });
    layer = createEffectLayer({ box: { append: canvas => output.push(canvas) }, store });
    await layer.setSource('test.png');
    const initialReads = reads, initialX = rectangles[0][0];
    assert.equal(initialReads, 1); assert(masks > 0); assert.equal(raf.size, 1);
    rectangles = []; tick(performance.now() + 100);
    assert(rectangles.length > 0); assert.notEqual(rectangles[0][0], initialX);
    assert.equal(reads, initialReads, 'moving windows must not resample the image or regenerate glyphs');
    store.update('motion', false); await settle();
    assert.equal(raf.size, 0, 'static mode must stop scheduling frames');
    store.update('palette', 'blue'); layer.render();
    frameAlphas = []; const start = clock;
    for (let i = 1; i <= 10; i++) tick(start + i * 16);
    assert.equal(raf.size, 0, 'static crossfade must finish and stop');
    assert.equal(frameAlphas.at(-1), 1, 'crossfade must present the fully resolved frame before stopping');
    store.update('motion', true); await settle(); assert.equal(raf.size, 1);
    preference.matches = true; preference.change(); await settle(); assert.equal(raf.size, 0);
    preference.matches = false; preference.change(); await settle(); assert.equal(raf.size, 1);
    document.hidden = true; tick(performance.now() + 1000); assert.equal(raf.size, 0);
    document.hidden = false; listeners.get('visibilitychange')(); await settle(); assert.equal(raf.size, 1);
    store.update('region', 'full'); await settle(); assert.equal(raf.size, 0);
    store.update('region', 'window'); await settle(); assert.equal(raf.size, 1);
    store.toggle(false); await settle(); assert.equal(raf.size, 0); assert.equal(output[0].hidden, true);
    store.toggle(true); await settle(); assert.equal(raf.size, 1);
    layer.destroy(); layer = null; assert.equal(raf.size, 0); assert.equal(listeners.size, 0);
  } finally {
    layer?.destroy();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
