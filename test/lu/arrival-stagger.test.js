// 入场错时回归：确认方阵不是"一次性融化"，而是按时间片一站站长出来，
// 且承载内容的单元（角色所在的那个）排在第一拍；入场完成后不允许出现穿模。
// 用法: node test/lu/arrival-stagger.test.js
// 依赖: 已在 127.0.0.1:8099 提供 index.html 的静态服务 (可用 LU_URL 覆盖)
//
// 设计说明：虚拟时钟会大步跳帧（实测一帧可跨 0.8s），逐帧采样观察不到入场中间态。
// 因此主判据放在"入场时间表"这个确定性事实上，而不是"某一帧看到了什么"。
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.LU_URL || 'http://127.0.0.1:8099/';

const probe = async ({ settleFrames }) => {
  const diag = window.luDiagnostics;
  const state = window.state;
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));

  // 触发一次"整体重建"（而非复用池重排）。复用路径刻意跳过入场：
  // 用户拖滑块时方阵不该反复重播入场，只有真正重新生成单元时才入场。
  const sel = document.querySelector('#material');
  if (sel && sel.options.length > 1) {
    sel.selectedIndex = (sel.selectedIndex + 1) % sel.options.length;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  window.rebuildMatrix();
  await frame();

  const g = diag.matrixGroup;
  const t0 = state.time;
  const pitch = diag.pitch;
  const plan = g.children.map((u, i) => ({
    i, delay: +((u.userData.arrival?.at ?? t0) - t0).toFixed(4),
    dist: +Math.hypot(u.userData.baseX, u.userData.baseY, u.userData.baseZ).toFixed(4),
    // 与实现同源的对角坐标：入场错时按它分层，而不是按径向距离
    diagKey: +((u.userData.baseX + u.userData.baseY) / (pitch * Math.SQRT2)).toFixed(4),
    content: !!u.userData.contentCount
  }));
  const staleReady = g.children.filter(u => u.userData.arrival?.ready).length;

  // 等待全部到点，记录用时
  let waited = 0;
  while (waited < settleFrames && g.children.some(u => u.userData.arrival && !u.userData.arrival.ready)) {
    await frame(); waited++;
  }
  const allReady = g.children.every(u => !u.userData.arrival || u.userData.arrival.ready);

  // 入场完成后跑一段，检查是否出现穿模（求解器只在演奏中/阵型过渡窗口求解，这里强制打开）
  state.isPlayingMusic = true;
  state.morphUntil = performance.now() + 1e6;
  let pushed = 0, activeFrames = 0;
  for (let f = 0; f < 60; f++) {
    const sep = diag.separation;
    if (sep) { pushed = Math.max(pushed, sep.pushed || 0); if (sep.active) activeFrames++; }
    await frame();
  }
  const scales = g.children.map(u => Math.abs(u.scale.x));
  return {
    count: g.children.length, plan, staleReady, allReady, waited,
    minScale: Math.min(...scales), maxScale: Math.max(...scales),
    pushed, activeFrames
  };
};

const run = async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.luDiagnostics && window.state
    && window.luDiagnostics.matrixGroup && window.luDiagnostics.matrixGroup.children.length > 0, { timeout: 30000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 3_600_000 });

  const r = await page.evaluate(probe, { settleFrames: 200 });
  const delays = r.plan.map(p => p.delay);
  const uniq = [...new Set(delays)].sort((a, b) => a - b);
  const contentDelays = r.plan.filter(p => p.content).map(p => p.delay);
  const otherDelays = r.plan.filter(p => !p.content).map(p => p.delay);

  console.log(`  单元数=${r.count} · 承载内容单元=${contentDelays.length}`);
  console.log(`  时间片取值=${uniq.map(d => d.toFixed(2)).join(', ')}（共 ${uniq.length} 种，方阵对称时重复属正常）`);
  console.log(`  时间片跨度=${(uniq[uniq.length - 1] - uniq[0]).toFixed(3)}s · 普通单元最晚=${otherDelays.length ? Math.max(...otherDelays).toFixed(2) : '-'}`);
  console.log(`  重建后陈旧 ready 残留=${r.staleReady} · 全部到点=${r.allReady} · 等待帧数=${r.waited}`);
  console.log(`  入场后尺寸区间=[${r.minScale.toFixed(4)}, ${r.maxScale.toFixed(4)}] · 避让推动=${r.pushed} 对 · 求解生效帧=${r.activeFrames}/60`);

  // 1. 对角坐标必须真的决定时间片：按对角键排序后，时间片不得出现倒退。
  //    这条是"扫掠顺序成立"的本质判据——对称方阵里相同对角键本来就该同时到达。
  const byKey = [...r.plan].sort((a, b) => a.diagKey - b.diagKey);
  let monotonic = true;
  for (let i = 1; i < byKey.length; i++) {
    if (byKey[i].delay < byKey[i - 1].delay - 1e-6) { monotonic = false; break; }
  }
  console.log(`  对角键序 → 时间片序单调=${monotonic}（首: key=${byKey[0].diagKey} delay=${byKey[0].delay.toFixed(2)} → 末: key=${byKey[byKey.length - 1].diagKey} delay=${byKey[byKey.length - 1].delay.toFixed(2)}）`);
  assert.ok(monotonic, '对角键越大的单元，入场时间片必须不早于对角键更小的单元（扫掠顺序被打乱）');
  assert.ok(uniq.length >= 4, `入场必须分出足够的时间片才读得出顺序，实测 ${uniq.length} 种`);
  assert.ok(uniq[uniq.length - 1] - uniq[0] > 0.4, `首尾时间片应拉开可感知的差距，实测跨度 ${(uniq[uniq.length - 1] - uniq[0]).toFixed(3)}s`);
  // 2. 全部必须到点，且不得留下上一轮的 ready 残留（否则新单元会一出生就可见）
  assert.equal(r.allReady, true, '所有单元最终必须到点');
  assert.equal(r.staleReady, 0, `重建后的新单元不应带着上一轮的 ready 出生，实测残留 ${r.staleReady} 个`);
  // 3. 最终身材到位
  assert.ok(r.minScale > 0.95, `所有单元最终必须到位，实测最小 ${r.minScale.toFixed(4)}`);
  // 4. 内容单元优先入场
  if (contentDelays.length) {
    const worstOther = Math.min(...otherDelays);
    assert.ok(Math.max(...contentDelays) <= worstOther,
      `承载内容的单元必须排在普通单元之前（内容最晚=${Math.max(...contentDelays)} 普通最早=${worstOther}）`);
  }
  // 5. 入场后不得穿模，且求解器确实在工作
  assert.ok(r.activeFrames > 0, '避让求解器必须在检查期间处于工作状态，否则这项检测等于没做');
  assert.equal(r.pushed, 0, `入场完成后不应触发几何避让，实测推动 ${r.pushed} 对`);

  console.log(`  页面错误=${errors.length}`, errors.slice(0, 3).join(' | '));
  assert.equal(errors.length, 0, `入场过程不应产生页面错误: ${errors.slice(0, 4).join(' | ')}`);

  await browser.close();
  console.log('\n✅ 入场错时验证通过');
};

run().catch(e => { console.error('\n❌ 验证失败:', e.message); process.exit(1); });
