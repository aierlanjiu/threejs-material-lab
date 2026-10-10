import assert from 'node:assert/strict';
import { chromium } from 'playwright';

function makeToneWav() {
  const sampleRate = 8000;
  const samples = sampleRate / 2;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    buffer.writeInt16LE(Math.round(Math.sin(i * Math.PI * 2 * 440 / sampleRate) * 6000), 44 + i * 2);
  }
  return buffer;
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.luCubeIntro?.phase === 'waiting');

  await page.locator('#luIntroThemeSelect [data-theme="dragon-ball"]').click();
  await page.waitForFunction(() => window.luCubeIntro?.phase === 'complete');
  const dragonBall = await page.evaluate(() => ({
    theme: document.body.dataset.luTheme,
    avatars: [...document.querySelectorAll('#avatarPresetGrid [data-avatar]')].map(card => card.dataset.avatar),
    wallpaper: document.querySelector('#presetBgSelect').value,
    wallpaperGroups: [...document.querySelectorAll('#presetBgSelect optgroup[data-theme]')].map(group => [group.dataset.theme, group.disabled]),
    songGroups: [...document.querySelectorAll('#playlistSelect optgroup[data-theme]')].map(group => [group.dataset.theme, group.disabled]),
    accent: document.body.style.getPropertyValue('--poster-accent'),
    introBackground: getComputedStyle(document.querySelector('.lu-intro-curtain i'), '::before').backgroundImage
  }));
  assert.equal(dragonBall.theme, 'dragon-ball');
  assert(dragonBall.avatars.length > 0 && dragonBall.avatars.every(id => id.startsWith('dragon-ball/')),
    'Dragon Ball should show only Dragon Ball expressions');
  assert.equal(dragonBall.wallpaper, 'images/wallpapers/db_goku_vegeta.jpg');
  assert.deepEqual(dragonBall.wallpaperGroups, [['one-piece', true], ['dragon-ball', false], ['naruto', true]]);
  assert.deepEqual(dragonBall.songGroups, [['one-piece', true], ['dragon-ball', false], ['naruto', true]]);
  assert.equal(dragonBall.accent, '#ee5426');
  assert.match(dragonBall.introBackground, /lu-intro-d-dragon-ball-portrait\.png/);

  await page.locator('#performanceCapsule').click();
  await page.locator('#playlistSelect').selectOption('anime_db_chala');
  assert.match(await page.locator('#nowPlayingText').innerText(), /导入/,
    'an empty local song slot should ask for a real file');
  await page.locator('#audioUpload').setInputFiles({
    name: 'CHA-LA HEAD-CHA-LA.wav', mimeType: 'audio/wav', buffer: makeToneWav()
  });
  await page.waitForFunction(() => document.querySelector('#playlistSelect [value="anime_db_chala"]').textContent.includes('已导入'));
  assert.match(await page.locator('#nowPlayingText').innerText(), /CHA-LA HEAD-CHA-LA/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.luCubeIntro?.phase === 'waiting');
  await page.waitForFunction(() => document.querySelector('#playlistSelect [value="anime_db_chala"]').textContent.includes('已导入'));
  assert.equal(await page.evaluate(() => document.body.dataset.luTheme), 'dragon-ball',
    'the selected theme should persist locally');

  await page.locator('#luIntroSkip').click();
  await page.locator('#performanceCapsule').click();
  await page.locator('#lueTabCreate').click();
  await page.locator('#luCoreReplay').click();
  await page.waitForFunction(() => window.luCubeIntro?.phase === 'waiting');
  await page.locator('#luIntroThemeSelect [data-theme="naruto"]').click();
  await page.waitForFunction(() => window.luCubeIntro?.phase === 'complete');
  assert.equal(await page.evaluate(() => document.body.dataset.luTheme), 'naruto');
  assert.equal(await page.locator('#presetBgSelect').inputValue(), 'images/wallpapers/naruto_naruto_sasuke.jpg');
  assert((await page.locator('#avatarPresetGrid [data-avatar]').evaluateAll(cards =>
    cards.every(card => card.dataset.avatar.startsWith('naruto/')))));
  assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
  console.log('LÜ theme isolation, wallpaper, and local music import PASS');
} finally {
  await browser.close();
}
