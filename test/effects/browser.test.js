import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.LU_BASE_URL || 'http://127.0.0.1:8018';
const artifacts = process.env.LU_TEST_ARTIFACTS || '/tmp/lu-ascii-qa';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.LU_TEST_BROWSER || undefined });
const errors = [];
const fingerprint = canvas => {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let hash = 0;
  for (let i = 0; i < data.length; i += 116) hash = (hash * 31 + data[i] + data[i + 1] + data[i + 2]) >>> 0;
  return hash;
};
async function hash(page) { return page.locator('#effectPreview canvas').evaluate(fingerprint); }
async function waitChanged(page, old) {
  await page.waitForFunction(({ previous, fn }) => (0, eval)(`(${fn})`)(document.querySelector('#effectPreview canvas')) !== previous,
    { previous: old, fn: String(fingerprint) });
}
try {
  for (const width of [1440, 390, 342]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/intro-effects.html`);
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#effectPreview canvas');
      return document.querySelector('#effectImage').naturalWidth > 0 && canvas.width > 20 && !canvas.hidden;
    });
    assert(await hash(page), 'rendered output must contain pixels');
    await page.locator('[data-motion=false]').click();
    assert.equal(await page.locator('input[type=number][data-key=size]').inputValue(), '28');
    const initial = await hash(page);
    await page.locator('input[type=number][data-key=size]').fill('62');
    await waitChanged(page, initial);
    await page.locator('[data-filter=dither]').click();
    assert.equal(await page.locator('[data-tone-row]').isVisible(), false);
    assert.equal(await page.locator('input[type=number][data-key=size]').inputValue(), '12');
    await page.locator('input[type=number][data-key=size]').fill('27');
    await page.locator('[data-filter=ascii]').click();
    assert.equal(await page.locator('input[type=number][data-key=size]').inputValue(), '62');
    await page.locator('.lu-effect-reset').click();
    assert.equal(await page.locator('input[type=number][data-key=size]').inputValue(), '28');
    await page.locator('[data-filter=dither]').click();
    assert.equal(await page.locator('input[type=number][data-key=size]').inputValue(), '27');
    await page.locator('[data-filter=ascii]').click();
    const beforePalette = await hash(page);
    await page.locator('[data-palette=blue]').click(); await waitChanged(page, beforePalette);
    await page.locator('#effectEnabled').uncheck();
    await page.waitForFunction(() => document.querySelector('#effectPreview canvas').hidden);
    await page.locator('#effectEnabled').check();
    await page.waitForFunction(() => !document.querySelector('#effectPreview canvas').hidden);
    for (const theme of ['dragon-ball', 'naruto', 'one-piece']) {
      await page.selectOption('#effectTheme', theme);
      await page.waitForFunction(theme => document.querySelector('#effectImage').complete && document.querySelector('#effectImage').naturalWidth > 0 && document.querySelector('#effectImage').src.includes(theme), theme);
    }
    await page.locator('[data-palette=original]').click();
    await page.locator('.lu-effect-reset').click();
    await page.locator('[data-motion=true]').click();
    await page.waitForTimeout(250);
    const alpha = await page.locator('#effectPreview canvas').evaluate(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let empty = 0, visible = 0;
      for (let p = 3; p < pixels.length; p += 4) { if (pixels[p] < 5) empty++; if (pixels[p] > 50) visible++; }
      return { empty: empty / (pixels.length / 4), visible };
    });
    assert(alpha.empty > .5 && alpha.visible > 100, 'windows should leave most of the source unchanged');
    const movingFrame = await hash(page); await page.waitForTimeout(400);
    assert.notEqual(await hash(page), movingFrame, 'the local reveal should move gently');
    await page.screenshot({ path: `${artifacts}/preview-${width}.png`, fullPage: true });
    const geometry = await page.evaluate(() => {
      const a = document.querySelector('#effectPreview').getBoundingClientRect(), b = document.querySelector('.lu-effect-controls').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth, separated: a.right <= b.left || a.bottom <= b.top, width: document.querySelector('canvas').width, height: document.querySelector('canvas').height };
    });
    assert.equal(geometry.overflow, false); assert.equal(geometry.separated, true);
    assert(geometry.width <= 2048 && geometry.height <= 2048);
    await page.reload();
    assert.equal(await page.locator('input[type=number][data-key=size]').inputValue(), '28');
    await page.close();
    console.log(`PASS preview ${width}px: live pixels, filters, recall/reset, palettes, original comparison, themes, reload, layout`);
  }

  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await reduced.goto(`${base}/intro-effects.html`);
  await reduced.waitForFunction(() => document.querySelector('canvas').width > 20);
  await reduced.locator('[data-filter=dither]').click();
  await reduced.waitForFunction(() => document.querySelector('canvas').width > 20 && !document.querySelector('canvas').hidden);
  assert.equal(await reduced.locator('[data-tone-row]').isVisible(), false);
  await reduced.close();
  assert.deepEqual(errors, []);
  console.log('PASS reduced motion preview and no browser runtime errors');
} finally { await browser.close(); }
