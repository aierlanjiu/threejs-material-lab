import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.LU_BASE_URL || 'http://127.0.0.1:8018';
const artifacts = process.env.LU_TEST_ARTIFACTS || '/tmp/lu-ascii-qa';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/intro-effects.html`);
    await page.waitForFunction(() => document.querySelector('#effectPreview canvas').width > 20);
    await page.locator('[data-filter=dither]').click();
    await page.locator('[data-motion=false]').click();
    for (const theme of ['one-piece', 'dragon-ball', 'naruto']) {
      await page.selectOption('#effectTheme', theme);
      await page.waitForFunction(theme => document.querySelector('#effectImage').naturalWidth > 0 && document.querySelector('#effectImage').src.includes(theme), theme);
      await page.waitForTimeout(350);
      await page.evaluate(() => {
        const canvas = document.querySelector('#effectPreview canvas');
        window.stillDither = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        window.ditherDrift = { brighter: 0, darker: 0, center: 0 };
      });
      await page.locator('[data-motion=true]').click();
      for (let n = 0; n < 8; n++) {
        await page.waitForTimeout(180);
        await page.evaluate(() => {
          const canvas = document.querySelector('#effectPreview canvas');
          const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let brighter = 0, darker = 0, center = 0, count = 0;
          for (let y = 0; y < canvas.height; y += 3) for (let x = 0; x < canvas.width; x += 3) {
            const p = (y * canvas.width + x) * 4;
            let delta = 0;
            for (let c = 0; c < 3; c++) {
              const difference = data[p + c] - window.stillDither[p + c];
              delta = Math.max(delta, Math.abs(difference));
              if (difference > 12) brighter++;
              if (difference < -12) darker++;
            }
            if (x > canvas.width * .46 && x < canvas.width * .54 && y > canvas.height * .43 && y < canvas.height * .53) center = Math.max(center, delta);
            count += 3;
          }
          window.ditherDrift.brighter = Math.max(window.ditherDrift.brighter, brighter / count);
          window.ditherDrift.darker = Math.max(window.ditherDrift.darker, darker / count);
          window.ditherDrift.center = Math.max(window.ditherDrift.center, center);
        });
      }
      const motion = await page.evaluate(() => window.ditherDrift);
      console.log(`${width}px ${theme}: ${JSON.stringify(motion)}`);
      // Naruto has small blue orbs around a largely warm, deliberately still image.
      assert(motion.brighter > .005 && motion.darker > .005, 'Dither must move quantization texture in both tonal directions, beyond a faint screen glow');
      // Blending identical opaque colors can round one 8-bit channel by one.
      assert(motion.center <= 1, 'the central composition must remain stable within canvas rounding');
      await page.screenshot({ path: `${artifacts}/dither-flow-${theme}-${width}.png`, fullPage: true });
      await page.locator('[data-motion=false]').click();
      await page.waitForTimeout(180);
      const still = await page.locator('#effectPreview canvas').evaluate(canvas => canvas.toDataURL());
      await page.waitForTimeout(250);
      assert.equal(await page.locator('#effectPreview canvas').evaluate(canvas => canvas.toDataURL()), still, 'Dither static mode must freeze');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-motion=true]').click();
    await page.waitForTimeout(180);
    const reduced = await page.locator('#effectPreview canvas').evaluate(canvas => canvas.toDataURL());
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#effectPreview canvas').evaluate(canvas => canvas.toDataURL()), reduced, 'reduced motion must freeze Dither');
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS Dither texture flow: three themes, desktop/mobile, quiet center, static and reduced motion');
} finally { await browser.close(); }
