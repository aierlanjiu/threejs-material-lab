export const PALETTES = {
  meadow: ['#2B361F', '#677D45', '#AEBA78', '#E5E1BD'],
  blue: ['#192A4D', '#326AC5', '#A2C2F1', '#EDF3FC'],
  amber: ['#3C200F', '#A74C15', '#EF9A46', '#F7E7CA'],
  lavender: ['#292144', '#6552AB', '#B3A5E4', '#F0ECFB'],
  mono: ['#151515', '#575757', '#A6A6A6', '#ECECEC']
};
export const RECOMMENDED = {
  ascii: { filter: 'ascii', mask: 52, palette: 'original', inkTone: 'shadows', strength: 78, size: 28, spacing: 10, motion: true },
  dither: { filter: 'dither', mask: 24, palette: 'original', inkTone: 'shadows', strength: 72, size: 12, spacing: 0, motion: true }
};
export const STORAGE_KEY = 'luIntroEffect.v2';
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const range = (v, a, b) => a + (b - a) * v / 100;
export const luminance = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

// Only the named image slot consumes this store. No global image filters.
export function createEffectSettings(storage) {
  if (storage === undefined) try { storage = globalThis.localStorage; } catch {}
  let filter = 'ascii', enabled = true;
  const values = structuredClone(RECOMMENDED), listeners = new Set();
  function restore(saved) {
    filter = saved?.filter === 'dither' ? 'dither' : 'ascii';
    enabled = saved?.enabled !== false;
    for (const name of ['ascii', 'dither']) {
      const input = saved?.values?.[name];
      for (const key of ['mask', 'strength', 'size', 'spacing']) {
        values[name][key] = Number.isFinite(input?.[key]) ? clamp(input[key], 0, 100) : RECOMMENDED[name][key];
      }
      values[name].palette = input?.palette === 'original' || Object.hasOwn(PALETTES, input?.palette) ? input.palette : 'original';
      values[name].inkTone = input?.inkTone === 'highlights' ? 'highlights' : 'shadows';
      values[name].motion = input?.motion !== false;
    }
  }
  try { restore(JSON.parse(storage?.getItem(STORAGE_KEY) || 'null')); } catch {}
  function notify(save = true) {
    if (save) try { storage?.setItem(STORAGE_KEY, JSON.stringify({ filter, enabled, values })); } catch {}
    listeners.forEach(fn => fn());
  }
  return {
    get current() { return { ...values[filter] }; },
    get enabled() { return enabled; },
    update(key, value) {
      if (['mask', 'strength', 'size', 'spacing'].includes(key) && Number.isFinite(value)) values[filter][key] = clamp(value, 0, 100);
      else if (key === 'palette' && (value === 'original' || Object.hasOwn(PALETTES, value))) values[filter][key] = value;
      else if (key === 'inkTone' && ['shadows', 'highlights'].includes(value)) values[filter][key] = value;
      else if (key === 'motion' && typeof value === 'boolean') values[filter].motion = value;
      else return;
      notify();
    },
    select(next) { if (Object.hasOwn(RECOMMENDED, next)) { filter = next; notify(); } },
    reset() { values[filter] = { ...RECOMMENDED[filter] }; notify(); },
    toggle(next) { enabled = Boolean(next); notify(); },
    restore(saved) { restore(saved); notify(false); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
