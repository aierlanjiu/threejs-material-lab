import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

// Headless SwiftShader stalls on hundreds of transmissive cubes; use the local GPU.
const browser = await chromium.launch({ headless: false });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8000/index.html?intro=skip', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.luDiagnostics);
  await page.evaluate(() => kineticLyricsManager.prepareGravity());
  console.log('Gravity shaders prepared');
  assert.equal(await page.evaluate(() => kineticLyricsManager.mode), 'slot', 'preparation must preserve the visible mode');
  assert.equal(await page.evaluate(() => luDiagnostics.matrixGroup.visible), true, 'preparation must preserve the current scene');
  await page.locator('#performanceCapsule').click();
  await page.locator('#playlistSelect').selectOption('anime_op_we_are');
  await page.waitForFunction(() => state.audioReady && state.audioCtx.state === 'running');
  await page.evaluate(() => {
    state.enableTitleIntro = state.isIntroPlaying = false;
    const track = state.playlist[state.currentTrackIndex];
    const slider = document.querySelector('#timeProgressSlider');
    slider.value = 33 / track.buffer.duration * 100;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => state.audioReady && getSynchronizedLyricContext().activeText.includes('梦想'));
  await page.locator('#lueTabRecord').click();
  await page.locator('#videoAspectSelect').selectOption('portrait');
  await page.locator('#recordToggle').click();
  await page.waitForFunction(() => state.isRecording);
  console.log('Portrait recording started with local music');
  const switchInfo = await page.evaluate(() => {
    window.__gravityRenderCosts = [];
    const composer = luDiagnostics.composer;
    const render = composer.render.bind(composer);
    composer.render = (...args) => {
      const start = performance.now();
      const result = render(...args);
      window.__gravityRenderCosts.push(performance.now() - start);
      return result;
    };
    const start = performance.now();
    document.querySelector('#kineticEngineModeGroup [data-kmode="gravity"]').click();
    return { switchMs: performance.now() - start, mode: kineticLyricsManager.mode };
  });
  assert.equal(switchInfo.mode, 'gravity');
  await page.waitForFunction(() => window.__gravityRenderCosts.length >= 20).catch(async error => {
    console.error('Gravity recording diagnostic', JSON.stringify({ errors, runtime: await page.evaluate(() => ({
      renders: window.__gravityRenderCosts, mode: kineticLyricsManager.mode,
      recording: state.isRecording, prepared: kineticLyricsManager.gravityPrepared
    })) }));
    throw error;
  });
  const renderCosts = await page.evaluate(() => window.__gravityRenderCosts.slice(0, 20));
  const firstPeak = Math.max(...renderCosts.slice(0, 5));
  const steady = [...renderCosts.slice(5)].sort((a, b) => a - b)[7];
  assert.ok(switchInfo.switchMs < 100, `mode switch blocked the main thread: ${switchInfo.switchMs}ms`);
  assert.ok(firstPeak < steady * 10 + 100, `cold material compilation returned during recording: first ${firstPeak}ms, steady ${steady}ms`);
  assert.equal(await page.evaluate(() => state.isPlayingMusic && /[\u4e00-\u9fff]/u.test(getSynchronizedLyricContext().activeText)), true);
  await page.waitForTimeout(1400);
  const framing = await page.evaluate(() => {
    const camera = luDiagnostics.camera, g = kineticLyricsManager.gravityEngine;
    camera.updateMatrixWorld(true); g.group.updateMatrixWorld(true);
    let visible = 0, total = 0;
    for (const cube of g.bottomCubes) for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
      const corner = camera.position.clone().set(x, y, z).applyMatrix4(cube.matrixWorld).project(camera);
      if (Math.abs(corner.x) <= 1 && Math.abs(corner.y) <= 1 && Math.abs(corner.z) <= 1) visible++;
      total++;
    }
    return { visible, total, fov: camera.fov, baseFov: state.baseFov };
  });
  assert.ok(framing.visible / framing.total > .98, `automatic lens cropped the mound: ${JSON.stringify(framing)}`);
  await page.screenshot({ path: 'output/playwright/lu-gravity-recording-switch.png' });
  if (await page.locator('#lueCoreDrawer').evaluate(el => el.hidden)) await page.locator('#performanceCapsule').click();
  await page.locator('#lueTabRecord').click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }), page.locator('#recordToggle').click()
  ]);
  const path = `output/playwright/lu-gravity-switch-${Date.now()}.${download.suggestedFilename().split('.').pop()}`;
  await download.saveAs(path);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,width,height', '-of', 'json', path], { encoding: 'utf8' }));
  assert.ok(probe.streams.some(stream => stream.codec_type === 'audio'), 'recording lost the music');
  assert.ok(probe.streams.some(stream => stream.codec_type === 'video' && stream.width === 1080 && stream.height === 1920));
  assert.ok(Number(probe.format.duration) > 1);
  for (const theme of ['dragon-ball', 'naruto', 'one-piece']) {
    await page.evaluate(theme => document.querySelector(`#avatarGroupTabs [data-group="${theme}"]`).click(), theme);
    const groups = await page.evaluate(() => kineticLyricsManager.gravityEngine.bottomCubes.map(cube => cube.userData.avatarGroup));
    assert.ok(groups.length >= 252 && groups.every(group => group === theme), `mound mixed themes after switching to ${theme}`);
  }
  assert.deepEqual(errors, []);
  console.log('LÜ live music recording / gravity switch PASS', JSON.stringify({ switchInfo, firstPeak, steady, framing, path, probe }));
} finally {
  await browser.close();
}
