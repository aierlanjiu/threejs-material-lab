import { PALETTES } from './effect-settings.js';

export function createEffectPanel({ element, store }) {
  const names = { original: '原色', meadow: '草甸', blue: '蓝调', amber: '琥珀', lavender: '薰衣草', mono: '黑白' };
  const slider = (key, name) => `<div class="lu-effect-row"><span>${name}</span><span class="lu-effect-slider"><input type="range" min="0" max="100" step="1" data-key="${key}" aria-label="${name}"><span class="lu-effect-number"><input type="number" min="0" max="100" step="1" data-key="${key}" aria-label="${name}数值"><span>%</span></span></span></div>`;
  element.innerHTML = `${slider('mask', '遮罩 / Mask')}
    <div class="lu-effect-row"><span>滤镜 / Filter</span><div class="lu-effect-segments" role="group" aria-label="滤镜"><button type="button" data-filter="ascii">ASCII</button><button type="button" data-filter="dither">Dither</button></div></div>
    <div class="lu-effect-row"><span>色彩 / Color</span><div class="lu-effect-swatches" role="group" aria-label="色彩">${Object.entries(names).map(([key, label]) => `<button type="button" class="lu-effect-swatch" data-palette="${key}" aria-label="${label}" title="${label}" style="${key === 'original' ? '' : `--swatch:linear-gradient(135deg,${PALETTES[key][1]},${PALETTES[key][2]})`}"></button>`).join('')}</div></div>
    <div class="lu-effect-row" data-tone-row><span>采样 / Tones</span><div class="lu-effect-segments" role="group" aria-label="采样色调"><button type="button" data-tone="shadows">暗部</button><button type="button" data-tone="highlights">亮部</button></div></div>
    ${slider('strength', '采样强度')}${slider('size', '尺寸 / Size')}${slider('spacing', '间距 / Spacing')}
    <div class="lu-effect-row"><span>效果区域</span><div class="lu-effect-segments" role="group" aria-label="效果区域"><button type="button" data-region="window">局部视窗</button><button type="button" data-region="full">全幅对比</button></div></div>
    <div class="lu-effect-row"><span data-motion-label>字符动态</span><div class="lu-effect-segments" role="group" data-motion-group aria-label="字符动态"><button type="button" data-motion="true">流动</button><button type="button" data-motion="false">静止</button></div></div>
    <button type="button" class="lu-effect-reset">恢复当前滤镜推荐值</button>`;
  function sync() {
    const settings = store.current;
    for (const input of element.querySelectorAll('input')) {
      input.value = settings[input.dataset.key];
      input.style.setProperty('--fill', `${input.value}%`);
    }
    for (const button of element.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === settings.filter));
    for (const button of element.querySelectorAll('[data-palette]')) button.setAttribute('aria-pressed', String(button.dataset.palette === settings.palette));
    for (const button of element.querySelectorAll('[data-tone]')) button.setAttribute('aria-pressed', String(button.dataset.tone === settings.inkTone));
    for (const button of element.querySelectorAll('[data-region]')) button.setAttribute('aria-pressed', String(button.dataset.region === settings.region));
    element.querySelector('[data-motion-label]').textContent = settings.filter === 'ascii' ? '字符动态' : '视窗动态';
    element.querySelector('[data-motion-group]').setAttribute('aria-label', settings.filter === 'ascii' ? '字符动态' : '视窗动态');
    element.querySelector('[data-motion="true"]').textContent = settings.filter === 'ascii' ? '流动' : '缓动';
    for (const button of element.querySelectorAll('[data-motion]')) { button.setAttribute('aria-pressed', String(button.dataset.motion === String(settings.motion))); button.disabled = settings.region === 'full'; }
    element.querySelector('[data-tone-row]').hidden = settings.filter !== 'ascii';
  }
  const input = event => { if (event.target.matches('input[data-key]') && event.target.value !== '') store.update(event.target.dataset.key, Number(event.target.value)); };
  const click = event => {
    const button = event.target.closest('button');
    if (button?.dataset.filter) store.select(button.dataset.filter);
    else if (button?.dataset.palette) store.update('palette', button.dataset.palette);
    else if (button?.dataset.tone) store.update('inkTone', button.dataset.tone);
    else if (button?.dataset.region) store.update('region', button.dataset.region);
    else if (button?.dataset.motion) store.update('motion', button.dataset.motion === 'true');
    else if (button?.classList.contains('lu-effect-reset')) store.reset();
  };
  element.addEventListener('input', input); element.addEventListener('click', click);
  const unsubscribe = store.subscribe(sync); sync();
  return { destroy() { unsubscribe(); element.removeEventListener('input', input); element.removeEventListener('click', click); } };
}
