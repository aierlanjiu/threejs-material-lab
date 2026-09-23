import { chromium } from 'playwright';

async function testFraming() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  try {
    await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Apply the responsive camera framing in evaluate
    await page.evaluate(() => {
      window.kineticLyricsManager.setMode('gravity');
      window.setPlaybackTime(15.2);

      const engine = window.kineticLyricsManager.gravityEngine;
      const cam = engine.camera;
      const aspect = cam.aspect || (window.innerWidth / window.innerHeight);
      const scaleFactor = Math.max(1.0, 1.42 / aspect);
      const zTarget = 11.5 * scaleFactor;
      const yTarget = -0.2 - 0.15 * (scaleFactor - 1.0);

      cam.position.set(0, yTarget, zTarget);
      cam.lookAt(0, yTarget, 0);
      cam.updateProjectionMatrix();

      // Also style HUD switcher on mobile so it doesn't overlap
      const style = document.createElement('style');
      style.innerHTML = `
        @media (max-width: 640px) {
          .mode-gravity .preset-cam-group { display: none !important; }
          .stage-hud-left.mode-gravity { top: 6px; left: 6px; gap: 4px; max-width: calc(100% - 70px); }
          .stage-hud-left.mode-gravity #status { display: none !important; }
        }
      `;
      document.head.appendChild(style);
    });

    // Run 50 physics steps
    await page.evaluate(() => {
      const lyricCtx = window.getSynchronizedLyricContext();
      for (let i = 0; i < 50; i++) {
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
    });

    await page.waitForTimeout(400);

    // Check projections of lyrics left-most and right-most cubes
    const check = await page.evaluate(() => {
      const engine = window.kineticLyricsManager.gravityEngine;
      const active = engine.lyricCubes.filter(c => c.userData.targetScale > 0.5);
      const cam = engine.camera;
      const THREE = window.kineticLyricsManager.threeCtx.THREE;
      const canvas = document.querySelector('canvas');
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;

      function project(x, y, z) {
        const v = new THREE.Vector3(x, y, z);
        v.project(cam);
        return {
          px: (v.x * 0.5 + 0.5) * W,
          py: (-v.y * 0.5 + 0.5) * H
        };
      }

      const leftCube = active[0];
      const rightCube = active[active.length - 1];
      const leftEdge = project(leftCube.position.x - 0.5, leftCube.position.y, 0);
      const rightEdge = project(rightCube.position.x + 0.5, rightCube.position.y, 0);

      // Check bottom mound peak and lowest point
      const bottom = engine.bottomCubes;
      const bottomLowest = bottom.reduce((min, c) => c.position.y < min.position.y ? c : min, bottom[0]);
      const lowestP = project(bottomLowest.position.x, bottomLowest.position.y - 0.275, bottomLowest.position.z);

      return {
        canvasW: W,
        canvasH: H,
        leftEdgePx: leftEdge.px,
        rightEdgePx: rightEdge.px,
        leftMargin: leftEdge.px,
        rightMargin: W - rightEdge.px,
        lowestPy: lowestP.py,
        lowestClearanceFromBottom: H - lowestP.py
      };
    });

    console.log('Mobile Framing Projection Check:', JSON.stringify(check, null, 2));

    await page.screenshot({ path: 'test/screenshot_mobile_tested.png' });
    console.log('Saved test/screenshot_mobile_tested.png');

  } finally {
    await browser.close();
  }
}

testFraming().catch(console.error);
