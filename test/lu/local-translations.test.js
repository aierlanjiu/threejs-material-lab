import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback => { if (callback.name === 'animate') window.luTestFrame = callback; return 1; };
  });
  await page.goto('http://localhost:8000/index.html?intro=skip');
  await page.waitForFunction(() => window.luDiagnostics);
  await page.evaluate(() => { luDiagnostics.renderer.compileAsync = null; });
  await page.waitForFunction(() => state.playlist.filter(t => t.translatedLyrics?.length).length === 8 &&
    state.playlist.filter(t => t.localOnly && t.src).length === 10, null, { polling: 100 }).catch(async error => {
      console.error(JSON.stringify({errors, tracks: await page.evaluate(() => state.playlist.filter(t=>t.localOnly).map(t=>({type:t.type,src:t.src,lines:t.lyrics?.length,zh:t.translatedLyrics?.length})))}));
      throw error;
    });
  const result = await page.evaluate(async () => {
    const { loadLocalThemeTranslation } = await import('./js/audio/local-theme-library.js');
    const translated = state.playlist.filter(t => t.translatedLyrics?.length);
    const rows = [];
    for (const track of translated) {
      state.currentTrackIndex = state.playlist.indexOf(track); state.songTitle = track.title;
      track.lyrics.forEach((line, index) => {
        const time = line.time + .001;
        state.lyricLanguage = 'zh';
        const chinese = getSynchronizedLyricContext(time);
        state.lyricLanguage = 'original';
        const original = getSynchronizedLyricContext(time);
        if (chinese.activeText !== track.translatedLyrics[index].text || original.activeText !== line.text ||
            chinese.lineKey === original.lineKey || chinese.originalText !== line.text) throw new Error(`${track.type}: language or clock mismatch at ${index}`);
        if (/[ぁ-ヿ]/u.test(chinese.activeText)) throw new Error(`${track.type}: untranslated Japanese at ${index}`);
      });
      rows.push({ type: track.type, lines: track.lyrics.length });
    }
    const track = translated[0];
    const mismatch = await loadLocalThemeTranslation(track.type, track.lrcText + '\n[00:01.00]自定义版本');
    state.currentTrackIndex = state.playlist.indexOf(track); state.songTitle = track.title;
    state.lyricLanguage = 'zh';
    const textarea = document.querySelector('#text');
    textarea.value = '[00:00.00]用户自己导入的内容'; textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const custom = getSynchronizedLyricContext(0).activeText;
    // Actual One day decoding and playback must not inherit the previous song's lyric.
    textarea.value = '[00:00.00]上一首的内容';
    playTrackAtIndex(state.playlist.findIndex(t => t.type === 'anime_op_one_day'));
    const noLyrics = getSynchronizedLyricContext(60);
    return { rows, mismatch, custom, noLyrics: noLyrics.activeText, textarea: textarea.value,
      status: document.querySelector('#lyricsStatusBadge').textContent };
  });
  assert.equal(result.rows.reduce((n, t) => n + t.lines, 0), 301);
  assert.equal(result.mismatch, ''); assert.equal(result.custom, '用户自己导入的内容');
  assert.equal(result.noLyrics, 'One day · 海贼王'); assert.equal(result.textarea, '');
  assert.match(result.status, /歌词待导入/);
  await page.waitForFunction(() => state.audioReady && state.audioCtx.state === 'running', null, { polling: 100 });
  await page.waitForTimeout(800);
  const audio = await page.evaluate(() => {
    const data = new Uint8Array(state.analyser.frequencyBinCount); state.analyser.getByteFrequencyData(data);
    return { duration: state.playlist[state.currentTrackIndex].buffer.duration, peak: Math.max(...data), time: getPlaybackTime() };
  });
  assert.ok(audio.duration > 266 && audio.duration < 267); assert.ok(audio.peak > 0 && audio.time > .5, JSON.stringify(audio));
  await page.reload();
  await page.waitForFunction(() => state.playlist.filter(t => t.translatedLyrics?.length).length === 8, null, { polling: 100 });
  assert.equal(await page.evaluate(() => state.lyricLanguage), 'zh');
  const languageControl = await page.evaluate(() => {
    const track = state.playlist.find(t => t.type === 'anime_op_we_are');
    state.currentTrackIndex = state.playlist.indexOf(track); state.songTitle = track.title;
    const select = document.querySelector('#lyricsLanguage');
    select.value = 'original'; select.dispatchEvent(new Event('change', { bubbles: true }));
    const original = getSynchronizedLyricContext(32).activeText;
    select.value = 'zh'; select.dispatchEvent(new Event('change', { bubbles: true }));
    const chinese = getSynchronizedLyricContext(32).activeText;
    const builtin = state.playlist.filter(t => t.isPreset).map(t => {
      state.currentTrackIndex = state.playlist.indexOf(t); state.songTitle = t.title;
      return getSynchronizedLyricContext(1).activeText;
    });
    return { original, chinese, builtin };
  });
  assert.match(languageControl.original, /ありったけ/); assert.equal(languageControl.chinese, '把所有梦想汇聚起来');
  assert.ok(languageControl.builtin.every(text => /[\u4e00-\u9fff]/u.test(text)));
  assert.deepEqual(errors, []);
  console.log('LÜ 301 translated lines, source validation, custom lyric protection, refresh and One day audio PASS', JSON.stringify({ ...result, audio, languageControl }));
} finally { await browser.close(); }
