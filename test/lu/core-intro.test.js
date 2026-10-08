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
    await page.addInitScript(() => {
      const NativeAudioContext = window.AudioContext;
      window.introOscillatorCount = 0;
      if (!NativeAudioContext) return;
      window.AudioContext = class extends NativeAudioContext {
        createOscillator() {
          window.introOscillatorCount++;
          return super.createOscillator();
        }
      };
    });
    await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.luCubeIntro?.phase === 'waiting');
    assert.equal(await page.locator('#luIntroOverlay').isVisible(), true);
    assert.equal(await page.locator('.lu-intro-hint').innerText(), '轻触魔方');
    assert.equal(await page.locator('#luIntroSkip').innerText(), '跳过');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#luIntroOverlay')).backgroundColor), 'rgb(16, 16, 20)',
      'the opening scene should hide the stage until the canvas unfolds');
    assert.equal(await page.evaluate(() => document.querySelector('.app').inert), true);
    assert.deepEqual(await page.evaluate(() => [window.luCubeIntro.cubieCount, window.luCubeIntro.scrambleMoves]), [27, 8]);
    const shell = await page.evaluate(() => ({
      vertices: window.luCubeIntro.shellVertexCount,
      family: window.luCubeIntro.shellMaterialFamily,
      stageFamily: document.querySelector('#material').value
    }));
    assert(shell.vertices > 24, 'the entrance should use a subdivided rounded stage cube shell');
    assert.equal(shell.family, shell.stageFamily, 'the entrance should use the current stage material family');
    assert.equal(await page.evaluate(() => window.luCubeIntro.solved), false);
    assert.equal(await page.locator('#luIntroActivate canvas').count(), 1, 'the opening cube needs a real canvas');
    await page.evaluate(() => { window.introCanvas = document.querySelector('#luIntroActivate canvas'); });

    await page.locator('#luIntroActivate').click();
    await page.waitForFunction(() => window.luCubeIntro.phase === 'complete', null, { timeout: 45000 });
    assert.equal(await page.evaluate(() => window.luCubeIntro.solved), true);
    assert.equal(await page.locator('#luIntroOverlay').isVisible(), false);
    assert.equal(await page.evaluate(() => document.querySelector('.app').inert), false);
    assert.equal(await page.locator('#performanceCapsule .lu-cube-canvas').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'performanceCapsule',
      'keyboard focus should land on the persistent cube control');
    assert.equal(await page.evaluate(() => window.introCanvas === document.querySelector('#performanceCapsule canvas')), true,
      'the same cube canvas should continue as the LÜ Core');
    assert((await page.evaluate(() => window.introOscillatorCount)) >= 20,
      'the wake, layer turns, solved cue and unfold should schedule real sound nodes');

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
