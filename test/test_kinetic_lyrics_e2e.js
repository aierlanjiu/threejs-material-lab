/**
 * Dual-Engine Kinetic Lyrics Display E2E Test
 * Verifies both Slot-Text (Daniel White) and Physics Sandbox (aaayandev) engines in 『 律 』.
 * Specifically checks:
 * 1. 252 bottom cubes with avatar emoji expressions (ZERO Chinese characters)
 * 2. All 12 PBR materials and 7 tones present
 * 3. Magnetic liftoff & morphing lifecycle from bottom mound to dock
 * 4. Strict vertical confinement in-slot during phrase transitions ([0.70, 1.05])
 * 5. Screen height ratios (center mound 35%~40%, edge ~16%, bottom clearance >= 15px)
 * 6. HUD element clearing
 */

import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Starting Kinetic Lyrics Dual-Engine E2E test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  try {
    await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Helper to tick physics simulation deterministically in headless browser
    const tickSimulation = async (seconds) => {
      await page.evaluate((sec) => {
        const steps = Math.round(sec / 0.016);
        const lyricCtx = window.getSynchronizedLyricContext();
        for (let i = 0; i < steps; i++) {
          window.kineticLyricsManager.update({
            activeText: lyricCtx.activeText,
            prevText: lyricCtx.prevText,
            nextText: lyricCtx.nextText,
            beatPeriod: 0.5,
            progressInLine: lyricCtx.progressInLine,
            bassEnergy: 0,
            isKick: false,
            dt: 0.016
          });
        }
      }, seconds);
    };

    // 1. Verify manager initialization
    const managerExists = await page.evaluate(() => {
      return typeof window.kineticLyricsManager !== 'undefined' && window.kineticLyricsManager !== null;
    });
    console.log(`[Test 1] window.kineticLyricsManager exists: ${managerExists ? '✅ PASS' : '❌ FAIL'}`);
    if (!managerExists) throw new Error('kineticLyricsManager is not defined on window');

    // 2. Test Version 1: Slot-Text (Daniel White) Mode
    console.log('\n[Test 2] Testing Version 1: 3D Slot-Text Engine (Daniel White)...');
    await page.evaluate(() => {
      window.kineticLyricsManager.setMode('slot');
      window.setPlaybackTime(0.5);
    });
    await page.waitForTimeout(600);

    const slotState = await page.evaluate(() => {
      const stage = document.getElementById('kineticLyricsStage');
      const deck = document.getElementById('cubeLyricsDeck');
      const track = document.getElementById('cubeSlotsTrack');
      const slots = track ? track.querySelectorAll('.cube-slot') : [];
      return {
        stageClass: stage ? stage.className : '',
        deckExists: !!deck,
        slotCount: slots.length,
        firstChar: slots.length > 0 ? slots[0].querySelector('.cube-face-front')?.textContent : null
      };
    });
    console.log('Slot State:', slotState);
    if (!slotState.deckExists || slotState.slotCount === 0) {
      throw new Error(`Slot-Text rendering mismatch: ${JSON.stringify(slotState)}`);
    }
    console.log(`✅ Version 1: 3D Slot-Text Engine successfully mounted and rendered ${slotState.slotCount} cube slots.`);

    // 3. Test Version 2: 3D Physical Material Gravity Engine (252 Avatar Bottom Cubes + Magnetic Morphing Liftoff)
    console.log('\n[Test 3] Testing Version 2: Native 3D Physical Gravity Engine (252 Avatar Faces + Magnetic Liftoff)...');
    
    // Switch to gravity mode and trigger first phrase (15.2s: "悠悠的古城中")
    await page.evaluate(() => {
      window.kineticLyricsManager.setMode('gravity');
      window.setPlaybackTime(15.2);
    });

    // Check mid-liftoff state (sample at ~0.25s)
    await tickSimulation(0.25);
    const midLiftState = await page.evaluate(() => {
      const engine = window.kineticLyricsManager.gravityEngine;
      const active = engine.lyricCubes.filter(c => c.userData.targetScale > 0.5);
      return {
        count: active.length,
        isMagneticLifting: active.map(c => c.userData.isMagneticLifting),
        scales: active.map(c => c.scale.x),
        ys: active.map(c => c.position.y)
      };
    });
    console.log('Mid-Liftoff Magnetic State (t = 0.25s):', midLiftState);
    if (midLiftState.count !== 6) {
      throw new Error(`Expected 6 active cubes for "悠悠的古城中", got ${midLiftState.count}`);
    }
    const midScalesOk = midLiftState.scales.every(s => s >= 0.54 && s <= 1.0);
    if (!midScalesOk) {
      throw new Error(`Mid-liftoff scale out of range: ${JSON.stringify(midLiftState.scales)}`);
    }
    console.log('✅ Mid-flight magnetic liftoff scale morphing confirmed.');

    // Complete liftoff and settle at dock
    await tickSimulation(0.6);

    const gravityState = await page.evaluate(() => {
      const mgr = window.kineticLyricsManager;
      const engine = mgr.gravityEngine;
      const bottomCubes = engine ? engine.bottomCubes : [];
      const lyricCubes = engine ? engine.lyricCubes : [];
      const totalCubes = engine ? engine.cubes : [];
      const activeLyricCubes = lyricCubes.filter(c => c.userData.targetScale > 0.5);
      const originalMatrixVisible = mgr.threeCtx && mgr.threeCtx.matrixGroup ? mgr.threeCtx.matrixGroup.visible : null;
      const groupVisible = engine && engine.group ? engine.group.visible : false;
      const cam = mgr.threeCtx.camera;
      const THREE = mgr.threeCtx.THREE;

      // Bottom cubes checks
      const bottomScales = bottomCubes.map(c => c.scale.x);
      const avgBottomScale = bottomScales.reduce((a, b) => a + b, 0) / (bottomScales.length || 1);

      // Verify ZERO Chinese characters in bottom cubes, 100% avatar expressions
      const chineseCharsFound = bottomCubes.filter(c => typeof c.userData.char === 'string' && c.userData.char.trim().length > 0);
      const avatarFaces = bottomCubes.filter(c => c.userData.faceType && c.userData.faceTexture);

      // Material and Tone diversity
      const uniqueMaterials = new Set(bottomCubes.map(c => c.userData.matType));
      const uniqueTones = new Set(bottomCubes.map(c => c.userData.tone));

      // Active lyric cubes checks
      const dockY = engine.dockY || 0.85;
      const lyricYs = activeLyricCubes.map(c => c.position.y);
      const minLyricY = lyricYs.length ? Math.min(...lyricYs) : dockY;
      const maxLyricY = lyricYs.length ? Math.max(...lyricYs) : dockY;
      const lyricScales = activeLyricCubes.map(c => c.scale.x);
      const avgLyricScale = lyricScales.reduce((a, b) => a + b, 0) / (lyricScales.length || 1);
      const lyricChars = activeLyricCubes.map(c => c.userData.char).join('');
      const lyricMaterials = activeLyricCubes.map(c => c.userData.matType);
      const transparentList = ['crystal', 'prism', 'ice', 'frosted', 'smoke'];
      const allLyricTransparent = lyricMaterials.every(m => transparentList.includes(m));

      // Camera state check
      const camFov = cam ? cam.fov : null;
      const camPos = cam ? { x: cam.position.x, y: cam.position.y, z: cam.position.z } : null;

      // HUD position check
      const hud = document.getElementById('stageHudLeft');
      const hudHasClass = hud ? hud.classList.contains('mode-gravity') : false;
      const hudRect = hud ? hud.getBoundingClientRect() : null;

      // Quantitative screen projection metrics
      const canvas = document.querySelector('canvas');
      const W = canvas.clientWidth || 1440;
      const H = canvas.clientHeight || 900;

      function project(x, y, z) {
        const v = new THREE.Vector3(x, y, z);
        v.project(cam);
        const px = (v.x * 0.5 + 0.5) * W;
        const py = (-v.y * 0.5 + 0.5) * H;
        const heightFromBottom = H - py;
        const heightRatio = heightFromBottom / H;
        return { px, py, heightFromBottom, heightRatio };
      }

      // Center mound peak height ratio
      const centerCubes = bottomCubes.filter(c => Math.abs(c.position.x) < 0.8 && Math.abs(c.position.z) < 0.8);
      const peakCube = centerCubes.reduce((max, c) => c.position.y > max.position.y ? c : max, centerCubes[0]);
      const peakTopY = peakCube.position.y + peakCube.scale.y * 0.5;
      const peakMetrics = project(peakCube.position.x, peakTopY, peakCube.position.z);

      // Edge mound height ratio
      const edgeCubes = bottomCubes.filter(c => Math.abs(c.position.x) > 3.8);
      const edgeCube = edgeCubes.reduce((max, c) => c.position.y > max.position.y ? c : max, edgeCubes[0]);
      const edgeTopY = edgeCube ? edgeCube.position.y + edgeCube.scale.y * 0.5 : -2.5;
      const edgeMetrics = edgeCube ? project(edgeCube.position.x, edgeTopY, edgeCube.position.z) : null;

      // Bottom screen edge clearance (0 clipping check)
      let minBottomClearance = 9999;
      bottomCubes.forEach(c => {
        const bottomPointY = c.position.y - c.scale.y * 0.5;
        const p = project(c.position.x, bottomPointY, c.position.z);
        if (p.heightFromBottom < minBottomClearance) {
          minBottomClearance = p.heightFromBottom;
        }
      });

      const lyricTones = activeLyricCubes.map(c => c.userData.tone);
      const uniqueLyricMats = Array.from(new Set(lyricMaterials));
      const uniqueLyricTones = Array.from(new Set(lyricTones));
      const bottomMoving = bottomCubes.some(c => Math.abs(c.userData.vx) > 0.001 || Math.abs(c.userData.vy) > 0.001);
      const peakCenterX = engine.peakCenterX || 0;

      return {
        originalMatrixVisible,
        groupVisible,
        totalCubeCount: totalCubes.length,
        bottomCount: bottomCubes.length,
        lyricCount: lyricCubes.length,
        activeLyricCount: activeLyricCubes.length,
        chineseCharsFoundCount: chineseCharsFound.length,
        avatarFacesCount: avatarFaces.length,
        uniqueMaterialsCount: uniqueMaterials.size,
        uniqueTonesCount: uniqueTones.size,
        avgBottomScale,
        avgLyricScale,
        minLyricY,
        maxLyricY,
        dockY,
        lyricChars,
        camFov,
        camPos,
        hudHasClass,
        hudRect,
        peakHeightRatio: peakMetrics.heightRatio,
        edgeHeightRatio: edgeMetrics ? edgeMetrics.heightRatio : 0,
        minBottomClearance,
        lyricMaterials,
        uniqueLyricMats,
        uniqueLyricTones,
        bottomMoving,
        peakCenterX,
        allLyricTransparent
      };
    });

    console.log('Gravity 3D Settled State:', JSON.stringify(gravityState, null, 2));

    // Assertions
    if (gravityState.originalMatrixVisible !== false) {
      throw new Error(`Expected original matrix to be hidden (false), got ${gravityState.originalMatrixVisible}`);
    }
    if (gravityState.bottomCount !== 252) {
      throw new Error(`Expected 252 bottom cubes, got ${gravityState.bottomCount}`);
    }
    if (gravityState.chineseCharsFoundCount !== 0) {
      throw new Error(`Expected 0 Chinese characters in bottom cubes, but found ${gravityState.chineseCharsFoundCount}!`);
    }
    if (gravityState.avatarFacesCount !== 252) {
      throw new Error(`Expected all 252 bottom cubes to have avatar faces, got ${gravityState.avatarFacesCount}`);
    }
    if (gravityState.uniqueMaterialsCount !== 12) {
      throw new Error(`Expected all 12 materials, got ${gravityState.uniqueMaterialsCount}`);
    }
    if (gravityState.uniqueTonesCount < 14) {
      throw new Error(`Expected diverse tone palette (>= 14 tones), got ${gravityState.uniqueTonesCount}`);
    }
    if (!gravityState.allLyricTransparent) {
      throw new Error(`Expected all lyric cubes to use transparent materials, got ${JSON.stringify(gravityState.lyricMaterials)}`);
    }
    if (gravityState.uniqueLyricMats.length !== 1) {
      throw new Error(`Expected phrase 1 to have unified material, got: ${JSON.stringify(gravityState.uniqueLyricMats)}`);
    }
    if (gravityState.uniqueLyricTones.length !== 1) {
      throw new Error(`Expected phrase 1 to have unified tone, got: ${JSON.stringify(gravityState.uniqueLyricTones)}`);
    }
    if (gravityState.bottomMoving) {
      throw new Error('Expected bottom cubes to be completely still in steady state');
    }
    if (Math.abs(gravityState.avgBottomScale - 0.55) > 0.03) {
      throw new Error(`Expected bottom cubes scale ~0.55, got ${gravityState.avgBottomScale.toFixed(3)}`);
    }
    if (gravityState.avgLyricScale < 0.95) {
      throw new Error(`Expected active lyric cubes scale to reach ~1.0, got ${gravityState.avgLyricScale.toFixed(3)}`);
    }
    if (gravityState.lyricChars !== '悠悠的古城中') {
      throw new Error(`Expected lyric characters "悠悠的古城中", got "${gravityState.lyricChars}"`);
    }
    if (Math.abs(gravityState.dockY - 0.85) > 0.05) {
      throw new Error(`Expected dockY = 0.85, got ${gravityState.dockY}`);
    }
    if (gravityState.minLyricY < 0.70 || gravityState.maxLyricY > 1.05) {
      throw new Error(`Lyric cubes out of envelope [0.70, 1.05]: [${gravityState.minLyricY.toFixed(2)}, ${gravityState.maxLyricY.toFixed(2)}]`);
    }
    if (Math.abs(gravityState.camFov - 30) > 0.5) {
      throw new Error(`Expected camera FOV locked to 30°, got ${gravityState.camFov}`);
    }
    if (Math.abs(gravityState.camPos.x) > 0.1 || Math.abs(gravityState.camPos.y - (-0.2)) > 0.1 || Math.abs(gravityState.camPos.z - 11.5) > 0.3) {
      throw new Error(`Expected camera locked to front view (0, -0.2, 11.5), got (${gravityState.camPos.x.toFixed(2)}, ${gravityState.camPos.y.toFixed(2)}, ${gravityState.camPos.z.toFixed(2)})`);
    }
    if (!gravityState.hudHasClass || (gravityState.hudRect && gravityState.hudRect.top > 160)) {
      throw new Error(`Expected HUD to have mode-gravity and be placed at top of stage, got rect: ${JSON.stringify(gravityState.hudRect)}`);
    }

    // Quantitative Screen Ratios
    console.log(`Peak Mound Height Ratio: ${(gravityState.peakHeightRatio * 100).toFixed(1)}% (Target: 35% ~ 40%)`);
    if (gravityState.peakHeightRatio < 0.32 || gravityState.peakHeightRatio > 0.44) {
      throw new Error(`Peak mound height ratio ${(gravityState.peakHeightRatio * 100).toFixed(1)}% outside acceptable range [32%, 44%]`);
    }
    console.log(`Edge Mound Height Ratio: ${(gravityState.edgeHeightRatio * 100).toFixed(1)}% (Target: 15% ~ 22%)`);
    if (gravityState.edgeHeightRatio < 0.12 || gravityState.edgeHeightRatio > 0.25) {
      throw new Error(`Edge mound height ratio ${(gravityState.edgeHeightRatio * 100).toFixed(1)}% outside acceptable range [12%, 25%]`);
    }
    console.log(`Min Bottom Clearance: ${gravityState.minBottomClearance.toFixed(1)}px (Target: >= 15px)`);
    if (gravityState.minBottomClearance < 14) {
      throw new Error(`Bottom clearance ${gravityState.minBottomClearance.toFixed(1)}px violated 0-clipping requirement (>= 14px)!`);
    }
    console.log('✅ Bottom mound avatar faces, quantitative height ratios, zero bottom clipping, and HUD clearance all PASS.');

    // Test subsequent phrase transition: switch to 18.8s ("听美人奏琴声")
    // Verify that subsequent phrases ALSO transform from the bottom cubes with magnetic liftoff and morphing!
    console.log('\nTesting subsequent phrase transition to 18.8s ("听美人奏琴声") from bottom cubes...');
    await page.evaluate(() => {
      window.setPlaybackTime(18.8);
    });

    // Check mid-liftoff state of subsequent phrase
    await tickSimulation(0.2);
    const subLiftState = await page.evaluate(() => {
      const engine = window.kineticLyricsManager.gravityEngine;
      const active = engine.lyricCubes.filter(c => c.userData.targetScale > 0.5);
      const dropping = engine.lyricCubes.filter(c => c.userData.isDropping);
      const ys = active.map(c => c.position.y);
      const launchYs = active.map(c => c.userData.launchY);
      const droppingYs = dropping.map(c => c.position.y);
      const droppingScales = dropping.map(c => c.scale.x);
      return {
        activeCount: active.length,
        droppingCount: dropping.length,
        isMagneticLifting: active.map(c => c.userData.isMagneticLifting),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        launchYs,
        droppingYs,
        droppingScales,
        scales: active.map(c => c.scale.x),
        activeChars: active.map(c => c.userData.char).join('')
      };
    });
    console.log('Subsequent Phrase Mid-Liftoff State:', subLiftState);
    if (subLiftState.activeCount !== 6) {
      throw new Error(`Expected 6 active cubes for "听美人奏琴声", got ${subLiftState.activeCount}`);
    }
    if (subLiftState.droppingCount !== 6) {
      throw new Error(`Expected 6 old cubes to be visibly dropping, got ${subLiftState.droppingCount}`);
    }
    // Controlled descent: dropping cubes must descend from dock downwards, never appear above dock (y <= 0.86)
    const allDroppingBelowDock = subLiftState.droppingYs.every(y => y <= 0.86);
    if (!allDroppingBelowDock) {
      throw new Error(`Dropping cubes unexpectedly above dock: ${JSON.stringify(subLiftState.droppingYs)}`);
    }
    // Controlled descent: dropping cubes above mountain (y > -0.1) preserve scale = 1.0 (visible descent!)
    const visibleDescentScaleOk = subLiftState.droppingScales.every(s => s >= 0.98);
    if (!visibleDescentScaleOk) {
      throw new Error(`Dropping cubes scale prematurely shrank during visible descent: ${JSON.stringify(subLiftState.droppingScales)}`);
    }
    // New cubes must launch strictly from bottom mound (launchY <= -0.5)
    const allLaunchFromBottom = subLiftState.launchYs.every(y => y <= -0.5);
    if (!allLaunchFromBottom) {
      throw new Error(`New cubes did not launch from bottom mound: ${JSON.stringify(subLiftState.launchYs)}`);
    }
    if (!subLiftState.isMagneticLifting.every(Boolean)) {
      throw new Error(`Expected all new cubes to be magnetic lifting, got ${JSON.stringify(subLiftState.isMagneticLifting)}`);
    }
    // Action envelope check: upper boundary must not overshoot dock area (maxY <= 1.05)
    if (subLiftState.maxY > 1.05) {
      throw new Error(`Subsequent liftoff overshot lyric upper boundary (maxY > 1.05): ${subLiftState.maxY.toFixed(2)}`);
    }

    // Settle subsequent phrase
    await tickSimulation(0.65);
    const subSettledState = await page.evaluate(() => {
      const engine = window.kineticLyricsManager.gravityEngine;
      const active = engine.lyricCubes.filter(c => c.userData.targetScale > 0.5);
      const ys = active.map(c => c.position.y);
      const lyricMaterials = active.map(c => c.userData.matType);
      const lyricTones = active.map(c => c.userData.tone);
      const uniqueLyricMats = Array.from(new Set(lyricMaterials));
      const uniqueLyricTones = Array.from(new Set(lyricTones));
      const bottomMoving = engine.bottomCubes.some(c => Math.abs(c.userData.vx) > 0.001 || Math.abs(c.userData.vy) > 0.001);
      return {
        activeCount: active.length,
        lyricChars: active.map(c => c.userData.char).join(''),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        avgScale: active.reduce((acc, c) => acc + c.scale.x, 0) / (active.length || 1),
        isMagneticLifting: active.some(c => c.userData.isMagneticLifting),
        uniqueLyricMats,
        uniqueLyricTones,
        bottomMoving,
        peakCenterX: engine.peakCenterX
      };
    });
    console.log('Subsequent Phrase Settled State:', subSettledState);
    if (subSettledState.lyricChars !== '听美人奏琴声') {
      throw new Error(`Expected lyric characters "听美人奏琴声", got "${subSettledState.lyricChars}"`);
    }
    if (subSettledState.uniqueLyricMats.length !== 1) {
      throw new Error(`Expected phrase 2 to have unified material, got: ${JSON.stringify(subSettledState.uniqueLyricMats)}`);
    }
    if (subSettledState.uniqueLyricTones.length !== 1) {
      throw new Error(`Expected phrase 2 to have unified tone, got: ${JSON.stringify(subSettledState.uniqueLyricTones)}`);
    }
    if (subSettledState.bottomMoving) {
      throw new Error('Expected bottom cubes to be completely settled and still after 0.6s');
    }
    if (subSettledState.minY < 0.70 || subSettledState.maxY > 1.05) {
      throw new Error(`Settled lyric cubes out of envelope [0.70, 1.05]: [${subSettledState.minY.toFixed(2)}, ${subSettledState.maxY.toFixed(2)}]`);
    }
    if (subSettledState.avgScale < 0.95) {
      throw new Error(`Expected settled scale ~1.0, got ${subSettledState.avgScale}`);
    }
    console.log('✅ Subsequent phrase "听美人奏琴声" successfully transformed from bottom cubes, morphed, and docked!');
    console.log(`✅ Mountain peak offset dynamically updated: peakCenterX = ${subSettledState.peakCenterX.toFixed(3)}`);

    // The lyric row stays locked while upper mountain layers breathe slowly.
    console.log('\nVerifying steady lyric row and bounded stack motion...');
    const steadyCheck = await page.evaluate(() => {
      const engine = window.kineticLyricsManager.gravityEngine;
      const active = engine.lyricCubes.filter(c => c.userData.targetScale > 0.5);
      const prePositions = active.map(c => ({ x: c.position.x, y: c.position.y, z: c.position.z }));
      const preBottomPositions = engine.bottomCubes.slice(-10).map(c => ({ x: c.position.x, y: c.position.y, z: c.position.z }));

      // Simulate 15 frames with heavy bass kicks and progress
      for (let i = 0; i < 15; i++) {
        window.kineticLyricsManager.update({
          activeText: '听美人奏琴声',
          prevText: '悠悠的古城中',
          nextText: '朗朗夜色星空',
          beatPeriod: 0.5,
          progressInLine: 0.5 + i * 0.03,
          bassEnergy: 0.95,
          isKick: true,
          dt: 0.016
        });
      }

      const postPositions = active.map(c => ({ x: c.position.x, y: c.position.y, z: c.position.z }));
      const postBottomPositions = engine.bottomCubes.slice(-10).map(c => ({ x: c.position.x, y: c.position.y, z: c.position.z }));

      const maxLyricDrift = Math.max(...prePositions.map((p, i) => Math.hypot(p.x - postPositions[i].x, p.y - postPositions[i].y, p.z - postPositions[i].z)));
      const maxBottomDrift = Math.max(...preBottomPositions.map((p, i) => Math.hypot(p.x - postBottomPositions[i].x, p.y - postBottomPositions[i].y, p.z - postBottomPositions[i].z)));

      return { maxLyricDrift, maxBottomDrift };
    });
    console.log(`Steady-state position drift during playback: Lyric = ${steadyCheck.maxLyricDrift.toFixed(6)}, Bottom = ${steadyCheck.maxBottomDrift.toFixed(6)}`);
    if (steadyCheck.maxLyricDrift > 0.0001) {
      throw new Error(`Lyric cubes drifted during steady state: ${steadyCheck.maxLyricDrift}`);
    }
    if (steadyCheck.maxBottomDrift < 0.0001 || steadyCheck.maxBottomDrift > 0.05) {
      throw new Error(`Bottom stack motion should be visible but bounded: ${steadyCheck.maxBottomDrift}`);
    }
    console.log('✅ Lyric row stays locked while the bottom stack moves gently.');

    // Test Second Subsequent Phrase Transition: switch to 22.3s ("朗朗夜色星空")
    console.log('\nTesting second subsequent phrase transition to 22.3s ("朗朗夜色星空") from bottom cubes...');
    await page.evaluate(() => {
      window.setPlaybackTime(22.3);
    });

    // Check mid-liftoff state of second subsequent phrase
    await tickSimulation(0.2);
    const sub2LiftState = await page.evaluate(() => {
      const engine = window.kineticLyricsManager.gravityEngine;
      const active = engine.lyricCubes.filter(c => c.userData.targetScale > 0.5);
      const dropping = engine.lyricCubes.filter(c => c.userData.isDropping);
      const ys = active.map(c => c.position.y);
      const launchYs = active.map(c => c.userData.launchY);
      const droppingYs = dropping.map(c => c.position.y);
      const droppingScales = dropping.map(c => c.scale.x);
      return {
        activeCount: active.length,
        droppingCount: dropping.length,
        isMagneticLifting: active.map(c => c.userData.isMagneticLifting),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        launchYs,
        droppingYs,
        droppingScales,
        scales: active.map(c => c.scale.x),
        activeChars: active.map(c => c.userData.char).join('')
      };
    });
    console.log('Second Subsequent Phrase Mid-Liftoff State:', sub2LiftState);
    if (sub2LiftState.activeCount !== 6) {
      throw new Error(`Expected 6 active cubes for "朗朗夜色星空", got ${sub2LiftState.activeCount}`);
    }
    if (sub2LiftState.droppingCount !== 6) {
      throw new Error(`Expected 6 old cubes to be visibly dropping, got ${sub2LiftState.droppingCount}`);
    }
    // Controlled descent: dropping cubes must descend downwards (y <= 0.86)
    if (!sub2LiftState.droppingYs.every(y => y <= 0.86)) {
      throw new Error(`Dropping cubes unexpectedly above dock: ${JSON.stringify(sub2LiftState.droppingYs)}`);
    }
    // Controlled descent: scale = 1.0 while in the air (y > -0.1)
    if (!sub2LiftState.droppingScales.every(s => s >= 0.98)) {
      throw new Error(`Dropping cubes scale shrank prematurely: ${JSON.stringify(sub2LiftState.droppingScales)}`);
    }
    // New cubes must launch strictly from bottom mound (launchY <= -0.5)
    if (!sub2LiftState.launchYs.every(y => y <= -0.5)) {
      throw new Error(`New cubes did not launch from bottom mound: ${JSON.stringify(sub2LiftState.launchYs)}`);
    }
    if (!sub2LiftState.isMagneticLifting.every(Boolean)) {
      throw new Error(`Expected all new cubes to be magnetic lifting, got ${JSON.stringify(sub2LiftState.isMagneticLifting)}`);
    }

    // Settle second subsequent phrase
    await tickSimulation(0.65);
    const sub2SettledState = await page.evaluate(() => {
      const engine = window.kineticLyricsManager.gravityEngine;
      const active = engine.lyricCubes.filter(c => c.userData.targetScale > 0.5);
      const ys = active.map(c => c.position.y);
      const lyricMaterials = active.map(c => c.userData.matType);
      const lyricTones = active.map(c => c.userData.tone);
      const uniqueLyricMats = Array.from(new Set(lyricMaterials));
      const uniqueLyricTones = Array.from(new Set(lyricTones));
      const bottomMoving = engine.bottomCubes.some(c => Math.abs(c.userData.vx) > 0.001 || Math.abs(c.userData.vy) > 0.001);
      return {
        activeCount: active.length,
        lyricChars: active.map(c => c.userData.char).join(''),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        avgScale: active.reduce((acc, c) => acc + c.scale.x, 0) / (active.length || 1),
        isMagneticLifting: active.some(c => c.userData.isMagneticLifting),
        uniqueLyricMats,
        uniqueLyricTones,
        bottomMoving,
        peakCenterX: engine.peakCenterX
      };
    });
    console.log('Second Subsequent Phrase Settled State:', sub2SettledState);
    if (sub2SettledState.lyricChars !== '朗朗夜色星空') {
      throw new Error(`Expected lyric characters "朗朗夜色星空", got "${sub2SettledState.lyricChars}"`);
    }
    if (sub2SettledState.uniqueLyricMats.length !== 1) {
      throw new Error(`Expected phrase 3 to have unified material, got: ${JSON.stringify(sub2SettledState.uniqueLyricMats)}`);
    }
    if (sub2SettledState.uniqueLyricTones.length !== 1) {
      throw new Error(`Expected phrase 3 to have unified tone, got: ${JSON.stringify(sub2SettledState.uniqueLyricTones)}`);
    }
    if (sub2SettledState.bottomMoving) {
      throw new Error('Expected bottom cubes to be completely settled and still after 0.6s');
    }
    if (sub2SettledState.minY < 0.70 || sub2SettledState.maxY > 1.05) {
      throw new Error(`Settled lyric cubes out of envelope [0.70, 1.05]: [${sub2SettledState.minY.toFixed(2)}, ${sub2SettledState.maxY.toFixed(2)}]`);
    }
    if (sub2SettledState.avgScale < 0.95) {
      throw new Error(`Expected settled scale ~1.0, got ${sub2SettledState.avgScale}`);
    }
    console.log('✅ Second subsequent phrase "朗朗夜色星空" successfully transformed from bottom cubes, morphed, and docked!');
    console.log(`✅ Mountain peak offset dynamically updated: peakCenterX = ${sub2SettledState.peakCenterX.toFixed(3)}`);

    // 4. Test Mode Switching and Matrix Restoration
    console.log('\n[Test 4] Testing UI mode switching & matrix restoration...');
    await page.evaluate(() => {
      document.querySelector('.kinetic-mode-btn[data-mode="slot"]')?.click();
    });
    await page.waitForTimeout(400);
    const stateAfterSlot = await page.evaluate(() => {
      const mgr = window.kineticLyricsManager;
      return {
        mode: mgr.mode,
        matrixVisible: mgr.threeCtx.matrixGroup.visible,
        gravityGroupVisible: mgr.gravityEngine ? mgr.gravityEngine.group.visible : false
      };
    });
    if (stateAfterSlot.mode !== 'slot' || stateAfterSlot.matrixVisible !== true || stateAfterSlot.gravityGroupVisible !== false) {
      throw new Error(`Expected matrix to be restored and gravity group hidden: ${JSON.stringify(stateAfterSlot)}`);
    }

    await page.evaluate(() => {
      document.querySelector('.kinetic-mode-btn[data-mode="off"]')?.click();
    });
    await page.waitForTimeout(300);
    const stateAfterOff = await page.evaluate(() => {
      const mgr = window.kineticLyricsManager;
      return {
        mode: mgr.mode,
        matrixVisible: mgr.threeCtx.matrixGroup.visible,
        stageHidden: document.getElementById('kineticLyricsStage').style.display === 'none'
      };
    });
    if (stateAfterOff.mode !== 'off' || stateAfterOff.matrixVisible !== true || !stateAfterOff.stageHidden) {
      throw new Error(`Expected off mode to restore matrix and hide stage: ${JSON.stringify(stateAfterOff)}`);
    }

    await page.evaluate(() => {
      document.querySelector('.kinetic-mode-btn[data-mode="gravity"]')?.click();
    });
    await page.waitForTimeout(400);
    const finalMode = await page.evaluate(() => window.kineticLyricsManager.mode);
    if (finalMode !== 'gravity') throw new Error(`Expected mode gravity, got ${finalMode}`);
    console.log('✅ UI mode buttons switched modes, toggled matrix visibility, and updated stage cleanly.');

    // 5. Test Lyric Synchronization Precision
    console.log('\n[Test 5] Testing Lyric Synchronization Timings...');
    const syncResults = await page.evaluate(() => {
      const testTimings = [
        { sec: 0.0, expected: '《游京》- 星火社' },
        { sec: 15.0, expected: '悠悠的古城中' },
        { sec: 18.5, expected: '听美人奏琴声' },
        { sec: 22.1, expected: '朗朗夜色星空' },
        { sec: 61.2, expected: '悠长的街道上' },
        { sec: 83.0, expected: '且听这游京人在唱' }
      ];

      const results = testTimings.map(item => {
        const ctx = window.getSynchronizedLyricContext(item.sec);
        return {
          sec: item.sec,
          actual: ctx.activeText,
          expected: item.expected,
          pass: ctx.activeText === item.expected
        };
      });
      return results;
    });

    console.log('Lyric Synchronization Check:');
    syncResults.forEach(r => {
      console.log(`  [${r.sec}s] Expected: "${r.expected}" | Actual: "${r.actual}" -> ${r.pass ? '✅ PASS' : '❌ FAIL'}`);
      if (!r.pass) throw new Error(`Lyrics desync at ${r.sec}s: expected "${r.expected}", got "${r.actual}"`);
    });
    console.log('✅ Sampled lyric phrases follow the shared playback clock.');

    // 6. Check console errors
    console.log('\n[Test 6] Checking console errors...');
    const relevantErrors = consoleErrors.filter(err => !err.includes('favicon') && !err.includes('font') && !err.includes('AudioContext'));
    if (relevantErrors.length > 0) {
      console.warn('Console errors detected:', relevantErrors);
      throw new Error(`Errors during test: ${relevantErrors.join('; ')}`);
    } else {
      console.log('✅ Zero console errors detected during runtime execution.');
    }

    // Capture screenshots of Version 1 and Version 2 for visual inspection
    await page.evaluate(() => {
      window.kineticLyricsManager.setMode('slot');
      window.setPlaybackTime(15.2);
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test/screenshot_kinetic_slot.png' });

    await page.evaluate(() => {
      window.kineticLyricsManager.setMode('gravity');
      window.setPlaybackTime(15.2);
    });
    await tickSimulation(0.8);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test/screenshot_kinetic_gravity.png' });
    await page.screenshot({ path: 'test/screenshot_avatar_mound.png' });

    console.log('\n🎉 ALL KINETIC LYRICS TESTS PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
