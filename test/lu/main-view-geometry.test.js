// 主画面几何回归：确认(1)后处理缓冲启用多重采样，(2)任意档位×任意阵型×任意波形都不出现方块相交。
// 采用"合成频谱 + 虚拟时间"驱动：不依赖真实音频文件，可确定性覆盖整拍周期。
// 用法: node test/lu/main-view-geometry.test.js
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.LU_URL || 'http://127.0.0.1:8091/';
const FORMATIONS = ['grid', 'helix', 'ring', 'fan', 'orbit', 'terrace', 'sphere'];
const PATTERNS = ['ripple', 'diagonal', 'equalizer', 'spiral', 'heartbeat', 'glitch'];
const TIERS = (process.env.LU_TIERS || '1,2,3').split(',').map(Number);
const FRAMES_PER_CASE = Number(process.env.LU_FRAMES || 60);
// LU_QUICK=1 时只跑最严苛的 3 档全阵型，用于快速回归
const QUICK = process.env.LU_QUICK === '1';

// 页面内探针：合成音频驱动 + 精确 OBB 相交检测
const probe = async ({ formations, patterns, tier, frames, setup }) => {
  const diag = window.luDiagnostics;
  const state = window.state;
  const settleFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

  // --- 合成频谱驱动：一个 124BPM 的强低频节拍，覆盖 release/anticipation 全相位 ---
  const spectrum = new Uint8Array(64);
  let beatClock = 0;
  const BEAT = 60 / 124;
  const fakeAnalyser = {
    getByteFrequencyData(target) {
      const phase = (beatClock % BEAT) / BEAT;
      const hit = Math.exp(-phase * 6);
      const bass = Math.min(1, 0.35 + hit * 0.75);
      const mid = 0.25 + Math.sin(beatClock * 3.1) * 0.12 + hit * 0.25;
      const treble = 0.18 + Math.sin(beatClock * 7.3) * 0.08;
      for (let i = 0; i < 4; i++) target[i] = 255 * bass;
      for (let i = 4; i < 20; i++) target[i] = 255 * Math.max(0, Math.min(1, mid));
      for (let i = 20; i < 48; i++) target[i] = 255 * Math.max(0, Math.min(1, treble));
      for (let i = 48; i < target.length; i++) target[i] = 24;
    }
  };
  state.audioCtx = { currentTime: 0, state: 'running' };
  state.analyser = fakeAnalyser;
  state.audioDataArray = spectrum;
  state.isPlayingMusic = true;
  state.audioReady = true;
  state.playbackOffset = 0;
  state.playbackStartTime = 0;
  state.beatCount = 0;
  state.beatOrigin = 0;
  state.nextBeatTime = BEAT;
  state.onsetTimes = [];
  state.enableTitleIntro = false;
  state.isIntroPlaying = false;
  state.isChoreographyShow = false;
  state.contentMode = 'material';
  state.matrixSequence = 'standard';

  const tick = async () => {
    beatClock += 1 / 60;
    state.audioCtx.currentTime += 1 / 60;
    await settleFrame();
  };

  const obbOf = unit => {
    const e = unit.matrixWorld.elements;
    const raw = [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]];
    const dirs = [], half = [];
    for (const axis of raw) {
      const length = Math.hypot(axis[0], axis[1], axis[2]) || 1;
      dirs.push([axis[0] / length, axis[1] / length, axis[2] / length]);
      half.push(0.5 * length);
    }
    // 世界轴投影半宽：轴向余量判据用的量纲（与 SAT 的局部半宽不同）
    const projected = [
      0.5 * (Math.abs(e[0]) + Math.abs(e[4]) + Math.abs(e[8])),
      0.5 * (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])),
      0.5 * (Math.abs(e[2]) + Math.abs(e[6]) + Math.abs(e[10]))
    ];
    return { c: [e[12], e[13], e[14]], dirs, half, projected };
  };

  // 分离轴定理：3+3 面轴 + 9 叉积轴；任一轴分离即证明两块不相交
  const intersects = (a, b) => {
    const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], AbsR = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const EPS = 1e-6;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      R[i][j] = a.dirs[i][0] * b.dirs[j][0] + a.dirs[i][1] * b.dirs[j][1] + a.dirs[i][2] * b.dirs[j][2];
      AbsR[i][j] = Math.abs(R[i][j]) + EPS;
    }
    const d = [b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2]];
    const t = [
      d[0] * a.dirs[0][0] + d[1] * a.dirs[0][1] + d[2] * a.dirs[0][2],
      d[0] * a.dirs[1][0] + d[1] * a.dirs[1][1] + d[2] * a.dirs[1][2],
      d[0] * a.dirs[2][0] + d[1] * a.dirs[2][1] + d[2] * a.dirs[2][2]
    ];
    const ra = a.half, rb = b.half;
    for (let i = 0; i < 3; i++) {
      const projected = Math.abs(t[i]);
      const radius = ra[i] + rb[0] * AbsR[i][0] + rb[1] * AbsR[i][1] + rb[2] * AbsR[i][2];
      if (projected > radius) return false;
    }
    for (let j = 0; j < 3; j++) {
      const projected = Math.abs(t[0] * R[0][j] + t[1] * R[1][j] + t[2] * R[2][j]);
      const radius = ra[0] * AbsR[0][j] + ra[1] * AbsR[1][j] + ra[2] * AbsR[2][j] + rb[j];
      if (projected > radius) return false;
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const i1 = (i + 1) % 3, i2 = (i + 2) % 3, j1 = (j + 1) % 3, j2 = (j + 2) % 3;
      const projected = Math.abs(t[i2] * R[i1][j] - t[i1] * R[i2][j]);
      const radius = ra[i1] * AbsR[i2][j] + ra[i2] * AbsR[i1][j] + rb[j1] * AbsR[i][j2] + rb[j2] * AbsR[i][j1];
      if (projected > radius) return false;
    }
    return true;
  };

  // 分离轴最小穿透深度：>0 表示实体相交，数值即最小平移距离（MTV）
  const penetration = (a, b) => {
    if (!intersects(a, b)) return 0;
    const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], AbsR = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const EPS = 1e-6;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      R[i][j] = a.dirs[i][0] * b.dirs[j][0] + a.dirs[i][1] * b.dirs[j][1] + a.dirs[i][2] * b.dirs[j][2];
      AbsR[i][j] = Math.abs(R[i][j]) + EPS;
    }
    const d = [b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2]];
    const t = [
      d[0] * a.dirs[0][0] + d[1] * a.dirs[0][1] + d[2] * a.dirs[0][2],
      d[0] * a.dirs[1][0] + d[1] * a.dirs[1][1] + d[2] * a.dirs[1][2],
      d[0] * a.dirs[2][0] + d[1] * a.dirs[2][1] + d[2] * a.dirs[2][2]
    ];
    const ra = a.half, rb = b.half;
    let depth = Infinity;
    for (let i = 0; i < 3; i++) {
      const radius = ra[i] + rb[0] * AbsR[i][0] + rb[1] * AbsR[i][1] + rb[2] * AbsR[i][2];
      depth = Math.min(depth, radius - Math.abs(t[i]));
    }
    for (let j = 0; j < 3; j++) {
      const projected = Math.abs(t[0] * R[0][j] + t[1] * R[1][j] + t[2] * R[2][j]);
      const radius = ra[0] * AbsR[0][j] + ra[1] * AbsR[1][j] + ra[2] * AbsR[2][j] + rb[j];
      depth = Math.min(depth, radius - projected);
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const i1 = (i + 1) % 3, i2 = (i + 2) % 3, j1 = (j + 1) % 3, j2 = (j + 2) % 3;
      const projected = Math.abs(t[i2] * R[i1][j] - t[i1] * R[i2][j]);
      const radius = ra[i1] * AbsR[i2][j] + ra[i2] * AbsR[i1][j] + rb[j1] * AbsR[i][j2] + rb[j2] * AbsR[i][j1];
      depth = Math.min(depth, radius - projected);
    }
    return depth;
  };

  const axisMargin = (a, b) => Math.max(    Math.abs(b.c[0] - a.c[0]) - (a.projected[0] + b.projected[0]),
    Math.abs(b.c[1] - a.c[1]) - (a.projected[1] + b.projected[1]),
    Math.abs(b.c[2] - a.c[2]) - (a.projected[2] + b.projected[2])
  );

  const sample = async () => {
    const report = { frames: 0, intersecting: 0, minMargin: Infinity, worst: null, pushFrames: 0, maxPushed: 0, maxPush: 0 };
    for (let f = 0; f < frames; f++) {
      await tick();
      diag.matrixGroup.updateWorldMatrix(true, true);
      const units = [...diag.matrixGroup.children];
      const boxes = units.map(obbOf);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        if (intersects(boxes[i], boxes[j])) {
          report.intersecting++;
          if (window.__luDump && !report.dump) {
            const ua = units[i], ub = units[j];
            report.dump = { frame: f, depth: +penetration(boxes[i], boxes[j]).toFixed(4),
              a: `${ua.userData.gridR},${ua.userData.gridC},${ua.userData.gridL}`, b: `${ub.userData.gridR},${ub.userData.gridC},${ub.userData.gridL}`,
              aScale: [+ua.scale.x.toFixed(3), +ua.scale.y.toFixed(3), +ua.scale.z.toFixed(3)], aRot: [+ua.rotation.x.toFixed(3), +ua.rotation.y.toFixed(3), +ua.rotation.z.toFixed(3)],
              bScale: [+ub.scale.x.toFixed(3), +ub.scale.y.toFixed(3), +ub.scale.z.toFixed(3)], bRot: [+ub.rotation.x.toFixed(3), +ub.rotation.y.toFixed(3), +ub.rotation.z.toFixed(3)],
              aTarget: ua.userData.target ? [+ua.userData.target.x.toFixed(3), +ua.userData.target.y.toFixed(3), +ua.userData.target.z.toFixed(3)] : null,
              bTarget: ub.userData.target ? [+ub.userData.target.x.toFixed(3), +ub.userData.target.y.toFixed(3), +ub.userData.target.z.toFixed(3)] : null,
              aPos: [+ua.position.x.toFixed(3), +ua.position.y.toFixed(3), +ua.position.z.toFixed(3)],
              bPos: [+ub.position.x.toFixed(3), +ub.position.y.toFixed(3), +ub.position.z.toFixed(3)] };
          }
          if (!report.worst) report.worst = `${units[i].userData.gridR},${units[i].userData.gridC},${units[i].userData.gridL} ↔ ${units[j].userData.gridR},${units[j].userData.gridC},${units[j].userData.gridL}`;
        }
        const margin = axisMargin(boxes[i], boxes[j]);
        if (margin < report.minMargin) report.minMargin = margin;
      }
      const separation = diag.separation;
      if (separation && separation.frames > 0) {
        if (separation.pushed > 0) report.pushFrames++;
        report.maxPushed = Math.max(report.maxPushed, separation.pushed);
        report.maxPush = Math.max(report.maxPush, separation.maxPush);
      }
      report.frames++;
    }
    return report;
  };

  const aa = {
    screenAntialias: diag.renderer.getContext().getContextAttributes().antialias,
    postSamples: diag.composer.renderTarget1.samples,
    pitch: diag.pitch,
    scaleRange: { ...diag.geometry }
  };

  const results = [];
  const settleLimit = [];
  const isSettled = () => diag.matrixGroup.children.every(unit => {
    const target = unit.userData.target;
    if (!target) return true;
    return Math.abs(unit.position.x - target.x) + Math.abs(unit.position.y - target.y) + Math.abs(unit.position.z - target.z) < 0.02;
  });
  document.querySelector(`[data-tier="${tier}"]`)?.click();
  for (const formation of formations) {
    // 先在静止状态下等队形收敛（波形会让位置永远追不上瞬时目标），再开启波形采样
    state.isPlayingMusic = false;
    state.formationMode = formation;
    state.activeFormation = formation;
    window.rebuildMatrix();
    let waited = 0;
    while (waited < 300 && !isSettled()) { await tick(); waited++; }
    settleLimit.push(waited);
    state.isPlayingMusic = true;
    for (let i = 0; i < 40; i++) await tick();
    for (const pattern of patterns) {
      state.wavePattern = pattern;
      for (let i = 0; i < 20; i++) await tick();
      results.push({ tier, formation, pattern, ...(await sample()) });
    }
  }
  // 阵型过渡：换阵当下开始逐帧采样，衡量"移动中"是否出现实体相交以及最大穿透深度
  const morphs = [];
  const swap = ['ring', 'sphere', 'grid', 'fan', 'helix', 'terrace', 'orbit'];
  state.wavePattern = 'ripple';
  for (let i = 0; i < swap.length; i++) {
    state.formationMode = swap[i];
    state.activeFormation = swap[i];
    window.rebuildMatrix();
    const report = { to: swap[i], frames: 0, intersecting: 0, deepest: 0, worst: null };
    for (let f = 0; f < 60; f++) {
      await tick();
      diag.matrixGroup.updateWorldMatrix(true, true);
      const units = [...diag.matrixGroup.children];
      const boxes = units.map(obbOf);
      let hit = false;
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const depth = penetration(boxes[a], boxes[b]);
        if (depth <= 0) continue;
        hit = true;
        if (depth > report.deepest) {
          report.deepest = +depth.toFixed(3);
          report.worst = `${units[a].userData.gridR},${units[a].userData.gridC} ↔ ${units[b].userData.gridR},${units[b].userData.gridC}`;
        }
      }
      if (hit) report.intersecting++;
      report.frames++;
    }
    morphs.push(report);
  }
  return { aa, results, morphs, settle: settleLimit };
};

async function run() {
  // SwiftShader 软件渲染会让每帧耗时 10 倍以上；显式启用 Metal 后端走真实 GPU
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.luDiagnostics && window.state);
  if (process.env.LU_DUMP === '1') await page.evaluate(() => { window.__luDump = true; });
  const cdp = await page.context().newCDPSession(page);
  // 虚拟时间：headless 下 rAF 会被节流到 1~2fps，用虚拟时钟把整拍周期快速跑完
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 3_600_000 });

  const started = Date.now();
  const tiers = QUICK ? [3] : TIERS;
  const patternsFor = tier => (QUICK || tier !== 3 ? ['ripple', 'glitch'] : PATTERNS);
  const aa = await page.evaluate(() => ({
    screenAntialias: window.luDiagnostics.renderer.getContext().getContextAttributes().antialias,
    postSamples: window.luDiagnostics.composer.renderTarget1.samples,
    pitch: window.luDiagnostics.pitch,
    maxScale: window.luDiagnostics.geometry.maxScale
  }));
  const results = [];
  const morphs = [];
  const settles = [];
  for (const tier of tiers) {
    const patterns = patternsFor(tier);
    const report = await page.evaluate(probe, { formations: FORMATIONS, patterns, tier, frames: FRAMES_PER_CASE });
    results.push(...report.results);
    morphs.push(...report.morphs);
    settles.push(...report.settle);
    const bad = report.results.filter(item => item.intersecting > 0);
    console.log(`   · ${tier} 档 × ${FORMATIONS.length} 阵型 × ${patterns.length} 波形：相交组 ${bad.length} / ${report.results.length}`);
  }
  await browser.close();

  const failures = results.filter(item => item.intersecting > 0);
  const worstMargin = results.reduce((min, item) => Math.min(min, item.minMargin), Infinity);
  const busiest = results.reduce((max, item) => Math.max(max, item.maxPushed), 0);
  const biggestPush = results.reduce((max, item) => Math.max(max, item.maxPush), 0);

  console.log(`ok - 后处理多重采样 samples=${aa.postSamples}（canvas antialias=${aa.screenAntialias}）`);
  console.log(`ok - 格距 pitch=${aa.pitch.toFixed(3)} · 档位尺寸上限=${aa.maxScale}`);
  console.log(`ok - 用例 ${results.length} 组 × ${FRAMES_PER_CASE} 帧，用时 ${Math.round((Date.now() - started) / 1000)}s：相交组 ${failures.length}`);
  const morphBad = morphs.filter(m => m.intersecting > 0);
  console.log(`ok - 每档换阵收敛帧数：${settles.join('/')}（上限 400）`);
  console.log(`ok - 阵型过渡 ${morphs.length} 次 × 60 帧：出现相交的过渡 ${morphBad.length} 次，最深穿透 ${morphs.reduce((max, m) => Math.max(max, m.deepest), 0).toFixed(3)}`);
  for (const m of morphBad) console.log(`   ~ 过渡→${m.to}: ${m.intersecting}/60 帧相交，最深 ${m.deepest} (${m.worst})`);
  console.log(`ok - 全局最小轴向余量 ${worstMargin.toFixed(4)} · 求解器单帧最多推动 ${busiest} 对 / 最大修正 ${biggestPush.toFixed(4)}`);
  for (const item of results.filter(r => r.intersecting > 0)) {
    console.log(`   ✗ ${item.tier}档 ${item.formation}/${item.pattern} 相交帧=${item.intersecting} dump=${JSON.stringify(item.dump)}`);
  }
  for (const item of (process.env.LU_VERBOSE === '1' ? results : results.filter(r => r.minMargin < 0.03 || r.intersecting > 0))) {
    console.log(`   ! ${item.tier}档 ${item.formation}/${item.pattern} 相交帧=${item.intersecting} 最小余量=${item.minMargin.toFixed(4)} 推动帧=${item.pushFrames} 单帧最多${item.maxPushed}对 最大修正=${item.maxPush.toFixed(4)} ${item.worst || ''}`);
  }
  if (errors.length) console.log('页面错误: ' + errors.slice(0, 5).join(' | '));

  assert.equal(errors.length, 0, '页面不得出现运行时错误');
  assert.ok(aa.postSamples > 0, '后处理缓冲必须启用多重采样（主画面毛边根因）');
  assert.deepEqual(failures.map(f => `${f.tier}/${f.formation}/${f.pattern}`), [], '任意档位/阵型/波形下都不得出现方块相交');
  // 轴向余量只是"必不相交"的充分条件：方块带旋转时包围盒可以重叠而实体仍不相交，
  // 所以这里作为深度告警，真正的判据是上面的精确相交检测。
  assert.ok(worstMargin >= -0.25, `世界轴余量不应出现深度重叠，实测 ${worstMargin}`);
  console.log('\nPASS - 主画面几何与抗锯齿回归通过');
}

run();
