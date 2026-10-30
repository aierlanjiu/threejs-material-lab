import { createEffectSettings, STORAGE_KEY } from '../effects/effect-settings.js';
import { createEffectLayer } from '../effects/effect-layer.js';

export function installIntroEffect(overlay) {
  const store = createEffectSettings();
  const layer = createEffectLayer({ box: overlay, mounts: [...overlay.querySelectorAll('.lu-intro-curtain i')], store, fit: 'fill' });
  function refresh() {
    const backdrop = getComputedStyle(overlay).getPropertyValue('--intro-backdrop');
    const path = backdrop.match(/url\(['"]?([^'"\)]+)['"]?\)/)?.[1];
    link.href = `./intro-effects.html?theme=${overlay.dataset.theme || 'one-piece'}`;
    layer.setLight(overlay.dataset.theme === 'naruto');
    // The CSS path is relative to css/lu-cube-intro.css, not this module.
    if (path) layer.setSource(new URL(path, new URL('../../css/lu-cube-intro.css', import.meta.url)).href);
  }
  const theme = new MutationObserver(refresh);
  theme.observe(overlay, { attributes: true, attributeFilter: ['data-theme', 'hidden'] });
  const viewport = matchMedia('(max-width: 760px)'); viewport.addEventListener('change', refresh);
  const storage = event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try { store.restore(JSON.parse(event.newValue || 'null')); } catch {}
  };
  window.addEventListener('storage', storage);
  const link = document.createElement('a');
  link.className = 'lu-intro-effect-link'; link.href = './intro-effects.html';
  link.target = '_blank'; link.rel = 'noopener'; link.textContent = '背景质感 ↗';
  link.setAttribute('aria-label', '调整入场背景质感，在新标签页打开');
  overlay.append(link); refresh();
  return { store, destroy() { theme.disconnect(); viewport.removeEventListener('change', refresh); window.removeEventListener('storage', storage); link.remove(); layer.destroy(); } };
}
