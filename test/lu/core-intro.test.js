import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const widths = process.env.LU_INTRO_WIDTHS === 'none' ? []
    : (process.env.LU_INTRO_WIDTHS || '390,1440').split(',').map(Number);
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && message.text().includes('Shader Error')) errors.push(message.text());
    });
    await page.addInitScript(() => {
      const NativeAudioContext = window.AudioContext;
      window.introOscillatorCount = 0;
      window.introDecodedAudioCount = 0;
      window.introBufferSourceCount = 0;
      if (!NativeAudioContext) return;
      window.AudioContext = class extends NativeAudioContext {
        createOscillator() {
          window.introOscillatorCount++;
          return super.createOscillator();
        }
        createBufferSource() {
          window.introBufferSourceCount++;
          return super.createBufferSource();
        }
        decodeAudioData(...args) {
          window.introDecodedAudioCount++;
          return super.decodeAudioData(...args);
        }
      };
    });
    await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.luCubeIntro?.phase === 'waiting');
    assert.equal(await page.locator('#luIntroOverlay').isVisible(), true);
    assert.equal(await page.locator('.lu-intro-hint').innerText(), '轻触魔方');
    assert.equal(await page.locator('#luIntroSkip').innerText(), '跳过');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#luIntroOverlay')).backgroundColor), 'rgb(8, 40, 56)',
      'the opening scene should use the ocean palette before the canvas unfolds');
    const plate = await page.evaluate(() => getComputedStyle(document.querySelector('.lu-intro-curtain i'), '::before').backgroundImage);
    assert.match(plate, width <= 760 ? /lu-intro-d-one-piece-portrait\.png/ : /lu-intro-d-one-piece-wide\.png/,
      'the static D backdrop should match the viewport');
    assert.equal(await page.evaluate(() => window.luCubeIntro.backdropMode), 'static-image');
    assert.equal(await page.locator('#luIntroOverlay canvas').count(), 1,
      'the static backdrop must not create a second WebGL renderer');
    assert.deepEqual(await page.locator('#luIntroThemeSelect img').evaluateAll(images =>
      images.map(image => image.complete && image.naturalWidth > 0)), [true, true, true],
      'all three theme buttons need their theme-specific artwork');
    assert.deepEqual(await page.locator('#luIntroThemeSelect img').evaluateAll(images =>
      images.map(image => new URL(image.src).pathname.split('/').pop())),
      ['one-piece-straw-compass.png', 'dragon-ball-shenron-cutout.png', 'naruto-leaf-chakra.png']);
    assert.match(await page.locator('#luIntroThemeSelect [data-theme="dragon-ball"] img').getAttribute('src'), /dragon-ball-shenron-cutout\.png$/,
      'the Dragon Ball selector should show Shenron');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#luIntroThemeSelect .lu-theme-art'), '::after').backgroundImage),
      'none', 'theme artwork should not be framed by the generic cube shell');
    if (width === 1440) {
      const button = page.locator('#luIntroThemeSelect [data-theme="one-piece"]');
      const box = await button.boundingBox();
      await page.mouse.move(box.x + box.width * .8, box.y + box.height * .3);
      assert.notEqual(await button.evaluate(element => element.style.getPropertyValue('--tilt-y')), '',
        'pointer movement should add slight button parallax');
      await page.mouse.move(0, 0);
      assert.equal(await button.evaluate(element => element.style.getPropertyValue('--tilt-y')), '');
    }
    for (const theme of ['dragon-ball', 'naruto']) {
      const themePlate = await page.evaluate(theme => {
        window.luCubeIntro.setTheme(theme);
        return getComputedStyle(document.querySelector('.lu-intro-curtain i'), '::before').backgroundImage;
      }, theme);
      assert.match(themePlate, new RegExp(`lu-intro-d-${theme}-${width <= 760 ? 'portrait' : 'wide'}\\.png`));
      assert.equal(await page.locator('#luIntroWordmark').innerText(), theme === 'dragon-ball' ? 'DRAGON BALL' : 'NARUTO');
    }
    await page.evaluate(() => window.luCubeIntro.setTheme('one-piece'));
    assert.equal(await page.evaluate(() => document.querySelector('.app').inert), true);
    assert.deepEqual(await page.evaluate(() => [window.luCubeIntro.cubieCount, window.luCubeIntro.scrambleMoves]), [27, 8]);
    const shell = await page.evaluate(() => ({
      vertices: window.luCubeIntro.shellVertexCount,
      family: window.luCubeIntro.shellMaterialFamily,
      transmission: window.luCubeIntro.shellTransmission,
      stageFamily: document.querySelector('#material').value
    }));
    assert(shell.vertices > 24, 'the entrance should use a subdivided rounded stage cube shell');
    assert.equal(shell.family, shell.stageFamily, 'the entrance should use the stage crystal material family');
    assert(shell.transmission > .8, 'the entrance should retain crystal transmission');
    assert.equal(await page.evaluate(() => window.luCubeIntro.solved), false);
    assert.equal(await page.locator('#luIntroActivate canvas').count(), 1, 'the opening cube needs a real canvas');
    await page.evaluate(() => { window.introCanvas = document.querySelector('#luIntroActivate canvas'); });

    await page.locator('#luIntroActivate').click();
    await page.waitForFunction(() => window.luCubeIntro.phase === 'solving', null, { timeout: 12000 });
    await page.waitForFunction(() => window.luCubeIntro.phase === 'complete', null, { timeout: 45000 });
    assert.equal(await page.evaluate(() => window.luCubeIntro.solved), true);
    assert.equal(await page.locator('#luIntroOverlay').isVisible(), false);
    assert.equal(await page.evaluate(() => document.querySelector('.app').inert), false);
    const coreIcon = page.locator('#performanceCapsule .lu-core-mark-fallback img');
    assert.equal(await coreIcon.isVisible(), true, 'the current theme artwork should appear in the top-left control');
    assert.match(await coreIcon.getAttribute('src'), /one-piece-straw-compass\.png$/);
    assert.equal(await coreIcon.evaluate(image => image.complete && image.naturalWidth > 0), true);
    assert.equal(await page.locator('#performanceCapsule .lu-cube-canvas').count(), 0);
    assert.equal(await page.locator('.poster-side').count(), 0, 'the poster side labels should be removed');
    await page.locator('#avatarGroupTabs [data-group="dragon-ball"]').evaluate(button => button.click());
    assert.match(await coreIcon.getAttribute('src'), /dragon-ball-shenron-cutout\.png$/,
      'the top-left artwork should follow theme changes');
    await page.locator('#avatarGroupTabs [data-group="one-piece"]').evaluate(button => button.click());
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'performanceCapsule',
      'keyboard focus should land on the persistent core control');
    assert.equal(await page.evaluate(() => window.introCanvas === document.querySelector('#luIntroActivate canvas')), true,
      'the entrance canvas should remain available for replay');
    assert((await page.evaluate(() => window.introDecodedAudioCount)) >= 3,
      'the three physical cube recordings should decode before the turn animation');
    assert((await page.evaluate(() => window.introBufferSourceCount)) >= 9,
      'each layer turn and the final lock should play recorded material');

    await page.locator('#performanceCapsule').click();
    await page.locator('#lueTabCreate').click();
    await page.locator('#luCoreMute').click();
    assert.equal(await page.locator('#luCoreMute').getAttribute('aria-pressed'), 'false');
    await page.locator('#luCoreReplay').click();
    await page.waitForFunction(() => window.luCubeIntro?.phase === 'waiting');
    assert.equal(await page.evaluate(() => window.luCubeIntro.solved), false);
    assert.equal(await page.locator('#luIntroMute').getAttribute('aria-pressed'), 'false');
    await page.locator('#luIntroSkip').click();
    assert.equal(await page.evaluate(() => window.luCubeIntro.phase), 'complete');
    assert.equal(await page.evaluate(() => window.luCubeIntro.solved), true);
    if (width === 390) {
      await page.locator('#performanceCapsule').click();
      await page.locator('#lueTabCreate').click();
      await page.locator('#luCoreReplay').click();
      await page.locator('#luIntroActivate').click();
      await page.locator('#luIntroSkip').click();
      assert.equal(await page.evaluate(() => window.luCubeIntro.phase === 'complete' && window.luCubeIntro.solved), true,
        'skipping during a turn must leave the core solved and usable');
    }
    assert.deepEqual(errors, [], `${width}px browser errors: ${errors.join('; ')}`);
    await page.close();
    console.log(`LÜ expression cube entrance ${width}px PASS`);
  }

  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await reduced.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
  await reduced.waitForFunction(() => window.luCubeIntro?.phase === 'waiting');
  await reduced.locator('#luIntroActivate').click();
  const motionState = await reduced.evaluate(() => ({
    phase: window.luCubeIntro.phase,
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    override: document.documentElement.classList.contains('lu-full-motion')
  }));
  assert.equal(motionState.phase, 'complete', `reduced motion should skip turns: ${JSON.stringify(motionState)}`);
  assert.equal(await reduced.evaluate(() => window.luCubeIntro.solved), true);
  console.log('LÜ expression cube reduced motion PASS');
} finally {
  await browser.close();
}
