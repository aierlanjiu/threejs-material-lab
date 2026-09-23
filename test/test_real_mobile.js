import { chromium } from 'playwright';

async function checkRealMobile() {
  const browser = await chromium.launch({ headless: true });
  // Directly launch in 390x844 viewport!
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  try {
    await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Switch to gravity mode at 15.2s
    await page.evaluate(() => {
      window.kineticLyricsManager.setMode('gravity');
      window.setPlaybackTime(15.2);
    });

    // Run physics simulation
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

    const info = await page.evaluate(() => {
      const inspector = document.querySelector('#inspectorPanel');
      const canvas = document.querySelector('canvas');
      const stage = document.querySelector('.stageWrap');
      const cam = window.kineticLyricsManager.gravityEngine.camera;
      const lyrics = window.kineticLyricsManager.gravityEngine.lyricCubes.filter(c => c.userData.targetScale > 0.5);
      const bottomCubes = window.kineticLyricsManager.gravityEngine.bottomCubes;

      return {
        inspectorClasses: inspector?.className,
        inspectorRect: inspector?.getBoundingClientRect(),
        canvasRect: canvas?.getBoundingClientRect(),
        stageRect: stage?.getBoundingClientRect(),
        camFov: cam?.fov,
        camAspect: cam?.aspect,
        camPos: cam ? { x: cam.position.x, y: cam.position.y, z: cam.position.z } : null,
        lyricsXs: lyrics.map(c => c.position.x),
        bottomCount: bottomCubes.length,
        bottomLayersCount: window.kineticLyricsManager.gravityEngine.bottomLayersCount
      };
    });

    console.log('Real Mobile Initial State:', JSON.stringify(info, null, 2));

    await page.screenshot({ path: 'test/screenshot_real_mobile_fresh.png' });
    console.log('Captured screenshot_real_mobile_fresh.png');

  } finally {
    await browser.close();
  }
}

checkRealMobile().catch(console.error);
