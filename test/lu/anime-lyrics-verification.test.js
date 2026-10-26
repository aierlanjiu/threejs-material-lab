import assert from 'node:assert/strict';
import { statSync, existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SONGS = [
  {
    theme: 'one-piece',
    type: 'anime_op_we_are',
    title: 'We Are! · 海贼王',
    file: 'output/audio/anime_op_we_are.mp3',
    lrc: 'output/audio/anime_op_we_are.lrc',
    expectedMinDuration: 238,
    isInstrumental: false,
    introCheck: { time: 5.0 },
    verseCheck: { time: 32.0 },
    chorusCheck: { time: 89.0 },
  },
  {
    theme: 'one-piece',
    type: 'anime_op_over_the_top',
    title: 'OVER THE TOP · 海贼王',
    file: 'output/audio/anime_op_over_the_top.mp3',
    lrc: 'output/audio/anime_op_over_the_top.lrc',
    expectedMinDuration: 300,
    isInstrumental: false,
    introCheck: { time: 1.0 },
    verseCheck: { time: 27.0 },
    chorusCheck: { time: 89.0 },
  },
  {
    theme: 'one-piece',
    type: 'anime_op_overtaken',
    title: 'Overtaken · 海贼王',
    file: 'output/audio/anime_op_overtaken.mp3',
    lrc: 'output/audio/anime_op_overtaken.lrc',
    expectedMinDuration: 118,
    isInstrumental: true,
    introCheck: { time: 2.0 },
    verseCheck: { time: 16.0 },
    chorusCheck: { time: 62.0 },
  },
  {
    theme: 'one-piece',
    type: 'anime_op_one_day',
    title: 'One day · 海贼王',
    file: 'output/audio/anime_op_one_day.mp3',
    lrc: 'output/audio/anime_op_one_day.lrc',
    expectedMinDuration: 265,
    isInstrumental: false,
    introCheck: { time: 1.0 },
    verseCheck: { time: 14.0 },
    chorusCheck: { time: 87.0 },
  },
  {
    theme: 'dragon-ball',
    type: 'anime_db_chala',
    title: 'CHA-LA HEAD-CHA-LA · 龙珠',
    file: 'output/audio/anime_db_chala.mp3',
    lrc: 'output/audio/anime_db_chala.lrc',
    expectedMinDuration: 198,
    isInstrumental: false,
    introCheck: { time: 2.0 },
    verseCheck: { time: 18.5 },
    chorusCheck: { time: 59.0 },
  },
  {
    theme: 'dragon-ball',
    type: 'anime_db_makafushigi',
    title: 'Makafushigi Adventure! · 龙珠',
    file: 'output/audio/anime_db_makafushigi.mp3',
    lrc: 'output/audio/anime_db_makafushigi.lrc',
    expectedMinDuration: 230,
    isInstrumental: false,
    introCheck: { time: 2.0 },
    verseCheck: { time: 35.5 },
    chorusCheck: { time: 64.0 },
  },
  {
    theme: 'dragon-ball',
    type: 'anime_db_dandan',
    title: 'DAN DAN 心魅かれてく · 龙珠',
    file: 'output/audio/anime_db_dandan.mp3',
    lrc: 'output/audio/anime_db_dandan.lrc',
    expectedMinDuration: 213,
    isInstrumental: false,
    introCheck: { time: 1.0 },
    verseCheck: { time: 26.5 },
    chorusCheck: { time: 71.0 },
  },
  {
    theme: 'naruto',
    type: 'anime_nr_blue_bird',
    title: 'Blue Bird · 火影忍者',
    file: 'output/audio/anime_nr_blue_bird.mp3',
    lrc: 'output/audio/anime_nr_blue_bird.lrc',
    expectedMinDuration: 217,
    isInstrumental: false,
    introCheck: { time: 3.0 },
    verseCheck: { time: 28.5 },
    chorusCheck: { time: 53.8 },
  },
  {
    theme: 'naruto',
    type: 'anime_nr_silhouette',
    title: 'Silhouette · 火影忍者',
    file: 'output/audio/anime_nr_silhouette.mp3',
    lrc: 'output/audio/anime_nr_silhouette.lrc',
    expectedMinDuration: 237,
    isInstrumental: false,
    introCheck: { time: 2.0 },
    verseCheck: { time: 23.0 },
    chorusCheck: { time: 55.0 },
  },
  {
    theme: 'naruto',
    type: 'anime_nr_sign',
    title: 'Sign · 火影忍者',
    file: 'output/audio/anime_nr_sign.mp3',
    lrc: 'output/audio/anime_nr_sign.lrc',
    expectedMinDuration: 236,
    isInstrumental: false,
    introCheck: { time: 1.0 },
    verseCheck: { time: 26.0 },
    chorusCheck: { time: 58.0 },
  }
];
// LRC files are the source fixtures; wording changes must not drift from playback.
for (const spec of SONGS) {
  const cues = readFileSync(spec.lrc, 'utf8').split(/\r?\n/).flatMap(line => {
    const text = line.replace(/\[[^\]]*\]/g, '').trim();
    return [...line.matchAll(/\[(\d{2}):(\d{2}(?:\.\d+)?)\]/g)].map(m => ({time:Number(m[1])*60+Number(m[2]),text}));
  }).sort((a,b) => a.time-b.time);
  for (const key of ['introCheck','verseCheck','chorusCheck']) {
    const cue = cues.filter(c => c.time <= spec[key].time).at(-1);
    assert(cue, `${spec.type}: missing ${key} fixture`);
    spec[key].text = cue.text;
  }
}


// 1. 验证文件物理存在与基础属性
console.log('--- Step 1: 物理文件检查 ---');
for (const s of SONGS) {
  assert(existsSync(s.file), `Missing audio file: ${s.file}`);
  assert(existsSync(s.lrc), `Missing lrc file: ${s.lrc}`);
  const audioStat = statSync(s.file);
  const lrcStat = statSync(s.lrc);
  assert(audioStat.size > 1024 * 1024, `Audio file too small: ${s.file} (${audioStat.size} bytes)`);
  assert(lrcStat.size > 100, `LRC file too small: ${s.lrc} (${lrcStat.size} bytes)`);
  console.log(`✓ ${s.title}: 音频 ${(audioStat.size / 1024 / 1024).toFixed(2)}MB, 歌词 ${lrcStat.size}B`);
}

// 2. 浏览器端到端：验证全部 10 首歌曲接入、歌词同步时点与刷新恢复
console.log('\n--- Step 2: 浏览器端到端验证 ---');
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:8000/index.html?intro=skip', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.luDiagnostics && window.state);

  // 等待本地曲库发现与解析完成
  await page.waitForFunction(() => {
    return window.state.playlist.filter(t => t.localOnly && t.src && t.lyrics && t.lyrics.length > 0).length === 10;
  });

  const evaluationResults = await page.evaluate(songsToTest => {
    state.lyricLanguage = 'original';
    const results = [];
    for (const spec of songsToTest) {
      const trackIndex = window.state.playlist.findIndex(t => t.type === spec.type);
      const track = window.state.playlist[trackIndex];
      window.state.currentTrackIndex = trackIndex;
      window.state.songTitle = track.title;
      window.state.lyricOffsetMs = 0;

      const introCtx = window.getSynchronizedLyricContext(spec.introCheck.time);
      const verseCtx = window.getSynchronizedLyricContext(spec.verseCheck.time);
      const chorusCtx = window.getSynchronizedLyricContext(spec.chorusCheck.time);

      results.push({
        type: spec.type,
        title: track.title,
        src: track.src,
        lyricCount: track.lyrics ? track.lyrics.length : 0,
        intro: { time: spec.introCheck.time, got: introCtx.activeText, expect: spec.introCheck.text },
        verse: { time: spec.verseCheck.time, got: verseCtx.activeText, expect: spec.verseCheck.text },
        chorus: { time: spec.chorusCheck.time, got: chorusCtx.activeText, expect: spec.chorusCheck.text },
        isInstrumental: spec.isInstrumental
      });
    }
    return results;
  }, SONGS);

  for (const r of evaluationResults) {
    console.log(`\n验证歌曲: ${r.title}`);
    console.log(`  歌词句数: ${r.lyricCount}`);
    console.log(`  前奏时点 (@${r.intro.time}s): [${r.intro.got}]`);
    assert.equal(r.intro.got, r.intro.expect, `前奏歌词不匹配: got "${r.intro.got}", expect "${r.intro.expect}"`);
    console.log(`  主歌时点 (@${r.verse.time}s): [${r.verse.got}]`);
    assert.equal(r.verse.got, r.verse.expect, `主歌歌词不匹配: got "${r.verse.got}", expect "${r.verse.expect}"`);
    console.log(`  副歌时点 (@${r.chorus.time}s): [${r.chorus.got}]`);
    assert.equal(r.chorus.got, r.chorus.expect, `副歌歌词不匹配: got "${r.chorus.got}", expect "${r.chorus.expect}"`);
    if (r.isInstrumental) {
      assert.match(r.intro.got, /序奏/, '纯器乐前奏必须为器乐标注');
      assert.match(r.verse.got, /动机/, '纯器乐主段必须为器乐动机标注');
      assert.match(r.chorus.got, /高潮/, '纯器乐高潮必须为器乐全奏标注');
      console.log('  纯器乐验证: 严格标注器乐段，无虚假唱词通过');
    }
  }

  // 3. 验证刷新恢复
  console.log('\n--- Step 3: 刷新页面验证持久化恢复 ---');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.luDiagnostics && window.state);
  await page.waitForFunction(() => {
    return window.state.playlist.filter(t => t.localOnly && t.src && t.lyrics && t.lyrics.length > 0).length === 10;
  });
  const reloadedCount = await page.evaluate(() => {
    return window.state.playlist.filter(t => t.localOnly && t.src && t.lyrics && t.lyrics.length > 0).length;
  });
  assert.equal(reloadedCount, 10, '刷新后 10 首动漫歌曲与歌词应全部自动就绪恢复');
  console.log('✓ 刷新页面后全部 10 首歌曲及逐行 LRC 歌词完整恢复！');

  assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
  console.log('\n========================================');
  console.log('十首动漫歌曲本地接入、逐行LRC与刷新恢复测试全部 PASS');
  console.log('========================================');
} finally {
  await browser.close();
}
