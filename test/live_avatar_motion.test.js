import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback => {
      if (callback.name === 'animate') window.__nextLuFrame = callback;
      return 1;
    };
  });
  await page.goto(`${process.env.LU_TEST_BASE_URL || 'http://localhost:8000'}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.luDiagnostics && window.__nextLuFrame));

  const result = await page.evaluate(async () => {
    window.luDiagnostics.composer.render = () => {};
    const preview = document.querySelector('.avatar-card.active canvas');
    const stage = document.querySelector('#stageWrap');
    const bounds = stage.getBoundingClientRect();
    stage.dispatchEvent(new PointerEvent('pointermove', {
      clientX: bounds.left + bounds.width * 0.85,
      clientY: bounds.top + bounds.height * 0.2,
      bubbles: true
    }));
    const gaze = [state.mouseNormX, state.mouseNormY];
    stage.dispatchEvent(new PointerEvent('pointerleave'));
    const centered = [state.mouseNormX, state.mouseNormY];

    state.isChoreographyShow = false;
    state.camMotionMode = 'auto';
    const camera = window.luDiagnostics.camera;
    const firstFrame = performance.now();
    for (let i = 0; i < 20; i++) window.__nextLuFrame(firstFrame + i * 100);
    const start = camera.position.clone();
    for (let i = 20; i < 50; i++) window.__nextLuFrame(firstFrame + i * 100);
    const idleMotion = camera.position.distanceTo(start);
    state.isPlayingMusic = true;
    state.audioReady = true;
    state.isIntroPlaying = false;
    state.bassEnergy = 0.8;
    for (let i = 50; i < 70; i++) window.__nextLuFrame(firstFrame + i * 100);
    const musicMotion = camera.position.distanceTo(start);
    state.time = 10;
    state.bassEnergy = 0;
    state.waveAmpMultiplier = 0.2;
    state.intensityTier = 1;
    for (let i = 0; i < 50; i++) window.updateMasterChoreography(0.1);
    const cameraControlLow = Math.abs(camera.position.x);
    state.waveAmpMultiplier = 1;
    state.intensityTier = 3;
    for (let i = 0; i < 50; i++) window.updateMasterChoreography(0.1);
    const cameraControlHigh = Math.abs(camera.position.x);
    state.isPlayingMusic = false;
    state.audioReady = false;

    const previewSignature = () => {
      const pixels = preview.getContext('2d').getImageData(0, 0, 256, 256).data;
      let sum = 0;
      for (let i = 0; i < pixels.length; i += 17) sum = (sum * 31 + pixels[i]) >>> 0;
      return sum;
    };
    state.activeEmote = 'happy';
    state.emoteEndTime = Date.now() + 10000;
    window.__nextLuFrame(firstFrame + 7100);
    await new Promise(resolve => setTimeout(resolve, 50));
    const previewHappy = previewSignature();
    state.activeEmote = 'wink';
    window.__nextLuFrame(firstFrame + 7200);
    await new Promise(resolve => setTimeout(resolve, 50));
    const previewWink = previewSignature();

    const { renderLiveAvatar } = await import('./js/avatar/live.js?v=20260923');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const signature = () => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, 256, 256).data;
      let sum = 0;
      for (let i = 0; i < pixels.length; i += 17) sum = (sum * 31 + pixels[i]) >>> 0;
      return sum;
    };
    const draw = async (time, mood, options = {}) => {
      await renderLiveAvatar('one-piece/luffy', canvas, time, mood, options);
      return signature();
    };
    const calm = await draw(1.2, 'calm', { blink: true });
    const happy = await draw(1.2, 'happy', { blink: true });
    const left = await draw(1.2, 'calm', { blink: true, lookX: -1 });
    const right = await draw(1.2, 'calm', { blink: true, lookX: 1 });
    const closed = await draw(0.47, 'calm', { blink: true });
    const open = await draw(0.47, 'calm', { blink: false });
    const breathA = await draw(0, 'calm', { blink: false });
    const breathB = await draw(1.1, 'calm', { blink: false });

    return {
      previewIsCanvas: Boolean(preview), gaze, centered, idleMotion, musicMotion,
      cameraControlLow, cameraControlHigh, previewHappy, previewWink,
      calm, happy, left, right, closed, open, breathA, breathB
    };
  });

  assert.equal(result.previewIsCanvas, true, 'selected avatar should use the live preview canvas');
  assert(result.gaze[0] > 0.5 && result.gaze[1] < -0.5, 'pointer should move the avatar gaze');
  assert.deepEqual(result.centered, [0, 0], 'gaze should recenter when pointer leaves');
  assert(result.idleMotion < 0.001, `auto camera moved while idle: ${result.idleMotion}`);
  assert(result.musicMotion > 0.01, 'auto camera should still move during music');
  assert(result.cameraControlHigh > result.cameraControlLow * 2, 'motion tier and amplitude should reduce camera orbit');
  assert.notEqual(result.previewHappy, result.previewWink, 'live preview should reflect expression controls');
  assert.notEqual(result.calm, result.happy, 'expression should change pixels');
  assert.notEqual(result.left, result.right, 'gaze should change pixels');
  assert.notEqual(result.closed, result.open, 'blink should change pixels');
  assert.notEqual(result.breathA, result.breathB, 'breathing should change pixels');
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  console.log('Live avatar, gaze, blink, breathing, and idle camera: PASS');
} finally {
  await browser.close();
}
