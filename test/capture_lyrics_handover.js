import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/papazed/.gemini/antigravity/brain/cf4bc01d-7392-4249-95e1-9e0dd62022d2';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

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

    // 1. Phrase 1 ("悠悠的古城中") Settled
    await page.evaluate(() => {
      window.kineticLyricsManager.setMode('gravity');
      window.setPlaybackTime(15.2);
    });
    await tickSimulation(0.8);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test/screenshot_phrase1_unified.png' });
    console.log('✅ Captured phrase 1 screenshot');

    // 2. Phrase transition handover 1 (15.2s -> 18.8s: t = 0.22s into phrase 2)
    await page.evaluate(() => {
      window.setPlaybackTime(18.8);
    });
    await tickSimulation(0.22);
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test/screenshot_transition_handover.png' });
    console.log('✅ Captured transition handover 1 screenshot');

    // 3. Phrase 2 ("听美人奏琴声") Settled
    await tickSimulation(0.65);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test/screenshot_phrase2_unified.png' });
    console.log('✅ Captured phrase 2 screenshot');

    // 4. Phrase transition handover 2 (18.8s -> 22.3s: t = 0.22s into phrase 3)
    await page.evaluate(() => {
      window.setPlaybackTime(22.3);
    });
    await tickSimulation(0.22);
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test/screenshot_transition_handover2.png' });
    console.log('✅ Captured transition handover 2 screenshot');

    // 5. Phrase 3 ("朗朗夜色星空") Settled
    await tickSimulation(0.65);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test/screenshot_phrase3_unified.png' });
    console.log('✅ Captured phrase 3 screenshot');
    await page.close();

    // 6. Mobile viewport (fresh page initialized directly with 390x844)
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobilePage.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await mobilePage.waitForTimeout(2000);
    await mobilePage.evaluate(() => document.fonts.ready);
    await mobilePage.evaluate(() => {
      window.kineticLyricsManager.setMode('gravity');
      window.setPlaybackTime(15.2);
    });
    await mobilePage.evaluate(() => {
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
    await mobilePage.waitForTimeout(400);
    await mobilePage.screenshot({ path: 'test/screenshot_phrase1_mobile.png' });
    console.log('✅ Captured authentic mobile phrase 1 screenshot');
    await mobilePage.close();

    // Copy to artifact directory
    const screenshotFiles = [
      'screenshot_phrase1_unified.png',
      'screenshot_transition_handover.png',
      'screenshot_phrase2_unified.png',
      'screenshot_transition_handover2.png',
      'screenshot_phrase3_unified.png',
      'screenshot_phrase1_mobile.png'
    ];
    screenshotFiles.forEach(file => {
      const src = path.join('test', file);
      const dest = path.join(ARTIFACT_DIR, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${file} to artifacts`);
      }
    });

  } finally {
    await browser.close();
  }
}

capture().catch(console.error);
