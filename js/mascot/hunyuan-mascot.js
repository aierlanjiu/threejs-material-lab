import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/GLTFLoader.js/+esm';

if (typeof window !== 'undefined') window.THREE = THREE;

const MODEL_PATHS = {
  hoodie_open: './assets/mascots/blender/hoodie-lychee.glb?rig=2',
  hoodie_closed: './assets/mascots/hunyuan3d/scheme_a_closed_fruit/model_glb.glb',
  astro: './assets/mascots/blender/astro-lychee.glb?rig=2',
};

// Extra rotation from the sculpted rest pose, in radians. Keep gestures small
// enough for the existing sleeve seams, including reach poses and action blends.
const ARM_MOTION_LIMITS = {
  hoodie: { UpperArm: 0.14, LowerArm: 0.105, Hand: 0.14 },
  astro: { UpperArm: 0.21, LowerArm: 0.175, Hand: 0.175 },
};

/* =============================================================================
 * 0. 版本能力探测
 * three r166 的 MeshPhysicalMaterial 不一定含 anisotropy / dispersion。
 * 用 'in' 探测实例属性，缺失时自动降级，不写 NaN 到 uniform。
 * ========================================================================== */
const PHYSICAL_PROBE = new THREE.MeshPhysicalMaterial();
const SUPPORTS_ANISOTROPY = 'anisotropy' in PHYSICAL_PROBE;
const SUPPORTS_DISPERSION = 'dispersion' in PHYSICAL_PROBE;
PHYSICAL_PROBE.dispose();

/**
 * 法线贴图绿通道符号（OpenGL / DirectX 约定之争）。
 * 这里按「OpenGL 约定 + flipY=false（glTF 原生贴图约定）」推导：green = -∂H/∂v。
 * 浏览器实测若出现「凸起变凹陷」，在控制台执行：
 *   liCMFDebug.flipNormalGreen(true)
 * 即可整体反号重烘，不需要改代码。
 */
let NORMAL_GREEN_SIGN = -1;

/* =============================================================================
 * 1. 程序化微表面内核：确定性 · 无缝可平铺 · normal 与 roughness 同源
 *    所有频谱周期都按住 Nyquist 上限（≤200 cycles / 512px）设计，杜绝高频锯齿。
 * ========================================================================== */

const TAU = Math.PI * 2;

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
// e0 > e1 时自动变成下降沿 smoothstep
const smoothstep = (e0, e1, x) => {
  const d = e1 - e0;
  const t = clamp01(Math.abs(d) < 1e-6 ? (x < e0 ? 0 : 1) : (x - e0) / d);
  return t * t * (3 - 2 * t);
};

/** 32 位整数哈希 → [0,1)，用 Math.imul 保证不溢出成浮点 */
function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 可平铺双轴值噪声。px/py 为整周期数，索引先取模再哈希 → 上下左右严格接缝 */
function valueNoise(x, y, px, py, seed) {
  const fx = x * px, fy = y * py;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy;
  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);
  const w = (a, b) => hash2(((a % px) + px) % px, ((b % py) + py) % py, seed);
  const n00 = w(ix, iy), n10 = w(ix + 1, iy);
  const n01 = w(ix, iy + 1), n11 = w(ix + 1, iy + 1);
  return mix(mix(n00, n10, ux), mix(n01, n11, ux), uy);
}

/** 分形叠加。px/py 每层翻倍，调用方需保证 px*2^(o-1) ≤ 200 */
function fbm(x, y, px, py, octaves, seed, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, ax = px, ay = py;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x, y, ax, ay, seed + o * 131);
    norm += amp;
    amp *= gain;
    ax *= 2; ay *= 2;
  }
  return sum / norm;
}

/** 可平铺 Worley（细胞噪声）。返回细胞单位下的最近/次近距离 */
function worley(x, y, cells, seed) {
  const px = x * cells, py = y * cells;
  const ix = Math.floor(px), iy = Math.floor(py);
  let f1 = 1e9, f2 = 1e9;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox, cy = iy + oy;
      const wx = ((cx % cells) + cells) % cells;
      const wy = ((cy % cells) + cells) % cells;
      const jx = hash2(wx, wy, seed);
      const jy = hash2(wx, wy, seed + 977);
      const dx = cx + jx - px, dy = cy + jy - py;
      const d = dx * dx + dy * dy;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return { f1: Math.sqrt(f1), f2: Math.sqrt(f2) };
}

/** 故宫剔红回纹：3 层嵌套方环，各层留一道异位开口 → 连续回旋的雷纹/回纹 */
function meander(cu, cv) {
  const dx = cu - 0.5, dy = cv - 0.5;
  const ang = Math.atan2(dy, dx);
  let d = 1e9;
  for (let i = 0; i < 3; i++) {
    const r = 0.40 - i * 0.115;
    const ring = Math.abs(Math.max(Math.abs(dx) - (r - 0.042), Math.abs(dy) - (r - 0.042))) - 0.042;
    let da = ang - (-Math.PI * 0.5 + i * (TAU / 3));
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const gap = Math.exp(-Math.pow(da / 0.42, 4));
    d = Math.min(d, Math.abs(ring) + gap * 0.45);
  }
  return d;
}

/* =============================================================================
 * 2. 五套 CMF 微表面场
 *    每个 sample(u,v) 一次遍历同时产出 height 与 roughness 原始场，省一半噪声计算。
 *    roughness 原始场会被重映射到 roughnessRange，避免与 mat.roughness 双重打折。
 * ========================================================================== */
const SURFACES = {
  /** 羊脂白玉温润微油脂毛孔 + 荔枝果壳有机微颗粒 */
  jadeRind: {
    size: 512, repeat: [7, 7], slope: 5.0, roughnessRange: [0.22, 0.42],
    sample(u, v) {
      const w = worley(u, v, 18, 1103);
      const crown = Math.pow(clamp01(1 - w.f1 / 1.15), 1.7);          // 每颗壳粒的球冠
      const edge = 1 - smoothstep(0.0, 0.17, w.f2 - w.f1);            // 壳粒交界成脊
      const poreN = fbm(u, v, 46, 46, 3, 71);
      const pores = Math.pow(smoothstep(0.50, 0.86, poreN), 1.4);     // 稀疏油脂毛孔
      const swell = fbm(u, v, 3, 3, 3, 5) - 0.5;                      // 玉的柔和手作起伏
      const oil = fbm(u, v, 60, 60, 2, 313) - 0.5;                    // 极细油润面
      return {
        h: edge * 0.050 + crown * 0.028 - pores * 0.026 + swell * 0.050 + oil * 0.005,
        r: clamp01(0.34 + pores * 0.62 - crown * 0.22 + (fbm(u, v, 9, 9, 3, 907) - 0.5) * 0.30),
      };
    },
  },

  /** 羊绒粗细交织坑条 + 细密羊毛纤维杂色 */
  corduroy: {
    size: 512, repeat: [6, 6], slope: 6.0, roughnessRange: [0.74, 0.99],
    sample(u, v) {
      const WALES = 26;
      const width = valueNoise(u, 0.5, WALES, 3, 17);                 // 每根坑条粗细不一
      const t = (u * WALES) - Math.floor(u * WALES);
      const crest = Math.pow(clamp01(1 - Math.abs(t - 0.5) / (0.33 + width * 0.23)), 0.6);
      const fiber = fbm(u, v, 48, 4, 3, 41) - 0.5;                    // 沿坑条方向的绒纤维束
      const nap = fbm(u, v, 64, 64, 2, 83) - 0.5;                     // 绒毛杂色
      const slub = Math.pow(smoothstep(0.56, 0.92, fbm(u, v, 9, 26, 3, 59)), 1.4); // 粗纺竹节
      return {
        h: crest * 0.30 + fiber * 0.11 + nap * 0.05 + slub * 0.05,
        r: clamp01(0.52 + crest * 0.30 + fiber * 0.30 + slub * 0.18),
      };
    },
  },

  /** 剔红雕漆如意卷草纹 + 故宫温润堆漆微浮雕 */
  cinnabar: {
    size: 512, repeat: [2.5, 2.5], slope: 2.8, roughnessRange: [0.12, 0.26],
    sample(u, v) {
      const CELLS = 3;
      const m = meander((u * CELLS) % 1, (v * CELLS) % 1);
      const relief = smoothstep(0.01, 0.08, m);                     // 柔和浮雕隆起
      const layer = Math.sin(v * CELLS * 12 * Math.PI) * 0.0015;    // 堆漆微纹理
      const knife = (fbm(u, v, 20, 50, 2, 211) - 0.5) * 0.008;     // 细腻手工刀感
      return {
        h: relief * 0.05 + layer + knife,
        r: clamp01(0.14 + (1.0 - relief) * 0.18),                   // 凹处略深沉微哑，凸处晶亮润泽
      };
    },
  },

  /** 纳米级超细微拉丝（各向异性） */
  titanium: {
    size: 512, repeat: [3, 4], slope: 1.8, roughnessRange: [0.14, 0.28],
    sample(u, v) {
      const wobbleA = fbm(u, v, 2, 4, 2, 61);
      const fine = Math.sin(TAU * (v * 72 + 0.4 * wobbleA)) * 0.5;   // 缎面主拉丝
      const broad = fbm(u, v, 2, 12, 2, 13) - 0.5;                   // 宏观缎面光晕
      return {
        h: fine * 0.008 + broad * 0.012,
        r: clamp01(0.18 + fbm(u, v, 2, 30, 2, 23) * 0.20),
      };
    },
  },

  /** 火山玻璃贝壳状微断口 + 流动微纹 */
  obsidian: {
    size: 512, repeat: [5, 5], slope: 9.0, roughnessRange: [0.05, 0.15],
    sample(u, v) {
      const w = worley(u, v, 7, 43);
      const step = Math.pow(1 - smoothstep(0.0, 0.20, w.f2 - w.f1), 2.0); // 断口台阶
      const facet = Math.pow(clamp01(1 - w.f1), 1.2) * 0.02;              // 断口面微凸
      const flow = fbm(u, v, 3, 3, 4, 79) - 0.5;
      const arc = Math.sin(TAU * (w.f1 * 5.5 + flow * 1.6)) * 0.0045;     // 沿断口的同心弧纹
      return {
        h: -step * 0.30 + facet + arc + flow * 0.030,
        r: clamp01(0.10 + step * 0.85 + (fbm(u, v, 4, 4, 3, 19) - 0.5) * 0.10),
      };
    },
  },
};

const surfaceCache = new Map();

/**
 * 把高度场烘成 normalMap，把粗糙度场烘成 ormMap（R=255, G=roughness, B=0）。
 * 法线用 2 texel 中心差分 + wrap 索引 → 无缝；并做软限幅防止 SDF 硬边产生失控法线。
 */
function bakeSurface(def, key) {
  const n = def.size || 512;
  const n1 = n - 1;
  const H = new Float32Array(n * n);
  const R = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const s = def.sample(x / n, y / n);
      H[y * n + x] = s.h;
      R[y * n + x] = s.r;
    }
  }

  const nrmCanvas = document.createElement('canvas');
  nrmCanvas.width = nrmCanvas.height = n;
  const ormCanvas = document.createElement('canvas');
  ormCanvas.width = ormCanvas.height = n;
  const nctx = nrmCanvas.getContext('2d');
  const octx = ormCanvas.getContext('2d');
  const nrm = nctx.createImageData(n, n);
  const orm = octx.createImageData(n, n);

  const [rMin, rMax] = def.roughnessRange;
  const rFloor = clamp01(rMin / rMax);
  const slope = def.slope || 6.0;

  for (let y = 0; y < n; y++) {
    const ym = (y + n1) % n, yp = (y + 1) % n;
    const row = y * n;
    const rowM = ym * n, rowP = yp * n;
    for (let x = 0; x < n; x++) {
      const xm = (x + n1) % n, xp = (x + 1) % n;
      const i = (row + x) * 4;

      let nx = -(H[row + xp] - H[row + xm]) * slope;
      let ny = -(H[rowP + x] - H[rowM + x]) * slope * NORMAL_GREEN_SIGN;
      const m = Math.hypot(nx, ny);
      if (m > 2.4) { const k = 2.4 / m; nx *= k; ny *= k; }
      const len = Math.hypot(nx, ny, 1);

      nrm.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      nrm.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      nrm.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      nrm.data[i + 3] = 255;

      orm.data[i] = 255;
      orm.data[i + 1] = (rFloor + (1 - rFloor) * clamp01(R[row + x])) * 255;
      orm.data[i + 2] = 0;
      orm.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nrm, 0, 0);
  octx.putImageData(orm, 0, 0);

  const rep = def.repeat || [6, 6];
  const build = canvas => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep[0], rep[1]);
    t.flipY = false;                 // 与 glTF 原生贴图同一 UV 原点
    t.anisotropy = 8;                // three 内部会 clamp 到硬件上限
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };

  return {
    key,
    normalMap: build(nrmCanvas),
    ormMap: build(ormCanvas),
    roughnessRange: def.roughnessRange,
  };
}

function getSurface(name) {
  if (!surfaceCache.has(name)) {
    const def = SURFACES[name];
    if (!def) throw new Error(`Unknown CMF surface: ${name}`);
    surfaceCache.set(name, bakeSurface(def, name));
  }
  return surfaceCache.get(name);
}

/* 规范化导出：与既有命名对齐，方便 QA 脚本 / 保真比对台直接取用 */
export function getJadeRindNormalTexture() { return getSurface('jadeRind').normalMap; }
export function getCorduroyNormalTexture() { return getSurface('corduroy').normalMap; }
export function getCinnabarNormalTexture() { return getSurface('cinnabar').normalMap; }
export function getTitaniumNormalTexture() { return getSurface('titanium').normalMap; }
export function getObsidianNormalTexture() { return getSurface('obsidian').normalMap; }

/* =============================================================================
 * 3. 原生 4K 贴图调色（关键：不覆盖，只重映射色相/明度骨架）
 *    —— 把原生贴图的亮度骨架（五官、果壳暗纹、烘焙 AO）保留，
 *       重映射到该 CMF 的「暗部/中间调/高光」三色，再按 desaturate 混回原色。
 * ========================================================================== */
const GRADED_ALBEDO_MAX_EDGE = 2048;   // 内存吃紧可降到 1024/1536
const gradedAlbedoCache = new Map();

function hexBytes(hex) {
  const s = (typeof hex === 'string' ? hex : '#ffffff').replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function buildGradedAlbedo(source, spec) {
  const image = source && source.image;
  if (!image || !image.width || !image.height) return null;

  const k = Math.min(1, GRADED_ALBEDO_MAX_EDGE / Math.max(image.width, image.height));
  const w = Math.max(2, Math.round(image.width * k));
  const h = Math.max(2, Math.round(image.height * k));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const frame = ctx.getImageData(0, 0, w, h);
  const px = frame.data;

  const [sR, sG, sB] = hexBytes(spec.shadow);
  const [mR, mG, mB] = hexBytes(spec.mid);
  const [hR, hG, hB] = hexBytes(spec.highlight);
  const desat = spec.desaturate ?? 1;
  const contrast = spec.contrast ?? 1;
  const gain = spec.gain ?? 1;
  const flecks = spec.flecks || null;
  const [fR, fG, fB] = flecks ? hexBytes(flecks.color) : [0, 0, 0];

  // 头顶嫩芽/天线定制点睛色 (若未特别指定则默认高雅翠竹/玉芽绿)
  const sprout = spec.sprout || null;
  const [spSR, spSG, spSB] = sprout ? hexBytes(sprout.shadow) : [18, 48, 26];
  const [spMR, spMG, spMB] = sprout ? hexBytes(sprout.mid) : [52, 115, 68];
  const [spHR, spHG, spHB] = sprout ? hexBytes(sprout.highlight) : [135, 202, 148];

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const i = (y * w + x) * 4;
      const r0 = px[i], g0 = px[i + 1], b0 = px[i + 2];

      const rawLum = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
      const l = Math.pow(clamp01(rawLum), contrast) * gain;

      // 1) 语义分区权重计算（精准隔离面部、腮红与帽檐，杜绝猴屁股）
      // (a) 五官瞳孔与嘴线暗部：纯净深黑，绝对保护
      const darkWeight = 1 - smoothstep(0.08, 0.16, rawLum);

      // (b) 头顶嫩芽/天线绿色区域：提取鲜活叶芽，赋予考究互补点睛色
      const greenDiff = g0 - Math.max(r0, b0);
      const sproutWeight = (1 - darkWeight) * clamp01((greenDiff - 4) / 16) * smoothstep(0.12, 0.30, rawLum);

      // (c) 荔枝主壳体/工装面料（特征：深红/砖红纯色壳体，R 远大于 G 与 B，r0/g0 达到 2.8~4.0）
      // 面部与腮红区域：r0/g0 仅为 1.1~1.55，绝不超过 1.75！
      // 通过红绿比与红蓝比的最小值，精准划分壳体与面部/腮红边界
      const redRatio = Math.min(r0 / Math.max(1, g0), r0 / Math.max(1, b0));
      // 1.75 ~ 2.25 之间柔和插值过渡，帽檐无毛刺锯齿光晕，天然腮红 100% 豁免绝不染成猴屁股
      const shellFactor = (r0 > 75) ? smoothstep(1.75, 2.25, redRatio) : 0.0;

      // (d) 面部、天然腮红与小手肤色（100% 忠实保护）
      const faceWeight = (1 - darkWeight) * (1 - sproutWeight) * (1.0 - shellFactor);

      // (e) 主壳体权重
      const bodyWeight = clamp01(1 - darkWeight - sproutWeight - faceWeight);

      // 2) 主体三色带色阶映射（自适应动态范围展开）
      // 原生果壳底色偏深红 (lum ~ 0.16-0.36)，若直接取 rawLum 会使高光完全无法触达、暗部过于晦暗。
      // 将壳体动态范围映射至 0.0~1.0，使暗部/中间调/高光层次鲜明绽放。
      const lumMin = (r0 > 75 && redRatio > 1.7) ? 0.14 : 0.06;
      const lumMax = (r0 > 75 && redRatio > 1.7) ? 0.38 : 0.88;
      const bodyLum = clamp01((rawLum - lumMin) / (lumMax - lumMin));
      const bL = clamp01(Math.pow(bodyLum, contrast) * gain);

      let bR, bG, bB;
      if (bL < 0.5) {
        const t = bL * 2;
        bR = mix(sR, mR, t); bG = mix(sG, mG, t); bB = mix(sB, mB, t);
      } else {
        const t = (bL - 0.5) * 2;
        bR = mix(mR, hR, t); bG = mix(mG, hG, t); bB = mix(mB, hB, t);
      }

      // 3) 嫩芽点睛色映射
      let spR, spG, spB;
      if (l < 0.5) {
        const t = l * 2;
        spR = mix(spSR, spMR, t); spG = mix(spSG, spMG, t); spB = mix(spSB, spMB, t);
      } else {
        const t = (l - 0.5) * 2;
        spR = mix(spMR, spHR, t); spG = mix(spMG, spHG, t); spB = mix(spMB, spHB, t);
      }

      // 4) 面部与腮红：100% 忠实保留混元原生原画级手绘五官与粉嫩腮红！
      // 拒绝死白覆盖，绝不污染变猴屁股！轻微温润提亮即可
      const fcR = r0;
      const fcG = g0;
      const fcB = b0;

      // 5) 语义组合合成
      let R = bR * bodyWeight + spR * sproutWeight + fcR * faceWeight + r0 * darkWeight;
      let G = bG * bodyWeight + spG * sproutWeight + fcG * faceWeight + g0 * darkWeight;
      let B = bB * bodyWeight + spB * sproutWeight + fcB * faceWeight + b0 * darkWeight;

      // 6) 按 desaturate 混合原色阶（仅主体部分适度混回）
      if (desat < 1) {
        R = mix(r0, R, desat);
        G = mix(g0, G, desat);
        B = mix(b0, B, desat);
      }

      // 7) 金箔微粒：只落在主体中调漆体上，绝不污染面部、嫩芽与眼珠
      if (flecks && bodyWeight > 0.35) {
        const clump = valueNoise(u, v, 150, 150, 9173);
        const grain = valueNoise(u, v, 44, 44, 4021);
        const mask = smoothstep(flecks.threshold, flecks.threshold + 0.07, clump)
          * smoothstep(0.30, 0.85, grain)
          * smoothstep(0.14, 0.42, l)
          * bodyWeight;
        const amt = mask * (flecks.gain ?? 0.5);
        R = mix(R, fR, amt); G = mix(G, fG, amt); B = mix(B, fB, amt);
      }

      px[i] = clamp01(R / 255) * 255;
      px[i + 1] = clamp01(G / 255) * 255;
      px[i + 2] = clamp01(B / 255) * 255;
      // Alpha 始终保持 255，严防 2D Canvas 预乘 Alpha 抹零服饰与外壳 RGB 数据
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(frame, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.wrapS = source.wrapS;
  tex.wrapT = source.wrapT;
  tex.repeat.copy(source.repeat);
  tex.offset.copy(source.offset);
  tex.center.copy(source.center);
  tex.rotation = source.rotation;
  tex.channel = source.channel ?? 0;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function getGradedAlbedo(variant, colorwayId, source, spec) {
  const key = `${variant}|${colorwayId || 'default'}|${source.uuid}`;
  if (!gradedAlbedoCache.has(key)) {
    gradedAlbedoCache.set(key, buildGradedAlbedo(source, spec));
  }
  return gradedAlbedoCache.get(key);
}

/** 换材质或换配色时释放多余缓存：常驻显存保持轻量 */
function releaseGradedAlbedoExcept(variant, colorwayId) {
  const prefix = `${variant}|${colorwayId || 'default'}|`;
  for (const [key, tex] of gradedAlbedoCache) {
    if (!key.startsWith(prefix)) {
      if (tex) tex.dispose();
      gradedAlbedoCache.delete(key);
    }
  }
}

/* =============================================================================
 * 3.5 独立面部保护蒙版纹理（R 通道封装面部权重，Alpha 恒定 255 杜绝预乘抹零）
 * ========================================================================== */
const faceMaskCache = new Map();

function buildFaceMaskTexture(source) {
  const image = source && source.image;
  if (!image || !image.width || !image.height) return null;

  const k = Math.min(1, 1024 / Math.max(image.width, image.height));
  const w = Math.max(2, Math.round(image.width * k));
  const h = Math.max(2, Math.round(image.height * k));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const frame = ctx.getImageData(0, 0, w, h);
  const px = frame.data;

  for (let i = 0; i < px.length; i += 4) {
    const r0 = px[i], g0 = px[i + 1], b0 = px[i + 2];
    const rawLum = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
    const darkWeight = 1 - smoothstep(0.08, 0.16, rawLum);
    const greenDiff = g0 - Math.max(r0, b0);
    const sproutWeight = (1 - darkWeight) * clamp01((greenDiff - 4) / 16) * smoothstep(0.12, 0.30, rawLum);

    const redRatio = Math.min(r0 / Math.max(1, g0), r0 / Math.max(1, b0));
    const shellFactor = (r0 > 75) ? smoothstep(1.75, 2.25, redRatio) : 0.0;
    const faceWeight = (1 - darkWeight) * (1 - sproutWeight) * (1.0 - shellFactor);

    const maskVal = Math.round(clamp01(faceWeight + darkWeight) * 255);
    px[i] = maskVal;
    px[i + 1] = maskVal;
    px[i + 2] = maskVal;
    px[i + 3] = 255;
  }
  ctx.putImageData(frame, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.wrapS = source.wrapS || THREE.RepeatWrapping;
  tex.wrapT = source.wrapT || THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function getFaceMaskTexture(source) {
  if (!source) return null;
  const id = source.uuid || 'default_mask';
  if (!faceMaskCache.has(id)) {
    faceMaskCache.set(id, buildFaceMaskTexture(source));
  }
  return faceMaskCache.get(id);
}

/* =============================================================================
 * 4. 六套 CMF 配方 × 24 款大师级工坊配色矩阵 (Colorways)
 * ========================================================================== */
const CMF_RECIPES = {
  /* 01 果壳白玉 · 原生 4K 漫反射保留 + 羊脂白玉温润微透 */
  default: {
    surface: 'jadeRind',
    normalScale: 0.62,
    metalness: 0.02,
    ior: 1.46,
    specularIntensity: 1.0, specularColor: 0xfff4ea,
    clearcoat: 0.34, clearcoatRoughness: 0.26,
    sheen: 0.36, sheenRoughness: 0.62, sheenColor: 0xffe7d7,
    transmission: 0.13, thickness: 0.72,
    attenuationColor: 0xffd8c0, attenuationDistance: 1.5,
    iridescence: 0, iridescenceIOR: 1.30, iridescenceRange: [140, 420],
    anisotropy: 0, dispersion: 0,
    envMapIntensity: 0.95,
    colorways: {
      default: {
        name: '羊脂温白', en: 'Mutton-fat White', chip: '#f6efe2',
        albedo: { desaturate: 0.0, contrast: 1.0, gain: 1.0, shadow: '#000000', mid: '#808080', highlight: '#ffffff' },
        tint: 0xffffff,
      },
      celadon: {
        name: '龙泉粉青', en: 'Celadon Mist', chip: '#689d89',
        albedo: { desaturate: 0.92, contrast: 1.05, gain: 1.0, shadow: '#1a362a', mid: '#447a66', highlight: '#9ccbbe', sprout: { shadow: '#133022', mid: '#316949', highlight: '#6fb08b' } },
        tint: 0xffffff,
      },
      rose_quartz: {
        name: '胭脂粉玉', en: 'Blush Rose', chip: '#c27287',
        albedo: { desaturate: 0.90, contrast: 1.08, gain: 1.02, shadow: '#441b26', mid: '#a35569', highlight: '#e8aec0', sprout: { shadow: '#1a3b22', mid: '#4a8253', highlight: '#8ecc98' } },
        tint: 0xffffff,
      },
      midnight_ink: {
        name: '玄青墨玉', en: 'Midnight Ink', chip: '#2b3f3e',
        albedo: { desaturate: 0.96, contrast: 1.10, gain: 0.88, shadow: '#0c1617', mid: '#203636', highlight: '#598280', sprout: { shadow: '#132b1c', mid: '#316343', highlight: '#6fa883' } },
        tint: 0xffffff,
      }
    }
  },

  /* 02 暖绒灯芯 · 复古砖红粗坑条 + 天鹅绒边缘柔光 */
  corduroy: {
    surface: 'corduroy',
    normalScale: 0.92,
    metalness: 0.0,
    ior: 1.42,
    specularIntensity: 0.30, specularColor: 0xd9c6b8,
    clearcoat: 0.0, clearcoatRoughness: 1.0,
    sheen: 0.95, sheenRoughness: 0.82,
    transmission: 0, thickness: 0,
    iridescence: 0, iridescenceIOR: 1.30, iridescenceRange: [100, 400],
    anisotropy: 0, dispersion: 0,
    envMapIntensity: 0.85,
    colorways: {
      default: {
        name: '复古砖红', en: 'Brick Red', chip: '#b3452e',
        albedo: { desaturate: 0.88, contrast: 1.08, gain: 1.0, shadow: '#3d120a', mid: '#ad4029', highlight: '#d9654c', sprout: { shadow: '#183a1e', mid: '#477e4e', highlight: '#91cb96' } },
        sheenColor: 0xffd2ba,
      },
      forest_green: {
        name: '松针墨绿', en: 'Pine Moss', chip: '#2d5c3f',
        albedo: { desaturate: 0.92, contrast: 1.10, gain: 1.0, shadow: '#0d2417', mid: '#285739', highlight: '#588f6d', sprout: { shadow: '#38200f', mid: '#8a5e30', highlight: '#cca06c' } },
        sheenColor: 0xb8e0c8,
      },
      mustard_ochre: {
        name: '芥末姜黄', en: 'Mustard Ochre', chip: '#c4962d',
        albedo: { desaturate: 0.92, contrast: 1.06, gain: 1.02, shadow: '#3b2907', mid: '#a37922', highlight: '#e0b755', sprout: { shadow: '#15301c', mid: '#3d6e46', highlight: '#83bf8d' } },
        sheenColor: 0xffe6a8,
      },
      heritage_navy: {
        name: '经典藏蓝', en: 'Heritage Navy', chip: '#274472',
        albedo: { desaturate: 0.94, contrast: 1.10, gain: 0.95, shadow: '#0c1729', mid: '#25416e', highlight: '#5d83be', sprout: { shadow: '#421d0a', mid: '#9c4d20', highlight: '#e38852' } },
        sheenColor: 0xbcd2f5,
      }
    }
  },

  /* 03 朱砂凝玉 · 故宫宫廷剔红深红剔彩雕漆 + 24K 金箔微粒 + 晶莹玉润清漆 */
  cinnabar_jade: {
    surface: 'cinnabar',
    normalScale: 0.38,
    metalness: 0.0,
    ior: 1.56,
    specularIntensity: 1.0, specularColor: 0xfff0e4,
    clearcoat: 1.0, clearcoatRoughness: 0.035,
    clearcoatFollowsRelief: false,
    sheen: 0.60, sheenRoughness: 0.32,
    transmission: 0.06, thickness: 0.65,
    attenuationColor: 0xd62828, attenuationDistance: 2.2,
    iridescence: 0, iridescenceIOR: 1.30, iridescenceRange: [100, 400],
    anisotropy: 0, dispersion: 0,
    envMapIntensity: 1.15,
    colorways: {
      default: {
        name: '故宫剔红', en: 'Palace Vermilion', chip: '#c72c2f',
        albedo: { desaturate: 1.0, contrast: 1.05, gain: 1.0, shadow: '#6e0f14', mid: '#c91b22', highlight: '#f53b42', flecks: { color: '#ffd55c', threshold: 0.46, gain: 0.95 }, sprout: { shadow: '#102e1a', mid: '#2c6e40', highlight: '#6ec288' } },
        sheenColor: 0xffd55c,
      },
      ochre_bronze: {
        name: '黛赭金漆', en: 'Ochre Bronze', chip: '#8c5227',
        albedo: { desaturate: 1.0, contrast: 1.05, gain: 1.0, shadow: '#3d200e', mid: '#9a5a2b', highlight: '#df995d', flecks: { color: '#f7ce68', threshold: 0.46, gain: 0.90 }, sprout: { shadow: '#152d1f', mid: '#386a4a', highlight: '#7cb591' } },
        sheenColor: 0xf7ce68,
      },
      cobalt_blue: {
        name: '霁蓝剔彩', en: 'Cobalt Blue', chip: '#22488a',
        albedo: { desaturate: 1.0, contrast: 1.05, gain: 1.0, shadow: '#0e244d', mid: '#2b62bf', highlight: '#689bf5', flecks: { color: '#fcd672', threshold: 0.48, gain: 0.90 }, sprout: { shadow: '#132f1c', mid: '#327246', highlight: '#72bd8b' } },
        sheenColor: 0xfcd672,
      },
      black_gold: {
        name: '玄黑描金', en: 'Black Lacquer & Gold', chip: '#1f1e21',
        albedo: { desaturate: 1.0, contrast: 1.05, gain: 0.95, shadow: '#121215', mid: '#2d2c33', highlight: '#55545e', flecks: { color: '#f7be3b', threshold: 0.38, gain: 1.25 }, sprout: { shadow: '#102b18', mid: '#296b3d', highlight: '#65ba7f' } },
        sheenColor: 0xf7be3b,
      }
    }
  },

  /* 04 全息钛银 · 航天级微拉丝缎面钛合金 + 物理薄膜氧化彩虹高光 */
  titanium_holographic: {
    surface: 'titanium',
    normalScale: 0.18,
    metalness: 0.60,
    roughness: 0.32,
    ior: 2.10,
    specularIntensity: 1.0, specularColor: 0xf6f9fc,
    clearcoat: 0.15, clearcoatRoughness: 0.20,
    sheen: 0,
    transmission: 0, thickness: 0,
    iridescence: 0.22, iridescenceIOR: 1.35, iridescenceRange: [200, 440],
    anisotropy: SUPPORTS_ANISOTROPY ? 0.50 : 0,
    anisotropyRotation: 0,
    dispersion: 0,
    envMapIntensity: 1.25,
    colorways: {
      default: {
        name: '原色钛银', en: 'Raw Titanium', chip: '#adb5bd',
        albedo: { desaturate: 1.0, contrast: 1.0, gain: 1.0, shadow: '#8695a5', mid: '#c8d4df', highlight: '#f8fbfe', sprout: { shadow: '#154035', mid: '#2cd4a3', highlight: '#8affdf' } },
      },
      electro_blue: {
        name: '阳极电光蓝', en: 'Anodized Blue', chip: '#2a6cb8',
        albedo: { desaturate: 1.0, contrast: 1.0, gain: 1.0, shadow: '#224a73', mid: '#4485c9', highlight: '#9ec4f5', sprout: { shadow: '#0f3f45', mid: '#1ddbdb', highlight: '#92ffff' } },
      },
      space_black: {
        name: '幻夜曜黑钛', en: 'Space Black', chip: '#343a40',
        albedo: { desaturate: 1.0, contrast: 1.0, gain: 0.95, shadow: '#25292e', mid: '#4a525d', highlight: '#8c98a8', sprout: { shadow: '#421a0a', mid: '#d9531e', highlight: '#ff9266' } },
      },
      champagne_gold: {
        name: '香槟流金钛', en: 'Champagne Gold', chip: '#bfa77a',
        albedo: { desaturate: 1.0, contrast: 1.0, gain: 1.0, shadow: '#615438', mid: '#baa77e', highlight: '#f5ebdb', sprout: { shadow: '#173625', mid: '#3cb873', highlight: '#92f5b8' } },
      }
    }
  },

  /* 05 光学水晶 · 高色散 + 内部衰减吸收 */
  optic_crystal: {
    surface: null,
    normalScale: 0,
    roughness: 0.045,
    metalness: 0.0,
    ior: 1.52,
    specularIntensity: 1.0, specularColor: 0xffffff,
    clearcoat: 1.0, clearcoatRoughness: 0.02,
    sheen: 0,
    transmission: 0.90, thickness: 0.42,
    iridescence: 0.16, iridescenceIOR: 1.35, iridescenceRange: [120, 380],
    anisotropy: 0,
    dispersion: SUPPORTS_DISPERSION ? 0.34 : 0,
    envMapIntensity: 1.20,
    colorways: {
      default: {
        name: '极地冰蓝', en: 'Glacier Blue', chip: '#bdebf0',
        albedo: { desaturate: 1.0, contrast: 0.88, gain: 1.0, shadow: '#b8dcde', mid: '#e2f4f5', highlight: '#ffffff', sprout: { shadow: '#307a5d', mid: '#68cca0', highlight: '#c4f7df' } },
        tint: 0xf2fcfc,
        attenuationColor: 0xbfe4e8, attenuationDistance: 1.0,
      },
      amber_topaz: {
        name: '琥珀蜜蜡', en: 'Amber Citrine', chip: '#f0c77a',
        albedo: { desaturate: 1.0, contrast: 0.90, gain: 1.0, shadow: '#d6b176', mid: '#f5dc9f', highlight: '#ffffff', sprout: { shadow: '#4d4624', mid: '#a89842', highlight: '#ede085' } },
        tint: 0xfdfbf4,
        attenuationColor: 0xf5c97a, attenuationDistance: 1.2,
      },
      emerald_beryl: {
        name: '祖母绿晶', en: 'Emerald Quartz', chip: '#7fd4b0',
        albedo: { desaturate: 1.0, contrast: 0.88, gain: 1.0, shadow: '#7ebda2', mid: '#bde7d5', highlight: '#ffffff', sprout: { shadow: '#235941', mid: '#44a677', highlight: '#99e8c2' } },
        tint: 0xf4fdf8,
        attenuationColor: 0x82dbb3, attenuationDistance: 0.9,
      },
      amethyst_violet: {
        name: '幻紫水晶', en: 'Amethyst Crystal', chip: '#c4b0eb',
        albedo: { desaturate: 1.0, contrast: 0.88, gain: 1.0, shadow: '#beafde', mid: '#e5dcfa', highlight: '#ffffff', sprout: { shadow: '#443361', mid: '#8265b5', highlight: '#c7b3f0' } },
        tint: 0xfbf8fd,
        attenuationColor: 0xd0bef0, attenuationDistance: 1.1,
      }
    }
  },

  /* 06 曜石黑金 · 火山玻璃锐利镜面 + 24K 帝王金边缘勾边 */
  obsidian_gold: {
    surface: 'obsidian',
    normalScale: 0.75,
    metalness: 0.08,
    ior: 1.52,
    specularIntensity: 1.0, specularColor: 0xfff2cc,
    clearcoat: 1.0, clearcoatRoughness: 0.02,
    clearcoatFollowsRelief: true,
    sheen: 0.85, sheenRoughness: 0.30,
    transmission: 0, thickness: 0,
    iridescence: 0.12, iridescenceIOR: 1.32, iridescenceRange: [200, 700],
    anisotropy: 0, dispersion: 0,
    envMapIntensity: 0.95,
    colorways: {
      default: {
        name: '帝王玄黑金', en: 'Imperial Black & Gold', chip: '#1c1c1f',
        albedo: { desaturate: 1.0, contrast: 1.05, gain: 0.78, shadow: '#060607', mid: '#121213', highlight: '#242324', flecks: { color: '#e8b838', threshold: 0.68, gain: 0.70 }, sprout: { shadow: '#0f291a', mid: '#286340', highlight: '#63b381' } },
        sheenColor: 0xdfad36,
      },
      silver_sheen: {
        name: '雪花银曜', en: 'Silver Sheen', chip: '#2b3340',
        albedo: { desaturate: 1.0, contrast: 1.06, gain: 0.82, shadow: '#080a0d', mid: '#14181f', highlight: '#2a303b', flecks: { color: '#d8e4f0', threshold: 0.62, gain: 0.75 }, sprout: { shadow: '#122629', mid: '#336166', highlight: '#7cb5bd' } },
        sheenColor: 0xd0dde8,
      },
      lapis_bronze: {
        name: '青金古矿', en: 'Lapis & Bronze', chip: '#192b47',
        albedo: { desaturate: 1.0, contrast: 1.08, gain: 0.82, shadow: '#060b14', mid: '#101c30', highlight: '#1f3354', flecks: { color: '#e0ad52', threshold: 0.65, gain: 0.75 }, sprout: { shadow: '#102a20', mid: '#265f46', highlight: '#65b38d' } },
        sheenColor: 0xdeb462,
      },
      crimson_flame: {
        name: '赤焰火曜', en: 'Crimson Flame', chip: '#381619',
        albedo: { desaturate: 1.0, contrast: 1.10, gain: 0.84, shadow: '#120506', mid: '#240b0d', highlight: '#3d161a', flecks: { color: '#f59638', threshold: 0.60, gain: 0.85 }, sprout: { shadow: '#260e07', mid: '#632714', highlight: '#b55436' } },
        sheenColor: 0xeb7a34,
      }
    }
  },
};

/* =============================================================================
 * 5. 材质工厂与变体切换
 * ========================================================================== */

/** 每套变体切换前把物理属性全部归零，杜绝跨变体参数串味 */
function resetPhysical(mat) {
  mat.color.set(0xffffff);
  mat.map = null;
  mat.normalMap = null;
  mat.normalScale.set(1, 1);
  mat.roughnessMap = null;
  mat.metalnessMap = null;
  mat.clearcoatNormalMap = null;
  mat.clearcoatNormalScale.set(1, 1);
  mat.roughness = 1;
  mat.metalness = 0;
  mat.ior = 1.5;
  mat.specularIntensity = 1;
  mat.specularColor.set(0xffffff);
  mat.clearcoat = 0;
  mat.clearcoatRoughness = 0;
  mat.sheen = 0;
  mat.sheenRoughness = 1;
  mat.sheenColor.set(0x000000);
  mat.transmission = 0;
  mat.thickness = 0;
  mat.attenuationColor.set(0xffffff);
  mat.attenuationDistance = Infinity;
  mat.iridescence = 0;
  mat.iridescenceIOR = 1.3;
  mat.iridescenceThicknessRange[0] = 100;
  mat.iridescenceThicknessRange[1] = 400;
  mat.envMapIntensity = 1;
  if (SUPPORTS_ANISOTROPY) mat.anisotropy = 0;
  if (SUPPORTS_DISPERSION) mat.dispersion = 0;
}

/** 用 MeshPhysicalMaterial 重建，智能识别分件网格（面罩、眼睛、面庞、贴花、服饰外壳） */
function adoptMaterial(source, morphologyKey, meshName = '') {
  const name = meshName || source.name || '';

  // 1. 宇航员透明光学气泡面罩（物理高保真前置透明层，renderOrder=10，杜绝 transmission 嵌套吞脸与多重采样闪烁）
  if (/Visor/i.test(name)) {
    const visorMat = new THREE.MeshPhysicalMaterial({
      name: `${morphologyKey}_Visor_Optical`,
      color: new THREE.Color(0xf6fbff),
      transparent: true,
      opacity: 0.22,
      roughness: 0.04,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      ior: 1.45,
      reflectivity: 0.85,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide
    });
    visorMat.userData.isOpticalVisor = true;
    return visorMat;
  }

  // 2. 眼睛：深黑曜石高光镜片（不透光高光清漆宝石，renderOrder=2，稳定不闪烁）
  if (/(Face_2|Face001_2|Eyes)/i.test(name)) {
    const eyesMat = new THREE.MeshPhysicalMaterial({
      name: `${morphologyKey}_Eyes_Obsidian`,
      map: source.map || null,
      color: new THREE.Color(0x0d0e12),
      roughness: 0.04,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      ior: 1.45,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide
    });
    eyesMat.userData.isEyes = true;
    return eyesMat;
  }

  // 3. 面庞与手掌：温润羊脂白玉 SSS 与脸庞保护（renderOrder=1，面容常驻）
  if (/(Face_1|Face001_1|Hand_Surface)/i.test(name)) {
    const faceMat = new THREE.MeshPhysicalMaterial({
      name: `${morphologyKey}_Face_WarmJade`,
      map: source.map || null,
      color: new THREE.Color(0xffffff),
      roughness: 0.32,
      clearcoat: 0.16,
      metalness: 0.0,
      emissive: new THREE.Color('#ffe4d6'),
      emissiveIntensity: 0.025,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide
    });
    faceMat.userData.isFaceSkin = true;
    return faceMat;
  }

  // 3.1 口腔内衬：温暖深樱桃果肉色 (renderOrder=1)
  if (/Mouth_Interior/i.test(name)) {
    const mouthMat = new THREE.MeshPhysicalMaterial({
      name: `${morphologyKey}_Mouth_Interior`,
      map: source.map || null,
      color: new THREE.Color('#380e14'),
      roughness: 0.45,
      metalness: 0.0,
      clearcoat: 0.2,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide
    });
    mouthMat.userData.isMouthInterior = true;
    return mouthMat;
  }

  // 3.5. 宇航头盔内圈 HUD 发光光环（renderOrder=5）
  if (/HUD_Ring/i.test(name)) {
    const hudMat = new THREE.MeshPhysicalMaterial({
      name: `${morphologyKey}_HUD_Ring`,
      map: source.map || null,
      color: new THREE.Color('#dffffb'),
      emissive: new THREE.Color('#38e0c8'),
      emissiveIntensity: 0.25,
      roughness: 0.12,
      metalness: 0.0,
      clearcoat: 0.5,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide
    });
    hudMat.userData.isHUDRing = true;
    return hudMat;
  }

  // 4. 高精贴花徽标 (Pocket / Patch / Saturn)
  if (/(Pocket|Patch|Saturn)/i.test(name)) {
    const decalMat = new THREE.MeshPhysicalMaterial({
      name: `${morphologyKey}_Decal_${name}`,
      map: source.map || null,
      transparent: true,
      opacity: 1.0,
      roughness: 0.45,
      metalness: 0.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    decalMat.userData.isDecal = true;
    return decalMat;
  }

  // 5. 抽绳 (Drawcord)
  if (/Drawcord/i.test(name)) {
    const cordMat = new THREE.MeshPhysicalMaterial({
      name: `${morphologyKey}_Drawcord`,
      map: source.map || null,
      color: new THREE.Color('#477e4e'),
      roughness: 0.68,
      metalness: 0.0
    });
    cordMat.userData.isDrawcord = true;
    return cordMat;
  }

  // 6. 顶端鲜果叶片 (Leaf_Antenna)
  if (/Leaf_Antenna/i.test(name)) {
    const leafMat = new THREE.MeshPhysicalMaterial({
      name: `${morphologyKey}_Leaf_Antenna`,
      map: source.map || null,
      color: new THREE.Color(0xffffff),
      roughness: 0.42,
      metalness: 0.0
    });
    leafMat.userData.isAntenna = true;
    return leafMat;
  }

  // 7. 外壳服饰 / 靴子 / 宇航服 / 或单体网格 -> CMF 核心靶向材质
  const mat = new THREE.MeshPhysicalMaterial({ name: `${morphologyKey}_CMF` });
  mat.map = source.map || null;
  mat.aoMap = source.aoMap || null;
  mat.alphaMap = source.alphaMap || null;
  mat.emissiveMap = source.emissiveMap || null;
  mat.side = source.side;
  mat.flatShading = source.flatShading ?? false;
  mat.vertexColors = source.vertexColors ?? false;
  mat.transparent = source.transparent ?? false;
  mat.opacity = source.opacity ?? 1;
  mat.alphaTest = source.alphaTest ?? 0;
  mat.depthWrite = source.depthWrite ?? true;
  mat.userData.cmf = { morphology: morphologyKey, variant: 'default' };
  mat.userData.isCMFTarget = true;

  const faceMaskTex = getFaceMaskTexture(source.map || source);
  mat.customProgramCacheKey = () => 'li-mascot-face-guard-v4';
  mat.onBeforeCompile = shader => {
    shader.uniforms.uFaceMaskMap = { value: faceMaskTex };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_pars_fragment>',
        `#include <map_pars_fragment>
        uniform sampler2D uFaceMaskMap;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
        // LI: 独立高保真面部保护蒙版（1.0 = 面部/腮红/双手，0.0 = 服饰外壳）
        float liFaceMask = texture2D(uFaceMaskMap, vMapUv).r;
        #else
        float liFaceMask = 0.0;
        #endif`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        #if (defined(USE_NORMALMAP) || defined(USE_NORMALMAP_OBJECTSPACE) || defined(USE_NORMALMAP_TANGENTSPACE)) && defined(USE_MAP)
        // LI: 面部抚平法线，杜绝漆面刻槽与金属拉丝刮花脸蛋与腮红
        normal = normalize(mix(normal, nonPerturbedNormal, liFaceMask));
        #endif`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        #ifdef USE_MAP
        // LI: 面部锁定温润天鹅绒羊脂玉肤感粗糙度
        roughnessFactor = mix(roughnessFactor, 0.42, liFaceMask);
        #endif`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        #ifdef USE_MAP
        // LI: 面部锁定零金属度，严禁钛银反光照镜子
        metalnessFactor *= (1.0 - liFaceMask);
        #endif`
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        #ifdef USE_MAP
        // LI: 针对面部 (liFaceMask) 进行物理材质降维与肤感保护：
        material.diffuseColor = mix(material.diffuseColor, diffuseColor.rgb, liFaceMask);
        material.specularColor = mix(material.specularColor, vec3(0.04), liFaceMask);
        material.roughness = mix(material.roughness, 0.42, liFaceMask);
        #ifdef USE_CLEARCOAT
        material.clearcoat *= (1.0 - liFaceMask * 0.92);
        #endif
        #ifdef USE_IRIDESCENCE
        material.iridescence *= (1.0 - liFaceMask);
        #endif
        #ifdef USE_ANISOTROPY
        material.anisotropy *= (1.0 - liFaceMask);
        #endif
        #endif`
      );
  };

  return mat;
}

export class HunyuanMascot {
  static async load(morphologyKey) {
    const url = MODEL_PATHS[morphologyKey];
    if (!url) throw new Error(`Unknown morphology key: ${morphologyKey}`);
    const gltf = await new GLTFLoader().loadAsync(url);
    return new HunyuanMascot(morphologyKey, gltf.scene);
  }

  constructor(morphologyKey, rawScene) {
    this.morphologyKey = morphologyKey;
    this.role = morphologyKey === 'astro' ? 'astro' : 'hoodie';
    this.source = 'Tencent Hunyuan 3D Pro + Blender Rig';
    this.variant = 'default';
    this.currentEmotion = 'normal';
    this.reducedMotion = false;
    this.face = { targetLook: new THREE.Vector2() };
    this.onVFX = null;
    this.actions = new Map();
    this.materials = new Map();      // mesh -> material | material[]
    this.origMaterials = new Map();  // mesh -> material | material[]
    this.meshes = [];

    this.group = new THREE.Group();
    this.group.name = `Hunyuan_${morphologyKey}`;

    this.pivot = new THREE.Group();
    this.pivot.name = `${morphologyKey}_Pivot`;
    this.group.add(this.pivot);

    rawScene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rawScene);
    this.modelBox = box;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const targetHeight = morphologyKey === 'hoodie_closed' ? 2.65 : 3.1;
    const scale = targetHeight / (maxDim || 1);
    this.baseScale = scale;

    rawScene.scale.setScalar(scale);
    rawScene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    this.pivot.add(rawScene);

    // 骨骼与关节提取
    this.bones = {};
    this.rigVersion = 0;
    this.poseTargets = new Map();
    this.home = new Map();
    rawScene.traverse(child => {
      this.rigVersion = Math.max(this.rigVersion, child.userData.li_rig_version || 0);
      if (child.isBone) {
        const rawName = child.userData.li_name || child.name;
        this.bones[rawName] = child;
        const dotted = rawName.replace(/^(Clavicle|Arm|UpperArm|LowerArm|ForearmTwist|Hand|Thigh|Calf|Foot|Toe|Drawcord_0[123])([LR])$/, '$1.$2');
        this.bones[dotted] = child;
        const undotted = rawName.replace(/\./g, '');
        this.bones[undotted] = child;
      }
    });

    if (this.bones.Chest) this.bones.Body = this.bones.Chest;
    if (this.bones.Leaf_Antenna_01) this.bones.Leaf_Antenna = this.bones.Leaf_Antenna_01;
    rawScene.updateMatrixWorld(true);
    for (const b of Object.values(this.bones)) {
      if (!this.home.has(b)) {
        this.home.set(b, {
          position: b.position.clone(),
          scale: b.scale.clone(),
          quaternion: b.quaternion.clone(),
          worldInverse: b.getWorldQuaternion(new THREE.Quaternion()).invert()
        });
      }
    }
    this.armRest = {};
    for (const side of ['L', 'R']) {
      const upper = this.bones[`UpperArm.${side}`], lower = this.bones[`LowerArm.${side}`], hand = this.bones[`Hand.${side}`];
      if (upper && lower && hand) this.armRest[side] = [upper, lower, hand].map(b => b.getWorldPosition(new THREE.Vector3()));
    }

    // 表情形变网格提取
    this.morphMeshes = [];
    this.morphValues = { blink: 0, smile: 0, curious: 0, shy: 0, mouth_open: 0 };
    rawScene.traverse(child => {
      if (child.isMesh && child.morphTargetDictionary) {
        this.morphMeshes.push(child);
      }
    });

    // 网格与材质解析
    rawScene.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      this.meshes.push(child);

      // 严格确定性渲染层级（彻底杜绝透明/高光层逐帧深度排序混乱引起的画面闪烁）
      if (/(Face_1|Face001_1|Hand_Surface)/i.test(child.name)) {
        child.renderOrder = 1; // 面部肌理与温润玉石基底
      } else if (/Mouth_Interior/i.test(child.name)) {
        child.renderOrder = 1; // 口腔内衬
      } else if (/(Face_2|Face001_2|Eyes)/i.test(child.name)) {
        child.renderOrder = 2; // 黑曜石眼珠高光镜片（叠在脸庞之上）
      } else if (/HUD_Ring/i.test(child.name)) {
        child.renderOrder = 5; // 头盔内圈 HUD 投射光环
      } else if (/(Pocket|Patch|Saturn)/i.test(child.name)) {
        child.renderOrder = 6; // 宇航刺绣与胸章贴花
      } else if (/Visor/i.test(child.name)) {
        child.renderOrder = 10; // 全景光学气泡面罩（最外层透明玻璃）
      } else {
        child.renderOrder = 0; // 外壳服饰、头盔外壳与身体
      }

      const raw = child.material;
      if (!raw) return;
      const isArray = Array.isArray(raw);
      const sources = isArray ? raw : [raw];
      const rebuilt = sources.map(src => adoptMaterial(src, morphologyKey, child.name));

      this.origMaterials.set(child, isArray ? sources : sources[0]);
      this.materials.set(child, isArray ? rebuilt : rebuilt[0]);
      child.material = isArray ? rebuilt : rebuilt[0];
    });

    // 为宇航员补全由于 Blender 导出缺失的口腔与舌头组件
    if (morphologyKey === 'astro' && this.bones.Head) {
      const mouthGroup = new THREE.Group();
      mouthGroup.name = 'Astro_Mouth_Assembly';
      mouthGroup.position.set(0, 0.524, 0.965);

      // 1. 口腔底色（深樱桃红椭球体）
      const cavityGeo = new THREE.SphereGeometry(0.12, 24, 16);
      cavityGeo.scale(1.2, 0.75, 0.25);
      const cavityMat = new THREE.MeshPhysicalMaterial({
        name: 'astro_Oral_Cavity',
        color: new THREE.Color('#380e14'),
        roughness: 0.45,
        clearcoat: 0.2,
        depthWrite: true,
        depthTest: true
      });
      cavityMat.userData.isMouthInterior = true;
      const cavityMesh = new THREE.Mesh(cavityGeo, cavityMat);
      cavityMesh.name = 'Astro_Oral_Cavity';
      cavityMesh.renderOrder = 1;
      mouthGroup.add(cavityMesh);
      this.meshes.push(cavityMesh);
      this.origMaterials.set(cavityMesh, cavityMat);
      this.materials.set(cavityMesh, cavityMat);

      // 2. 珊瑚粉舌头 (向上翘起的浅粉小舌苔)
      const tongueGeo = new THREE.SphereGeometry(0.07, 20, 14);
      tongueGeo.scale(1.1, 0.5, 0.4);
      const tongueMat = new THREE.MeshPhysicalMaterial({
        name: 'astro_Coral_Tongue',
        color: new THREE.Color('#e05a67'),
        roughness: 0.35,
        clearcoat: 0.4,
        depthWrite: true,
        depthTest: true
      });
      tongueMat.userData.isTongue = true;
      const tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
      tongueMesh.name = 'Astro_Coral_Tongue';
      tongueMesh.position.set(0, -0.045, 0.02);
      tongueMesh.renderOrder = 1;
      mouthGroup.add(tongueMesh);
      this.meshes.push(tongueMesh);
      this.origMaterials.set(tongueMesh, tongueMat);
      this.materials.set(tongueMesh, tongueMat);

      this.bones.Head.add(mouthGroup);
      this.astroMouth = mouthGroup;
    }

    this.setMaterialVariant('default');
  }

  poseBone(name, rotations, blendRate = 12, dt = 0.016) {
    const bone = this.bones[name];
    if (!bone) return;
    const h = this.home.get(bone);
    if (!h) return;
    const q = h.quaternion.clone();
    for (const [axis, requested] of rotations) {
      // The source hoodie is sculpted with folded arms. Its shoulder envelope
      // is deliberately smaller than the astronaut's hanging-arm rest pose.
      const angle = this.role === 'hoodie' && name.startsWith('UpperArm.') ? requested * 0.28 : requested;
      if (Math.abs(angle) < 1e-5) continue;
      const v = new THREE.Vector3(...axis).applyQuaternion(h.worldInverse);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(v, angle));
    }
    this.poseTargets.set(bone, { quaternion: q, rate: blendRate });
  }

  poseLocalBone(name, rotations, blendRate = 14, dt = 0.016) {
    const bone = this.bones[name], home = bone && this.home.get(bone);
    if (!home) return;
    const q = home.quaternion.clone();
    for (const [axis, requested] of rotations) {
      const angle = name.startsWith('LowerArm.') && axis[0] === 1
        ? THREE.MathUtils.clamp(requested, -(bone.userData.li_max_flex ?? Math.PI / 2), bone.userData.li_max_extension ?? Math.PI / 2)
        : requested;
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis), angle));
    }
    this.poseTargets.set(bone, { quaternion: q, rate: blendRate });
  }

  poseElbow(side, angle, rate, dt) {
    const bend = Math.min(Math.abs(angle) * (this.role === "hoodie" ? 0.18 : 1), Math.PI / 2);
    this.poseLocalBone(`LowerArm.${side}`, [[[1, 0, 0], -bend]], rate, dt);
  }

  poseArmReach(side, offset, amount, rate = 14) {
    const rest = this.armRest[side];
    if (!rest) return;
    const [shoulder, elbow, wrist] = rest;
    const upper = elbow.clone().sub(shoulder), lower = wrist.clone().sub(elbow);
    const a = upper.length(), b = lower.length();
    const target = shoulder.clone().add(new THREE.Vector3(...offset).multiplyScalar(this.baseScale));
    const reach = wrist.clone().lerp(target, amount).sub(shoulder);
    const distance = THREE.MathUtils.clamp(reach.length(), Math.abs(a - b) + 0.01, (a + b) * 0.97);
    const axis = reach.normalize();
    const pole = elbow.clone().sub(shoulder).addScaledVector(axis, -upper.dot(axis)).normalize();
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    const desiredUpper = axis.clone().multiplyScalar(along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const delta = new THREE.Quaternion().setFromUnitVectors(upper.normalize(), desiredUpper.normalize());
    const bone = this.bones[`UpperArm.${side}`], home = this.home.get(bone);
    const localDelta = home.worldInverse.clone().multiply(delta).multiply(home.worldInverse.clone().invert());
    this.poseTargets.set(bone, { quaternion: home.quaternion.clone().multiply(localDelta), rate });
    const restAngle = Math.acos(THREE.MathUtils.clamp(upper.dot(lower.normalize()), -1, 1));
    const bendAngle = Math.acos(THREE.MathUtils.clamp((distance * distance - a * a - b * b) / (2 * a * b), -1, 1));
    this.poseLocalBone(`LowerArm.${side}`, [[[1, 0, 0], restAngle - bendAngle]], rate);
  }

  applyPoseTargets(dt) {
    for (const [bone, pose] of this.poseTargets) {
      const part = /^(UpperArm|LowerArm|Hand)\.?[LR]$/.exec(bone.userData.li_name || bone.name)?.[1];
      const limit = ARM_MOTION_LIMITS[this.role]?.[part];
      const home = this.home.get(bone);
      let target = pose.quaternion;
      if (limit && home) {
        const angle = home.quaternion.angleTo(target);
        // Smooth compression preserves timing and small movements instead of
        // holding the arm at a hard stop for most of a large authored gesture.
        if (angle > 1e-6) target = home.quaternion.clone().slerp(target, limit * Math.tanh(angle / limit) / angle);
      }
      bone.quaternion.slerp(target, 1 - Math.exp(-pose.rate * dt));
    }
    for (const side of ["L", "R"]) {
      const bone = this.bones[`LowerArm.${side}`], h = bone && this.home.get(bone);
      if (!h) continue;
      const delta = h.quaternion.clone().invert().multiply(bone.quaternion);
      const bend = Math.max(0, -new THREE.Euler().setFromQuaternion(delta, "XYZ").x);
      const weight = Math.min(1, bend / (bone.userData.li_max_flex ?? Math.PI / 2)) ** 2;
      for (const mesh of this.morphMeshes) {
        const index = mesh.morphTargetDictionary?.[`ElbowFix_${side}`];
        if (index !== undefined) mesh.morphTargetInfluences[index] = weight;
      }
      const knee = this.bones[`Calf.${side}`], kh = knee && this.home.get(knee);
      const kneeAngle = kh ? Math.max(0, -new THREE.Euler().setFromQuaternion(kh.quaternion.clone().invert().multiply(knee.quaternion), 'XYZ').x) : 0;
      for (const mesh of this.morphMeshes) {
        const index = mesh.morphTargetDictionary?.[`KneeFix_${side}`];
        if (index !== undefined) mesh.morphTargetInfluences[index] = Math.min(1, kneeAngle / 1.25) ** 2;
      }
    }
  }

  resetAllBones(blendRate = 8, dt = 0.016) {
    this.poseTargets.clear();
    for (const [b, h] of this.home) this.poseTargets.set(b, { quaternion: h.quaternion, rate: blendRate });
  }

  setEmotion(emotion) {
    this.currentEmotion = emotion;
  }

  setMaterialVariant(variantId, colorwayId = null) {
    const recipe = CMF_RECIPES[variantId] || CMF_RECIPES.default;
    this.variant = CMF_RECIPES[variantId] ? variantId : 'default';

    const colorways = recipe.colorways || { default: { name: '默认', chip: '#ffffff', albedo: recipe.albedo, tint: recipe.tint } };
    if (!this.selectedColorways) this.selectedColorways = {};
    if (colorwayId && colorways[colorwayId]) {
      this.selectedColorways[this.variant] = colorwayId;
    }
    const activeColorwayId = this.selectedColorways[this.variant] || 'default';
    const colorway = colorways[activeColorwayId] || colorways.default;
    this.currentColorwayId = activeColorwayId;

    releaseGradedAlbedoExcept(this.variant, activeColorwayId);

    const surface = recipe.surface ? getSurface(recipe.surface) : null;

    const activeAlbedo = colorway.albedo !== undefined ? colorway.albedo : recipe.albedo;
    const activeTint = colorway.tint !== undefined ? colorway.tint : (recipe.tint ?? 0xffffff);
    const activeSheenColor = colorway.sheenColor !== undefined ? colorway.sheenColor : recipe.sheenColor;
    const activeAttenuationColor = colorway.attenuationColor !== undefined ? colorway.attenuationColor : recipe.attenuationColor;
    const activeAttenuationDistance = colorway.attenuationDistance !== undefined ? colorway.attenuationDistance : recipe.attenuationDistance;

    for (const mesh of this.meshes) {
      const origEntry = this.origMaterials.get(mesh);
      const matEntry = this.materials.get(mesh);
      if (!origEntry || !matEntry) continue;

      const isArray = Array.isArray(matEntry);
      const mats = isArray ? matEntry : [matEntry];
      const origs = isArray ? origEntry : [origEntry];

      mats.forEach((mat, i) => {
        const source = origs[i] || origs[0];

        // 特殊部件保护：不被外壳 CMF 材质覆盖
        if (mat.userData.isOpticalVisor) {
          mat.transparent = true;
          mat.opacity = 0.22;
          mat.roughness = 0.04;
          mat.clearcoat = 1.0;
          mat.clearcoatRoughness = 0.03;
          mat.depthWrite = false;
          mat.needsUpdate = true;
          return;
        }
        if (mat.userData.isEyes) {
          mat.color.set('#0d0e12');
          mat.roughness = 0.04;
          mat.clearcoat = 1.0;
          mat.clearcoatRoughness = 0.02;
          mat.depthWrite = true;
          mat.needsUpdate = true;
          return;
        }
        if (mat.userData.isFaceSkin) {
          mat.roughness = 0.32;
          mat.clearcoat = 0.16;
          mat.emissive.set('#ffe4d6');
          mat.emissiveIntensity = 0.025;
          mat.depthWrite = true;
          mat.needsUpdate = true;
          return;
        }
        if (mat.userData.isHUDRing) {
          mat.transparent = true;
          mat.opacity = 0.55;
          mat.depthWrite = false;
          mat.needsUpdate = true;
          return;
        }
        if (mat.userData.isDecal) {
          mat.transparent = true;
          mat.depthWrite = false;
          mat.needsUpdate = true;
          return;
        }
        if (mat.userData.isDrawcord) {
          if (this.variant === 'corduroy') mat.color.set('#8f6345');
          else if (this.variant === 'cinnabar_jade') mat.color.set('#dbba7f');
          else mat.color.set('#477e4e');
          mat.needsUpdate = true;
          return;
        }
        if (mat.userData.isMouthInterior) {
          mat.color.set('#380e14');
          mat.roughness = 0.45;
          mat.clearcoat = 0.2;
          mat.depthWrite = true;
          mat.needsUpdate = true;
          return;
        }
        if (mat.userData.isTongue) {
          mat.color.set('#e05a67');
          mat.roughness = 0.35;
          mat.clearcoat = 0.4;
          mat.depthWrite = true;
          mat.needsUpdate = true;
          return;
        }

        resetPhysical(mat);

        /* ---- 反照率：原生 4K 保留 或 语义分区调色 ---- */
        if (!activeAlbedo) {
          mat.map = source.map || null;
        } else {
          mat.map = getGradedAlbedo(this.variant, activeColorwayId, source.map || source, activeAlbedo) || source.map || null;
        }
        if (activeTint !== undefined) mat.color.set(activeTint);

        /* ---- 微表面：法线 + 粗糙度同源 ---- */
        if (surface) {
          mat.normalMap = surface.normalMap;
          mat.normalScale.set(recipe.normalScale, recipe.normalScale);
          mat.roughnessMap = surface.ormMap;
          mat.roughness = surface.roughnessRange[1];
          if (recipe.clearcoatFollowsRelief) {
            mat.clearcoatNormalMap = surface.normalMap;
            mat.clearcoatNormalScale.copy(mat.normalScale).multiplyScalar(0.75);
          }
        } else {
          mat.roughness = recipe.roughness ?? 0.5;
        }

        /* ---- 基础 PBR ---- */
        mat.metalness = recipe.metalness ?? 0;
        mat.ior = recipe.ior ?? 1.5;
        mat.specularIntensity = recipe.specularIntensity ?? 1;
        if (recipe.specularColor !== undefined) mat.specularColor.set(recipe.specularColor);
        mat.envMapIntensity = recipe.envMapIntensity ?? 1;

        /* ---- 清漆 ---- */
        mat.clearcoat = recipe.clearcoat ?? 0;
        mat.clearcoatRoughness = recipe.clearcoatRoughness ?? 0;

        /* ---- 织物柔光 ---- */
        mat.sheen = recipe.sheen ?? 0;
        mat.sheenRoughness = recipe.sheenRoughness ?? 1;
        if (activeSheenColor !== undefined) mat.sheenColor.set(activeSheenColor);

        /* ---- 透射与内部吸收 ---- */
        // 宇航服（astro）全套均为致密航天纤维、头盔外壳与金属工程件，非透明玉石；
        // 强制 transmission = 0 杜绝 WebGL 逐帧 18 次全屏缓冲抓取开销与闪烁
        if (this.morphologyKey === 'astro') {
          mat.transmission = 0;
          mat.thickness = 0;
        } else {
          mat.transmission = recipe.transmission ?? 0;
          mat.thickness = recipe.thickness ?? 0;
          if (activeAttenuationColor !== undefined) mat.attenuationColor.set(activeAttenuationColor);
          mat.attenuationDistance = activeAttenuationDistance ?? Infinity;
        }

        /* ---- 薄膜干涉 ---- */
        mat.iridescence = recipe.iridescence ?? 0;
        mat.iridescenceIOR = recipe.iridescenceIOR ?? 1.3;
        if (recipe.iridescenceRange) {
          mat.iridescenceThicknessRange[0] = recipe.iridescenceRange[0];
          mat.iridescenceThicknessRange[1] = recipe.iridescenceRange[1];
        }

        /* ---- 各向异性与色散（按版本能力降级） ---- */
        if (SUPPORTS_ANISOTROPY && recipe.anisotropy) {
          mat.anisotropy = recipe.anisotropy;
          mat.anisotropyRotation = recipe.anisotropyRotation ?? 0;
        }
        if (SUPPORTS_DISPERSION && recipe.dispersion) {
          mat.dispersion = recipe.dispersion;
        }

        mat.userData.cmf = { morphology: this.morphologyKey, variant: this.variant, colorway: this.currentColorwayId };
        mat.needsUpdate = true;
      });
    }
  }

  setColorway(colorwayId) {
    this.setMaterialVariant(this.variant, colorwayId);
  }

  setEmotion(emotion) {
    this.currentEmotion = emotion;
  }

  emitVFX(type, payload) {
    if (typeof this.onVFX === 'function') {
      try { this.onVFX(type, payload); } catch (e) { console.warn('VFX error:', e); }
    }
  }

  triggerAction(name) {
    this.secondary?.impulse?.(name);
    const isAstro = this.morphologyKey === 'astro';
    const durations = {
      bounce: isAstro ? 2.8 : 2.2,
      wave: 2.2, nod: 1.3, shake: 1.4, shy: 2.2, sleepy: 2.6,
      groove: 2.6, breathe: 2.5, sway: 2.4, roll: 2.5, zero_g_float: 3.2,
      jetpack_boost: 2.4, salute: 1.8, visor_hud_pulse: 1.8, beacon: 1.5, think: 1.8,
    };
    this.actions.set(name, {
      elapsed: 0,
      duration: durations[name] || 2.0,
      milestones: new Set(),
      lastPuff: 0,
      state: {}
    });
  }

  update(time, dt, audio = 0, rhythm = {}) {
    dt = Math.min(dt, 0.08);

    for (const [name, act] of this.actions.entries()) {
      act.elapsed += dt;
      if (act.elapsed >= act.duration) this.actions.delete(name);
    }

    let dPosX = 0, dPosZ = 0, dPosY = 0, dScaleY = 0, dScaleXZ = 0, dRotX = 0, dRotY = 0, dRotZ = 0;
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
    const hasBones = Object.keys(this.bones).length > 0;

    if (hasBones) {
      // 1. 骨骼平滑回弹基础闲置位
      this.resetAllBones(7.5, dt);

      // 2. Chibi 治愈系自然呼吸与松弛悬垂站姿
      const idleBreathe = this.reducedMotion ? 0 : Math.sin(time * 1.85) * 0.045;
      const idleSway = this.reducedMotion ? 0 : Math.sin(time * 1.1) * 0.035;
      const bassBeat = this.reducedMotion ? 0 : (rhythm.bass || 0) * 0.12;
      const midBeat = this.reducedMotion ? 0 : (rhythm.mid || 0) * 0.08;

      this.poseBone('Spine', [[X, idleBreathe * 0.5 + bassBeat * 0.15], [Z, idleSway * 0.3]], 6, dt);
      this.poseBone('Head', [[X, -idleBreathe * 0.35 + bassBeat * 0.2], [Z, -idleSway * 0.5], [Y, idleSway * 0.25]], 8, dt);

      // 双臂自然下垂微外展 (告别僵硬 A-Pose)
      this.poseBone('UpperArm.L', [[Z, idleSway * 0.15], [X, idleBreathe * 0.1]], 6, dt);
      this.poseElbow('L', 0, 6, dt);
      this.poseBone('UpperArm.R', [[Z, -idleSway * 0.15], [X, idleBreathe * 0.1]], 6, dt);
      this.poseElbow('R', 0, 6, dt);

      // 双腿自然扎地微动
      this.poseBone('Thigh.L', [[Z, -0.02 + idleSway * 0.05]], 6, dt);
      this.poseBone('Thigh.R', [[Z, 0.02 + idleSway * 0.05]], 6, dt);
    }

    for (const [name, act] of this.actions.entries()) {
      const u = Math.min(act.elapsed / act.duration, 1.0);
      const t = act.elapsed;

      switch (name) {
        case 'bounce': {
          const isAstro = this.morphologyKey === 'astro';
          const maxJumpHeight = isAstro ? 4.6 : 3.0;

          if (u < 0.16) {
            // 阶段 1：深蹲蓄力 (双膝深屈，双臂向后下方蓄势后摆，抬头看天)
            const p = u / 0.16;
            const sq = Math.sin(p * Math.PI * 0.5);
            dScaleY -= sq * 0.32;
            dScaleXZ += sq * 0.22;
            dPosY -= sq * 0.16;
            dRotZ += Math.sin(t * 65) * 0.02 * p;

            this.poseBone('Thigh.L', [[X, 0.68 * sq]], 14, dt);
            this.poseBone('Thigh.R', [[X, 0.68 * sq]], 14, dt);
            this.poseBone('Calf.L', [[X, -0.95 * sq]], 14, dt);
            this.poseBone('Calf.R', [[X, -0.95 * sq]], 14, dt);
            this.poseBone('Foot.L', [[X, 0.30 * sq]], 14, dt);
            this.poseBone('Foot.R', [[X, 0.30 * sq]], 14, dt);
            this.poseBone('UpperArm.L', [[X, -0.52 * sq], [Z, 0.22 * sq]], 14, dt);
            this.poseBone('UpperArm.R', [[X, -0.52 * sq], [Z, -0.22 * sq]], 14, dt);
            this.poseBone('Head', [[X, 0.22 * sq]], 14, dt);
          } else if (u < 0.48) {
            // 起跳瞬间触发地面推进烟雾环
            if (!act.milestones.has('takeoff')) {
              act.milestones.add('takeoff');
              this.emitVFX('launch_ring', { x: dPosX, z: dPosZ, intensity: isAstro ? 1.35 : 1.0 });
            }
            // 阶段 2：爆发冲天直飞出视口顶部 (双腿向下笔直蹬直绷脚尖，双臂高举朝天欢呼)
            const p = (u - 0.16) / 0.32;
            const easeUp = Math.sin(p * Math.PI * 0.5);
            dPosY += easeUp * maxJumpHeight;
            const stretch = (1.0 - p) * 0.45;
            dScaleY += stretch;
            dScaleXZ -= stretch * 0.4;
            dRotX -= Math.sin(p * Math.PI) * 0.12;

            this.poseBone('Thigh.L', [[X, -0.22]], 14, dt);
            this.poseBone('Thigh.R', [[X, -0.22]], 14, dt);
            this.poseBone('Calf.L', [[X, 0.12]], 14, dt);
            this.poseBone('Calf.R', [[X, 0.12]], 14, dt);
            this.poseBone('Foot.L', [[X, -0.62]], 14, dt);
            this.poseBone('Foot.R', [[X, -0.62]], 14, dt);
            this.poseBone('UpperArm.L', [[Z, 1.58], [X, -0.32]], 14, dt);
            this.poseBone('UpperArm.R', [[Z, -1.58], [X, -0.32]], 14, dt);
            this.poseElbow('L', 0.35, 14, dt);
            this.poseElbow('R', -0.35, 14, dt);
            this.poseBone('Head', [[X, -0.25]], 14, dt);
          } else if (u < 0.70) {
            // 阶段 3：微重力轨道滞空 / 视口外浮动 (手脚在风中微张轻盈摆动)
            const p = (u - 0.48) / 0.22;
            const hang = Math.sin(p * Math.PI);
            dPosY += maxJumpHeight + hang * 0.15;
            dRotZ += Math.sin(p * Math.PI) * 0.22;
            dRotY += p * 0.5;
            dScaleY += hang * 0.06;
            if (isAstro && t - act.lastPuff > 0.18) {
              act.lastPuff = t;
              this.emitVFX('stardust', { x: dPosX, y: 1.8, z: dPosZ });
            }

            this.poseBone('UpperArm.L', [[Z, 1.35 + Math.sin(t * 6) * 0.15], [X, -0.2]], 10, dt);
            this.poseBone('UpperArm.R', [[Z, -1.35 - Math.sin(t * 6) * 0.15], [X, -0.2]], 10, dt);
            this.poseBone('Thigh.L', [[Z, Math.sin(t * 5) * 0.12]], 10, dt);
            this.poseBone('Thigh.R', [[Z, -Math.sin(t * 5) * 0.12]], 10, dt);
          } else if (u < 0.82) {
            // 阶段 4：高速重力流星折返坠地 (身体微屈收拢迎风)
            const p = (u - 0.70) / 0.12;
            dPosY += maxJumpHeight * (1.0 - p * p);
            dScaleY += p * 0.35;
            dScaleXZ -= p * 0.18;
            dRotX += p * 0.10;

            this.poseBone('UpperArm.L', [[Z, 0.65], [X, 0.15]], 14, dt);
            this.poseBone('UpperArm.R', [[Z, -0.65], [X, 0.15]], 14, dt);
            this.poseBone('Thigh.L', [[X, 0.35]], 14, dt);
            this.poseBone('Thigh.R', [[X, 0.35]], 14, dt);
          } else if (u < 0.90) {
            // 落地瞬间触发重力砸地冲击波扬尘
            if (!act.milestones.has('landing')) {
              act.milestones.add('landing');
              this.emitVFX('impact_burst', { x: dPosX, z: dPosZ, intensity: isAstro ? 1.4 : 1.0 });
            }
            // 阶段 5：强冲击缓冲重压 (双膝外展深度深蹲吸震，双手下撑撑地缓冲)
            const p = (u - 0.82) / 0.08;
            const sq = Math.sin(p * Math.PI);
            dScaleY -= sq * 0.42;
            dScaleXZ += sq * 0.38;
            dPosY -= sq * 0.15;

            this.poseBone('Thigh.L', [[X, 0.88 * sq]], 18, dt);
            this.poseBone('Thigh.R', [[X, 0.88 * sq]], 18, dt);
            this.poseBone('Calf.L', [[X, -1.25 * sq]], 18, dt);
            this.poseBone('Calf.R', [[X, -1.25 * sq]], 18, dt);
            this.poseBone('Foot.L', [[X, 0.38 * sq]], 18, dt);
            this.poseBone('Foot.R', [[X, 0.38 * sq]], 18, dt);
            this.poseBone('UpperArm.L', [[X, 0.48 * sq], [Z, 0.35 * sq]], 18, dt);
            this.poseBone('UpperArm.R', [[X, 0.48 * sq], [Z, -0.35 * sq]], 18, dt);
            this.poseBone('Head', [[X, 0.28 * sq]], 18, dt);
          } else {
            // 阶段 6：双段阻尼弹性回弹站直
            const p = (u - 0.90) / 0.10;
            const damp = Math.exp(-6.2 * p) * Math.sin(p * Math.PI * 3.5);
            dScaleY += damp * 0.22;
            dScaleXZ -= damp * 0.14;
            dPosY += Math.max(0, damp * 0.09);
            dRotZ += damp * 0.06;
          }
          break;
        }
        case 'roll': {
          // 沿着 Y 轴侧翻（Y-Axis Sideways Barrel Roll / 侧滚翻）：
          // 机制：模型向侧面倾倒卧地（tiltZ -> -90°），以自身纵向主轴 Y 轴为主自转轴持续旋转两整周（dRotY = -720°）
          // 质心高度补偿锁定在 Rroll = 0.95m，配合 X 轴居中补偿（-1.45m），保证侧滚贴合展台，绝不下沉穿模
          if (u < 0.20) {
            // 阶段 1：侧倾卧倒贴地 (向右侧卧倒地，四肢微屈缓冲触地)
            const p = u / 0.20;
            const easeP = Math.sin(p * Math.PI * 0.5);
            dRotZ = -easeP * (Math.PI * 0.5); // 侧卧倾角
            dRotY = -easeP * 0.45;            // 起步侧转
            dRotX = 0;

            dPosX = -1.45 * easeP;
            dPosY = 0.95 * easeP - Math.sin(p * Math.PI) * 0.08;
            dPosZ = 0;

            dScaleY -= Math.sin(p * Math.PI) * 0.10;
            dScaleXZ += Math.sin(p * Math.PI) * 0.08;

            if (p > 0.85 && !act.milestones.has('hit_floor')) {
              act.milestones.add('hit_floor');
              this.emitVFX('roll_dust', { x: dPosX, y: 0.10, z: dPosZ, velocityX: 1.2 });
            }

            // 侧卧微屈抱团姿态
            this.poseBone('Thigh.L', [[X, 0.85 * p]], 14, dt);
            this.poseBone('Thigh.R', [[X, 0.85 * p]], 14, dt);
            this.poseBone('Calf.L', [[X, -1.10 * p]], 14, dt);
            this.poseBone('Calf.R', [[X, -1.10 * p]], 14, dt);
            this.poseBone('UpperArm.L', [[X, 0.65 * p], [Z, 0.45 * p]], 14, dt);
            this.poseBone('UpperArm.R', [[X, 0.65 * p], [Z, -0.45 * p]], 14, dt);
            this.poseElbow('L', 0.70 * p, 14, dt);
            this.poseElbow('R', -0.70 * p, 14, dt);
            this.poseBone('Head', [[Z, -0.25 * p]], 14, dt);
          } else if (u < 0.78) {
            // 阶段 2：沿 Y 轴地表高速侧身桶滚翻 (严格以纵轴 Y 轴自转整整两周 -720°)
            const p = (u - 0.20) / 0.58;
            dRotZ = -(Math.PI * 0.5); // 保持侧卧地平线
            dRotY = -(0.45 + p * Math.PI * 4.0); // 核心 Y 轴侧翻滚动两整周！
            dRotX = Math.sin(p * Math.PI * 4) * 0.06;

            const groundZ = -Math.sin(p * Math.PI) * 1.15; // 展台纵深滚动折返
            dPosZ = groundZ;
            dPosX = -1.45 + Math.sin(p * Math.PI * 2) * 0.20;
            const bump = Math.abs(Math.sin(p * Math.PI * 8)) * 0.04;
            dPosY = 0.95 + bump;

            dScaleY -= Math.sin(p * Math.PI * 8) * 0.05;
            dScaleXZ += Math.sin(p * Math.PI * 8) * 0.05;

            // 维持紧凑侧滚桶态
            this.poseBone('Thigh.L', [[X, 0.85]], 14, dt);
            this.poseBone('Thigh.R', [[X, 0.85]], 14, dt);
            this.poseBone('Calf.L', [[X, -1.10]], 14, dt);
            this.poseBone('Calf.R', [[X, -1.10]], 14, dt);
            this.poseBone('UpperArm.L', [[X, 0.65], [Z, 0.45]], 14, dt);
            this.poseBone('UpperArm.R', [[X, 0.65], [Z, -0.45]], 14, dt);
            this.poseBone('Head', [[Z, -0.20]], 14, dt);

            if (t - act.lastPuff > 0.075) {
              act.lastPuff = t;
              const vz = (dPosZ - (act.state.lastZ || 0)) / Math.max(dt, 0.016);
              this.emitVFX('roll_dust', { x: dPosX, y: 0.10, z: dPosZ, velocityX: vz });
            }
            act.state.lastZ = dPosZ;
            act.state.lastX = dPosX;
            act.state.lastRotY = dRotY;
          } else {
            // 阶段 3：侧身撑地弹射归位 (双腿蹬地展开、双臂撑地弹起站直)
            const p = (u - 0.78) / 0.22;
            const easeOut = Math.sin(p * Math.PI * 0.5);
            const startZ = act.state.lastZ || 0;
            const startX = act.state.lastX || -1.45;
            dPosZ = THREE.MathUtils.lerp(startZ, 0, easeOut);
            dPosX = THREE.MathUtils.lerp(startX, 0, easeOut);

            const hop = Math.sin(p * Math.PI) * 0.35;
            dPosY = 0.95 * (1.0 - easeOut) + hop;

            dRotZ = -(Math.PI * 0.5) * (1.0 - easeOut);
            const remainAngle = (act.state.lastRotY || -Math.PI * 4.45) % (Math.PI * 2);
            dRotY = remainAngle * (1.0 - easeOut);
            dRotX = 0;

            // 舒展蹬腿撑地
            this.poseBone('Thigh.L', [[X, 0.40 * (1 - p)]], 16, dt);
            this.poseBone('Thigh.R', [[X, 0.40 * (1 - p)]], 16, dt);
            this.poseBone('Calf.L', [[X, -0.20 * (1 - p)]], 16, dt);
            this.poseBone('Calf.R', [[X, -0.20 * (1 - p)]], 16, dt);
            this.poseBone('UpperArm.L', [[Z, 0.50 * Math.sin(p * Math.PI)]], 16, dt);
            this.poseBone('UpperArm.R', [[Z, -0.50 * Math.sin(p * Math.PI)]], 16, dt);
            this.poseBone('Head', [[Z, 0]], 16, dt);

            if (p < 0.45) {
              dScaleY += 0.22;
              dScaleXZ -= 0.12;
            } else {
              const settle = Math.exp(-5.5 * (p - 0.45)) * Math.sin((p - 0.45) * Math.PI * 3);
              dScaleY += settle * 0.20;
              dScaleXZ -= settle * 0.12;
              if (p > 0.55 && !act.milestones.has('settled')) {
                act.milestones.add('settled');
                this.emitVFX('roll_dust', { x: 0, y: 0.08, z: 0, velocityX: 0 });
              }
            }
          }
          break;
        }
        case 'jetpack_boost': {
          if (u < 0.20) {
            const p = u / 0.20;
            dPosY -= p * 0.12;
            dScaleY -= p * 0.18;
            dRotX += p * 0.35;
            if (t - act.lastPuff > 0.06) {
              act.lastPuff = t;
              this.emitVFX('jetpack_thrust', { x: dPosX, y: 0.15, z: dPosZ + 0.3, dirX: 0, dirY: -1, dirZ: 0.6 });
            }
          } else if (u < 0.75) {
            const p = (u - 0.20) / 0.55;
            const flight = Math.sin(p * Math.PI);
            dPosY += 0.12 + flight * 0.85;
            dPosZ -= flight * 0.48;
            dPosX += Math.sin(p * Math.PI * 2) * 0.28;
            dRotX += 0.42;
            dRotZ -= Math.cos(p * Math.PI * 2) * 0.22;
            dScaleY += 0.18;

            // 飞行流线姿态：双腿向后笔直延展，双臂后掠作为尾翼
            this.poseBone('Spine', [[X, 0.28]], 10, dt);
            this.poseBone('Head', [[X, -0.32]], 10, dt);
            this.poseBone('Thigh.L', [[X, -0.35], [Z, -0.08]], 10, dt);
            this.poseBone('Thigh.R', [[X, -0.35], [Z, 0.08]], 10, dt);
            this.poseBone('Foot.L', [[X, -0.45]], 10, dt);
            this.poseBone('Foot.R', [[X, -0.45]], 10, dt);
            this.poseBone('UpperArm.L', [[X, -0.45], [Z, 0.35]], 10, dt);
            this.poseBone('UpperArm.R', [[X, -0.45], [Z, -0.35]], 10, dt);

            if (t - act.lastPuff > 0.045) {
              act.lastPuff = t;
              this.emitVFX('jetpack_thrust', {
                x: dPosX,
                y: dPosY + 0.35,
                z: dPosZ + 0.32,
                dirX: -dPosX * 0.6,
                dirY: -0.9,
                dirZ: 0.8
              });
            }
          } else {
            const p = (u - 0.75) / 0.25;
            const easeDown = 1.0 - p;
            dPosY += 0.45 * easeDown;
            dPosZ -= 0.20 * easeDown;
            dRotX += 0.42 * easeDown;
            dRotZ -= 0.22 * easeDown;
            if (p > 0.85 && !act.milestones.has('land')) {
              act.milestones.add('land');
              this.emitVFX('impact_burst', { x: dPosX, z: dPosZ, intensity: 0.8 });
            }
          }
          break;
        }
        case 'zero_g_float': {
          const env = Math.sin(u * Math.PI);
          dPosX += Math.sin(t * 2.4) * 0.32 * env;
          dPosY += (0.28 + Math.cos(t * 1.9) * 0.25) * env;
          dPosZ += Math.sin(t * 1.6) * 0.22 * env;
          dRotX += Math.sin(t * 2.1) * 0.18 * env;
          dRotY += Math.cos(t * 1.5) * 0.24 * env;
          dRotZ += Math.sin(t * 2.7) * 0.16 * env;
          dScaleY += Math.sin(t * 3.2) * 0.05 * env;

          // 微重力浮游划水肢体
          this.poseBone('Thigh.L', [[X, Math.sin(t * 1.5) * 0.18 * env], [Z, Math.cos(t * 1.2) * 0.10 * env]], 8, dt);
          this.poseBone('Thigh.R', [[X, -Math.sin(t * 1.5 + 0.5) * 0.18 * env], [Z, -Math.cos(t * 1.2) * 0.10 * env]], 8, dt);
          this.poseBone('UpperArm.L', [[Z, (0.45 + Math.sin(t * 1.6) * 0.22) * env], [X, Math.cos(t * 1.4) * 0.15 * env]], 8, dt);
          this.poseBone('UpperArm.R', [[Z, (-0.45 - Math.sin(t * 1.6) * 0.22) * env], [X, Math.cos(t * 1.4) * 0.15 * env]], 8, dt);
          this.poseBone('Head', [[X, (-0.12 + Math.sin(t * 1.2) * 0.08) * env]], 8, dt);

          if (t - act.lastPuff > 0.16) {
            act.lastPuff = t;
            this.emitVFX('stardust', { x: dPosX, y: dPosY + 0.6, z: dPosZ });
          }
          break;
        }
        case 'wave': {
          const env = Math.sin(u * Math.PI);
          dPosX += Math.sin(u * Math.PI) * 0.12;
          dRotZ += Math.sin(t * 11) * 0.08 * env;
          dPosY += Math.abs(Math.sin(t * 11)) * 0.04 * env;
          dRotX += 0.06 * env;
          dRotY += Math.cos(t * 5.5) * 0.12 * env;

          // 真实抬起左臂与欢快左右挥手
          this.poseBone('UpperArm.L', [[Z, 1.28 * env], [X, -0.28 * env]], 14, dt);
          this.poseElbow('L', 0.85 * env, 14, dt);
          if (this.role === 'hoodie') this.poseArmReach('L', [0.12, 0.04, 0.80], env);
          this.poseLocalBone('Hand.L', [[Y, Math.sin(t * 16) * 0.18 * env], [Z, Math.cos(t * 16) * 0.08 * env]], 18, dt);
          this.poseBone('UpperArm.R', [[Z, -0.22 * env]], 10, dt);
          this.poseBone('Head', [[Z, 0.14 * env], [X, -0.08 * env]], 10, dt);
          break;
        }
        case 'nod': {
          const env = Math.exp(-1.8 * u);
          dPosY -= Math.abs(Math.sin(t * 12)) * 0.04 * env;
          dScaleY -= Math.sin(t * 12) * 0.06 * env;

          // 头部独立俯仰双下巴点头
          this.poseBone('Head', [[X, Math.sin(t * 12) * 0.28 * env]], 14, dt);
          this.poseBone('UpperArm.L', [[X, Math.sin(t * 12) * 0.08 * env]], 12, dt);
          this.poseBone('UpperArm.R', [[X, Math.sin(t * 12) * 0.08 * env]], 12, dt);
          break;
        }
        case 'shake': {
          const env = Math.exp(-1.8 * u);
          dPosX += Math.sin(t * 14) * 0.04 * env;

          // 头部独立左右摇头
          this.poseBone('Head', [[Y, Math.sin(t * 14) * 0.35 * env], [Z, Math.cos(t * 14) * 0.08 * env]], 14, dt);
          this.poseBone('UpperArm.L', [[Z, Math.cos(t * 14) * 0.08 * env]], 12, dt);
          this.poseBone('UpperArm.R', [[Z, -Math.cos(t * 14) * 0.08 * env]], 12, dt);
          break;
        }
        case 'shy': {
          const env = Math.sin(u * Math.PI);
          dPosZ += env * 0.18;
          dPosY -= env * 0.08;
          dScaleY -= env * 0.06;

          // 双臂内夹掩面，双手遮挡脸颊两侧，头部微低含蓄
          this.poseBone('UpperArm.L', [[X, 0.65 * env], [Z, 0.45 * env]], 14, dt);
          this.poseBone('UpperArm.R', [[X, 0.65 * env], [Z, -0.45 * env]], 14, dt);
          this.poseElbow('L', 0.75 * env, 14, dt);
          this.poseElbow('R', -0.75 * env, 14, dt);
          this.poseBone('Hand.L', [[X, 0.25 * env]], 14, dt);
          this.poseBone('Hand.R', [[X, 0.25 * env]], 14, dt);
          this.poseBone('Head', [[X, 0.25 * env], [Z, -0.08 * env]], 12, dt);
          break;
        }
        case 'sleepy': {
          const p = Math.sin(u * Math.PI);
          dPosY -= p * 0.10;
          dScaleY -= p * 0.06;

          // 头部缓缓前垂，猛地惊醒微仰，手臂自然下垂
          this.poseBone('Head', [[X, 0.45 * p], [Z, Math.sin(t * 2.5) * 0.06]], 8, dt);
          this.poseBone('UpperArm.L', [[Z, 0.08], [X, -0.08]], 8, dt);
          this.poseBone('UpperArm.R', [[Z, -0.08], [X, -0.08]], 8, dt);
          break;
        }
        case 'groove': {
          dPosY += Math.abs(Math.sin(t * 9)) * 0.08;
          dScaleY -= Math.sin(t * 18) * 0.06;

          // 双腿随节奏交替屈膝踩点，双臂对向协调前后摆动
          this.poseBone('Thigh.L', [[X, Math.max(0, Math.sin(t * 5.5)) * 0.28]], 12, dt);
          this.poseBone('Thigh.R', [[X, Math.max(0, -Math.sin(t * 5.5)) * 0.28]], 12, dt);
          this.poseBone('UpperArm.L', [[X, Math.sin(t * 5.5) * 0.38], [Z, 0.22]], 12, dt);
          this.poseBone('UpperArm.R', [[X, -Math.sin(t * 5.5) * 0.38], [Z, -0.22]], 12, dt);
          this.poseBone('Head', [[X, Math.abs(Math.sin(t * 5.5)) * 0.16]], 12, dt);
          break;
        }
        case 'breathe': {
          const b = Math.sin(u * Math.PI);
          dScaleY += b * 0.09; dScaleXZ += b * 0.06; dPosY += b * 0.04;
          this.poseBone('Spine', [[X, b * 0.1]], 8, dt);
          break;
        }
        case 'sway': {
          const env = Math.exp(-1.2 * u);
          dRotZ += Math.sin(t * 5.5) * 0.16 * env;
          dScaleY -= Math.abs(Math.sin(t * 5.5)) * 0.04 * env;

          // 身体柔韧摆动，双臂流体相位摆动
          this.poseBone('Spine', [[Z, Math.sin(t * 5.5) * 0.18 * env]], 10, dt);
          this.poseBone('Head', [[Z, -Math.sin(t * 5.5) * 0.20 * env]], 10, dt);
          this.poseBone('UpperArm.L', [[Z, (0.22 + Math.sin(t * 5.5 - 0.4) * 0.25) * env]], 10, dt);
          this.poseBone('UpperArm.R', [[Z, (-0.22 + Math.sin(t * 5.5 - 0.4) * 0.25) * env]], 10, dt);
          break;
        }
        case 'salute': {
          const p = Math.min(u / 0.22, 1.0) * (1.0 - Math.max(0, (u - 0.78) / 0.22));
          dScaleY += 0.05 * p;

          // 右臂干脆利落行宇航军礼，身姿挺拔拔正
          this.poseBone('UpperArm.R', [[Z, -1.45 * p], [X, 0.28 * p]], 16, dt);
          this.poseElbow('R', -1.15 * p, 16, dt);
          this.poseBone('Hand.R', [[X, 0.25 * p], [Y, -0.20 * p]], 16, dt);
          this.poseBone('Body', [[X, -0.06 * p]], 12, dt);
          this.poseBone('Head', [[X, -0.08 * p]], 12, dt);
          break;
        }
        case 'visor_hud_pulse': {
          dRotY += Math.sin(t * 5.0) * 0.16;
          dScaleY += Math.sin(t * 10.0) * 0.03;
          break;
        }
        case 'think': {
          dRotX -= 0.08; dRotY += 0.16; dRotZ += Math.sin(t * 4) * 0.05;
          this.poseBone('Head', [[X, -0.12], [Z, 0.15], [Y, 0.12]], 10, dt);
          this.poseBone('UpperArm.L', [[X, 0.55], [Z, 0.35]], 10, dt);
          this.poseBone('Hand.L', [[X, 0.3]], 10, dt);
          break;
        }
      }
    }

    // 面部表情形变驱动 (Blinking, Smile, Lip sync)
    const phase = (time + 1.7) % 4.7;
    const blink = this.reducedMotion ? 0 : (phase < 0.22 ? Math.sin(phase / 0.22 * Math.PI) ** 2 : 0);
    const mood = this.currentEmotion;
    const targets = {
      blink: Math.max(blink, mood === 'sleepy' ? 0.85 : 0),
      smile: (mood === 'happy' || mood === 'energetic') ? 1 : 0,
      curious: mood === 'curious' ? 1 : 0,
      shy: mood === 'shy' ? 1 : 0,
      mouth_open: THREE.MathUtils.clamp(audio * 1.5, 0, 1)
    };
    for (const [k, targetVal] of Object.entries(targets)) {
      this.morphValues[k] = THREE.MathUtils.damp(this.morphValues[k], targetVal, k === 'blink' ? 35 : 18, dt);
      for (const mesh of this.morphMeshes) {
        const idx = mesh.morphTargetDictionary?.[k];
        if (idx !== undefined) mesh.morphTargetInfluences[idx] = this.morphValues[k];
      }
    }

    if (this.astroMouth) {
      const open = this.morphValues.mouth_open || 0;
      this.astroMouth.scale.y = 1.0 + open * 0.4;
      this.astroMouth.scale.x = 1.0 + open * 0.15;
    }

    dScaleXZ -= dScaleY * 0.52;

    let musicPosY = 0, musicScaleY = 0, musicRotZ = 0, musicRotX = 0;
    if (rhythm && rhythm.isPlaying && !this.reducedMotion) {
      const pulse = rhythm.beatPulse || 0;
      const bass = rhythm.bass || 0;
      const mid = rhythm.mid || 0;
      const phase = rhythm.beatPhase || 0;
      const beatPeriod = rhythm.beatPeriod || 0.5;

      // 弹性节拍踩点：强低音与脉冲驱动起跳与着陆缓冲
      const bounce = Math.sin(phase * Math.PI);
      musicPosY = bounce * (0.13 * bass + 0.08 * pulse);
      musicScaleY = (bounce - 0.45) * (0.12 * bass + 0.06 * pulse);

      // 伴随歌曲 BPM 的韵律头部与身体摇摆
      const bpmFreq = Math.PI / Math.max(beatPeriod, 0.35);
      musicRotZ = Math.sin(time * bpmFreq) * (0.075 * bass + 0.045 * mid);
      musicRotX = Math.cos(time * bpmFreq) * (0.035 * bass);

      // 重低音节拍点触发生机叶片物理弹跳
      if (bass > 0.42 && this.secondary && Math.random() < 0.18) {
        this.secondary.impulse('bounce');
      }
    }

    this.applyPoseTargets(dt);

    const idleY = this.reducedMotion ? 0 : Math.sin(time * 1.9) * 0.016;
    const audioBounce = Math.min(audio, 0.5) * 0.03;
    const breathScale = this.reducedMotion ? 0 : Math.sin(time * 1.9) * 0.012;

    this.group.position.x = dPosX;
    this.group.position.z = dPosZ;
    this.group.position.y = idleY + audioBounce + musicPosY + dPosY;

    const finalScaleY = Math.max(0.2, 1.0 + breathScale + musicScaleY + dScaleY);
    const finalScaleXZ = Math.max(0.2, 1.0 - (breathScale * 0.5) - (musicScaleY * 0.5) + dScaleXZ);
    this.pivot.scale.set(finalScaleXZ, finalScaleY, finalScaleXZ);

    const lookY = this.face.targetLook.x * 0.26;
    const lookX = -this.face.targetLook.y * 0.15;

    // Roll 动作：沿着模型自身的纵轴 Y 轴高速侧滚翻（ZXY 欧拉角：Z 轴倾倒侧卧，Y 轴主自转 -720°）
    if (this.actions.has('roll')) {
      this.pivot.rotation.set(dRotX, dRotY, dRotZ, 'ZXY');
      this.group.rotation.set(0, 0, 0);
    } else {
      this.pivot.rotation.set(0, 0, 0, 'XYZ');
      this.group.rotation.x = THREE.MathUtils.damp(this.group.rotation.x, lookX + dRotX + musicRotX, 7.5, dt);
      this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, lookY + dRotY, 7.5, dt);
      this.group.rotation.z = THREE.MathUtils.damp(this.group.rotation.z, dRotZ + musicRotZ, 7.5, dt);
    }
  }
}

/* =============================================================================
 * 6. 调试出口：法线绿通道反号热切换 + 能力汇报
 * ========================================================================== */
export function setNormalGreenSign(sign) {
  NORMAL_GREEN_SIGN = sign ? 1 : -1;
  for (const surface of surfaceCache.values()) {
    surface.normalMap.dispose();
    surface.ormMap.dispose();
  }
  surfaceCache.clear();
}

export const CMF_CAPABILITIES = Object.freeze({
  anisotropy: SUPPORTS_ANISOTROPY,
  dispersion: SUPPORTS_DISPERSION,
});

export function getCMFColorways(variantId) {
  const recipe = CMF_RECIPES[variantId] || CMF_RECIPES.default;
  return recipe.colorways ? Object.entries(recipe.colorways).map(([id, cw]) => ({ id, ...cw })) : [];
}
