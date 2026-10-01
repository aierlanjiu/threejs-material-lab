import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  const path = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
  if (path !== root && !path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(path);
    response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback => {
      if (callback.name === 'animate') window.__nextLuFrame = callback;
      return 1;
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.luDiagnostics && window.__nextLuFrame));

  const result = await page.evaluate(() => {
    const { state, luDiagnostics: d, kineticLyricsManager: lyrics } = window;
    d.composer.render = () => {};
    state.isPlayingMusic = true;
    state.audioReady = true;
    state.isIntroPlaying = false;
    state.camMotionMode = 'auto';
    state.enableDynamicFov = true;
    state.fovMode = 'bass';
    state.waveMotion = true;
    state.isChoreographyShow = false;
    const start = performance.now();

    const sample = mode => {
      lyrics.setMode(mode);
      const frames = [];
      for (let i = 0; i < 90; i++) {
        state.beatCount = Math.floor(i / 5) + 1;
        state.beatPhase = (i % 5) / 5;
        state.beatPulse = i % 5 === 0 ? 0.95 : 0.1;
        state.bassEnergy = i % 5 === 0 ? 0.85 : 0.28;
        state.midEnergy = 0.42;
        window.__nextLuFrame(start + (mode === 'slot' ? i : i + 90) * 50);
        frames.push({ fov: d.camera.fov, camX: d.camera.position.x,
          rigY: d.matrixGroup.position.y, emote: d.avatarEmote });
      }
      const range = key => Math.max(...frames.map(frame => frame[key])) - Math.min(...frames.map(frame => frame[key]));
      return { fovRange: range('fov'), camXRange: range('camX'), rigYRange: range('rigY'),
        emotes: [...new Set(frames.map(frame => frame.emote).filter(Boolean))] };
    };

    const slot = sample('slot');
    const off = sample('off');
    state.activeFormation = 'ring';
    state.gridCols = 4;
    state.gridRows = 4;
    state.gridLayers = 2;
    window.rebuildMatrix();
    let maxCornerNdcY = 0;
    const Vector3 = d.camera.position.constructor;
    for (let i = 0; i < 120; i++) {
      state.beatCount = Math.floor(i / 5) + 1;
      state.beatPhase = (i % 5) / 5;
      state.beatPulse = i % 5 === 0 ? 0.95 : 0.1;
      state.bassEnergy = i % 5 === 0 ? 0.85 : 0.28;
      window.__nextLuFrame(start + (i + 180) * 50);
      if (i < 70) continue;
      d.camera.updateMatrixWorld(true);
      d.matrixGroup.updateMatrixWorld(true);
      for (const unit of d.matrixGroup.children) {
        for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
          maxCornerNdcY = Math.max(maxCornerNdcY,
            Math.abs(unit.localToWorld(new Vector3(x, y, z)).project(d.camera).y));
        }
      }
    }
    state.isChoreographyShow = true;
    state.beatCount = 32;
    window.updateMasterChoreography(0.05);
    const choreographedFovMode = state.fovMode;
    const choreographedWave = state.wavePattern;
    state.isChoreographyShow = false;
    let snapCornerNdcY = 0;
    let minSnapFov = Infinity;
    let maxSnapFov = -Infinity;
    for (let i = 0; i < 100; i++) {
      state.beatCount = 32 + Math.floor(i / 5);
      state.beatPhase = (i % 5) / 5;
      state.beatPulse = i % 5 === 0 ? 0.95 : 0.1;
      state.bassEnergy = i % 5 === 0 ? 0.85 : 0.28;
      window.__nextLuFrame(start + (i + 300) * 50);
      minSnapFov = Math.min(minSnapFov, d.camera.fov);
      maxSnapFov = Math.max(maxSnapFov, d.camera.fov);
      if (i < 50) continue;
      d.camera.updateMatrixWorld(true);
      d.matrixGroup.updateMatrixWorld(true);
      for (const unit of d.matrixGroup.children) {
        for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
          snapCornerNdcY = Math.max(snapCornerNdcY,
            Math.abs(unit.localToWorld(new Vector3(x, y, z)).project(d.camera).y));
        }
      }
    }
    return { slot, off, maxCornerNdcY, formation: state.activeFormation,
      fovMode: choreographedFovMode, wavePattern: choreographedWave,
      snapFovRange: maxSnapFov - minSnapFov, snapCornerNdcY };
  });
  console.log(result);
  for (const [mode, sample] of Object.entries({ slot: result.slot, off: result.off })) {
    assert.ok(sample.fovRange > 2.5, `${mode}: FOV did not visibly react to music`);
    assert.ok(sample.camXRange > 0.7, `${mode}: camera did not perform its orbit`);
    assert.ok(sample.rigYRange > 0.15, `${mode}: cubes did not hit musical beats`);
  }
  assert.ok(result.slot.emotes.length >= 2, 'Music did not change the avatar expression');
  assert.ok(result.maxCornerNdcY < 1, `Ring formation was clipped by the moving camera: ${result.maxCornerNdcY}`);
  assert.notEqual(result.formation, 'grid', 'The musical movement sequence did not change formation');
  assert.equal(result.fovMode, 'snap', 'The movement sequence did not switch its FOV direction');
  assert.equal(result.wavePattern, 'equalizer', 'The movement sequence did not switch its wave pattern');
  assert.ok(result.snapFovRange > 8, 'The choreographed snap FOV did not switch between lens widths');
  assert.ok(result.snapCornerNdcY < 1, `The snap FOV cropped the ring: ${result.snapCornerNdcY}`);
  assert.deepEqual(errors, [], 'The page reported JavaScript errors');
  console.log('Music choreography, camera, FOV, and avatar expressions: PASS');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
