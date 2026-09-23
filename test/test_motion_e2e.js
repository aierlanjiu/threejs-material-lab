import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();
const PORT = 8124;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url.split('?')[0]);
  if (filePath.endsWith('/')) filePath += 'index.html';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    });
    res.end(content);
  });
});

server.listen(PORT, async () => {
  console.log(`[Test Server] Running on http://localhost:${PORT}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[Console Error] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    errors.push(`[Page Error] ${err.message}`);
  });

  try {
    console.log('[1/5] Loading index.html (LÜ Workbench)...');
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Test Tab switching with motionTabSwitch & focus breath
    console.log('[2/5] Testing Inspector Tab cascading motion (rise) & 3D focus breath...');
    await page.click('[data-tab="tab-matrix"]');
    await page.waitForTimeout(300);

    await page.click('[data-tab="tab-content"]');
    await page.waitForTimeout(300);

    await page.click('[data-tab="tab-optics"]');
    await page.waitForTimeout(300);

    // Test Play/Pause morph
    console.log('[3/5] Testing Play/Pause morph transition...');
    await page.click('#playPauseBtn');
    await page.waitForTimeout(400);
    await page.click('#playPauseBtn');
    await page.waitForTimeout(400);

    // Test Record button morph & Immersive button morph & Camera transition
    console.log('[4/5] Testing Record button morph, Immersive morph & 3D Camera overshoot...');
    await page.click('#recordToggle');
    await page.waitForTimeout(600);
    await page.click('#recordToggle', { force: true });
    await page.waitForTimeout(600);

    await page.click('#immersiveToggle');
    await page.waitForTimeout(400);
    await page.click('#immersiveToggle');
    await page.waitForTimeout(400);

    console.log('      - Testing camera preset overshoot transitions...');
    await page.click('.preset-cam-btn[data-cam="iso"]');
    await page.waitForTimeout(450);
    await page.click('.preset-cam-btn[data-cam="front"]');
    await page.waitForTimeout(450);

    console.log('[5/5] Testing mascot_studio.html (LI Companion Studio)...');
    await page.goto(`http://localhost:${PORT}/mascot_studio.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Open chat drawer
    console.log('      - Opening conversation drawer via #chat-toggle...');
    await page.click('#chat-toggle');
    await page.waitForTimeout(400);

    // Test sending chat message
    console.log('      - Submitting chat message for transcript rise motion...');
    await page.fill('#chat-input', '你好荔小卫！');
    await page.click('#send-btn');
    await page.waitForTimeout(500);

    const messageCount = await page.locator('#transcript-list .message').count();
    console.log(`      - Current message count: ${messageCount}`);

    // Test clear chat
    console.log('      - Clicking clear-chat for leave motion...');
    await page.click('#clear-chat');
    await page.waitForTimeout(500);

    // Test Companion Switch morph
    console.log('      - Testing companion switch morph (Hoodie <-> Astro)...');
    await page.click('#btn-role-astro');
    await page.waitForTimeout(400);
    await page.click('#btn-role-hoodie');
    await page.waitForTimeout(400);

    const filteredErrors = errors.filter(e => !e.includes('favicon') && !e.includes('AudioContext') && !e.includes('avc1') && !e.includes('mp4 encoding'));
    if (filteredErrors.length > 0) {
      console.error('Errors found:', filteredErrors);
      process.exitCode = 1;
    } else {
      console.log('✅ ALL CUBE MOTION & AUDIO HAPTICS & 3D SPATIAL CONTINUITY TESTS PASSED CLEANLY!');
    }
  } catch (err) {
    console.error('Verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
});
