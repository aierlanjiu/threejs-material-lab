import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEffectSettings, RECOMMENDED, STORAGE_KEY } from '../../js/effects/effect-settings.js';
const memory = () => {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
};

test('each filter restores its own settings and reset affects only the active filter', () => {
  const store = createEffectSettings(memory());
  assert.deepEqual(store.current, RECOMMENDED.ascii);
  store.update('size', 72); store.update('palette', 'blue'); store.update('inkTone', 'highlights');
  store.select('dither'); assert.deepEqual(store.current, RECOMMENDED.dither);
  store.update('mask', 31); store.update('spacing', 75);
  store.select('ascii');
  assert.equal(store.current.size, 72); assert.equal(store.current.palette, 'blue'); assert.equal(store.current.inkTone, 'highlights');
  store.reset(); assert.deepEqual(store.current, RECOMMENDED.ascii);
  store.select('dither'); assert.equal(store.current.mask, 31); assert.equal(store.current.spacing, 75);
});

test('reload preserves both filters, original comparison, and sync emits no storage echo', () => {
  const storage = memory(), first = createEffectSettings(storage);
  first.update('strength', 41); first.select('dither'); first.update('size', 63); first.toggle(false);
  const second = createEffectSettings(storage);
  assert.equal(second.enabled, false); assert.equal(second.current.filter, 'dither'); assert.equal(second.current.size, 63);
  second.select('ascii'); assert.equal(second.current.strength, 41);
  let notifications = 0;
  const unsubscribe = second.subscribe(() => notifications++);
  const saved = storage.getItem(STORAGE_KEY);
  second.restore({ filter: 'dither', enabled: true, values: { dither: { size: 19 } } });
  assert.equal(second.current.size, 19); assert.equal(second.enabled, true); assert.equal(notifications, 1);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  unsubscribe(); second.toggle(false); assert.equal(notifications, 1);
});

test('corrupt or unavailable storage falls back and invalid values never enter rendering', () => {
  const store = createEffectSettings({ getItem() { return '{'; }, setItem() { throw new Error('quota'); } });
  assert.deepEqual(store.current, RECOMMENDED.ascii);
  store.restore({ filter: 'invalid', values: { ascii: { size: 900, mask: -9, strength: null, palette: '<script>', inkTone: 'evil' } } });
  assert.deepEqual(store.current, { ...RECOMMENDED.ascii, size: 100, mask: 0 });
  store.update('size', NaN); store.update('filter', 'dither'); store.update('palette', 'bogus');
  assert.equal(store.current.filter, 'ascii'); assert.equal(store.current.size, 100); assert.equal(store.current.palette, 'original');
  store.update('mask', 50); assert.equal(store.current.mask, 50);
  const blocked = createEffectSettings({ getItem() { throw new Error('denied'); } });
  assert.deepEqual(blocked.current, RECOMMENDED.ascii);
});

test('prototype property names are rejected as palettes and filters', () => {
  for (const key of ['constructor', '__proto__', 'toString']) {
    const store = createEffectSettings(memory());
    store.restore({ values: { ascii: { palette: key } } });
    assert.equal(store.current.palette, 'original');
    store.update('palette', key); assert.equal(store.current.palette, 'original');
    store.select(key); assert.deepEqual(store.current, RECOMMENDED.ascii);
  }
});
