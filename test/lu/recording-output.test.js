import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const testAudio = process.env.LU_TEST_AUDIO === '1';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.luDiagnostics));

  assert.equal(await page.locator('.kinetic-mode-btn[data-mode="slot"]').getAttribute('aria-checked'), 'true');

  // 打开律核胶囊 -> 创作面 -> 验证检查器开关
  await page.locator('#performanceCapsule').click();
  await page.locator('#lueTabCreate').click();
  await page.locator('#inspectorToggleBtn').click();
  assert.equal(await page.locator('#inspectorPanel').evaluate(el => !el.classList.contains('collapsed')), true);
  await page.locator('#inspectorCloseBtn').click();
  assert.equal(await page.locator('#inspectorPanel').evaluate(el => el.classList.contains('collapsed')), true);

  // 切换录制面 -> 调整成片画幅为竖屏 9:16
  await page.locator('#performanceCapsule').click();
  await page.locator('#lueTabRecord').click();
  await page.locator('#videoAspectSelect').selectOption('portrait');
  await page.waitForFunction(() => {
    const stage = document.querySelector('#stageWrap').getBoundingClientRect();
    return Math.abs(stage.width / stage.height - 9 / 16) < 0.01;
  });

  // 切换演出面 -> 进入沉浸模式 -> 点击极简胶囊退出
  await page.locator('#lueTabChoreo').click();
  await page.locator('#immersiveToggle').click();
  await page.waitForFunction(() => document.body.classList.contains('immersive'));
  assert.equal(await page.locator('#performanceCapsuleLabel').innerText(), '退出沉浸');
  assert.equal(await page.locator('#stageHudLeft').isVisible(), false);
  await page.waitForTimeout(200);
  await page.locator('#performanceCapsule').click();
  await page.waitForFunction(() => !document.body.classList.contains('immersive'));

  if (testAudio) {
    await page.locator('#performanceCapsule').click();
    await page.locator('#lueTabPlay').click();
    await page.locator('#playPauseBtn').click();
    await page.waitForFunction(() => {
      const title = document.querySelector('#nowPlayingText')?.textContent || '';
      const elapsed = document.querySelector('#timeDisplay')?.textContent?.split(' / ')[0] || '';
      return title.startsWith('当前：') && elapsed !== '00:00';
    });
    await page.keyboard.press('Escape');
  }
  await page.waitForFunction(() => document.querySelectorAll('#cubeSlotsTrack .cube-slot').length > 0);

  // 打开律核胶囊 -> 录制面 -> 点击开始录制
  await page.locator('#performanceCapsule').click();
  await page.locator('#lueTabRecord').click();
  await page.locator('#recordToggle').click();
  await page.waitForFunction(() => document.body.classList.contains('recording-preview'));
  assert.equal(await page.locator('#recordToggle').getAttribute('data-record-state'), 'recording');
  const frame = await page.evaluate(() => {
    const output = document.querySelector('#recordingPreviewCanvas');
    const stage = document.querySelector('#stageWrap');
    const scene = document.querySelector('#stage canvas');
    const deck = document.querySelector('#cubeLyricsDeck').getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const scratch = document.createElement('canvas');
    scratch.width = output.width;
    scratch.height = output.height;
    scratch.getContext('2d').drawImage(scene, 0, 0, scratch.width, scratch.height);
    const x = Math.max(0, Math.floor((deck.left - stageRect.left + 8) * output.width / stageRect.width));
    const y = Math.max(0, Math.floor((deck.top - stageRect.top + 8) * output.height / stageRect.height));
    const w = Math.min(output.width - x, Math.floor((deck.width - 16) * output.width / stageRect.width));
    const h = Math.min(output.height - y, Math.floor((deck.height - 16) * output.height / stageRect.height));
    const painted = output.getContext('2d').getImageData(x, y, w, h).data;
    const source = scratch.getContext('2d').getImageData(x, y, w, h).data;
    let difference = 0;
    let samples = 0;
    for (let i = 0; i < painted.length; i += 4 * 64) {
      difference += Math.abs(painted[i] - source[i]) + Math.abs(painted[i + 1] - source[i + 1]) + Math.abs(painted[i + 2] - source[i + 2]);
      samples++;
    }
    return { width: output.width, height: output.height, difference: difference / samples };
  });
  assert.deepEqual([frame.width, frame.height], [1080, 1920]);
  assert(frame.difference > 25, `slot lyrics absent from video canvas: ${frame.difference}`);
  assert.equal(await page.locator('#stageHudLeft').isVisible(), false, 'editor controls should hide while previewing a recording');

  await page.locator('#performanceCapsule').click();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('#performanceCapsule').getAttribute('data-state'), 'record');
  assert.equal(await page.locator('#performanceCapsule .rec-dot-pill').count(), 1);
  assert.match(await page.locator('#performanceCapsuleDetail').innerText(), /^\d{2}:\d{2}$/);
  await page.locator('#performanceCapsule').click();
  assert.equal(await page.locator('#lueTabRecord').getAttribute('aria-selected'), 'true');
  await page.evaluate(() => {
    const button = document.querySelector('#recordToggle');
    window.recordStateHistory = [button.dataset.recordState];
    new MutationObserver(() => window.recordStateHistory.push(button.dataset.recordState))
      .observe(button, { attributes: true, attributeFilter: ['data-record-state'] });
  });
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.locator('#recordToggle').click();
  const download = await downloadPromise;
  await page.waitForFunction(() => document.querySelector('#recordToggle').dataset.recordState === 'success');
  assert.deepEqual((await page.evaluate(() => window.recordStateHistory)).slice(0, 3),
    ['recording', 'exporting', 'success'], 'record button must export before reporting success');
  const name = download.suggestedFilename();
  const videoPath = await download.path();
  const probe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=format_name,duration:stream=codec_type,width,height',
    '-of', 'json', videoPath
  ], { encoding: 'utf8' }));
  const video = probe.streams.find(stream => stream.codec_type === 'video');
  assert.deepEqual([video.width, video.height], [1080, 1920]);
  if (testAudio) assert(probe.streams.some(stream => stream.codec_type === 'audio'), 'music audio track is missing');
  assert(Number(probe.format.duration) > 0.5);
  if (name.endsWith('.mp4')) assert.match(probe.format.format_name, /mp4|mov/);
  else if (name.endsWith('.webm')) assert.match(probe.format.format_name, /webm|matroska/);
  else assert.fail(`unexpected extension: ${name}`);
  if (process.env.LU_RECORD_FRAME_PATH) {
    execFileSync('ffmpeg', ['-v', 'error', '-i', videoPath, '-frames:v', '1', process.env.LU_RECORD_FRAME_PATH]);
  }
  console.log(`Recording portrait slot lyrics ${testAudio ? 'with audio ' : ''}PASS: ${name}, ${video.width}x${video.height}, ${probe.format.duration}s, canvas difference ${frame.difference.toFixed(1)}`);
  if (!testAudio) {
    if (await page.locator('#lueCoreDrawer').evaluate(el => el.hidden)) {
      await page.locator('#performanceCapsule').click();
    }
    await page.locator('#lueTabRecord').click();
    await page.locator('#videoAspectSelect').selectOption('landscape');
    await page.waitForFunction(() => document.querySelector('#stageWrap').dataset.aspect === 'landscape');
    await page.locator('#recordToggle').click();
    await page.waitForFunction(() => document.body.classList.contains('recording-preview'));
    assert.deepEqual(await page.locator('#recordingPreviewCanvas').evaluate(canvas => [canvas.width, canvas.height]), [1920, 1080]);
    await page.waitForTimeout(1200);
    const [landscapeDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('#recordToggle').click()
    ]);
    const landscapeName = landscapeDownload.suggestedFilename();
    const landscapeProbe = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=format_name,duration:stream=codec_type,width,height',
      '-of', 'json', await landscapeDownload.path()
    ], { encoding: 'utf8' }));
    const landscapeVideo = landscapeProbe.streams.find(stream => stream.codec_type === 'video');
    assert.deepEqual([landscapeVideo.width, landscapeVideo.height], [1920, 1080]);
    assert(Number(landscapeProbe.format.duration) > 0.3);
    if (landscapeName.endsWith('.mp4')) assert.match(landscapeProbe.format.format_name, /mp4|mov/);
    else if (landscapeName.endsWith('.webm')) assert.match(landscapeProbe.format.format_name, /webm|matroska/);
    else assert.fail(`unexpected extension: ${landscapeName}`);
    console.log(`Recording landscape slot lyrics PASS: ${landscapeName}, ${landscapeVideo.width}x${landscapeVideo.height}, ${landscapeProbe.format.duration}s`);
  }
  assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
} finally {
  await browser.close();
}
