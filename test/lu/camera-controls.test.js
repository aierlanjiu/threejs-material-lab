import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback => {
      if (callback.name === 'animate') window.__nextLuFrame = callback;
      return 1;
    };
  });
  await page.goto('http://localhost:8000/index.html?intro=skip', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.luDiagnostics && window.__nextLuFrame);
  // A mode change may wait for the alternate scene's material preparation.
  await page.evaluate(async () => {
    await kineticLyricsManager.prepareGravity();
    await kineticLyricsManager.setMode('gravity');
  });
  await page.waitForFunction(() => kineticLyricsManager.mode === 'gravity');
  const result = await page.evaluate(() => {
    const d = luDiagnostics;
    d.composer.render = () => {};
    state.isPlayingMusic = false;
    state.enableDynamicFov = false;
    state.camMotionMode = 'off';
    let frame = performance.now();
    const advance = count => { for (let i = 0; i < count; i++) window.__nextLuFrame(frame += 50); };
    const input = value => {
      const el = document.querySelector('#fov');
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    kineticLyricsManager.setMode('gravity');
    advance(30);
    input(60);
    const initial = d.camera.fov;
    advance(60);
    const gravityFov = d.camera.fov;
    const eye = d.camera.position.toArray();
    d.camera.updateMatrixWorld(true);
    const projection60 = Math.abs(new (d.camera.position.constructor)(1, 0, 0).project(d.camera).x);
    input(30);
    advance(60);
    d.camera.updateMatrixWorld(true);
    const projection30 = Math.abs(new (d.camera.position.constructor)(1, 0, 0).project(d.camera).x);
    input(60);
    kineticLyricsManager.setMode('slot');
    kineticLyricsManager.setMode('gravity');
    advance(60);
    const afterModes = d.camera.fov;
    document.querySelector('#camMotionGroup [data-cam-mode="on"]').click();
    advance(40);
    const positions = [];
    for (let i = 0; i < 100; i++) { advance(1); positions.push(d.camera.position.x); }
    const idleOrbit = Math.max(...positions) - Math.min(...positions);
    document.querySelector('#camMotionGroup [data-cam-mode="off"]').click();
    const stopped = d.camera.position.clone();
    advance(30);
    const drift = d.camera.position.distanceTo(stopped);
    for (const theme of ['dragon-ball', 'naruto', 'one-piece']) {
      document.querySelector(`#avatarGroupTabs [data-group="${theme}"]`).click();
      const groups = kineticLyricsManager.gravityEngine.bottomCubes.map(cube => cube.userData.avatarGroup);
      if (!groups.every(group => group === theme)) throw new Error(`Mixed avatars in ${theme}: ${[...new Set(groups)]}`);
    }
    document.querySelector('#orbitModeGroup [data-orbit="full"]').click();
    document.querySelector('#camMotionGroup [data-cam-mode="on"]').click();
    const startAngle = Math.atan2(d.camera.position.x, d.camera.position.z);
    advance(160);
    const fullOrbitAngle = Math.atan2(d.camera.position.x, d.camera.position.z) - startAngle;
    document.querySelector('#camMotionGroup [data-cam-mode="off"]').click();
    document.querySelector('#inspectorResetCam').click();
    advance(30);
    const reset = { eye: d.camera.position.toArray(), fov: d.camera.fov };
    const limits = [];
    for (const value of [10, 100]) { input(value); advance(80); limits.push(d.camera.fov); }
    input(60);
    state.enableDynamicFov = true;
    const ranges = {};
    for (const mode of ['bass', 'dolly', 'sine', 'snap']) {
      document.querySelector(`#fovModeGroup [data-fmode="${mode}"]`).click();
      const samples = [];
      for (let i = 0; i < 120; i++) {
        state.beatPulse = i % 20 < 10 ? 1 : 0;
        state.beatCount = Math.floor(i / 10);
        advance(1);
        samples.push(d.camera.fov);
      }
      ranges[mode] = Math.max(...samples) - Math.min(...samples);
    }
    document.querySelector('#fovModeGroup [data-fmode="sine"]').click();
    state.audioReady = state.isPlayingMusic = state.isChoreographyShow = true;
    state.beatCount = 160;
    window.updateMasterChoreography();
    const manualMode = state.fovMode;
    state.audioReady = state.isPlayingMusic = false;
    state.enableDynamicFov = false;
    input(60);
    advance(80);
    window.__advanceCameraTest = advance;
    return { initial, gravityFov, afterModes, idleOrbit, drift, eye, projection30, projection60,
      fullOrbitAngle, reset, limits, ranges, manualMode };
  });
  assert.ok(result.initial < 60, 'slider must request a smooth change rather than snap to the target');
  assert.ok(Math.abs(result.gravityFov - 60) < 0.05, 'gravity mode must retain the user FOV');
  assert.ok(Math.abs(result.afterModes - 60) < 0.05, 'mode switches must preserve the user FOV');
  assert.ok(result.projection60 < result.projection30 * 0.65, 'FOV must change visible magnification rather than be cancelled by camera distance');
  assert.ok(result.idleOrbit > 0.2, 'always-on camera motion must run while music is paused');
  assert.ok(result.drift < 0.001, 'camera-off must preserve the current position');
  assert.ok(Math.abs(result.fullOrbitAngle) > 0.5, 'full orbit must visibly advance');
  assert.ok(Math.abs(result.reset.eye[0]) < 0.001 && Math.abs(result.reset.eye[2] - 11.5) < 0.001, 'reset must restore gravity framing');
  assert.ok(Math.abs(result.reset.fov - 60) < 0.05, 'reset must preserve the base FOV');
  assert.ok(Math.abs(result.limits[0] - 10) < 0.05 && Math.abs(result.limits[1] - 100) < 0.05, 'the complete FOV range must be usable');
  for (const [mode, range] of Object.entries(result.ranges)) assert.ok(range > 1, `${mode} FOV mode must respond`);
  assert.equal(result.manualMode, 'sine', 'director chapters must preserve a manually selected lens mode');
  const box = await page.locator('#stage canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -160);
  const wheel = await page.evaluate(() => {
    const requested = +document.querySelector('#fov').value;
    window.__advanceCameraTest(80);
    return { requested, actual: luDiagnostics.camera.fov };
  });
  assert.ok(wheel.requested < 60, 'wheel must update the base FOV slider');
  assert.ok(Math.abs(wheel.actual - wheel.requested) < 0.05, 'wheel FOV must remain after settling');
  console.log('LÜ camera controls, persistent FOV, wheel zoom, and gravity themes PASS', JSON.stringify({ result, wheel }));
} finally {
  await browser.close();
}
