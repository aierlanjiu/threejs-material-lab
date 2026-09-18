// 自定义图集盲盒回归：确认整目录导入后每格抽取一张，且抽取结果
//   (1) 稳定可复现——同样的种子+格号必得同一张（否则重建会看起来在闪烁）
//   (2) 可重抽——换种子后排布必须真的变了
//   (3) 清空后不留残影
// 用法: node test/lu/album-blindbox.test.js
// 依赖: 已在 127.0.0.1:8099 提供 index.html 的静态服务 (可用 LU_URL 覆盖)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.LU_URL || 'http://127.0.0.1:8099/';

// 在页面内造 N 张纯色 PNG，直接塞进 input.files，避免依赖磁盘素材
const makeAlbum = async ({ count }) => {
  const files = [];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    // 每张一个可区分的纯色
    ctx.fillStyle = `rgb(${(i * 37) % 256}, ${(i * 91) % 256}, ${(i * 53) % 256})`;
    ctx.fillRect(0, 0, 64, 64);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    files.push(new File([blob], `album_${i}.png`, { type: 'image/png' }));
  }
  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  const input = document.querySelector('#albumUpload');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const probe = async ({ count, actions }) => {
  const state = window.state;
  const diag = window.luDiagnostics;
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const settle = async ms => { await sleep(ms); };
  const out = { steps: [] };

  const snapshot = () => {
    const g = diag.matrixGroup;
    // 缓存会复用同一批 canvas 对象，所以不能拿"图像对象/尺寸"当身份——那样所有格子看起来都一样。
    // 改为取每张贴图的像素指纹（测试图片是纯色，中心像素即可唯一标识一张）。
    return g.children.map((u, i) => {
      let sig = 'none';
      u.traverse(o => {
        if (sig !== 'none') return;
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) {
          const t = m.userData?.surfaceTexture || m.map;
          const img = t && t.image;
          if (img && img.getContext) {
            const d = img.getContext('2d').getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
            sig = `${d[0]},${d[1]},${d[2]}`;
            return;
          }
        }
      });
      return { slot: i, has: sig !== 'none', sig };
    });
  };

  // 切到图片模式 + 图集盲盒
  state.contentMode = 'image';
  state.imageDist = 'album';
  document.querySelectorAll('#imageDistGroup .pill-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.idist === 'album'));
  window.rebuildMatrix();
  await frame();

  out.albumCount = state.imageAlbum.length;
  out.seedBefore = state.albumSeed;
  await sleep(900);
  out.snapA = snapshot();
  out.contentUnitsA = diag.matrixGroup.children.filter(u => u.userData.contentCount).length;

  // 重建两次，排布必须完全一致（稳定伪随机，不是 Math.random）
  window.rebuildMatrix(); await frame(); await sleep(700);
  out.snapB = snapshot();
  const sameAB = JSON.stringify(out.snapA) === JSON.stringify(out.snapB);
  out.deterministic = sameAB;

  // 重新抽取：种子变了，排布应当变化
  document.querySelector('#albumReseedBtn').click();
  await frame(); await sleep(900);
  out.seedAfter = state.albumSeed;
  out.snapC = snapshot();
  out.changedAfterReseed = JSON.stringify(out.snapA) !== JSON.stringify(out.snapC);
  out.contentUnitsC = diag.matrixGroup.children.filter(u => u.userData.contentCount).length;

  // 清空：不应残留任何单元内容
  document.querySelector('#albumClearBtn').click();
  await frame(); await sleep(900);
  out.albumAfterClear = state.imageAlbum.length;
  out.contentUnitsAfterClear = diag.matrixGroup.children.filter(u => u.userData.contentCount).length;
  out.cacheAfterClear = undefined;
  return out;
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
  // 刻意不启用 CDP 虚拟时钟：createImageBitmap 在 'advance' 策略下不会 resolve，
  // 会让整个导入流程静默挂死（本测试初版就是这样超时的）。全程走真实时钟。

  // 先造图集并塞进 input，再跑探针
  const ALBUM = Number(process.env.LU_ALBUM_COUNT || 12);
  await page.evaluate(makeAlbum, { count: ALBUM });
  await page.waitForFunction(n => window.state.imageAlbum.length === n, ALBUM, { timeout: 20000 })
    .catch(() => {});

  const r = await page.evaluate(probe, { count: ALBUM, actions: [] });
  const withContent = r.snapA.filter(s => s.has).length;
  const distinctA = [...new Set(r.snapA.filter(s => s.has).map(s => s.sig))];
  const distinctC = [...new Set(r.snapC.filter(s => s.has).map(s => s.sig))];

  console.log(`  导入图集: ${r.albumCount} 张 · 种子 ${r.seedBefore} → ${r.seedAfter}`);
  console.log(`  承载内容的格子: ${withContent}/${r.snapA.length}（首轮 contentCount=${r.contentUnitsA}）`);
  console.log(`  实际出现的不同图片: 首轮 ${distinctA.length} 种 / 重抽后 ${distinctC.length} 种`);
  console.log(`  重建后排布一致(可复现)=${r.deterministic}`);
  console.log(`  换种子后排布变化=${r.changedAfterReseed}`);
  console.log(`  清空后: 图集=${r.albumAfterClear} 张 · 承载内容格=${r.contentUnitsAfterClear}`);
  console.log(`  页面错误=${errors.length}`, errors.slice(0, 3).join(' | '));

  assert.equal(r.albumCount, ALBUM, `图集应当全部导入，实测 ${r.albumCount}/${ALBUM}`);
  assert.equal(withContent, r.snapA.length, `每格都应有图（图集非空时不应留空格），实测 ${withContent}/${r.snapA.length}`);
  assert.ok(distinctA.length > 1, `盲盒应当真的抽出多张不同图片，实测只有 ${distinctA.length} 种`);
  assert.ok(r.deterministic, '同样的种子+格号必须得到同一张：重建后排布必须完全一致（否则画面会闪烁）');
  assert.ok(r.changedAfterReseed, '重新抽取后种子变化，排布必须真的改变');
  assert.ok(r.seedAfter > r.seedBefore, '重新抽取应当推进种子');
  assert.equal(r.albumAfterClear, 0, '清空后图集应为空');
  assert.equal(r.contentUnitsAfterClear, 0, '清空后不应残留任何单元内容');
  assert.equal(errors.length, 0, `不应产生页面错误: ${errors.slice(0, 4).join(' | ')}`);

  await browser.close();
  console.log('\n✅ 图集盲盒验证通过');
};

run().catch(e => { console.error('\n❌ 验证失败:', e.message); process.exit(1); });
