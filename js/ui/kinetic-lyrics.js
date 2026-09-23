/**
 * 『 律 』(LÜ) 双版本灵动歌词系统 (Dual-Engine Kinetic Lyrics Display)
 * 
 * 版本一 (SlotTextLyricsEngine):
 *   基于 Daniel White (@dwhitedesign) 风格的 3D 轴心方块翻转 (rotateX) 与 
 *   骨牌级联 (Grapheme Stagger) + 超调微弹 + Web Audio 机械咔哒触感。
 * 
 * 版本二 (Three3DGravityLyricsEngine):
 *   基于 aaayandev (@aaayandev) 风格的原生 3D 全材质物理刚体沙盒与反重力磁吸升空：
 *   - 切换到磁吸模式时，原方阵隐退 (matrixGroup.visible = false)，机位自动运镜至纯正正面平视 (Front View)；
 *   - 地面散落堆积 48 枚由全部 12 种 PBR 物理材质与 7 种色调随机打乱生成的真实 3D 立方块；
 *   - 唱响时字块反重力腾空升入中央正面排列，唱毕解离坠落回弹，伴随音乐低音炮 (Kick) 物理共振微震！
 */

import { haptic } from './motion-adapter.js';
import { AVATAR_MANIFEST } from '../../assets/live-avatars/manifest.js';

const isReducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// 字符级精确切分器 (原生 Intl.Segmenter 支持中英文及多字节 Emoji)
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('zh', { granularity: 'grapheme' })
  : null;

let tsangerFontPromise = null;
export function ensureTsangerFontReady() {
  if (!tsangerFontPromise) {
    if (typeof document !== 'undefined' && document.fonts) {
      tsangerFontPromise = Promise.all([
        document.fonts.load('400 240px TsangerJinKai02'),
        document.fonts.load('500 240px TsangerJinKai02'),
        document.fonts.ready
      ]).catch(() => true);
    } else {
      tsangerFontPromise = Promise.resolve(true);
    }
  }
  return tsangerFontPromise;
}

function splitIntoGraphemes(text) {
  if (!text) return [];
  if (segmenter) {
    return Array.from(segmenter.segment(text), s => s.segment);
  }
  return Array.from(text);
}

/* =========================================================================
 * 1. 版本一：Daniel White 风格 · 机械魔方 3D Slot-Text 引擎
 * ========================================================================= */
export class SlotTextLyricsEngine {
  constructor(containerEl) {
    this.container = containerEl;
    this.deckEl = null;
    this.pastLineEl = null;
    this.activeLineEl = null;
    this.nextLineEl = null;
    this.currentText = '';
    this.slots = [];
    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="cube-lyrics-deck" id="cubeLyricsDeck">
        <div class="cube-line cube-line-past" id="cubeLinePast"></div>
        <div class="cube-line cube-line-active" id="cubeLineActive">
          <div class="cube-slots-track" id="cubeSlotsTrack"></div>
        </div>
        <div class="cube-line cube-line-next" id="cubeLineNext"></div>
      </div>
    `;
    this.deckEl = this.container.querySelector('#cubeLyricsDeck');
    this.pastLineEl = this.container.querySelector('#cubeLinePast');
    this.activeLineEl = this.container.querySelector('#cubeSlotsTrack');
    this.nextLineEl = this.container.querySelector('#cubeLineNext');
  }

  update(activeText, prevText, nextText, beatPeriod = 0.5, progressInLine = 0, lineKey = activeText, characterCursor = null) {
    if (!this.deckEl) return;
    if (lineKey === activeText && activeText === this.currentText && this.currentLineKey) lineKey = this.currentLineKey;

    if (this.pastLineEl && this.pastLineEl.textContent !== (prevText || '')) {
      this.pastLineEl.textContent = prevText || '';
    }
    if (this.nextLineEl && this.nextLineEl.textContent !== (nextText || '')) {
      this.nextLineEl.textContent = nextText || '';
    }

    if (lineKey === this.currentLineKey) {
      this.updateProgress(progressInLine, characterCursor);
      return;
    }

    this.currentLineKey = lineKey;
    this.currentText = activeText || '';
    this.renderActiveLine(this.currentText, beatPeriod);
    this.updateProgress(progressInLine, characterCursor);
  }

  renderActiveLine(text, beatPeriod) {
    const chars = splitIntoGraphemes(text);
    this.activeLineEl.innerHTML = '';
    this.slots = [];
    this.previousCursor = -1;

    if (chars.length === 0) return;

    chars.forEach((char, idx) => {
      const isSpace = char.trim() === '';
      const slot = document.createElement('div');
      slot.className = `cube-slot ${isSpace ? 'cube-slot-space' : ''}`;
      
      const inner = document.createElement('div');
      inner.className = 'cube-slot-inner';

      const faceFront = document.createElement('div');
      faceFront.className = 'cube-face cube-face-front';
      faceFront.textContent = char;

      const faceTop = document.createElement('div');
      faceTop.className = 'cube-face cube-face-top';
      faceTop.textContent = char;

      inner.appendChild(faceFront);
      inner.appendChild(faceTop);
      slot.appendChild(inner);
      this.activeLineEl.appendChild(slot);

      this.slots.push({ el: slot, inner, char, revealed: isSpace });
      if (!isReducedMotion() && !isSpace) {
        inner.style.transform = 'rotateX(-90deg) scale(0.92)';
        inner.style.opacity = '0';
        inner.style.filter = 'blur(4px)';
      }
    });

    this.deckEl.style.transition = 'all 320ms cubic-bezier(0.16, 1, 0.3, 1)';
  }

  updateProgress(progress, characterCursor = null) {
    if (!this.slots || this.slots.length === 0) return;
    const visibleCount = this.slots.filter(slot => slot.char.trim()).length;
    const activeCount = characterCursor === null
      ? Math.floor(progress * visibleCount) : Math.max(0, Math.min(visibleCount, characterCursor));
    if (activeCount === this.previousCursor) return;
    const oneNewCharacter = activeCount === (this.previousCursor ?? 0) + 1;
    let visibleIndex = 0;
    this.slots.forEach((slot, idx) => {
      const logicalIndex = slot.char.trim() ? visibleIndex++ : -1;
      const isPast = logicalIndex >= 0 && logicalIndex < activeCount;
      const isCurrent = logicalIndex === activeCount;
      slot.el.classList.toggle('char-sung', isPast);
      slot.el.classList.toggle('char-active', isCurrent);
      if (isPast && !slot.revealed) {
        slot.revealed = true;
        slot.inner.style.transition = 'transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 240ms ease-out, filter 300ms ease-out';
        slot.inner.style.transform = 'rotateX(0deg) scale(1)';
        slot.inner.style.opacity = '1';
        slot.inner.style.filter = 'blur(0px)';
        if (oneNewCharacter && !isReducedMotion()) haptic.click(logicalIndex % 4 === 0 ? 'mechanical' : 'soft');
      } else if (!isPast && slot.revealed && logicalIndex >= 0 && !isReducedMotion()) {
        slot.revealed = false;
        slot.inner.style.transition = 'none';
        slot.inner.style.transform = 'rotateX(-90deg) scale(0.92)';
        slot.inner.style.opacity = '0';
      }
    });
    this.previousCursor = activeCount;
  }

  destroy() {
    if (this.container) this.container.innerHTML = '';
  }
}

/* =========================================================================
 * 2. 版本二：原生 3D 全材质物理刚体沙盒与反重力升空 (Three3DGravityLyricsEngine)
 *    全部由『 律 』12 种真实物理材质与 7 种色调随机打乱生成 3D 立方块，
 *    正面平视视图，地面堆叠散落，歌词反重力腾空升入中央正面排列，低音炮震颤起跳。
 * ========================================================================= */
export class Three3DGravityLyricsEngine {
  constructor(threeContext) {
    this.ctx = threeContext || {};
    this.THREE = threeContext.THREE;
    this.scene = threeContext.scene;
    this.matrixGroup = threeContext.matrixGroup;
    this.createMaterialPreset = threeContext.createMaterialPreset;
    this.createTypographyTexture = threeContext.createTypographyTexture;
    this.activeGeometry = threeContext.activeGeometry;
    this.camera = threeContext.camera;
    this.controls = threeContext.controls;
    this.studioFloor = threeContext.studioFloor;
    this.transitionCameraTo = threeContext.transitionCameraTo;
    this.framingDistance = threeContext.framingDistance;
    this.liveTextureMap = threeContext.liveTextureMap || (typeof window !== 'undefined' ? window.liveTextureMap : null);
    this.renderAvatarRig = threeContext.renderAvatarRig || (typeof window !== 'undefined' ? window.renderAvatarRig : null);
    this.AVATAR_KEYS = threeContext.AVATAR_KEYS || (typeof window !== 'undefined' ? window.AVATAR_KEYS : null);

    this.group = new this.THREE.Group();
    this.group.name = 'gravityMaterialSandbox';
    if (this.scene) this.scene.add(this.group);

    this.bottomCubes = [];
    this.lyricCubes = [];
    this.lyricBankA = [];
    this.lyricBankB = [];
    this.banks = [];
    this.activeBankIndex = -1;
    this.cubes = []; // 暴露给外部检测器及统计工具
    this.currentText = '';

    // 歌词魔方优先采用高纯净通透物理材质（水晶、棱镜、冰晶、毛玻璃、烟晶）
    this.transparentMaterials = ['crystal', 'prism', 'ice', 'frosted', 'smoke'];

    // 底部魔方保留全部 12 款材质并支持洗牌打乱
    this.materialsList = ['prism', 'crystal', 'ice', 'frosted', 'smoke', 'silk', 'wool', 'cloud', 'sand', 'shell', 'alloy', 'jade'];

    // 丰富扩充色彩谱系（20 款高饱和与莫兰迪色系交错），呈现绚烂生动的玩具堆叠质感
    this.tonesList = [
      '#ffffff', // 纯白水晶
      '#7e9fb9', // 雾蓝冰川
      '#405677', // 极夜墨蓝
      '#b94250', // 朱砂赤红
      '#b68a50', // 琥珀熔金
      '#768d80', // 霁雪青玉
      '#424752', // 玄铁钛黑
      '#f43f5e', // 蔷薇荧粉
      '#a855f7', // 霓虹紫晶
      '#06b6d4', // 碧落青湖
      '#10b981', // 祖母绿翠
      '#eab308', // 帝皇曜黄
      '#f97316', // 烈日炽橙
      '#ec4899', // 甜心草莓
      '#6366f1', // 极光幻紫
      '#3b82f6', // 皇家宝蓝
      '#14b8a6', // 绿松石青
      '#84cc16', // 青提初翠
      '#e2e8f0', // 铂金辉光
      '#1e293b'  // 黑曜玄武
    ];

    this.floorBoundsX = 5.8;
    this.floorBoundsZ = 2.2;
    this.dockY = 0.85; // 歌词区域中心高度基准

    this.initCubes();
    this.onEnterMode();
  }

  onEnterMode() {
    // 1. 原编排方阵优雅隐退消失
    if (this.matrixGroup) {
      this.matrixGroup.visible = false;
    }
    this.group.visible = true;

    // 2. 摄像机与控制器锁定纯正正面平视机位 (Front View，自适应宽窄视口)
    const aspect = this.camera ? (this.camera.aspect || 1.6) : 1.6;
    const tanHalfFov = 0.26794919243;
    const targetHalfWidth = 4.35;
    const distForWidth = targetHalfWidth / (tanHalfFov * aspect);
    const isNarrow = aspect < 1.42;
    const targetZ = isNarrow ? Math.max(11.5, distForWidth) : 11.5;
    const targetY = isNarrow ? -0.2 - 0.035 * (targetZ - 11.5) : -0.2;

    if (this.camera) {
      this.camera.position.set(0, targetY, targetZ);
      this.camera.fov = 30;
      this.camera.updateProjectionMatrix();
    }
    if (this.controls) {
      this.controls.target.set(0, targetY, 0);
    }
    if (this.camera && this.controls) {
      this.camera.lookAt(this.controls.target);
    }
    if (this.transitionCameraTo) {
      this.transitionCameraTo(new this.THREE.Vector3(0, targetY, targetZ), 300);
    }
  }

  onLeaveMode() {
    // 恢复原编排方阵
    if (this.matrixGroup) {
      this.matrixGroup.visible = true;
    }
    this.group.visible = false;
    this.activeBankIndex = -1;
    this.currentText = '';
    this.currentLineKey = null;
    if (this.lyricCubes) {
      this.lyricCubes.forEach(slot => {
        slot.scale.set(0, 0, 0);
        slot.userData.targetScale = 0;
        slot.userData.currentScale = 0;
        slot.userData.isMagneticLifting = false;
        slot.userData.isDropping = false;
      });
    }
  }

  getSafeFloorY(z, isMobile = this.isMobileStack) {
    const tan15 = 0.26794919243;
    if (isMobile) {
      const aspect = this.camera ? (this.camera.aspect || 0.56) : 0.56;
      const targetHalfWidth = 4.35;
      const distForWidth = targetHalfWidth / (tan15 * aspect);
      const camZ = Math.max(11.5, distForWidth);
      const camY = -0.2 - 0.035 * (camZ - 11.5);
      const viewportBottomAtZ = camY - (camZ - z) * tan15;
      // 触及屏幕底边缘，保证最底层方块底缘自然贴紧画面底端（无空白缝隙）
      return viewportBottomAtZ + 0.55 * 0.5 - 0.14;
    }
    const viewportBottomAtZ = -0.2 - (11.5 - z) * tan15;
    // 0.55 * 0.5 为方块半高，+0.24 确保屏幕投影底边至少距画布底边缘拥有 18px~25px 安全呼吸带，100% 杜绝底边裁切
    return viewportBottomAtZ + 0.55 * 0.5 + 0.24;
  }

  getMoundProfile(x, z, peakCenterX = 0) {
    const sigmaX = 3.3;
    const sigmaZ = 1.5;
    const dx = x - peakCenterX;
    const bell = Math.exp(-(dx * dx) / (2 * sigmaX * sigmaX) - (z * z) / (2 * sigmaZ * sigmaZ));
    // 中心厚度 2.05 (占黑色舞台高度 36%~39%)，两侧边缘自然降至 0.37 (15%~18%)
    return 2.05 * (0.18 + 0.82 * bell);
  }

  createAvatarFaceTexture(faceType, matType, tone) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // 计算底色相对亮度，决定线条高对比配色
    let r = 128, g = 128, b = 128;
    if (tone && tone.startsWith('#') && tone.length === 7) {
      r = parseInt(tone.slice(1, 3), 16);
      g = parseInt(tone.slice(3, 5), 16);
      b = parseInt(tone.slice(5, 7), 16);
    }
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isLightOrGlass = ['prism', 'crystal', 'ice', 'cloud', 'frosted'].includes(matType) || tone === '#e7ebee' || lum > 0.52;

    const strokeColor = isLightOrGlass ? '#0f172a' : '#f8fafc';
    const glowColor = isLightOrGlass ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.7)';
    const blushColor = isLightOrGlass ? 'rgba(244, 114, 182, 0.65)' : 'rgba(251, 113, 133, 0.75)';

    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 徽章外环底衬
    ctx.beginPath();
    ctx.arc(256, 256, 210, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = 14;

    // 腮红工具函数
    const drawBlush = (x1 = 140, x2 = 372, y = 305, rx = 32, ry = 18) => {
      ctx.save();
      ctx.fillStyle = blushColor;
      ctx.beginPath();
      ctx.ellipse(x1, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.ellipse(x2, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    switch (faceType) {
      case 'smile':
        // 笑眼 ◠ ◠
        ctx.beginPath();
        ctx.arc(175, 240, 36, Math.PI, 0);
        ctx.arc(337, 240, 36, Math.PI, 0);
        ctx.stroke();
        // 微笑嘴
        ctx.beginPath();
        ctx.arc(256, 280, 52, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        drawBlush();
        break;

      case 'wink':
        // 左眼 >，右眼圆眨眼
        ctx.beginPath();
        ctx.moveTo(145, 215); ctx.lineTo(185, 240); ctx.lineTo(145, 265);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(337, 240, 26, 0, Math.PI * 2);
        ctx.fill();
        // 开心嘴
        ctx.beginPath();
        ctx.arc(256, 275, 45, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        drawBlush();
        break;

      case 'cool':
        // 墨镜
        ctx.beginPath();
        ctx.roundRect(125, 210, 105, 65, 12);
        ctx.roundRect(282, 210, 105, 65, 12);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(230, 242); ctx.lineTo(282, 242);
        ctx.stroke();
        ctx.save();
        ctx.strokeStyle = isLightOrGlass ? '#ffffff' : '#94a3b8';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(145, 255); ctx.lineTo(170, 225);
        ctx.moveTo(302, 255); ctx.lineTo(327, 225);
        ctx.stroke();
        ctx.restore();
        // 酷翘嘴
        ctx.beginPath();
        ctx.moveTo(225, 325); ctx.quadraticCurveTo(260, 340, 295, 315);
        ctx.stroke();
        break;

      case 'laugh':
        // 眯眼大笑 ≧ ≦
        ctx.beginPath();
        ctx.moveTo(140, 220); ctx.lineTo(185, 245); ctx.lineTo(140, 270);
        ctx.moveTo(372, 220); ctx.lineTo(327, 245); ctx.lineTo(372, 270);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(256, 280, 58, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        drawBlush(130, 382, 290);
        break;

      case 'starry':
        // 星星眼 ★ ★
        const drawStar = (cx, cy, rOut = 36, rIn = 16) => {
          ctx.beginPath();
          for (let s = 0; s < 5; s++) {
            const rot = (s * Math.PI) / 2.5 - Math.PI / 2;
            const x = cx + Math.cos(rot) * rOut;
            const y = cy + Math.sin(rot) * rOut;
            if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            const rotIn = rot + Math.PI / 5;
            ctx.lineTo(cx + Math.cos(rotIn) * rIn, cy + Math.sin(rotIn) * rIn);
          }
          ctx.closePath();
          ctx.fill();
        };
        drawStar(175, 235);
        drawStar(337, 235);
        ctx.beginPath();
        ctx.arc(256, 295, 42, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        drawBlush();
        break;

      case 'cat':
        // 猫猫脸 =^･ω･^=
        ctx.beginPath();
        ctx.arc(175, 235, 24, 0, Math.PI * 2);
        ctx.arc(337, 235, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(110, 275); ctx.lineTo(60, 260);
        ctx.moveTo(110, 295); ctx.lineTo(60, 305);
        ctx.moveTo(402, 275); ctx.lineTo(452, 260);
        ctx.moveTo(402, 295); ctx.lineTo(452, 305);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(232, 295, 24, 0, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(280, 295, 24, 0, Math.PI);
        ctx.stroke();
        drawBlush(150, 362, 310, 24, 14);
        break;

      case 'surprised':
        // 惊讶圆眼与 'O' 型嘴
        ctx.beginPath();
        ctx.arc(175, 230, 32, 0, Math.PI * 2);
        ctx.arc(337, 230, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(175, 230, 16, 0, Math.PI * 2);
        ctx.arc(337, 230, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(256, 325, 28, 42, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'cute':
      default:
        // 超萌水灵大眼 (带双重反光高光)
        ctx.beginPath();
        ctx.arc(175, 235, 38, 0, Math.PI * 2);
        ctx.arc(337, 235, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.fillStyle = isLightOrGlass ? '#ffffff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(163, 222, 12, 0, Math.PI * 2);
        ctx.arc(185, 245, 6, 0, Math.PI * 2);
        ctx.arc(325, 222, 12, 0, Math.PI * 2);
        ctx.arc(347, 245, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(256, 310, 28, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
        drawBlush();
        break;
    }

    ctx.restore();

    const tex = new this.THREE.CanvasTexture(canvas);
    tex.colorSpace = this.THREE.SRGBColorSpace;
    tex.userData = { isAvatarFace: true, faceType };
    return tex;
  }

  createDecalTexture(char, matType, tone) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // 计算底色相对亮度
    let r = 128, g = 128, b = 128;
    if (tone && tone.startsWith('#') && tone.length === 7) {
      r = parseInt(tone.slice(1, 3), 16);
      g = parseInt(tone.slice(3, 5), 16);
      b = parseInt(tone.slice(5, 7), 16);
    }
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isTranslucentOrLight = ['prism', 'crystal', 'ice', 'cloud', 'frosted'].includes(matType) || tone === '#e7ebee' || lum > 0.52;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 240px "TsangerJinKai02", "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", Georgia, serif';

    if (isTranslucentOrLight) {
      // 浅色或半透明玻璃/冰晶材质：深度墨色字体 + 高反差白边内发光微浮雕
      ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;

      ctx.lineWidth = 12;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(char, size / 2, size / 2 + 8);

      ctx.fillStyle = '#0f172a';
      ctx.fillText(char, size / 2, size / 2 + 8);
    } else {
      // 深色或高饱和金属/漆面材质：亮白立体字形 + 深暗倒角投影
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 6;

      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.strokeText(char, size / 2, size / 2 + 8);

      ctx.fillStyle = '#f8fafc';
      ctx.fillText(char, size / 2, size / 2 + 8);
    }

    const tex = new this.THREE.CanvasTexture(canvas);
    tex.colorSpace = this.THREE.SRGBColorSpace;
    tex.userData = { isLyricChar: true, char };
    return tex;
  }

  initCubes() {
    if (!this.THREE || !this.createMaterialPreset) return;

    const geo = this.ctx.currentRoundedGeo
      || (this.activeGeometry && typeof this.activeGeometry === 'function' && this.activeGeometry().rounded)
      || new this.THREE.BoxGeometry(1, 1, 1);
    const decalGeo = new this.THREE.PlaneGeometry(0.85, 0.85);

    // 确保仓耳今楷字体预加载完成并对已就绪的字形贴图自动热重载
    ensureTsangerFontReady().then(() => {
      if (this.lyricCubes) {
        this.lyricCubes.forEach(slot => {
          const u = slot.userData;
          if (u && u.char && u.char.trim().length > 0) {
            u.charTex = this.createDecalTexture(u.char, u.matType, u.tone);
            if (!u.isMagneticLifting || u.magneticProgress >= 0.45) {
              u.decalMat.map = u.charTex;
              u.decalMat.needsUpdate = true;
            }
          }
        });
      }
    });

    // 加载海贼王 (One Piece)、龙珠 (Dragon Ball)、火影忍者 (Naruto) 官方 29 款动漫角色表情资产
    const officialChars = (typeof AVATAR_MANIFEST !== 'undefined' && AVATAR_MANIFEST.characters)
      ? AVATAR_MANIFEST.characters
      : [];
    this.avatarCharacters = officialChars;

    // 预热加载全部 29 款动漫角色头像贴图 (优先使用动态 liveTextureMap 实时贴图，同步支持眨眼、视线与情绪动画)
    if (!this.avatarTextures) {
      this.avatarTextures = new Map();
      const loader = new this.THREE.TextureLoader();
      officialChars.forEach(char => {
        let tex = (this.liveTextureMap && this.liveTextureMap[char.id]) ? this.liveTextureMap[char.id] : null;
        if (!tex) {
          tex = loader.load(`assets/live-avatars/${char.id}/still.png`);
          tex.colorSpace = this.THREE.SRGBColorSpace;
        }
        tex.userData = {
          isAvatarFace: true,
          avatarId: char.id,
          characterName: char.name,
          group: char.group
        };
        this.avatarTextures.set(char.id, tex);
      });
    }

    // =========================================================================
    // 1. 底部方块堆：桌面 252 枚 / 移动端 334 枚 0.55 尺寸交错山形宝石堆 (占下半部 35~40%)
    // 移动模式下增加层级与方块堆叠，画面更饱满生动
    // =========================================================================
    const isMobile = (typeof window !== 'undefined' && (window.innerWidth <= 768 || (this.camera && this.camera.aspect < 1.42)));
    const layerDefs = isMobile ? [
      { count: 76, spanX: 5.8, spanZ: 2.5 },
      { count: 70, spanX: 5.3, spanZ: 2.3 },
      { count: 64, spanX: 4.8, spanZ: 2.1 },
      { count: 56, spanX: 4.2, spanZ: 1.8 },
      { count: 48, spanX: 3.6, spanZ: 1.6 },
      { count: 42, spanX: 3.1, spanZ: 1.4 },
      { count: 36, spanX: 2.6, spanZ: 1.2 },
      { count: 30, spanX: 2.1, spanZ: 1.0 },
      { count: 24, spanX: 1.6, spanZ: 0.8 }
    ] : [
      { count: 60, spanX: 5.6, spanZ: 2.0 },
      { count: 52, spanX: 4.8, spanZ: 1.8 },
      { count: 44, spanX: 4.0, spanZ: 1.5 },
      { count: 38, spanX: 3.2, spanZ: 1.2 },
      { count: 32, spanX: 2.3, spanZ: 0.9 },
      { count: 26, spanX: 1.4, spanZ: 0.6 }
    ];
    const bottomCount = layerDefs.reduce((sum, def) => sum + def.count, 0);
    this.bottomLayersCount = layerDefs.length;
    this.isMobileStack = isMobile;
    const bottomScale = 0.55;

    // 随机打乱全部 12 款材质与 20 款多样色调，以及 29 款日漫角色表情 (Fisher-Yates 洗牌算法)
    const matPool = [];
    const tonePool = [];
    const avatarPool = [];
    for (let i = 0; i < bottomCount; i++) {
      matPool.push(this.materialsList[i % this.materialsList.length]);
      tonePool.push(this.tonesList[i % this.tonesList.length]);
      if (officialChars.length > 0) {
        avatarPool.push(officialChars[i % officialChars.length]);
      }
    }
    for (let i = bottomCount - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [matPool[i], matPool[j]] = [matPool[j], matPool[i]];
      const k = Math.floor(Math.random() * (i + 1));
      [tonePool[i], tonePool[k]] = [tonePool[k], tonePool[i]];
      if (avatarPool.length > 0) {
        const m = Math.floor(Math.random() * (i + 1));
        [avatarPool[i], avatarPool[m]] = [avatarPool[m], avatarPool[i]];
      }
    }

    let cubeIdx = 0;
    layerDefs.forEach((layerDef, layerIdx) => {
      const LCount = layerDef.count;
      for (let j = 0; j < LCount; j++) {
        const charDef = avatarPool.length > 0 ? avatarPool[cubeIdx] : (officialChars.length > 0 ? officialChars[cubeIdx % officialChars.length] : null);
        const matType = matPool[cubeIdx];
        const tone = tonePool[cubeIdx];

        const material = this.createMaterialPreset(matType, tone);
        const cubeMesh = new this.THREE.Mesh(geo, material);
        cubeMesh.castShadow = material.transmission < 0.6;
        cubeMesh.receiveShadow = true;
        cubeMesh.renderOrder = 4;

        // 底部方块展示海贼王/龙珠/火影等官方经典角色表情贴图，而非汉字
        const texture = charDef
          ? this.avatarTextures.get(charDef.id)
          : this.createAvatarFaceTexture('cute', matType, tone);

        const decalMat = new this.THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false
        });
        const decalMesh = new this.THREE.Mesh(decalGeo, decalMat);
        decalMesh.position.set(0, 0, 0.508);
        decalMesh.renderOrder = 5;

        const unit = new this.THREE.Group();
        unit.add(cubeMesh);
        unit.add(decalMesh);
        unit.scale.setScalar(bottomScale);

        // 经纬交错排布，从两侧完整铺满（-spanX 至 +spanX）
        const colRatio = (j + (layerIdx % 2) * 0.5) / LCount;
        const x = -layerDef.spanX + colRatio * (layerDef.spanX * 2) + (Math.random() - 0.5) * 0.18;
        const z = -layerDef.spanZ + (Math.random() * 2 - 1) * layerDef.spanZ;
        const yFloor = this.getSafeFloorY(z, isMobile);
        const moundThick = this.getMoundProfile(x, z) * (isMobile ? 3.9 : 1.0);
        const layerRatio = layerIdx / (layerDefs.length - 1);
        const yRest = yFloor + layerRatio * (moundThick - bottomScale * 0.5) + (Math.random() - 0.5) * 0.08;

        const rx = (Math.random() - 0.5) * 0.42;
        const ry = (Math.random() - 0.5) * 0.42;
        const rz = (Math.random() - 0.5) * 0.42;

        unit.position.set(x, yRest, z);
        unit.rotation.set(rx, ry, rz);

        const isSpikeUnit = Math.random() < 0.18;
        const rhythmSens = isSpikeUnit ? (1.5 + Math.random() * 0.9) : (0.75 + Math.random() * 0.4);
        const phaseOffset = (Math.random() - 0.5) * 0.5;

        unit.userData = {
          isBottomUnit: true,
          cubeIdx,
          isSpikeUnit,
          rhythmSens,
          phaseOffset,
          char: null,
          faceType: 'avatar_manifest',
          avatarId: charDef ? charDef.id : null,
          avatarName: charDef ? charDef.name : null,
          avatarGroup: charDef ? charDef.group : null,
          faceTexture: texture,
          matType,
          tone,
          decalMesh,
          decalMat,
          baseColX: x,
          layerBaseY: yRest - yFloor,
          floorY: yFloor,
          layerIdx,
          animOffset: Math.random() * 20.0,
          restX: x,
          restY: yRest,
          restZ: z,
          restRx: rx,
          restRy: ry,
          restRz: rz,
          vx: 0,
          vy: 0,
          vz: 0,
          wx: 0,
          wy: 0,
          wz: 0
        };

        this.group.add(unit);
        this.bottomCubes.push(unit);
        cubeIdx++;
      }
    });

    // =========================================================================
    // 2. 顶部歌词区域：双银行轮替架构 (Bank A & Bank B，各 16 枚独立槽位方块)
    // 歌词魔方优先采用高纯净通透物理材质（水晶、棱镜、冰晶、毛玻璃、烟晶）
    // =========================================================================
    const maxLyricSlotsPerBank = 40;
    this.lyricBankA = [];
    this.lyricBankB = [];
    this.lyricCubes = [];

    for (let i = 0; i < maxLyricSlotsPerBank * 2; i++) {
      const bankIdx = i < maxLyricSlotsPerBank ? 0 : 1;
      const slotIdx = i % maxLyricSlotsPerBank;
      const matType = this.transparentMaterials[i % this.transparentMaterials.length];
      const tone = this.tonesList[(i * 3 + 1) % this.tonesList.length];

      const material = this.createMaterialPreset(matType, tone);
      const cubeMesh = new this.THREE.Mesh(geo, material);
      cubeMesh.castShadow = true;
      cubeMesh.receiveShadow = true;
      cubeMesh.renderOrder = 8;

      const texture = this.createDecalTexture(' ', matType, tone);
      const decalMat = new this.THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      });
      const decalMesh = new this.THREE.Mesh(decalGeo, decalMat);
      decalMesh.position.set(0, 0, 0.508);
      decalMesh.renderOrder = 9;

      const slot = new this.THREE.Group();
      slot.add(cubeMesh);
      slot.add(decalMesh);
      slot.scale.set(0, 0, 0); // 初始待命中
      slot.position.set(0, this.dockY, 0);

      slot.userData = {
        isLyricSlot: true,
        bankIdx,
        slotIdx,
        char: '',
        nextChar: '',
        matType,
        tone,
        decalMesh,
        decalMat,
        isMagneticLifting: false,
        magneticProgress: 0,
        magneticDelay: 0,
        isAscending: false,
        ascendProgress: 0,
        isDropping: false,
        dropVx: 0,
        dropVy: 0,
        dropVz: 0,
        dropRotSpeedX: 0,
        dropRotSpeedY: 0,
        dropRotSpeedZ: 0,
        launchX: 0,
        launchY: 0,
        launchZ: 0,
        launchRx: 0,
        launchRy: 0,
        launchRz: 0,
        targetX: 0,
        targetY: this.dockY,
        targetScale: 0,
        currentScale: 0,
        hopOffset: 0,
        hopVel: 0,
        sung: false,
        levitating: true
      };

      this.group.add(slot);
      this.lyricCubes.push(slot);
      if (bankIdx === 0) {
        this.lyricBankA.push(slot);
      } else {
        this.lyricBankB.push(slot);
      }
    }

    this.banks = [this.lyricBankA, this.lyricBankB];
    this.activeBankIndex = -1;

    this.peakCenterX = 0;
    this.isRecontouring = false;
    this.recontourTimer = 0.0;
    this.phraseCount = 0;

    // 暴露统一的 this.cubes 供外部测试及统计
    this.cubes = [...this.bottomCubes, ...this.lyricCubes];
  }

  update(activeText, prevText, nextText, beatPeriod = 0.5, progressInLine = 0, bassEnergy = 0, isKick = false, dt = 0.016, lineKey = activeText, characterCursor = null) {
    this.lastBassEnergy = bassEnergy;
    this.lastIsKick = isKick;

    if (lineKey === activeText && activeText === this.currentText && this.currentLineKey) lineKey = this.currentLineKey;
    if (lineKey !== this.currentLineKey) {
      this.currentLineKey = lineKey;
      this.currentText = activeText || '';
      this.handlePhraseTransition(this.currentText, beatPeriod);
    }

    this.updateProgress(progressInLine, characterCursor);

    if (isKick || bassEnergy > 0.40) {
      this.triggerBassShockwave(bassEnergy);
    }

    this.stepPhysics(dt);
  }

  handlePhraseTransition(text, beatPeriod) {
    const chars = splitIntoGraphemes(text).filter(c => c.trim().length > 0);
    const N = chars.length;
    const rows = N > 24 ? 3 : (N > 9 ? 2 : 1);
    const columns = Math.ceil(N / rows);
    const pitch = Math.min(1.18, 7.7 / Math.max(1, columns - 1));
    const cubeScale = Math.min(1, pitch / 1.08);
    const rowPitch = cubeScale * 0.98;

    // 计算当前切换瞬间的节奏冲击能量 (Burst Power)
    const burstPower = Math.min(2.4, 1.0 + (this.lastBassEnergy || 0) * 1.6 + (this.lastIsKick ? 0.9 : 0));

    // 1. 若已有在轨歌词（上一句），解除强磁吸附，开启有控制但极具力量感向底部山体坠落
    if (this.activeBankIndex >= 0) {
      const oldBank = this.banks[this.activeBankIndex];
      oldBank.forEach(slot => {
        const u = slot.userData;
        if (u.targetScale > 0.5 || u.currentScale > 0.5) {
          u.dropScale = Math.max(0.55, u.currentScale);
          u.isDropping = true;
          u.isMagneticLifting = false;
          u.isAscending = false;
          u.targetScale = 0.0;
          u.burstPower = burstPower;
          // 有控制且充满爆发力的初速度与翻滚角速度，随音乐节奏爆发
          u.dropVy = (-0.65 - Math.random() * 0.35) * Math.min(1.4, Math.sqrt(burstPower));
          u.dropVx = (Math.random() - 0.5) * 0.8 * burstPower;
          u.dropVz = (Math.random() - 0.5) * 0.6 * burstPower;
          u.dropRotSpeedX = (Math.random() - 0.5) * 4.0 * burstPower;
          u.dropRotSpeedY = (Math.random() - 0.5) * 4.0 * burstPower;
          u.dropRotSpeedZ = (Math.random() - 0.5) * 4.0 * burstPower;
          u.currentScale = u.dropScale;
          slot.scale.setScalar(u.dropScale);
        } else {
          u.isDropping = false;
          u.targetScale = 0.0;
          u.currentScale = 0.0;
          slot.scale.set(0, 0, 0);
          slot.position.set(0, -10, 0);
        }
      });
    }

    // 换句时触发山峰随机横向偏移与微幅重塑（约 0.6 秒落稳）
    this.peakCenterX = (Math.random() - 0.5) * 2.2;
    this.bottomCubes.forEach(cube => {
      const u = cube.userData;
      const moundThick = this.getMoundProfile(u.baseColX, u.restZ, this.peakCenterX) * (this.isMobileStack ? 3.9 : 1.0);
      const totalLayers = Math.max(1, (this.bottomLayersCount || 6) - 1);
      const yRest = u.floorY + (u.layerIdx / totalLayers) * (moundThick - 0.55 * 0.5) + (Math.random() - 0.5) * 0.04;
      u.restY = yRest;
      const distFromPeak = Math.abs(u.baseColX - this.peakCenterX);
      const wave = Math.max(0, 0.45 - distFromPeak * 0.12);
      u.vy = wave * (0.6 + Math.random() * 0.4);
      u.wx = (Math.random() - 0.5) * 0.5;
    });
    this.isRecontouring = true;
    this.recontourTimer = 0.0;

    if (N === 0) {
      this.activeBankIndex = -1;
      return;
    }

    // 2. 切换至轮替银行展示全新歌词
    this.activeBankIndex = (this.activeBankIndex === 0) ? 1 : 0;
    const newBank = this.banks[this.activeBankIndex];

    // 同一句歌词严格统一一款通透透明材质 (crystal, prism, ice, frosted, smoke) 与统一色调
    const phraseMat = this.transparentMaterials[(this.phraseCount || 0) % this.transparentMaterials.length];
    const phraseTone = this.tonesList[(this.phraseCount * 3 + 1) % this.tonesList.length];
    this.phraseCount = (this.phraseCount || 0) + 1;

    // 3. 所有新歌词方块统一从底部动漫魔方堆叠表面强磁吸附拔地而起并变形
    newBank.forEach((slot, idx) => {
      const u = slot.userData;
      if (idx < N) {
        const char = chars[idx];
        const row = Math.floor(idx / columns);
        const rowLength = Math.min(columns, N - row * columns);
        const column = idx % columns;
        const targetX = (column - (rowLength - 1) / 2) * pitch;
        const targetY = this.dockY + ((rows - 1) / 2 - row) * rowPitch;

        // 从对应列的底部山体表面拾取堆叠母体方块
        const candidates = this.bottomCubes.filter(c => Math.abs(c.position.x - targetX) < 1.2);
        const seedCube = candidates.length > 0
          ? candidates.reduce((top, c) => c.position.y > top.position.y ? c : top, candidates[0])
          : this.bottomCubes[(idx * 23 + this.activeBankIndex * 13) % this.bottomCubes.length];

        // 母体方块产生受激磁吸后坐力微弹物理反馈 (牛顿第三定律反冲)
        seedCube.userData.vy -= 0.65 * burstPower;
        seedCube.userData.wx += (Math.random() - 0.5) * 1.2 * burstPower;

        // 同一句歌词严格统一单一通透透明材质与统一色调
        u.matType = phraseMat;
        u.tone = phraseTone;
        slot.children[0].material = this.createMaterialPreset(u.matType, u.tone);

        // 正面贴图初始继承母体方块的“日漫头像”！
        u.faceTex = seedCube.userData.faceTexture;
        u.charTex = this.createDecalTexture(char, u.matType, u.tone);
        u.decalMat.map = u.faceTex;
        u.decalMat.needsUpdate = true;

        // 初始位姿完全贴合母体方块（位于底部山体中）
        slot.position.copy(seedCube.position);
        slot.rotation.copy(seedCube.rotation);
        slot.scale.setScalar(0.55);

        u.launchX = seedCube.position.x;
        u.launchY = seedCube.position.y;
        u.launchZ = seedCube.position.z;
        u.launchRx = seedCube.rotation.x;
        u.launchRy = seedCube.rotation.y;
        u.launchRz = seedCube.rotation.z;

        u.targetX = targetX;
        u.targetY = targetY;
        u.targetScale = cubeScale;
        u.currentScale = 0.55;
        u.char = char;
        u.nextChar = char;

        // 启动力量感磁吸动力学 (受音乐节拍能量爆发增益)
        u.burstPower = burstPower;
        u.magneticDuration = 0.42 / Math.min(1.3, 0.85 + (burstPower - 1.0) * 0.25);
        u.isMagneticLifting = true;
        u.magneticProgress = 0.0;
        u.magneticDelay = idx * 0.025;
        u.isAscending = true;
        u.ascendProgress = 0.0;
        u.isDropping = false;
        u.sung = false;
      } else {
        u.targetScale = 0.0;
        u.currentScale = 0.0;
        u.isMagneticLifting = false;
        u.isAscending = false;
        u.isDropping = false;
        slot.scale.set(0, 0, 0);
        slot.position.set(0, -10, 0);
      }
    });
  }

  updateProgress(progressInLine, characterCursor = null) {
    if (this.activeBankIndex < 0) return;
    const activeSlots = this.banks[this.activeBankIndex].filter(s => s.userData.targetScale > 0.5);
    const N = activeSlots.length;
    if (N === 0) return;
    const sungCount = characterCursor === null
      ? Math.floor(progressInLine * N) : Math.max(0, Math.min(N, characterCursor));
    activeSlots.forEach((slot, idx) => {
      const sung = idx < sungCount;
      slot.userData.sung = sung;
      slot.userData.decalMat.opacity = sung ? 1 : (idx === sungCount ? 0.88 : 0.62);
      const material = slot.children[0]?.material;
      if (material?.emissive) {
        material.emissive.set('#5977b3');
        material.emissiveIntensity = sung ? 0.16 : (idx === sungCount ? 0.07 : 0);
      }
    });
  }

  triggerBassShockwave(energy = 0.5) {
    // 反重力模式稳态严格静止：只在歌词切换瞬间动作，彻底消除日常演奏中的低音冲击与方块随机跳跃
  }

  stepPhysics(dt) {
    if (!this.group.visible) return;
    const safeDt = Math.max(0.001, Math.min(0.035, isNaN(dt) ? 0.016 : dt));
    this.stackTime = (this.stackTime || 0) + safeDt;

    // 1. 底部方块稳态与换句重塑动力学
    if (this.isRecontouring) {
      this.recontourTimer += safeDt;
      if (this.recontourTimer >= 0.60) {
        // 约 0.6 秒落稳，恢复绝对静止
        this.isRecontouring = false;
        this.bottomCubes.forEach(cube => {
          const u = cube.userData;
          u.vx = 0; u.vy = 0; u.vz = 0;
          u.wx = 0; u.wy = 0; u.wz = 0;
          cube.position.set(u.restX, u.restY, u.restZ);
          cube.rotation.set(u.restRx, u.restRy, u.restRz);
        });
      } else {
        // 换句瞬态微幅物理波纹
        this.bottomCubes.forEach(cube => {
          const u = cube.userData;
          cube.position.x += u.vx * safeDt;
          cube.position.y += u.vy * safeDt;
          cube.position.z += u.vz * safeDt;
          cube.rotation.x += u.wx * safeDt;
          cube.rotation.y += u.wy * safeDt;
          cube.rotation.z += u.wz * safeDt;

          u.vy -= 18.0 * safeDt;
          if (cube.position.y < u.restY) {
            cube.position.y = u.restY;
            u.vy = -u.vy * 0.25;
            if (Math.abs(u.vy) < 0.08) u.vy = 0;
            u.vx *= 0.6;
            u.vz *= 0.6;
            u.wx *= 0.5;
            u.wz *= 0.5;
          }

          const returnRate = Math.min(1.0, 7.0 * safeDt);
          cube.position.x += (u.restX - cube.position.x) * returnRate;
          cube.position.z += (u.restZ - cube.position.z) * returnRate;
          cube.rotation.x += (u.restRx - cube.rotation.x) * returnRate;
          cube.rotation.y += (u.restRy - cube.rotation.y) * returnRate;
          cube.rotation.z += (u.restRz - cube.rotation.z) * returnRate;

          u.vx *= Math.pow(0.12, safeDt);
          u.vz *= Math.pow(0.12, safeDt);
          u.wx *= Math.pow(0.08, safeDt);
          u.wy *= Math.pow(0.08, safeDt);
          u.wz *= Math.pow(0.08, safeDt);
        });
      }
    } else {
      // 稳态下：富有节奏与层次的“层叠起伏波”（Cascading Layered Swell）
      // 底层稳固扎根微动，中高层沿 X/Z 与层级相位阶梯错开（-layerIdx * 0.65），呈现连绵起伏、有机呼吸的波浪层叠感
      const reduced = isReducedMotion();
      const rhythmDrive = (this.lastBassEnergy || 0) * 1.8 + (this.lastIsKick ? 0.85 : 0);
      const totalLayers = Math.max(1, (this.bottomLayersCount || 6) - 1);
      const motionScale = reduced ? 0 : (this.isMobileStack ? 3.6 : 0.18);

      // 时钟累加器随节拍动态推进
      this.stackTime += safeDt * (1.15 + rhythmDrive * 0.75);

      this.bottomCubes.forEach(cube => {
        const u = cube.userData;
        const layerIdx = u.layerIdx || 0;
        const layerRatio = layerIdx / totalLayers;

        // 方块独立节奏体质：约 18% 为高弹活跃魔方，随低音爆发更大跳跃
        const isSpike = !!u.isSpikeUnit;
        const sens = u.rhythmSens || 1.0;
        const phase = this.stackTime * 1.35 - layerIdx * 0.65 + u.restX * 0.35 + u.restZ * 0.25 + (u.phaseOffset || 0);

        // 基础波幅 + 音乐重音动态注入
        const dynamicBoost = 1.0 + rhythmDrive * (isSpike ? 1.6 : 0.65);
        const layerAmp = (0.010 + layerRatio * 0.022) * sens * motionScale * dynamicBoost;

        const lift = Math.sin(phase) * layerAmp;
        const swayX = Math.cos(phase * 0.85) * layerAmp * 0.22;
        const swayZ = Math.sin(phase * 0.85 + 0.4) * layerAmp * 0.18;

        // 伴随微幅倾角起伏（Pitch & Roll），活跃方块伴随更剧烈翻滚
        const tiltX = Math.cos(phase) * (0.035 + 0.075 * layerRatio) * (isSpike ? 1.8 : 1.0);
        const tiltZ = Math.sin(phase) * (0.025 + 0.065 * layerRatio) * (isSpike ? 1.8 : 1.0);

        cube.position.set(u.restX + swayX, u.restY + lift, u.restZ + swayZ);
        cube.rotation.set(u.restRx + tiltX, u.restRy, u.restRz + tiltZ);
      });
    }

    // 2. 歌词区域独立方块动效（双银行轮换：磁吸拔地升空变形 + 强磁卡扣 + 旧词有控制自然重力下坠）
    this.lyricCubes.forEach(slot => {
      const u = slot.userData;

      if (u.isDropping) {
        // 旧歌词解除磁吸约束，向底部山丘有力下坠（重力加速度随节奏加强）
        const gAcc = 10.0 + Math.min(1.4, u.burstPower || 1.0) * 4.0;
        u.dropVy = Math.max(-5.5, u.dropVy - gAcc * safeDt);
        slot.position.x += u.dropVx * safeDt;
        slot.position.y += u.dropVy * safeDt;
        slot.position.z += u.dropVz * safeDt;
        slot.rotation.x += u.dropRotSpeedX * safeDt;
        slot.rotation.y += u.dropRotSpeedY * safeDt;
        slot.rotation.z += u.dropRotSpeedZ * safeDt;

        // 空中飞行阶段（y > -0.1）保持完整尺寸 scale = 1.0，保留清晰可见的下降全过程！
        if (slot.position.y > -0.1) {
          u.currentScale = u.dropScale || 1.0;
        } else {
          // 接近并进入底部山体深度（y <= -0.1）时，缩小融入山体
          u.currentScale = Math.max(0.0, u.currentScale - 3.8 * safeDt);
        }
        slot.scale.setScalar(u.currentScale);

        // 触及深层山体或缩小完全融入后注销
        if (slot.position.y < -3.5 || u.currentScale <= 0.01) {
          u.isDropping = false;
          u.currentScale = 0.0;
          slot.scale.set(0, 0, 0);
          slot.position.set(0, -10, 0);
        }
        return;
      }

      if (u.isMagneticLifting) {
        // 从底部日漫方块堆叠表面强力磁吸拔地而起并完成变形
        if (u.magneticDelay > 0) {
          u.magneticDelay -= safeDt;
        } else {
          const duration = u.magneticDuration || 0.42;
          u.magneticProgress += safeDt / duration;
          u.ascendProgress = u.magneticProgress;
          if (u.magneticProgress >= 1.0) {
            u.magneticProgress = 1.0;
            u.ascendProgress = 1.0;
            u.isMagneticLifting = false;
            u.isAscending = false;
            u.currentScale = u.targetScale;
            slot.scale.setScalar(u.targetScale);
            slot.position.set(u.targetX, u.targetY, 0);
            slot.rotation.set(0, 0, 0);
            if (u.charTex) {
              u.decalMat.map = u.charTex;
              u.decalMat.needsUpdate = true;
            }
            haptic.click('mechanical');
          } else {
            const p = Math.min(1.0, u.magneticProgress);
            // 强磁吸附与卡扣回弹曲线：初段强力拔地加速，末段带有轻微磁力锁扣微超调
            const snapOvershoot = 0.14 * Math.min(1.8, u.burstPower || 1.0);
            const ease = (1.0 - Math.pow(1.0 - p, 3.0)) + Math.sin(p * Math.PI) * p * snapOvershoot;

            slot.position.x = u.launchX + (u.targetX - u.launchX) * ease;
            slot.position.y = u.launchY + (u.targetY - u.launchY) * ease;
            slot.position.z = u.launchZ + (0 - u.launchZ) * ease;

            // 姿态自适应校准 (从山体杂乱倾角对准正面平视)
            slot.rotation.x = u.launchRx * Math.max(0, 1.0 - ease);
            slot.rotation.y = u.launchRy * Math.max(0, 1.0 - ease);
            slot.rotation.z = u.launchRz * Math.max(0, 1.0 - ease);

            // 尺寸变形：从山体方块 0.55 膨胀至歌词方块 1.00，严禁超调超过 targetScale (<= 1.0)
            const scaleEase = 1.0 - Math.pow(1.0 - p, 2.8);
            u.currentScale = Math.min(u.targetScale, Math.max(0.55, 0.55 + (u.targetScale - 0.55) * scaleEase));
            slot.scale.setScalar(u.currentScale);

            // 正面贴图变形：飞行中段 (p >= 0.45) 翻转为歌词汉字！
            if (p >= 0.45 && u.charTex && u.decalMat.map !== u.charTex) {
              u.decalMat.map = u.charTex;
              u.decalMat.needsUpdate = true;
            }
          }
        }
      } else if (u.targetScale > 0.5) {
        // 已归位稳态：磁吸卡扣完成后严格保持视觉静止，不随低音冲击或唱响进度改变 y
        slot.position.set(u.targetX, u.targetY, 0);
        slot.rotation.set(0, 0, 0);
        slot.scale.setScalar(u.targetScale);
        u.currentScale = u.targetScale;
      }
    });
  }

  destroy() {
    this.onLeaveMode();
    if (this.group && this.scene) {
      this.scene.remove(this.group);
      this.cubes.forEach(c => {
        c.traverse(child => {
          if (child.material) child.material.dispose?.();
        });
      });
      this.cubes = [];
      this.bottomCubes = [];
      this.lyricCubes = [];
      this.lyricBankA = [];
      this.lyricBankB = [];
      this.banks = [];
      this.activeBankIndex = -1;
    }
  }
}

/* =========================================================================
 * 3. 统一门面调度器 (KineticLyricsManager)
 * ========================================================================= */
export class KineticLyricsManager {
  constructor(stageContainerEl, threeContext = {}) {
    this.stage = stageContainerEl;
    this.threeCtx = threeContext;

    this.mode = 'off';
    this.slotEngine = null;
    this.gravityEngine = null;
    this.mountEl = null;

    try {
      const savedMode = localStorage.getItem('lu_kinetic_lyrics_mode');
      if (savedMode && ['slot', 'gravity', 'off'].includes(savedMode)) {
        this.mode = savedMode;
      }
    } catch (_) {}

    this.initMount();
    this.initUIButtons();
    if (this.mode !== 'off') {
      this.setMode(this.mode, true);
    }
  }

  initMount() {
    let mount = document.getElementById('kineticLyricsStage');
    if (!mount && this.stage) {
      mount = document.createElement('div');
      mount.id = 'kineticLyricsStage';
      mount.className = 'kinetic-lyrics-stage';
      this.stage.appendChild(mount);
    }
    this.mountEl = mount;
  }

  initUIButtons() {
    const btns = document.querySelectorAll('.kinetic-mode-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetMode = e.currentTarget.dataset.mode;
        if (targetMode) {
          this.setMode(targetMode);
        }
      });
    });
  }

  setThreeContext(threeContext) {
    this.threeCtx = Object.assign(this.threeCtx || {}, threeContext);
    if (this.mode === 'gravity' && !this.gravityEngine && this.threeCtx.scene) {
      this.gravityEngine = new Three3DGravityLyricsEngine(this.threeCtx);
    }
  }

  setMode(mode, silent = false) {
    if (!['slot', 'gravity', 'off'].includes(mode)) return;
    this.mode = mode;
    try {
      localStorage.setItem('lu_kinetic_lyrics_mode', mode);
    } catch (_) {}

    if (this.mountEl) {
      this.mountEl.className = `kinetic-lyrics-stage mode-${mode}`;
    }

    if (mode === 'gravity') {
      // 1. 隐藏 Slot 模式 DOM
      if (this.mountEl) this.mountEl.style.display = 'none';
      if (this.slotEngine) {
        this.slotEngine.destroy();
        this.slotEngine = null;
      }

      // 2. 启动/展示 3D 原生全材质物理反重力沙盒
      if (!this.gravityEngine && this.threeCtx && this.threeCtx.scene) {
        this.gravityEngine = new Three3DGravityLyricsEngine(this.threeCtx);
      } else if (this.gravityEngine) {
        this.gravityEngine.onEnterMode();
      }
    } else {
      // 离开 gravity 模式，确保原方阵复原，3D 物理沙盒隐藏
      if (this.gravityEngine) {
        this.gravityEngine.onLeaveMode();
      }

      if (mode === 'slot') {
        if (this.mountEl) {
          this.mountEl.style.display = 'flex';
          if (!this.slotEngine) {
            this.slotEngine = new SlotTextLyricsEngine(this.mountEl);
          }
        }
      } else if (mode === 'off') {
        if (this.mountEl) this.mountEl.style.display = 'none';
        if (this.slotEngine) {
          this.slotEngine.destroy();
          this.slotEngine = null;
        }
      }
    }

    // 避免 HUD 胶囊遮挡底部物理山丘堆
    const hudLeft = document.getElementById('stageHudLeft') || document.querySelector('.stage-hud-left');
    if (hudLeft) {
      hudLeft.classList.toggle('mode-gravity', mode === 'gravity');
    }
    if (document.body) {
      document.body.classList.toggle('mode-gravity', mode === 'gravity');
    }

    // 更新 UI 按钮激活状态
    document.querySelectorAll('.kinetic-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (!silent) {
      haptic.click('mechanical');
    }
  }

  update({ activeText, prevText, nextText, beatPeriod, progressInLine, lineKey, characterCursor, bassEnergy, isKick, dt = 0.016 }) {
    if (this.mode === 'off') return;
    if (this.mode === 'slot' && this.slotEngine) {
      this.slotEngine.update(activeText, prevText, nextText, beatPeriod, progressInLine, lineKey, characterCursor);
    } else if (this.mode === 'gravity' && this.gravityEngine) {
      this.gravityEngine.update(activeText, prevText, nextText, beatPeriod, progressInLine, bassEnergy, isKick, dt, lineKey, characterCursor);
    }
  }
}
