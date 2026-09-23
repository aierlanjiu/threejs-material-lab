import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { characterCues, characterCursorAt } from '../../js/ui/lyric-timing.js';

assert.deepEqual(characterCues({ time: 1, text: '你好', charTimes: [1.1, 1.6] }, 2, 2), [1.1, 1.6]);
assert.equal(characterCursorAt([1.1, 1.6], 1.59), 1);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const schedule = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      if (callback.name === 'animate') { window.__luFrame = callback; return 1; }
      return schedule(callback);
    };
  });
  await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.luDiagnostics && window.__luFrame));
  const result = await page.evaluate(() => {
    window.luDiagnostics.composer.render = () => {};
    const enhanced = window.parseLrcString('[00:01.00]<00:01.00>你<00:01.30>好');
    state.lyricOffsetMs = 0;
    const tracks = window.luDiagnostics.lyricTracks;
    let inspected = 0;
    const failures = [];
    for (const [title, lines] of Object.entries(tracks)) {
      const index = state.playlist.findIndex(track => track.title === title);
      if (index < 0) { failures.push(`missing playlist: ${title}`); continue; }
      state.currentTrackIndex = index;
      state.songTitle = title;
      lines.forEach((line, lineIndex) => {
        const next = lines[lineIndex + 1];
        const at = line.time + Math.min(0.05, next ? (next.time - line.time) / 2 : 0.05);
        const context = window.getSynchronizedLyricContext(at);
        if (context.activeText !== line.text || context.lineKey !== `${title}:${lineIndex}`) {
          failures.push(`${title} @${at}: ${context.activeText}`);
        }
        if (context.characterCursor < 0 || context.characterCursor > [...line.text].filter(char => char.trim()).length) {
          failures.push(`${title} cursor @${at}`);
        }
        inspected++;
      });
    }
    const synthetic = state.playlist.findIndex(track => track.title === 'CYBER CRYSTAL FLOW');
    state.currentTrackIndex = synthetic;
    state.songTitle = state.playlist[synthetic].title;
    const context = window.getSynchronizedLyricContext(6.1);
    const manager = window.kineticLyricsManager;
    manager.setMode('slot');
    manager.update({ ...context, beatPeriod: 0.5, bassEnergy: 0, isKick: false, dt: 0.016 });
    const slotCount = document.querySelectorAll('.cube-slot:not(.cube-slot-space)').length;
    window.__luFrame(performance.now() + 16);
    const slotCamera = window.luDiagnostics.camera;
    const slotBefore = { fov: slotCamera.fov, x: slotCamera.position.x, y: slotCamera.position.y, z: slotCamera.position.z };
    state.camMotionMode = 'on'; state.enableDynamicFov = true; state.fovMode = 'snap'; state.isPlayingMusic = true;
    state.beatCount = 4;
    window.updateMasterChoreography(0.016);
    const slotAfter = { fov: slotCamera.fov, x: slotCamera.position.x, y: slotCamera.position.y, z: slotCamera.position.z };
    state.isPlayingMusic = false;
    state.currentTrackIndex = 0;
    state.songTitle = state.playlist[0].title;
    const early = window.getSynchronizedLyricContext(14.9);
    const late = window.getSynchronizedLyricContext(17.1);
    manager.update({ ...early, beatPeriod: 0.5, dt: 0.016 });
    const earlySung = document.querySelectorAll('.cube-slot.char-sung').length;
    manager.update({ ...late, beatPeriod: 0.5, dt: 0.016 });
    const lateSung = document.querySelectorAll('.cube-slot.char-sung').length;
    manager.update({ ...early, beatPeriod: 0.5, dt: 0.016 });
    const seekBackSung = document.querySelectorAll('.cube-slot.char-sung').length;
    state.currentTrackIndex = synthetic;
    state.songTitle = state.playlist[synthetic].title;
    manager.setMode('gravity');
    manager.update({ ...context, beatPeriod: 0.5, bassEnergy: 0, isKick: false, dt: 0.016 });
    const gravityCount = manager.gravityEngine.lyricCubes.filter(cube => cube.userData.targetScale > 0.5).length;
    const sungCount = () => manager.gravityEngine.lyricCubes.filter(cube => cube.userData.targetScale > 0.5 && cube.userData.sung).length;
    const gravityEarlySung = sungCount();
    const laterContext = window.getSynchronizedLyricContext(8.5);
    manager.update({ ...laterContext, beatPeriod: 0.5, bassEnergy: 0, isKick: false, dt: 0.016 });
    const gravityLateSung = sungCount();
    manager.update({ ...context, beatPeriod: 0.5, bassEnergy: 0, isKick: false, dt: 0.016 });
    const gravitySeekBackSung = sungCount();
    const camera = window.luDiagnostics.camera;
    const before = { fov: camera.fov, x: camera.position.x, y: camera.position.y, z: camera.position.z };
    state.gridCols = 6; state.gridRows = 6; window.rebuildMatrix();
    window.__luFrame(performance.now() + 16);
    const after = { fov: camera.fov, x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const nextContext = window.getSynchronizedLyricContext(12.1);
    manager.update({ ...nextContext, beatPeriod: 0.5, bassEnergy: 0, isKick: false, dt: 0.016 });
    window.rebuildMatrix();
    window.__luFrame(performance.now() + 32);
    const afterLine = { fov: camera.fov, x: camera.position.x, y: camera.position.y, z: camera.position.z };
    return { enhanced, inspected, failures, slotCount, gravityCount, expectedCount: [...context.activeText].filter(char => char.trim()).length,
      earlySung, lateSung, seekBackSung, earlyCursor: early.characterCursor, lateCursor: late.characterCursor,
      gravityEarlySung, gravityLateSung, gravitySeekBackSung, gravityEarlyCursor: context.characterCursor, gravityLateCursor: laterContext.characterCursor,
      slotBefore, slotAfter, before, after, afterLine };
  });
  assert.deepEqual(result.failures, [], `timeline mapping errors: ${result.failures.join('; ')}`);
  assert.deepEqual(result.enhanced, [{ time: 1, text: '你好', charTimes: [1, 1.3] }]);
  assert.equal(result.inspected, 196);
  assert.equal(result.slotCount, result.expectedCount);
  assert.equal(result.gravityCount, result.expectedCount);
  assert.equal(result.gravityEarlySung, result.gravityEarlyCursor);
  assert.equal(result.gravityLateSung, result.gravityLateCursor);
  assert(result.gravityLateSung > result.gravityEarlySung);
  assert.equal(result.gravitySeekBackSung, result.gravityEarlyCursor);
  assert.deepEqual(result.slotAfter, result.slotBefore, 'slot lyrics must lock automatic camera motion and FOV');
  assert.equal(result.earlySung, result.earlyCursor);
  assert.equal(result.lateSung, result.lateCursor);
  assert(result.lateSung > result.earlySung, 'characters should reveal as the audio clock advances');
  assert.equal(result.seekBackSung, result.earlyCursor, 'seeking backward should restore character progress');
  assert.deepEqual(result.after, result.before, 'lyric layout rebuild must not reframe the gravity camera');
  assert.deepEqual(result.afterLine, result.before, 'line refresh must not reframe the gravity camera');
  assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
  console.log(`Lyric clock: ${result.inspected} lines across 9 tracks, both engines, and fixed camera PASS`);
} finally {
  await browser.close();
}
