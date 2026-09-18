/**
 * ThemeBus — 24 配色主题总线
 *
 * 语义规范：
 *   accent ← albedo.mid / chip（主交互色，决定卡片高亮描边、文字主色、输入框对焦）
 *   glow   ← sheenColor / albedo.highlight（全态光晕、3D 边缘光 rim / 柔光边缘）
 *   wave   ← accent 提饱和/明度的色相变体（声波柱在浅底上立得住）
 *
 * 对比度护栏：在 OKLCH 空间提亮/压深、保色相，确保对背景对比度 >= 3.0。
 */

const BG = '#f3f0eb';
const MIN_CONTRAST = 3.0;

/* ---------- 色彩空间：sRGB ⇄ OKLab/OKLCH（Ottosson） ---------- */
const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const l2s = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

export function hexToRgb(hex) {
  const s = String(hex || '#000').replace('#', '').trim();
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s.padEnd(6, '0').slice(0, 6);
  return [parseInt(f.slice(0, 2), 16) / 255, parseInt(f.slice(2, 4), 16) / 255, parseInt(f.slice(4, 6), 16) / 255];
}

export function rgbToHex(r, g, b) {
  const h = v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function srgbToOklab([r, g, b]) {
  const R = s2l(r), G = s2l(g), B = s2l(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

export function oklabToSrgb([L, a, bb]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * bb) ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [l2s(clamp01(R)), l2s(clamp01(G)), l2s(clamp01(B))];
}

const oklabToOklch = ([L, a, b]) => [L, Math.hypot(a, b), Math.atan2(b, a)];
const oklchToOklab = ([L, C, H]) => [L, C * Math.cos(H), C * Math.sin(H)];

/** WCAG 相对亮度（线性 sRGB 的 Y） */
export function relativeLuminance(rgb255) {
  const [r, g, b] = rgb255.map(v => s2l(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a255, b255) {
  const la = relativeLuminance(a255), lb = relativeLuminance(b255);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 在 OKLCH 空间调整 L 直到对 bg 的对比度达标（保色相与彩度，必要时才压 C） */
export function ensureContrast(hex, bgHex = BG, minRatio = MIN_CONTRAST) {
  const bg = hexToRgb(bgHex).map(v => v * 255);
  const rgb = hexToRgb(hex).map(v => v * 255);
  if (contrastRatio(rgb, bg) >= minRatio) return { hex, adjusted: false, ratio: contrastRatio(rgb, bg) };
  let [L, C, H] = oklabToOklch(srgbToOklab(hexToRgb(hex)));
  const isBgBright = relativeLuminance(bg) >= 0.5;   // 亮底 → 往暗处找 (0..L)
  let lo = isBgBright ? 0 : L, hi = isBgBright ? L : 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const test = oklabToSrgb(oklchToOklab([mid, C, H])).map(v => v * 255);
    const ok = contrastRatio(test, bg) >= minRatio;
    if (isBgBright) { if (ok) lo = mid; else hi = mid; } else { if (ok) hi = mid; else lo = mid; }
    if (Math.abs(hi - lo) < 1e-4) break;
  }
  let finalL = isBgBright ? lo : hi;
  let out = oklabToSrgb(oklchToOklab([finalL, C, H])).map(v => v * 255);
  for (let i = 0; i < 8 && contrastRatio(out, bg) < minRatio; i++) {
    C *= 0.7;
    finalL = clamp01(finalL + (isBgBright ? -0.04 : 0.04));
    out = oklabToSrgb(oklchToOklab([finalL, C, H])).map(v => v * 255);
  }
  return { hex: rgbToHex(...out.map(v => v / 255)), adjusted: true, ratio: contrastRatio(out, bg) };
}

/** 提饱和 + 提明度：让声波柱在浅底上有分量 */
const punch = (hex, dl = 0.06, dc = 1.35) => {
  const [L, C, H] = oklabToOklch(srgbToOklab(hexToRgb(hex)));
  return rgbToHex(...oklabToSrgb(oklchToOklab([clamp01(L + dl), C * dc, H])).map(v => v / 255));
};

/* ---------- 少数护栏处理不佳的款，手工定调 ---------- */
export const THEME_OVERRIDES = {
  'obsidian_gold/default':      { accent: '#c8922e', glow: '#e8b838' },
  'obsidian_gold/silver_sheen': { accent: '#7d8fa6', glow: '#d0dde8' },
  'obsidian_gold/lapis_bronze': { accent: '#3f6394', glow: '#e0ad52' },
  'obsidian_gold/crimson_flame':{ accent: '#b5442a', glow: '#f59638' },
  'cinnabar_jade/black_gold':   { accent: '#c9922b', glow: '#f0b836' },
  'titanium_holographic/space_black': { accent: '#4d586a', glow: '#8a97a8' },
  'default/midnight_ink':       { accent: '#2f5450', glow: '#598280' },
  'optic_crystal/default':       { accent: '#257a82', glow: '#67c7bb' },
  'optic_crystal/amber_topaz':   { accent: '#a66a24', glow: '#e8aa4c' },
  'optic_crystal/emerald_beryl': { accent: '#227b58', glow: '#5ec29b' },
  'optic_crystal/amethyst':      { accent: '#684594', glow: '#b48ded' },
};

const cssRgb = hex => {
  const c = hexToRgb(hex).map(v => Math.round(v * 255));
  return `${c[0]} ${c[1]} ${c[2]}`;
};

export class ThemeBus {
  constructor({ root = (typeof document !== 'undefined' ? document.documentElement : null), background = BG } = {}) {
    this.root = root;
    this.background = background;
    this.current = null;
    this.listeners = new Set();
    this._lastPulse = -1;
    this._pulseClock = 0;
  }

  registerOverride(key, triple) { THEME_OVERRIDES[key] = triple; return this; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /**
   * @param {object} colorway  getCMFColorways(variantId) 的单项
   * @param {string} key       `${variantId}/${colorwayId}`
   */
  resolve(colorway, key) {
    const ov = THEME_OVERRIDES[key] || {};
    const src = colorway || {};
    const albedo = src.albedo || {};
    let accent = ov.accent || albedo.sprout?.mid || albedo.sprout?.shadow || src.chip || albedo.mid || src.tint || '#b74343';
    const glowRaw = ov.glow || src.sheenColor || albedo.highlight || src.chip || accent;
    const g = ensureContrast(accent, this.background, MIN_CONTRAST);
    accent = g.hex;
    const glow = ensureContrast(glowRaw, this.background, 1.6).hex;
    const wave = punch(accent);
    const waveSoft = punch(accent, 0.22, 0.55);
    return {
      accent, glow, wave, waveSoft,
      accentSoft: punch(accent, 0.42, 0.30),
      contrast: g.ratio, contrastAdjusted: g.adjusted, key,
    };
  }

  /** 广播到 CSS 变量 + 3D 订阅者 */
  apply(variantId, colorwayId, colorway) {
    const key = `${variantId}/${colorwayId}`;
    const t = this.resolve(colorway, key);
    if (this.root && this.root.style) {
      const s = this.root.style;
      s.setProperty('--theme-accent', t.accent);
      s.setProperty('--theme-accent-soft', t.accentSoft);
      s.setProperty('--theme-glow', t.glow);
      s.setProperty('--theme-wave', t.wave);
      s.setProperty('--theme-wave-soft', t.waveSoft);
      s.setProperty('--theme-accent-rgb', cssRgb(t.accent));
      s.setProperty('--theme-glow-rgb', cssRgb(t.glow));
      s.setProperty('--theme-wave-rgb', cssRgb(t.wave));
      // 兼容旧变量：既有 var(--accent) / var(--accent-soft) 免费跟随
      s.setProperty('--accent', t.accent);
      s.setProperty('--accent-soft', t.accentSoft);
    }

    this.current = t;
    for (const fn of this.listeners) fn(t);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('li:theme', { detail: t }));
    }
    return t;
  }

  /**
   * 心跳：节流 30Hz 且 Δ>0.01 才写，避免每帧触发样式重算。
   * @param {number} dt     帧步长
   * @param {number} pulse  0..1（rhythm.beatPulse / bass）
   */
  pulse(dt, pulse) {
    if (!this.root || !this.root.style) return;
    this._pulseClock += dt;
    if (this._pulseClock < 1 / 30) return;
    this._pulseClock = 0;
    const p = clamp01(pulse);
    if (Math.abs(p - this._lastPulse) <= 0.01) return;
    this._lastPulse = p;
    this.root.style.setProperty('--theme-pulse', p.toFixed(3));
  }
}
