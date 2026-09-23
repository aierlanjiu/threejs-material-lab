/**
 * 『 律 』(LÜ) × 『 荔 』(LI) 统一 UI 微动效与触觉适配器
 * 基于 Cube Motion (Web Animations API · Zero Dependencies) 与 Web Audio API
 */

import { rise, leave, morph, reveal } from '../vendor/cube-motion/index.js';

export { rise, leave, morph, reveal };

const isReducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * 极轻量原生 Web Audio 物理微脉冲音效合成器 (Audio Haptics)
 * 纯数学算法实时合成，零外部音频资源网络请求，微秒级执行，不占 CPU
 */
class HapticAudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem('lu_haptics_muted') === 'true';
    } catch (_) {}
  }

  initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute(force) {
    this.muted = typeof force === 'boolean' ? force : !this.muted;
    try {
      localStorage.setItem('lu_haptics_muted', String(this.muted));
    } catch (_) {}
    return this.muted;
  }

  /**
   * 物理精密机械微咔哒声 (Leica 快门 / Apple 触觉震颤感)
   */
  click(variant = 'mechanical') {
    if (this.muted || isReducedMotion()) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      if (variant === 'soft') {
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.008);
        gain.gain.setValueAtTime(0.022, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.010);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.011);
      } else {
        // mechanical click: fast micro-chirp 1600Hz -> 450Hz in 9ms
        osc.frequency.setValueAtTime(1600, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.009);
        gain.gain.setValueAtTime(0.032, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.013);
      }
    } catch (_) {}
  }

  /**
   * 级联升起时的轻灵晶体微音阶 (Pentatonic Crystalline Pings)
   */
  cascade(stepIndex = 0, total = 5) {
    if (this.muted || isReducedMotion()) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const scale = [1046.5, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00]; // C6 ~ C7
      const freq = scale[stepIndex % scale.length];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.026);
    } catch (_) {}
  }

  /**
   * Toast 水晶共鸣微弱水滴声
   */
  toast() {
    if (this.muted || isReducedMotion()) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now); // A6
      osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.045); // drop to E6

      gain.gain.setValueAtTime(0.028, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.050);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.052);
    } catch (_) {}
  }
}

export const haptic = new HapticAudioEngine();

/**
 * 安全触发元素或子元素入场升起动画
 * @param {Element|string|Element[]} target
 * @param {Object} [options] { targets?: 'children', stagger?: number, delay?: number }
 */
export function motionRise(target, options = {}) {
  if (!target) return [];
  try {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return [];
    return rise(el, options);
  } catch (err) {
    console.warn('[motionRise] Animation skipped:', err);
    return [];
  }
}

/**
 * 安全触发元素退场下沉动画
 * @param {Element|string} target
 * @param {Object} [options]
 * @returns {Promise<void>}
 */
export async function motionLeave(target, options = {}) {
  if (!target) return;
  try {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const animations = leave(el, options);
    await Promise.all(animations.map(a => a.finished).filter(Boolean));
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      console.warn('[motionLeave] Animation skipped:', err);
    }
  }
}

/**
 * 在两个状态面（faces）之间触发无缝平滑形变
 * @param {Element} outgoing 当前展示面
 * @param {Element} incoming 目标展示面
 */
export function motionMorph(outgoing, incoming) {
  if (!outgoing || !incoming || outgoing === incoming) return [];
  try {
    haptic.click('soft');
    return morph(outgoing, incoming);
  } catch (err) {
    console.warn('[motionMorph] Morph skipped:', err);
    return [];
  }
}

/**
 * 单元素文字无缝形变（自动克隆目标面，执行字符级高斯模糊重构）
 * @param {Element} targetEl 目标文本元素
 * @param {string} newText 新文本
 */
export function motionTextMorph(targetEl, newText) {
  if (!targetEl || targetEl.textContent === newText) return;
  const parent = targetEl.parentElement;
  if (!parent) {
    targetEl.textContent = newText;
    return;
  }
  const incoming = targetEl.cloneNode(false);
  incoming.textContent = newText;
  incoming.style.opacity = '0';
  targetEl.after(incoming);

  try {
    haptic.click('soft');
    morph(targetEl, incoming);
    setTimeout(() => {
      if (incoming.isConnected && targetEl.isConnected) {
        targetEl.textContent = newText;
        targetEl.style.opacity = '1';
        targetEl.style.position = '';
        targetEl.removeAttribute('aria-hidden');
        targetEl.removeAttribute('inert');
        incoming.remove();
      }
    }, 450);
  } catch (e) {
    targetEl.textContent = newText;
    incoming.remove();
  }
}

/**
 * 检查器 Tab 切换级联升起 (带纯净微晶体音阶)
 * @param {Element|string} paneEl 激活的 Tab 容器
 */
export function motionTabSwitch(paneEl) {
  if (!paneEl) return;
  const pane = typeof paneEl === 'string' ? document.querySelector(paneEl) : paneEl;
  if (!pane) return;
  
  // 选取所有直接子级卡片或 section，触发 55ms 递进升起
  const children = Array.from(pane.children).filter(c => 
    c.nodeType === Node.ELEMENT_NODE && 
    window.getComputedStyle(c).display !== 'none'
  );
  
  if (children.length > 0) {
    try {
      rise(children, { stagger: 55 });
      children.forEach((_, i) => {
        setTimeout(() => haptic.cascade(i, children.length), i * 55);
      });
    } catch (err) {
      console.warn('[motionTabSwitch] Fallback:', err);
    }
  }
}

/**
 * 管理全局 Toast 的优雅升起与下沉退场
 */
let activeToastTimer = null;
let activeToastAnimations = [];

export function motionToast(toastEl, message, duration = 3200) {
  if (!toastEl) return;
  
  // 取消正在进行的定时器与动画
  if (activeToastTimer) {
    clearTimeout(activeToastTimer);
    activeToastTimer = null;
  }
  
  activeToastAnimations.forEach(anim => {
    try { anim.cancel(); } catch (_) {}
  });
  activeToastAnimations = [];

  toastEl.textContent = message;
  toastEl.style.transition = 'none';
  toastEl.style.display = 'block';
  toastEl.classList.add('visible');

  // 入场升起伴随微弱水晶共振
  try {
    activeToastAnimations = rise(toastEl);
    haptic.toast();
  } catch (err) {
    toastEl.style.opacity = '1';
  }

  activeToastTimer = setTimeout(async () => {
    try {
      const exitAnimations = leave(toastEl);
      await Promise.all(exitAnimations.map(a => a.finished).filter(Boolean));
    } catch (_) {
      // 忽略中断
    } finally {
      toastEl.classList.remove('visible');
      toastEl.style.display = 'none';
      activeToastTimer = null;
    }
  }, duration);
}
