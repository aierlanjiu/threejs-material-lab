import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CAST_DIR = path.join(ROOT, 'assets/band-cast-v2/one-piece');
const AUDIO_DIR = path.join(ROOT, 'output/lu-band-arrangement/one-day-shell-v1');
const OUT_DIR = process.env.LU_SHELL_REVIEW_OUT ? path.resolve(process.env.LU_SHELL_REVIEW_OUT) : path.join(ROOT, 'output/shell-performance-20261029/browser');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml'
};

async function run() {
  console.log('=== Step 1: Validating Manifest & Audio Assets ===');
  const manifest = JSON.parse(fs.readFileSync(path.join(CAST_DIR, 'manifest.json'), 'utf8'));
  if (manifest.actors.length !== 10) throw new Error(`Expected 10 actors, got ${manifest.actors.length}`);
  if (manifest.layerCount !== 60) throw new Error(`Expected 60 layers, got ${manifest.layerCount}`);

  for (const actor of manifest.actors) {
    const atlasPath = path.join(CAST_DIR, actor.atlas);
    if (!fs.existsSync(atlasPath)) throw new Error(`Missing atlas: ${actor.atlas}`);
    const layers = Object.keys(actor.layers);
    if (layers.length !== 6) throw new Error(`Actor ${actor.id} has ${layers.length} layers, expected 6`);
    for (const expected of ['body', 'head', 'leftArm', 'rightArm', 'instrument', 'mouth']) {
      if (!actor.layers[expected]) throw new Error(`Actor ${actor.id} missing layer ${expected}`);
    }
  }
  console.log('Manifest integrity: 10 actors, 60 layers, all atlases present.');

  const arrangement = JSON.parse(fs.readFileSync(path.join(AUDIO_DIR, 'arrangement.json'), 'utf8'));
  if (arrangement.parts.length !== 9) throw new Error(`Expected 9 instrument parts, got ${arrangement.parts.length}`);
  for (const part of arrangement.parts) {
    const solo30 = path.join(AUDIO_DIR, 'solo-30s', `${part.id}.mp3`);
    if (!fs.existsSync(solo30)) throw new Error(`Missing 30s track for ${part.id}`);
  }
  console.log('Arrangement integrity: 9 instrument parts, all 30s solo MP3s present.');

  console.log('\n=== Step 2: Browser Verification with Playwright ===');
  const server = http.createServer((req, res) => {
    const safePath = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(ROOT, safePath === '/' ? 'index.html' : safePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required']
    });

    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1
    });

    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto(`${baseUrl}/shell-performance-review.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.shellPerformanceReview?.ready === true, { timeout: 15000 });

    const initialState = await page.evaluate(() => ({ ...window.shellPerformanceReview }));
    console.log('Initial review state:', initialState);

  // 1. Verify all 10 actors and measure raw canvas pixel bounding boxes
  const actorIds = ['luffy', 'zoro', 'nami', 'sanji', 'chopper', 'robin', 'usopp', 'ace', 'law', 'shanks'];
  const actorChecks = [];

  for (const id of actorIds) {
    await page.click(`button[data-id="${id}"]`);
    await page.waitForTimeout(100);
    const canvasData = await page.evaluate(() => {
      const cvs = document.getElementById('actorCanvas');
      const ctx = cvs.getContext('2d');
      const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
      const data = imgData.data;
      let minX = cvs.width, maxX = 0, minY = cvs.height, maxY = 0;
      let topEdge = 0, bottomEdge = 0, leftEdge = 0, rightEdge = 0;
      for (let y = 0; y < cvs.height; y++) {
        for (let x = 0; x < cvs.width; x++) {
          const alpha = data[(y * cvs.width + x) * 4 + 3];
          if (alpha > 20) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (y === 0) topEdge++;
            if (y === cvs.height - 1) bottomEdge++;
            if (x === 0) leftEdge++;
            if (x === cvs.width - 1) rightEdge++;
          }
        }
      }
      return {
        bbox: [minX, minY, maxX, maxY],
        edges: { top: topEdge, bottom: bottomEdge, left: leftEdge, right: rightEdge },
        dataUrl: cvs.toDataURL('image/png')
      };
    });

    const actor = manifest.actors.find(a => a.id === id);
    fs.writeFileSync(path.join(OUT_DIR, `final-${actor.name}.png`), Buffer.from(canvasData.dataUrl.split(',')[1], 'base64'));

    actorChecks.push({
      id,
      name: actor.name,
      instrument: actor.instrument,
      bbox: canvasData.bbox,
      edges: canvasData.edges,
      clipped: canvasData.edges.top > 0 || canvasData.edges.bottom > 0 || canvasData.edges.left > 0 || canvasData.edges.right > 0
    });
  }

  const anyClipped = actorChecks.some(a => a.clipped);
  assert.equal(anyClipped, false, 'A character is clipped by its canvas');
  console.log(`Actor bounds check: 10/10 actors checked, any clipped: ${anyClipped}`);

  // 2. Audio Playback and 9-Track Decoding
  console.log('Testing 30s playback trigger...');
  await page.click('#play');
  await page.waitForFunction(() => window.shellPerformanceReview?.audioReady === true, { timeout: 15000 });
  await page.waitForFunction(() => window.shellPerformanceReview?.playing === true, { timeout: 5000 });
  await page.waitForTimeout(1000);

  const playingState = await page.evaluate(() => ({ ...window.shellPerformanceReview }));
  assert.equal(playingState.bufferCount, 9, 'All nine independent tracks must decode');
  assert(playingState.playing && playingState.position > 0, 'Audition clock must advance');
  console.log('Playing state:', {
    audioReady: playingState.audioReady,
    playing: playingState.playing,
    bufferCount: playingState.bufferCount,
    sampleRates: playingState.sampleRates,
    position: playingState.position
  });

  // 3. Test Sanji Mute vs Unmute Activity Frame Difference
  console.log('Testing track mute and actor activity...');
  await page.click('button[data-id="sanji"]');
  await page.waitForTimeout(200);

  // Mute Sanji
  const sanjiTrack = page.locator('div[data-track="sanji"]');
  await sanjiTrack.locator('button.mute').click();
  await page.waitForTimeout(200);
  const mutedScreenshot1 = await page.evaluate(() => document.getElementById('actorCanvas').toDataURL());
  await page.waitForTimeout(250);
  const mutedScreenshot2 = await page.evaluate(() => document.getElementById('actorCanvas').toDataURL());
  const sanjiMutedIdentical = mutedScreenshot1 === mutedScreenshot2;

  // Unmute Sanji
  await sanjiTrack.locator('button.mute').click();
  await page.waitForTimeout(200);
  const unmutedScreenshot1 = await page.evaluate(() => document.getElementById('actorCanvas').toDataURL());
  await page.waitForTimeout(250);
  const unmutedScreenshot2 = await page.evaluate(() => document.getElementById('actorCanvas').toDataURL());
  const sanjiUnmutedDifferent = unmutedScreenshot1 !== unmutedScreenshot2;
  assert(sanjiMutedIdentical, 'Muted instrument animation must stop');
  assert(sanjiUnmutedDifferent, 'Unmuted instrument animation must follow notes');

  console.log(`Mute activity test: when muted, frames identical: ${sanjiMutedIdentical}; when unmuted, frames dynamic: ${sanjiUnmutedDifferent}`);

  // 4. Test Solo and Clear
  await sanjiTrack.locator('button.solo').click();
  await page.waitForTimeout(100);
  const soloState = await page.evaluate(() => window.shellPerformanceReview.solo);
  assert.equal(soloState, 'sanji', 'Solo must select the requested instrument');
  console.log('Solo track state:', soloState);

  await page.click('#clear');
  await page.waitForTimeout(100);
  const clearedState = await page.evaluate(() => ({
    solo: window.shellPerformanceReview.solo,
    mutedCount: window.shellPerformanceReview.muted.length
  }));
  console.log('Cleared state:', clearedState);
  assert.equal(clearedState.solo, null);assert.equal(clearedState.mutedCount, 0);

  // 5. Test Full Song Audio Mutual Exclusion
  console.log('Testing full song audio player mutual exclusion...');
  const playingBeforeFull = await page.evaluate(() => window.shellPerformanceReview.playing);
  await page.evaluate(() => document.getElementById('fullAudio').play());
  await page.waitForTimeout(400);
  const playingAfterFull = await page.evaluate(() => window.shellPerformanceReview.playing);
  assert(playingBeforeFull && !playingAfterFull, 'Full song must stop the parallel audition');
  console.log(`Mutual exclusion: 30s playing before fullAudio: ${playingBeforeFull}, after fullAudio: ${playingAfterFull}`);
  await page.evaluate(() => document.getElementById('fullAudio').pause());

  // 6. Test Shanks Bow Position at 0s, 5s, 15s, 25s
  await page.click('button[data-id="shanks"]');
  await page.click('#stop');
  await page.waitForTimeout(100);

  const shanksSamples = [];
  for (const sec of [0, 5, 15, 25]) {
    await page.evaluate(s => {
      const seek = document.getElementById('seek');
      seek.value = s;
      seek.dispatchEvent(new Event('input'));
    }, sec);
    await page.waitForTimeout(150);
    const canvasData = await page.evaluate(() => {
      const cvs = document.getElementById('actorCanvas');
      const ctx = cvs.getContext('2d');
      const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
      const data = imgData.data;
      let topEdge = 0, bottomEdge = 0, leftEdge = 0, rightEdge = 0;
      for (let y = 0; y < cvs.height; y++) {
        for (let x = 0; x < cvs.width; x++) {
          const alpha = data[(y * cvs.width + x) * 4 + 3];
          if (alpha > 20) {
            if (y === 0) topEdge++;
            if (y === cvs.height - 1) bottomEdge++;
            if (x === 0) leftEdge++;
            if (x === cvs.width - 1) rightEdge++;
          }
        }
      }
      return {
        edges: { top: topEdge, bottom: bottomEdge, left: leftEdge, right: rightEdge },
        dataUrl: cvs.toDataURL('image/png')
      };
    });
    fs.writeFileSync(path.join(OUT_DIR, `final-shanks-${sec}s.png`), Buffer.from(canvasData.dataUrl.split(',')[1], 'base64'));
    shanksSamples.push({ position: sec, edges: canvasData.edges });
    assert(Object.values(canvasData.edges).every(n => n === 0), `Shanks clipped at ${sec}s`);
  }
  console.log('Shanks bow samples at 0s, 5s, 15s, 25s:', shanksSamples);

  // 7. Mobile Viewports (no horizontal overflow)
  console.log('Testing mobile responsive layout...');
  const mobileChecks = [];
  for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `Horizontal overflow at ${vp.width}px`);
    mobileChecks.push({ viewport: vp, horizontalOverflow: overflow });
  }
  console.log('Mobile viewport checks:', mobileChecks);
  assert.equal(errors.length, 0, 'Browser reported a script or console error');

  const finalBrowserState = {
    state: await page.evaluate(() => ({ ...window.shellPerformanceReview })),
    logs: errors,
    actorChecks,
    shanksSamples,
    mutualExclusion: { playingBefore: playingBeforeFull, playingAfter: playingAfterFull },
    sanjiMuteTest: { mutedIdentical: sanjiMutedIdentical, unmutedDynamic: sanjiUnmutedDifferent },
    mobileChecks,
    subjectiveListening: 'not performed',
    device: 'headless Chromium; simulated mobile viewports'
  };

  fs.writeFileSync(path.join(OUT_DIR, 'final-browser-state.json'), JSON.stringify(finalBrowserState, null, 2));
  console.log('Successfully wrote final-browser-state.json');

  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

run().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
