import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback => {
      if (callback.name === 'animate') window.nextLuTestFrame = callback;
      return 1;
    };
  });
  await page.goto('http://localhost:8000/index.html?intro=skip');
  await page.waitForFunction(() => window.luDiagnostics && window.nextLuTestFrame);
  const result = await page.evaluate(async () => {
    const d = luDiagnostics;
    d.composer.render = () => {};
    d.renderer.compileAsync = null;
    await kineticLyricsManager.prepareGravity();
    kineticLyricsManager.setMode('gravity');
    const g = kineticLyricsManager.gravityEngine;
    state.isPlayingMusic = state.audioReady = true;
    state.enableTitleIntro = state.isIntroPlaying = state.isChoreographyShow = false;
    state.enableLyricsDisplay = true;
    const click = selector => document.querySelector(selector).click();
    const input = (selector, value) => {
      const element = document.querySelector(selector); element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const tick = (count = 1, text = '山体与歌词同步', key = text) => {
      for (let i = 0; i < count; i++) g.update(text, '', '', .5, .5, .6, true, .016, key, 3);
    };
    const reset = () => {
      g.isRecontouring = false; g.stackTime = 1;
      g.bottomCubes.forEach(c => {
        const u = c.userData;
        c.position.set(u.restX, u.restY, u.restZ); c.rotation.set(u.restRx, u.restRy, u.restRz);
      });
    };
    const count = () => g.bottomCubes.reduce((n, c) => n + c.userData.contentCount, 0);
    tick(100);
    const waves = {};
    for (const pattern of ['ripple', 'diagonal', 'equalizer', 'spiral', 'heartbeat', 'glitch']) {
      click(`#wavePatternGroup [data-pattern="${pattern}"]`); reset(); tick(120);
      waves[pattern] = g.bottomCubes.slice(0, 16).map(c => +(c.position.y - c.userData.restY).toFixed(6));
    }
    const tiers = [];
    click('#wavePatternGroup [data-pattern="ripple"]');
    const span = () => {
      reset(); const values = [];
      for (let i = 0; i < 160; i++) { tick(); values.push(g.bottomCubes.at(-1).position.y); }
      return Math.max(...values) - Math.min(...values);
    };
    for (const tier of [1, 2, 3]) { click(`#intensityTierGroup [data-tier="${tier}"]`); tiers.push(span()); }
    const amplitudes = [];
    for (const value of [.2, 1]) { input('#waveAmpSlider', value); amplitudes.push(span()); }
    click('#waveMotionToggle'); tick(180);
    const offOffset = Math.max(...g.bottomCubes.map(c => Math.abs(c.position.y - c.userData.restY)));
    click('#waveMotionToggle');
    const cadence = {};
    for (const frequency of [4, 8, 16, 32]) {
      click(`#morphFreqGroup [data-freq="${frequency}"]`);
      state.beatCount = 0; tick(); const first = g.peakCenterX;
      state.beatCount = frequency - 1; tick(); const before = g.peakCenterX;
      state.beatCount = frequency; tick(); cadence[frequency] = { first, before, after: g.peakCenterX };
    }
    const distributions = {};
    for (const distribution of ['all', 'center', 'variety', 'mosaic']) {
      click(`#avatarDistGroup [data-dist="${distribution}"]`); tick(100);
      distributions[distribution] = { count: count(), ids: [...new Set(g.bottomCubes.filter(c => c.userData.contentCount).map(c => c.userData.avatarId))] };
    }
    reset(); tick(100);
    const mosaicLifts = g.bottomCubes.slice(0, 16).map(c => c.position.y - c.userData.restY);
    const mosaicShear = Math.max(...mosaicLifts) - Math.min(...mosaicLifts);
    const mosaicBounds = g.bottomCubes.slice(0, 16).map(c => c.children[0].material.userData.surfaceTexture?.uuid);
    click('#avatarDistGroup [data-dist="center"]'); click('#wavePatternGroup [data-pattern="glitch"]');
    state.isChoreographyShow = true;
    for (const beat of [32, 64, 96, 128, 160]) { state.beatCount = beat; updateMasterChoreography(); tick(); }
    const kept = { wave: state.wavePattern, distribution: state.avatarDist, count: count() };
    state.isChoreographyShow = false;
    const themes = {};
    for (const theme of ['dragon-ball', 'naruto', 'one-piece']) {
      click(`#avatarGroupTabs [data-group="${theme}"]`); tick();
      themes[theme] = [...new Set(g.bottomCubes.map(c => c.userData.avatarGroup))];
    }
    const modes = {};
    for (const mode of ['material', 'avatar', 'text', 'image']) {
      click(`#contentModeGroup [data-mode="${mode}"]`); tick(80);
      modes[mode] = { count: count(), disabled: document.querySelector('#layerModeGroup button').disabled };
    }
    const albumImages = tag => [0, 1, 2].map(index => {
      const bitmap = document.createElement('canvas'); bitmap.width = bitmap.height = 16;
      const ctx = bitmap.getContext('2d'); ctx.fillStyle = ['red', 'green', 'blue'][index]; ctx.fillRect(0, 0, 16, 16);
      return { key: `${tag}-${index}`, bitmap };
    });
    state.imageAlbum = albumImages('first'); state.albumRevision = 1;
    click('#imageDistGroup [data-idist="album"]'); tick(80);
    const imageIds = () => g.bottomCubes.map(c => c.userData.contentTexture?.uuid);
    const firstImages = imageIds(); tick(80); const steadyImages = imageIds();
    click('#albumReseedBtn'); tick(); const reseededImages = imageIds();
    click('#albumClearBtn'); state.imageAlbum = albumImages('second'); tick();
    const replacedImages = imageIds();
    const album = { all: count(), distinct: new Set(firstImages).size, stable: JSON.stringify(firstImages) === JSON.stringify(steadyImages),
      reseeded: JSON.stringify(firstImages) !== JSON.stringify(reseededImages), replaced: firstImages.every(id => !replacedImages.includes(id)) };
    input('#bevelRadius', .08); tick(); const rounded = g.bottomCubes[0].children[0].geometry === g.ctx.getRoundedGeometry();
    click('#contentModeGroup [data-mode="avatar"]'); click('#avatarDistGroup [data-dist="variety"]');
    const layers = {}, crafts = {};
    for (const layer of ['surface', 'inside', 'back']) {
      click(`#layerModeGroup [data-layer="${layer}"]`); tick(80);
      const u = g.bottomCubes[0].userData;
      layers[layer] = { visible: u.decalMesh.visible, z: u.decalMesh.position.z };
      for (const craft of ['conformal', 'emboss', 'hologram']) {
        click(`#adhesionCraftGroup [data-craft="${craft}"]`); tick();
        const c = g.bottomCubes[0];
        crafts[`${layer}/${craft}`] = layer === 'surface'
          ? c.children[0].material.customProgramCacheKey() : c.userData.decalMat.customProgramCacheKey();
      }
    }
    click('#materialSamples [data-material="prism"]');
    for (const [selector, value] of Object.entries({ '#roughness': .35, '#ior': 1.8, '#thickness': .9, '#transmission': .7, '#dispersion': .12 })) input(selector, value);
    tick();
    const material = g.bottomCubes[0].children[0].material;
    const optics = Object.fromEntries(['roughness', 'ior', 'thickness', 'transmission', 'dispersion'].map(k => [k, material[k]]));
    const families = [...new Set(g.cubes.map(c => c.children[0].material.userData.family))];
    for (let line = 0; line < 20; line++) tick(80, `同步歌词第${line}句`, `line-${line}`);
    const resources = { materials: g.presentationMaterials.size, cubes: g.cubes.length };
    const disabled = ['#gridCols', '#gridRows', '#gridLayers', '#matrixSequenceSelect', '#formationSelect'].map(s => document.querySelector(s).disabled);
    const beforeModeChange = { hidden: !d.matrixGroup.visible, hint: document.querySelector('#contentPresentationHint').textContent };
    kineticLyricsManager.setMode('slot');
    const restored = ['#gridCols', '#formationSelect'].map(s => !document.querySelector(s).disabled);
    return { waves, tiers, amplitudes, offOffset, cadence, distributions, mosaicShear, mosaicBounds,
      kept, themes, modes, album, rounded, layers, crafts, optics, families, resources, disabled, beforeModeChange, restored };
  });
  assert.equal(new Set(Object.values(result.waves).map(v => JSON.stringify(v))).size, 6);
  assert.ok(result.tiers[0] < result.tiers[1] && result.tiers[1] < result.tiers[2]);
  assert.ok(result.amplitudes[1] > result.amplitudes[0] * 4);
  assert.ok(result.offOffset < .001);
  for (const c of Object.values(result.cadence)) { assert.equal(c.first, c.before); assert.notEqual(c.before, c.after); }
  assert.ok(result.distributions.all.count >= 252); assert.equal(result.distributions.all.ids.length, 1);
  assert.equal(result.distributions.center.count, 1); assert.ok(result.distributions.variety.ids.length >= 9);
  assert.equal(result.distributions.mosaic.count, 16); assert.ok(result.mosaicShear < .00001);
  assert.deepEqual(result.kept, { wave: 'glitch', distribution: 'center', count: 1 });
  for (const [theme, groups] of Object.entries(result.themes)) assert.deepEqual(groups, [theme]);
  assert.equal(result.modes.material.count, 0); assert.ok(result.modes.avatar.count && result.modes.text.count);
  assert.equal(result.modes.image.count, 0); assert.equal(result.modes.image.disabled, true);
  assert.ok(result.album.all >= 252 && result.album.distinct === 3 && result.album.stable && result.album.reseeded && result.album.replaced);
  assert.equal(result.rounded, true);
  assert.equal(result.layers.surface.visible, false); assert.equal(result.layers.inside.z, 0); assert.equal(result.layers.back.z, -.508);
  for (const layer of ['surface', 'inside', 'back']) assert.equal(new Set(['conformal', 'emboss', 'hologram'].map(c => result.crafts[`${layer}/${c}`])).size, 3);
  assert.deepEqual(result.optics, { roughness: .35, ior: 1.8, thickness: .9, transmission: .7, dispersion: .12 });
  assert.deepEqual(result.families, ['prism']); assert.ok(result.resources.materials < result.resources.cubes * 2);
  assert.ok(result.disabled.every(Boolean) && result.restored.every(Boolean));
  assert.equal(result.beforeModeChange.hidden, true); assert.deepEqual(errors, []);
  delete result.waves; delete result.mosaicBounds;
  console.log('LÜ gravity controls PASS', JSON.stringify(result));
} finally { await browser.close(); }
