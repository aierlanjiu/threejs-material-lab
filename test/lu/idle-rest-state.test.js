// 静息待机态回归：确认装置在"未演奏"时自主呼吸，且与演奏态干净交接。
// 用法: node test/lu/idle-rest-state.test.js
// 依赖: 已在 127.0.0.1:8099 提供 index.html 的静态服务 (可用 LU_URL 覆盖)
// 说明: headless 下 rAF 会被节流到 1~2fps，因此与既有几何回归一致，用 CDP 虚拟时钟驱动；
//       所有判据都按"帧数"而不是墙上时间计，避免受渲染速度影响。
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.LU_URL || 'http://127.0.0.1:8099/';
const FRAMES = Number(process.env.LU_IDLE_FRAMES || 600);

// 页面内探针：逐帧采样静息包络与实体实际位移，不依赖音频文件
const probe = async ({ frames, startPlayingAtFrame }) => {
  const state = window.state;
  const diag = window.luDiagnostics;
  const breath = [];
  const mid = [];
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  let switched = false;
  // 避让求解器统计：静息呼吸若真的造成接触，求解器必然开始推动方块，这里读它的峰值作为穿模证据
  let pushedPeak = 0, maxPushPeak = 0, sepActiveFrames = 0;
  for (let f = 0; f < frames; f++) {
    if (startPlayingAtFrame != null && !switched && f >= startPlayingAtFrame) {
      switched = true;
      state.isPlayingMusic = true; // 只翻转播放标志：静息包络应当自行退出
    }
    breath.push(state.idleBreath);
    const g = diag.matrixGroup;
    if (g && g.children.length) {
      const u = g.children[Math.floor(g.children.length / 2)];
      mid.push([u.position.x, u.position.y, u.position.z]);
    }
    const sep = diag.separation;
    if (sep) {
      if (sep.active) sepActiveFrames++;
      pushedPeak = Math.max(pushedPeak, sep.pushed || 0);
      maxPushPeak = Math.max(maxPushPeak, sep.maxPush || 0);
    }
    await frame();
  }
  return { breath, mid, pushedPeak, maxPushPeak, sepActiveFrames };
};

const launch = async () => {
  // SwiftShader 软件渲染会让每帧耗时 10 倍以上；显式启用 Metal 后端走真实 GPU
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.luDiagnostics && window.state
    && window.luDiagnostics.matrixGroup && window.luDiagnostics.matrixGroup.children.length > 0, { timeout: 30000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 3_600_000 });
  return { browser, page, errors };
};

const travelOf = mid => {
  let travel = 0, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < mid.length; i++) {
    minY = Math.min(minY, mid[i][1]); maxY = Math.max(maxY, mid[i][1]);
    if (i === 0) continue;
    travel += Math.hypot(mid[i][0] - mid[i - 1][0], mid[i][1] - mid[i - 1][1], mid[i][2] - mid[i - 1][2]);
  }
  return { travel, span: mid.length > 1 ? maxY - minY : 0 };
};

const run = async () => {
  // ---------- 阶段 1：纯待机，静息包络必须升起来，且画面必须真的在动 ----------
  {
    const { browser, page, errors } = await launch();
    const cells = await page.evaluate(() => window.luDiagnostics.matrixGroup.children.length);
    console.log(`  矩阵单元数: ${cells} · 采样帧数: ${FRAMES}`);
    const r = await page.evaluate(probe, { frames: FRAMES, startPlayingAtFrame: null });
    const peak = Math.max(...r.breath);
    const end = r.breath[r.breath.length - 1];
    const { travel, span } = travelOf(r.mid);
    console.log(`  待机: idleBreath 峰值=${peak.toFixed(3)} 末值=${end.toFixed(3)}`);
    console.log(`  待机: 中心块累计位移=${travel.toFixed(4)} · 垂直行程=${span.toFixed(4)} 世界单位`);
    console.log(`  待机: 避让求解器推动峰值=${r.pushedPeak} 对 · 最大修正=${r.maxPushPeak.toFixed(4)} · 生效帧=${r.sepActiveFrames}/${FRAMES}`);
    assert.ok(peak > 0.9, `静息包络应升到 ~1，实测峰值 ${peak.toFixed(3)}`);
    assert.ok(travel > 0.01, `待机时画面必须真的在动，实测累计位移 ${travel.toFixed(5)}`);
    assert.ok(span > 0.001, `待机呼吸应有可测的垂直行程，实测 ${span.toFixed(5)}`);
    assert.equal(r.pushedPeak, 0, `静息呼吸不应触发几何避让（说明它超出了位移预算），实测推动 ${r.pushedPeak} 对`);
    assert.equal(errors.length, 0, `待机态不应产生页面错误: ${errors.slice(0, 4).join(' | ')}`);
    await browser.close();
  }

  // ---------- 阶段 2：待机中途开始"演奏"，包络必须干净退出 ----------
  {
    const { browser, page, errors } = await launch();
    const at = Math.round(FRAMES * 0.5);
    const r = await page.evaluate(probe, { frames: FRAMES, startPlayingAtFrame: at });
    const before = r.breath[at - 1];
    const after = r.breath[r.breath.length - 1];
    console.log(`  交接: 播放前 idleBreath=${before.toFixed(3)} → 播放后 ${(FRAMES - at)} 帧残留=${after.toFixed(4)}`);
    assert.ok(before > 0.8, `交接前应已处于静息态，实测 ${before.toFixed(3)}`);
    assert.ok(after < 0.02, `音乐开始后静息包络必须退出，实测残留 ${after.toFixed(4)}`);
    assert.equal(errors.length, 0, `交接过程不应产生页面错误: ${errors.slice(0, 4).join(' | ')}`);
    await browser.close();
  }

  console.log('\n✅ 静息待机态验证通过');
};

run().catch(e => { console.error('\n❌ 验证失败:', e.message); process.exit(1); });
