import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/papazed/.gemini/antigravity/brain/cf4bc01d-7392-4249-95e1-9e0dd62022d2';

const WALLPAPERS = [
  {
    id: 'luffy_kaido',
    file: 'images/wallpapers/op_luffy_kaido.jpg',
    lyric: '海鸥落在那礁石',
    prev: '但愿那海风再起',
    next: '我终于对着大海放声喊出你的名字',
    screenshot: 'screenshot_wallpaper_luffy_kaido.png'
  },
  {
    id: 'zoro_mihawk',
    file: 'images/wallpapers/op_zoro_mihawk.jpg',
    lyric: '但愿那海风再起',
    prev: '也明白有些遗憾会永远留在心里',
    next: '海鸥落在那礁石',
    screenshot: 'screenshot_wallpaper_zoro_mihawk.png'
  },
  {
    id: 'shanks_blackbeard',
    file: 'images/wallpapers/op_shanks_blackbeard.jpg',
    lyric: '我终于对着大海放声喊出你的名字',
    prev: '海鸥落在那礁石',
    next: '熟悉的城市',
    screenshot: 'screenshot_wallpaper_shanks_blackbeard.png'
  },
  {
    id: 'law_doflamingo',
    file: 'images/wallpapers/op_law_doflamingo.jpg',
    lyric: '归来的渔民叫卖着刚刚经历的风雨',
    prev: '今晨已褪去',
    next: '教堂里举行着婚礼',
    screenshot: 'screenshot_wallpaper_law_doflamingo.png'
  },
  {
    id: 'luffy_crocodile',
    file: 'images/wallpapers/op_luffy_crocodile.jpg',
    lyric: '昨夜的潮汐',
    prev: '《海鸥》- 逃跑计划',
    next: '今晨已褪去',
    screenshot: 'screenshot_wallpaper_luffy_crocodile.png'
  }
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  try {
    console.log('Navigating to local lab...');
    await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => document.fonts.ready);

    for (const item of WALLPAPERS) {
      console.log(`Setting wallpaper: ${item.id} -> ${item.lyric}`);
      await page.evaluate(({ file, lyric, prev, next }) => {
        window.setWallpaper(file);
        window.kineticLyricsManager.setMode('gravity');
        const sel = document.getElementById('playlistSelect');
        if (sel) sel.value = 'track_5';
        const nowPlaying = document.getElementById('nowPlayingText');
        if (nowPlaying) nowPlaying.textContent = '当前：《海鸥》- 逃跑计划';

        window.__overrideLyricContext = {
          activeText: lyric,
          prevText: prev,
          nextText: next,
          progressInLine: 0.65,
          lineKey: `wall_${lyric}`,
          characterCursor: Math.max(1, Math.floor(lyric.length * 0.7))
        };
      }, item);

      // Active loop to pump RAF frames until all active lyric slots complete magnetic lifting
      for (let i = 0; i < 35; i++) {
        await page.waitForTimeout(100);
        const settled = await page.evaluate(() => {
          const eng = window.kineticLyricsManager?.gravityEngine;
          if (!eng || eng.activeBankIndex < 0) return false;
          const bank = eng.banks[eng.activeBankIndex];
          const activeSlots = bank.filter(s => s.userData.targetScale > 0.5);
          return activeSlots.length > 0 && activeSlots.every(s => !s.userData.isMagneticLifting);
        });
        if (settled) break;
      }
      await page.waitForTimeout(300);
      const outPath = path.join('test', item.screenshot);
      await page.screenshot({ path: outPath });
      console.log(`Saved: ${outPath}`);

      const artifactPath = path.join(ARTIFACT_DIR, item.screenshot);
      fs.copyFileSync(outPath, artifactPath);
      console.log(`Copied to artifact: ${artifactPath}`);
    }

    console.log('🎉 All 5 wallpapers captured and copied to artifacts!');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
