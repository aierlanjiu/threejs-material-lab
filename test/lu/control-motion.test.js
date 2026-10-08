import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8000/index.html?intro=skip', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.luDiagnostics && window.state?.bgImageTexture));

  const capsule = page.locator('#performanceCapsule');
  const originalWidth = await capsule.evaluate(element => element.getBoundingClientRect().width);

  // 打开四面律核抽屉
  await capsule.click();

  // 1. 播放面：测试播放/暂停切换与进度条拖拽
  await page.locator('#playPauseBtn').click();
  await page.waitForFunction(() => document.querySelector('#playPauseBtn').dataset.playState === 'playing');
  await page.waitForFunction(() => document.querySelector('#performanceCapsuleLabel')?.textContent.includes('《游京》'));
  assert.match(await capsule.getAttribute('aria-label'), /^收起律核工作台/);
  assert.equal(await page.locator('#playPauseBtn .face-pause').getAttribute('aria-hidden'), 'false');
  await page.locator('#playPauseBtn').click();
  assert.equal(await page.locator('#playPauseBtn .face-play').getAttribute('aria-hidden'), 'false');

  const seek = await page.evaluate(() => {
    const slider = document.querySelector('#timeProgressSlider');
    const before = window.state.playbackOffset;
    slider.value = '50';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    const preview = { offset: window.state.playbackOffset, label: document.querySelector('#timeDisplay').textContent };
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    return { before, preview, committed: window.state.playbackOffset };
  });
  assert.equal(seek.preview.offset, seek.before, 'drag preview must not repeatedly seek the audio buffer');
  const seconds = value => value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const [previewTime, totalTime] = seek.preview.label.split(' / ');
  assert(Math.abs(seconds(previewTime) - seconds(totalTime) / 2) < 1.5, 'scrub preview shows the wrong time');
  assert(Math.abs(seek.committed - seconds(totalTime) / 2) < 1.5, 'seek was not committed on change');

  // 2. 演出面：测试抽屉高度 <= 35dvh、波形选择与歌词模式
  await page.locator('#lueTabChoreo').click();
  const geometry = await page.evaluate(() => {
    const drawer = document.querySelector('#lueCoreDrawer').getBoundingClientRect();
    const lyric = document.querySelector('#cubeLyricsDeck').getBoundingClientRect();
    return { drawerHeight: drawer.height, viewportHeight: innerHeight, drawerBottom: drawer.bottom, lyricTop: lyric.top };
  });
  assert(geometry.drawerHeight / geometry.viewportHeight <= .35, 'mobile drawer exceeds 35dvh');
  assert(geometry.drawerBottom <= geometry.lyricTop, 'drawer covers the lyric rail');
  await page.locator('#wavePatternGroup [data-pattern="heartbeat"]').click();
  assert.equal(await page.locator('#wavePatternGroup [data-pattern="heartbeat"]').getAttribute('aria-pressed'), 'true');
  await page.waitForFunction(() => {
    const chosen = document.querySelector('#wavePatternGroup .active').getBoundingClientRect();
    const surface = document.querySelector('#wavePatternGroup .lu-selection-surface').getBoundingClientRect();
    return Math.abs(chosen.x - surface.x) < 2;
  }, null, { timeout: 2000 });
  const indicator = await page.evaluate(() => {
    const chosen = document.querySelector('#wavePatternGroup .active').getBoundingClientRect();
    const surface = document.querySelector('#wavePatternGroup .lu-selection-surface').getBoundingClientRect();
    return { chosen: chosen.toJSON(), surface: surface.toJSON() };
  });
  assert(Math.abs(indicator.chosen.x - indicator.surface.x) < 2, 'wave selector indicator missed its target');

  await page.locator('#kineticModeSwitcher [data-mode="off"]').click();
  assert.equal(await page.locator('#kineticModeSwitcher [data-mode="off"]').getAttribute('aria-checked'), 'true');
  await page.locator('#kineticModeSwitcher [data-mode="slot"]').click();
  assert.equal(await page.locator('#kineticModeSwitcher [data-mode="slot"]').getAttribute('aria-checked'), 'true');
  await page.locator('#kineticModeSwitcher [data-mode="slot"]').focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#kineticModeSwitcher [data-mode="off"]').getAttribute('aria-checked'), 'true');
  await page.locator('#kineticModeSwitcher [data-mode="slot"]').click();

  // 3. 录制面：测试录制按钮尺寸与文案未被裁剪
  await page.locator('#lueTabRecord').click();
  const recordLabel = await page.locator('#recordToggle .face-idle').evaluate(face => {
    const textNode = [...face.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const label = range.getBoundingClientRect();
    const button = face.closest('button').getBoundingClientRect();
    return { width: label.width, right: label.right, buttonRight: button.right };
  });
  assert(recordLabel.width > 15 && recordLabel.right <= recordLabel.buttonRight, 'mobile record label is hidden or clipped');

  // 收起抽屉，验证胶囊尺寸恢复
  await page.keyboard.press('Escape');
  assert.equal(await capsule.evaluate(element => element.getBoundingClientRect().width), originalWidth);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await page.locator('#wavePatternGroup .lu-selection-surface').evaluate(element => getComputedStyle(element).transitionDuration);
  assert.match(duration, /0\.001s|0s/, 'reduced motion should simplify selector movement');
  assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
  console.log('LÜ mobile control motion and direct manipulation PASS');
} finally {
  await browser.close();
}
