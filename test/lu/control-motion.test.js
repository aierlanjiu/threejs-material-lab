import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.luDiagnostics && window.state?.bgImageTexture));

  const capsule = page.locator('#performanceCapsule');
  const originalWidth = await capsule.evaluate(element => element.getBoundingClientRect().width);
  const recordLabel = await page.locator('#recordToggle .face-idle').evaluate(face => {
    const textNode = [...face.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const label = range.getBoundingClientRect();
    const button = face.closest('button').getBoundingClientRect();
    return { width: label.width, right: label.right, buttonRight: button.right };
  });
  assert(recordLabel.width > 15 && recordLabel.right <= recordLabel.buttonRight, 'mobile record label is hidden or clipped');
  await page.locator('#playPauseBtn').click();
  await page.waitForFunction(() => document.querySelector('#playPauseBtn').dataset.playState === 'playing');
  assert.equal(await page.locator('#playPauseBtn .face-pause').getAttribute('aria-hidden'), 'false');
  assert.equal(await capsule.evaluate(element => element.getBoundingClientRect().width), originalWidth);
  await page.locator('#playPauseBtn').click();
  assert.equal(await page.locator('#playPauseBtn .face-play').getAttribute('aria-hidden'), 'false');

  await page.locator('#workbenchHandle').click();
  const geometry = await page.evaluate(() => {
    const dock = document.querySelector('#workbenchDock').getBoundingClientRect();
    const lyric = document.querySelector('#cubeLyricsDeck').getBoundingClientRect();
    return { dockHeight: dock.height, viewportHeight: innerHeight, dockTop: dock.top, lyricBottom: lyric.bottom };
  });
  assert(geometry.dockHeight / geometry.viewportHeight <= .35, 'mobile workbench exceeds 35dvh');
  assert(geometry.lyricBottom <= geometry.dockTop + 2, 'workbench covers the lyric rail');
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

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await page.locator('#wavePatternGroup .lu-selection-surface').evaluate(element => getComputedStyle(element).transitionDuration);
  assert.match(duration, /0\.001s|0s/, 'reduced motion should simplify selector movement');
  assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
  console.log('LÜ mobile control motion and direct manipulation PASS');
} finally {
  await browser.close();
}
