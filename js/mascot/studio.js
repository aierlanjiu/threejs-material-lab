import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/controls/OrbitControls.js/+esm';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/postprocessing/EffectComposer.js/+esm';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/postprocessing/RenderPass.js/+esm';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/postprocessing/UnrealBloomPass.js/+esm';
import { OutputPass } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/postprocessing/OutputPass.js/+esm';
import { HunyuanMascot, setNormalGreenSign, CMF_CAPABILITIES, getCMFColorways } from './hunyuan-mascot.js';
import { AudioVisualizer } from '../voice/audio-visualizer.js';
import { RhythmEngine } from '../voice/rhythm-engine.js';
import { LiIntentBridge } from '../voice/li-intent-bridge.js';
import { XiaoZhiClient } from '../voice/xiaozhi-client.js';
import { CameraDirector } from './camera-director.js';
import { SecondaryMotion } from './secondary-motion.js';
import { ThemeBus } from './theme-bus.js';
import { MascotVFX } from './vfx.js';
import { motionRise, motionLeave, motionMorph, motionToast, motionTextMorph, haptic } from '../ui/motion-adapter.js';

let studioFlashPulse = 0;
const $ = id => document.getElementById(id);

export const ACTION_GLYPHS = {
  lock_fruit: './assets/icons/quirky/action_lock_fruit.png',
  bounce: './assets/icons/quirky/action_bounce.png',
  wave: './assets/icons/quirky/action_wave.png',
  nod: './assets/icons/quirky/action_nod.png',
  shake: './assets/icons/quirky/action_shake.png',
  shy: './assets/icons/quirky/action_shy.png',
  sleepy: './assets/icons/quirky/action_sleepy.png',
  groove: './assets/icons/quirky/action_groove.png',
  pop_out: './assets/icons/quirky/action_pop_out.png',
  breathe: './assets/icons/quirky/action_bounce.png',
  sway: './assets/icons/quirky/action_shake.png',
  roll: './assets/icons/quirky/action_lock_fruit.png',
  zero_g_float: './assets/icons/quirky/action_astro_float.png',
  jetpack_boost: './assets/icons/quirky/action_astro_boost.png',
  salute: './assets/icons/quirky/action_astro_salute.png',
  visor_hud_pulse: './assets/icons/quirky/action_astro_float.png',
};

export const CMF_PRESETS = [
  { id: 'default', name: '果壳白玉', code: 'RIND & JADE', desc: '混元原生 4K 漫反射烘焙，还原真实果壳颗粒感与温润羊脂白玉。', swatch: './assets/icons/cmf/swatch_rind_jade.png' },
  { id: 'corduroy', name: '暖绒灯芯', code: 'CORDUROY', desc: '治愈秋冬复古砖红粗坑条灯芯绒，微凸坑条织纹与天鹅绒边缘柔光（Sheen PBR）。', swatch: './assets/icons/cmf/swatch_corduroy.png' },
  { id: 'cinnabar_jade', name: '朱砂凝玉', code: 'CINNABAR', desc: '东方典藏剔红雕漆深红镜面清漆，融入 24K 金箔微粒折光与羊脂玉温润微透。', swatch: './assets/icons/cmf/swatch_cinnabar.png' },
  { id: 'titanium_holographic', name: '全息钛银', code: 'TITANIUM', desc: '航天级拉丝钛合金，伴随视角变换泛出物理薄膜干涉彩虹光谱（Iridescence）。', swatch: './assets/icons/cmf/swatch_titanium.png' },
  { id: 'optic_crystal', name: '光学水晶', code: 'CRYSTAL', desc: '纯净无瑕光学白水晶，清雅通透折射微光与冰镇荔枝琉璃质感。', swatch: './assets/icons/cmf/swatch_crystal.png' },
  { id: 'obsidian_gold', name: '曜石黑金', code: 'OBSIDIAN', desc: '深邃火山黑曜石镜面反射，与 24K 帝王金金属光泽与边缘高光交织。', swatch: './assets/icons/cmf/swatch_obsidian.png' },
];

const COMPANIONS = {
  hoodie: {
    id: 'hoodie',
    name: '荔小卫',
    eyebrow: '01 / HOODIE COMPANION',
    description: '把心事收进兜帽，把好心情留给你。可随时锁进果实小憩。',
    greeting: '你好呀，兜帽里的世界很小，刚好装下今天的好心情。',
    states: {
      open: {
        id: 'open',
        title: '萌颜日常态',
        tag: '常开 · 伴随',
        sub: '探出头来 · 元气治愈',
        badge: './assets/icons/morphology/badge_hoodie_open.png',
        modelKey: 'hoodie_open',
        mood: '安静陪伴',
        actions: [
          ['lock_fruit', '锁进果实', ACTION_GLYPHS.lock_fruit],
          ['bounce', '开心跳跳', ACTION_GLYPHS.bounce],
          ['roll', '倒地翻滚', ACTION_GLYPHS.roll],
          ['wave', '欢快招手', ACTION_GLYPHS.wave],
          ['nod', '连连点头', ACTION_GLYPHS.nod],
          ['shake', '轻快摇头', ACTION_GLYPHS.shake],
          ['shy', '害羞掩面', ACTION_GLYPHS.shy],
          ['sleepy', '打瞌睡', ACTION_GLYPHS.sleepy],
          ['groove', '音乐律动', ACTION_GLYPHS.groove]
        ]
      },
      closed: {
        id: 'closed',
        title: '锁进果实态',
        tag: '闭合 · 守护',
        sub: '缩进果壳 · 鲜果安睡',
        badge: './assets/icons/morphology/badge_hoodie_closed.png',
        modelKey: 'hoodie_closed',
        mood: '锁进果壳小憩',
        actions: [
          ['pop_out', '探出头来', ACTION_GLYPHS.pop_out],
          ['breathe', '深呼吸', ACTION_GLYPHS.breathe],
          ['sway', '不倒翁轻晃', ACTION_GLYPHS.sway],
          ['roll', '倒地翻滚', ACTION_GLYPHS.roll],
          ['bounce', '果核Q弹跳', ACTION_GLYPHS.bounce]
        ]
      }
    }
  },
  astro: {
    id: 'astro',
    name: '荔小星',
    eyebrow: '02 / ASTRO EXPLORER',
    description: '戴上全景探索头盔，从小小星球出发，陪你看更大的宇宙。',
    greeting: '荔小星已抵达！宇航头盔就绪，今天的星际航线由你决定！',
    states: {
      astro: {
        id: 'astro',
        title: '探索宇航态',
        tag: '星际 · 探索',
        sub: '全景头盔 · 浩瀚星河',
        badge: './assets/icons/morphology/badge_astro.png',
        modelKey: 'astro',
        mood: '星际巡航',
        actions: [
          ['zero_g_float', '失重漂浮', ACTION_GLYPHS.zero_g_float],
          ['jetpack_boost', '背包助推', ACTION_GLYPHS.jetpack_boost],
          ['salute', '宇航敬礼', ACTION_GLYPHS.salute],
          ['roll', '月面翻滚', ACTION_GLYPHS.roll],
          ['visor_hud_pulse', '面罩脉冲', ACTION_GLYPHS.visor_hud_pulse],
          ['bounce', '月球大跳', ACTION_GLYPHS.bounce]
        ]
      }
    }
  }
};

const storage = {
  get(k, fallback) {
    try { return JSON.parse(localStorage.getItem(`li.${k}`)) ?? fallback; }
    catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem(`li.${k}`, JSON.stringify(v)); } catch {}
  }
};

/* ---------------------------------------------------------------------------
 * 影棚预设：只描述「这一次布光」，不掺材质
 * env 走 scene.environmentIntensity，key/fill/rim 是相对 BASE_* 的倍率
 * ------------------------------------------------------------------------ */
const LIGHT_PRESETS = {
  // 明亮柔和影棚：柔光漫射，曝光舒适通透，绝不晃眼爆白
  studio:  { key: 0xfff3e8, fill: 0xebf2f8, rim: 0xfff6e4, keyMix: 1.00, fillMix: 1.00, rimMix: 1.00, env: 1.00, exposure: 0.86 },
  // 晨光：暖主光柔和抬升、冷补光细腻自然
  morning: { key: 0xffdfb8, fill: 0xe8f0f8, rim: 0xffebd0, keyMix: 1.08, fillMix: 0.90, rimMix: 1.02, env: 1.05, exposure: 0.88 },
  // 黄昏：主光深沉沉静，轮廓温润勾勒
  dusk:    { key: 0xffbe95, fill: 0xc3d5ee, rim: 0xffcf9a, keyMix: 0.65, fillMix: 0.75, rimMix: 0.85, env: 0.75, exposure: 0.82 },
};

/* ---------------------------------------------------------------------------
 * CMF 自适应配光：让六种材质各自站在最舒适的影棚测光表上
 * 严格收紧泛光阈值（threshold 1.80~2.10）与光强，杜绝全屏白色眩光光雾
 * ------------------------------------------------------------------------ */
const CMF_LIGHTING = {
  default:              { key: 1.00, fill: 1.00, rim: 1.00, env: 1.00, exposure: 1.00, bloom: { strength: 0.08, radius: 0.35, threshold: 1.95 } },
  corduroy:             { key: 0.98, fill: 1.08, rim: 1.05, env: 0.95, exposure: 1.02, bloom: { strength: 0.06, radius: 0.35, threshold: 2.10 } },
  cinnabar_jade:        { key: 1.02, fill: 0.98, rim: 1.12, env: 1.05, exposure: 1.00, bloom: { strength: 0.10, radius: 0.35, threshold: 1.85 } },
  titanium_holographic: { key: 1.00, fill: 0.92, rim: 1.18, env: 1.15, exposure: 0.98, bloom: { strength: 0.12, radius: 0.35, threshold: 1.80 } },
  optic_crystal:        { key: 1.00, fill: 0.95, rim: 1.20, env: 1.18, exposure: 1.02, bloom: { strength: 0.12, radius: 0.35, threshold: 1.85 } },
  obsidian_gold:        { key: 1.05, fill: 0.90, rim: 1.18, env: 1.08, exposure: 1.00, bloom: { strength: 0.11, radius: 0.35, threshold: 1.80 } },
};

let lightPreset = storage.get('lightPreset', 'studio');
if (!LIGHT_PRESETS[lightPreset]) lightPreset = 'studio';
const cmfLight = { env: 1, key: 1, fill: 1, rim: 1, ready: false };

let currentRole = storage.get('role', 'hoodie');
if (!COMPANIONS[currentRole]) currentRole = 'hoodie';

let currentHoodieState = storage.get('hoodieState', 'open');
let currentMaterialId = storage.get('materialVariant', 'default');
let reducedMotion = storage.get('reducedMotion', false);
let speechEnabled = storage.get('speech', true);
let busy = false, disposed = false;
const actionTimers = new Map();
function toast(text) {
  motionToast($('toast'), text, 3200);
}

// 3D Scene Initialization
const container = $('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbc8562);
let galleryTexture;
new THREE.TextureLoader().load('./assets/backgrounds/li-warm-gallery.png', texture => {
  texture.colorSpace = THREE.SRGBColorSpace;
  galleryTexture = texture;
  scene.background = texture;
  matchBackdrop();
}, undefined, error => console.error('Gallery background failed', error));

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 600 ? 1.25 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
renderer.domElement.setAttribute('aria-label', '可拖动旋转的三维荔枝伙伴');
renderer.domElement.setAttribute('role', 'img');
container.appendChild(renderer.domElement);

const perspectiveCamera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
const orthoCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 60);
let camera = perspectiveCamera, viewPreset = 'three-quarter';
let astroFollowY = 0;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minPolarAngle = Math.PI * 0.27;
controls.maxPolarAngle = Math.PI * 0.53;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.55;

// User interaction tracking for Cinematic Arc Drift
let isUserInteracting = false;
let lastInteractionTime = 0;
controls.addEventListener('start', () => { isUserInteracting = true; });
controls.addEventListener('end', () => {
  isUserInteracting = false;
  lastInteractionTime = performance.now();
  if (typeof director !== 'undefined' && director) {
    director.anchorView(camera.position.clone().sub(controls.target).toArray());
  }
});

/* ---------------------------------------------------------------------------
 * 影棚 IBL：自建带方向结构的柔光箱环境
 * RoomEnvironment 是均匀柔和的「房间」，金属/水晶/清漆反射上去没有层次。
 * 这里改成：暗穹顶 + 顶部大柔光箱 + 左前高窄条光 + 右前冷补光板
 *          + 背后轮廓光条 + 底部暖反光板 + 侧后冷点光
 * → 金属上出现清晰柔光箱条纹、水晶有可折射的亮点、清漆能映出灯条，
 *   而暗穹顶保证反射有对比、不发灰。
 * ------------------------------------------------------------------------ */
function buildStudioEnvironment() {
  const env = new THREE.Scene();
  const quad = new THREE.PlaneGeometry(1, 1);

  const lamp = (hex, intensity, w, h) => {
    const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex).multiplyScalar(intensity),   // 线性空间 HDR 值，可 >1
    }));
    m.scale.set(w, h, 1);
    return m;
  };
  const place = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);          // 面板正对坐标原点
    env.add(mesh);
    return mesh;
  };

  // 暗穹顶：制造反射对比。没有它，金属反射就是一团均匀白 → 「发灰、塑料」
  const dome = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x202329, side: THREE.BackSide })
  );
  dome.scale.setScalar(24);
  env.add(dome);

  place(lamp(0xfff4e8, 4.5, 8.0, 5.5), 0.4, 7.4, 0.6);   // 顶部大面积柔光箱 (was 26)
  place(lamp(0xfff6ec, 5.5, 1.6, 8.4), -6.2, 2.6, 3.2);  // 左前主柔光板（高窄 → 竖直高光条，was 34)
  place(lamp(0xdbe7f2, 2.2, 6.4, 6.0), 6.0, 2.2, 2.4);   // 右前冷补光板 (was 11)
  place(lamp(0xfff1d8, 4.0, 5.6, 1.0), 0.8, 3.4, -6.4);  // 背后轮廓光条 (was 30)
  place(lamp(0xffd6b4, 1.2, 9.0, 9.0), 0, -5.6, 0);     // 底部暖反光板 (was 4.5)
  place(lamp(0x9dbeff, 2.0, 0.9, 5.0), 6.6, 3.0, -4.4);   // 侧后冷点光，拉开边缘层次 (was 9)

  return env;
}

const pmrem = new THREE.PMREMGenerator(renderer);
const studioEnvScene = buildStudioEnvironment();
// sigma 0.025 保留柔光箱的清晰边界（0.04 会糊成均匀环境，反射结构就没了）
const environment = pmrem.fromScene(studioEnvScene, 0.025, 0.1, 100);
studioEnvScene.traverse(o => {
  if (o.isMesh) { o.geometry.dispose?.(); o.material.dispose?.(); }
});
scene.environment = environment.texture;
pmrem.dispose();
scene.environmentIntensity = 1.0;

// Studio Lighting —— 三点布光比例（柔和护眼影棚，消除暴晒刺眼感）
const BASE_KEY_INTENSITY = 1.25;
const BASE_FILL_INTENSITY = 0.45;
const BASE_RIM_INTENSITY = 0.65;

const key = new THREE.DirectionalLight(0xfff1e2, BASE_KEY_INTENSITY);
key.position.set(3.4, 5.4, 6.6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = key.shadow.camera.bottom = -2.8;
key.shadow.camera.right = key.shadow.camera.top = 2.8;
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 15;
key.shadow.normalBias = 0.026;
key.shadow.bias = -0.00015;
key.shadow.radius = 4;
key.shadow.blurSamples = 8;
scene.add(key);

const fill = new THREE.DirectionalLight(0xeaf0f4, BASE_FILL_INTENSITY);
fill.position.set(-4.6, 2.7, 4.4);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xfff2d8, BASE_RIM_INTENSITY);
rim.position.set(1.4, 4.4, -4.6);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.ShadowMaterial({ color: 0x7b6557, opacity: 0.20 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.015;
floor.receiveShadow = true;
scene.add(floor);

const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = shadowCanvas.height = 128;
const sc = shadowCanvas.getContext('2d');
const gradient = sc.createRadialGradient(64, 64, 0, 64, 64, 64);
gradient.addColorStop(0, 'rgba(64,42,35,.25)');
gradient.addColorStop(0.38, 'rgba(64,42,35,.14)');
gradient.addColorStop(1, 'rgba(64,42,35,0)');
sc.fillStyle = gradient;
sc.fillRect(0, 0, 128, 128);

const contactShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.5, 1.8),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, opacity: 0.65 })
);
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.position.y = -0.012;
scene.add(contactShadow);

const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
const composer = new EffectComposer(renderer, target);
const scenePass = new RenderPass(scene, camera);
composer.addPass(scenePass);
// 泛光参数不再写死：按 CMF 配方逐材质给出（阈值在 OutputPass 之前，
// 作用在 ACES 之前的线性 HDR 亮度上），金箔/水晶微泛光而不爆白
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), CMF_LIGHTING.default.bloom.strength,
  CMF_LIGHTING.default.bloom.radius, CMF_LIGHTING.default.bloom.threshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Load 3 Hunyuan 3D Pro native assets
const mascots = await (async () => {
  try {
    const [hoodie_open, hoodie_closed, astro] = await Promise.all([
      HunyuanMascot.load('hoodie_open'),
      HunyuanMascot.load('hoodie_closed'),
      HunyuanMascot.load('astro')
    ]);
    return { hoodie_open, hoodie_closed, astro };
  } catch (error) {
    $('loading-state').textContent = '伙伴三维资产加载中遇到问题，请刷新重试。';
    console.error('Hunyuan model load failed', error);
    throw error;
  }
})();

Object.values(mascots).forEach(m => {
  scene.add(m.group);
  m.reducedMotion = reducedMotion;
});

// DeepSeek 4.1 Flash: CameraDirector, ThemeBus, SecondaryMotion
const director = new CameraDirector();
const theme = new ThemeBus();
const secondary = Object.fromEntries(
  Object.entries(mascots).map(([k, m]) => [k, new SecondaryMotion().bind(m)])
);
Object.values(mascots).forEach(m => { m.secondary = secondary[m.morphologyKey]; });

// 实例化专属 3D 摄影棚台面粒子特效系统 (起跳烟雾环/重力砸地/地面翻滚扬尘/喷气尾焰)
const vfx = new MascotVFX(scene);
window.mascots = mascots;
window.vfx = vfx;
window.getActiveMascot = getActiveMascot;

Object.values(mascots).forEach(m => {
  m.onVFX = (type, payload = {}) => {
    if (reducedMotion) return;
    const isCurrentActive = (m.morphologyKey === getActiveModelKey());
    if (!isCurrentActive) return;

    switch (type) {
      case 'launch_ring':
        vfx.spawnLaunchRing(payload.x || 0, payload.z || 0, payload.intensity || 1.0);
        break;
      case 'impact_burst':
        vfx.spawnImpactBurst(payload.x || 0, payload.z || 0, payload.intensity || 1.0);
        break;
      case 'roll_dust':
        vfx.spawnRollDust(payload.x || 0, payload.y || 0.03, payload.z || 0, payload.velocityX || 0);
        break;
      case 'jetpack_thrust':
        vfx.spawnJetpackThrust(payload.x || 0, payload.y || 0.5, payload.z || 0, payload.dirX || 0, payload.dirY || -1, payload.dirZ || 0);
        break;
      case 'stardust':
        vfx.spawnStardust(payload.x || 0, payload.y || 1.0, payload.z || 0);
        break;
    }
  };
});

function syncControlLimits() {
  const [lo, hi] = director.cfg.dollyRange;
  controls.minDistance = fitDistance * 0.72 * lo;
  controls.maxDistance = fitDistance * 1.65 * hi;
}

function syncTheme() {
  const cws = getCMFColorways(currentMaterialId);
  const id = storage.get(`colorway_${currentMaterialId}`, 'default');
  const cw = cws.find(c => c.id === id) || cws.find(c => c.id === 'default') || cws[0];
  theme.apply(currentMaterialId, cw?.id || 'default', cw);
}

theme.subscribe(t => {
  rim.color.set(t.glow);
});

// Morph Transition State Controller for Smooth Lock/Pop
const morphTransition = {
  active: false,
  direction: null, // 'to_closed' or 'to_open'
  progress: 0,
  duration: 0.68
};

function matchBackdrop() {
  if (!galleryTexture?.image) return;
  const aspect = container.clientWidth / Math.max(1, container.clientHeight);
  const imageAspect = galleryTexture.image.width / galleryTexture.image.height;
  const x = Math.min(1, aspect / imageAspect), y = Math.min(1, imageAspect / aspect);
  galleryTexture.repeat.set(x, y);
  galleryTexture.offset.set((1 - x) / 2, (1 - y) / 2);
  galleryTexture.updateMatrix();
}
matchBackdrop();

let fitDistance = 6, frameTimes = [], lastFrame = 0, time = 0, diagnostics = {};

function getActiveModelKey() {
  if (currentRole === 'astro') return 'astro';
  return currentHoodieState === 'closed' ? 'hoodie_closed' : 'hoodie_open';
}

function getActiveMascot() {
  return mascots[getActiveModelKey()];
}

function fitCamera(resetOrientation = true) {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  const aspect = w / h;
  const modelKey = getActiveModelKey();
  const extent = modelKey === 'hoodie_closed' ? 4.05 : modelKey === 'astro' ? 4.8 : 4.55;
  const center = 1.30;
  const previous = camera.position.clone().sub(controls.target).normalize();
  controls.target.set(0, center, 0);
  astroFollowY = 0;

  const directions = { front: [0, 0, 1], side: [1, 0, 0], back: [0, 0, -1], 'three-quarter': [0.34, 0.035, 1] };
  const direction = resetOrientation ? new THREE.Vector3(...(directions[viewPreset] || directions['three-quarter'])).normalize() : previous;

  if (camera.isOrthographicCamera) {
    const half = Math.max(extent * 0.545, 2.66 / (2 * aspect));
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.zoom = 1;
    fitDistance = 10;
    controls.minZoom = 0.7;
    controls.maxZoom = 1.6;
  } else {
    camera.aspect = aspect;
    const v = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    fitDistance = Math.max(extent / (2 * v), 2.66 / (2 * v * aspect)) * 1.04 + 0.6;
  }
  camera.updateProjectionMatrix();
  camera.position.copy(controls.target).addScaledVector(direction, fitDistance);
  controls.minDistance = fitDistance * 0.72;
  controls.maxDistance = fitDistance * 1.65;
  controls.update();
  if (typeof director !== 'undefined' && director) {
    director.anchorView(direction.toArray());
  }
}

function setView(view) {
  viewPreset = view;
  camera = view === 'three-quarter' ? perspectiveCamera : orthoCamera;
  controls.object = camera;
  scenePass.camera = camera;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  fitCamera();
}

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  matchBackdrop();
  composer.setSize(w, h);
  fitCamera(false);
}

new ResizeObserver(resize).observe(container);
fitCamera();
resize();

function renderCMFButtons() {
  const c = $('cmf-buttons');
  c.replaceChildren(...CMF_PRESETS.map(preset => {
    const card = document.createElement('button');
    card.className = 'cmf-card';
    card.dataset.material = preset.id;
    card.setAttribute('aria-label', preset.name);

    const swatchBox = document.createElement('div');
    swatchBox.className = 'cmf-swatch-box';
    const img = document.createElement('img');
    img.className = 'cmf-swatch-img';
    img.src = preset.swatch.startsWith('./') || preset.swatch.startsWith('assets/') 
      ? preset.swatch 
      : `./design_sheets/${preset.swatch}`;
    img.alt = preset.name;
    swatchBox.appendChild(img);

    const info = document.createElement('div');
    info.className = 'cmf-info';
    const title = document.createElement('span');
    title.className = 'cmf-title';
    title.textContent = preset.name;
    const sub = document.createElement('span');
    sub.className = 'cmf-sub';
    sub.textContent = preset.code;
    info.append(title, sub);

    card.append(swatchBox, info);
    card.addEventListener('click', () => applyMaterial(preset.id));
    return card;
  }));
}

/** 把「影棚预设 × CMF 配方」落到灯光颜色与曝光上；光强由 animate 阻尼推进 */
function applyLighting() {
  const preset = LIGHT_PRESETS[lightPreset] || LIGHT_PRESETS.studio;
  const profile = CMF_LIGHTING[currentMaterialId] || CMF_LIGHTING.default;
  key.color.set(preset.key);
  fill.color.set(preset.fill);
  rim.color.set(preset.rim);
  // 曝光硬切：换材质＝重新测光。matchBackdrop 用曝光反解背景，
  // 所以背景色显示值恒为 #f3f0eb，曝光只影响主体 → 有充足的高光余量
  renderer.toneMappingExposure = preset.exposure * profile.exposure;
  matchBackdrop();
}

function applyMaterial(variantId) {
  currentMaterialId = variantId;
  storage.set('materialVariant', variantId);
  const selected = CMF_PRESETS.find(p => p.id === variantId) || CMF_PRESETS[0];

  const savedColorway = storage.get(`colorway_${variantId}`, 'default');
  Object.values(mascots).forEach(m => m.setMaterialVariant(variantId, savedColorway));
  applyLighting();

  document.querySelectorAll('.cmf-card').forEach(b => {
    const active = b.dataset.material === variantId;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });

  $('material-description').textContent = selected.desc;
  $('cmf-badge').textContent = `CMF 0${CMF_PRESETS.indexOf(selected) + 1}`;

  renderColorways(variantId);
  syncTheme();
}

function renderColorways(variantId) {
  const container = $('cmf-colorways');
  if (!container) return;
  const colorways = getCMFColorways(variantId);
  if (!colorways || colorways.length <= 1) {
    container.innerHTML = '';
    return;
  }

  const savedColorway = storage.get(`colorway_${variantId}`, 'default');
  const activeColorway = colorways.some(c => c.id === savedColorway) ? savedColorway : 'default';

  container.innerHTML = '';
  const title = document.createElement('span');
  title.className = 'colorway-title';
  title.textContent = '工坊大师配色';
  container.appendChild(title);

  const list = document.createElement('div');
  list.className = 'colorway-list';

  colorways.forEach(cw => {
    const chip = document.createElement('button');
    chip.className = `colorway-chip ${cw.id === activeColorway ? 'active' : ''}`;
    chip.dataset.colorway = cw.id;
    chip.setAttribute('aria-label', `${cw.name} (${cw.en || ''})`);
    chip.title = `${cw.name} · ${cw.en || ''}`;

    const dot = document.createElement('span');
    dot.className = 'colorway-dot';
    dot.style.backgroundColor = cw.chip || '#ffffff';

    const name = document.createElement('span');
    name.className = 'colorway-name';
    name.textContent = cw.name;

    chip.append(dot, name);
    chip.addEventListener('click', () => applyColorway(cw.id));
    list.appendChild(chip);
  });

  container.appendChild(list);
}

function applyColorway(colorwayId) {
  studioFlashPulse = 1.0;
  haptic.click('soft');
  storage.set(`colorway_${currentMaterialId}`, colorwayId);
  Object.values(mascots).forEach(m => m.setColorway(colorwayId));
  syncTheme();

  document.querySelectorAll('.colorway-chip').forEach(chip => {
    const active = chip.dataset.colorway === colorwayId;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  });

  const colorways = getCMFColorways(currentMaterialId);
  const selected = colorways.find(c => c.id === colorwayId);
  if (selected) {
    toast(`已切换至工坊配色：${selected.name}`);
  }
}

function action(name) {
  haptic.click('mechanical');
  if (name === 'lock_fruit') {
    setHoodieState('closed');
    return;
  }
  if (name === 'pop_out') {
    setHoodieState('open');
    return;
  }

  getActiveMascot().triggerAction(name);

  const companion = COMPANIONS[currentRole];
  const currentStateMeta = currentRole === 'hoodie' ? companion.states[currentHoodieState] : companion.states.astro;
  const label = currentStateMeta.actions.find(a => a[0] === name)?.[1] || name;
  toast(`${companion.name}收到了动作指令：${label}`);
}

function update3DVisibility() {
  const activeKey = getActiveModelKey();
  Object.entries(mascots).forEach(([key, m]) => {
    m.group.visible = (key === activeKey);
  });
  applyMaterial(currentMaterialId);
  fitCamera();
}

function renderMorphologyControls() {
  const companion = COMPANIONS[currentRole];
  if (!companion) return;

  $('morph-section-heading').innerHTML = `<span>00 /</span> 陪伴形态 <small id="morphology-badge">${currentRole === 'hoodie' ? (currentHoodieState === 'closed' ? '锁果态' : '常开态') : '宇航态'}</small>`;
  $('morphology-description').textContent = currentRole === 'hoodie' ? (currentHoodieState === 'closed' ? companion.states.closed.sub : companion.states.open.sub) : companion.states.astro.sub;

  const states = Object.values(companion.states);
  $('morphology-buttons').replaceChildren(...states.map(st => {
    const active = currentRole === 'hoodie' ? currentHoodieState === st.id : true;
    const card = document.createElement('div');
    card.className = `morphology-card ${active ? 'active' : ''}`;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(active));
    card.dataset.state = st.id;

    card.innerHTML = `
      <div class="badge-frame">
        <img class="morphology-badge-img" src="${st.badge}" alt="${st.title}">
      </div>
      <div class="morphology-meta">
        <div class="card-title-row">
          <span class="morphology-name">${st.title}</span>
          <span class="morph-tag">${st.tag}</span>
        </div>
        <span class="morphology-sub">${st.sub}</span>
      </div>
    `;

    if (currentRole === 'hoodie') {
      card.addEventListener('click', () => setHoodieState(st.id));
    }
    return card;
  }));

  const currentStateMeta = currentRole === 'hoodie' ? companion.states[currentHoodieState] : companion.states.astro;
  $('action-buttons').replaceChildren(...currentStateMeta.actions.map(([id, name, glyph]) => {
    const b = document.createElement('button');
    b.className = 'action-button';
    b.dataset.action = id;
    if (glyph) {
      const img = document.createElement('img');
      img.className = 'action-glyph';
      img.src = glyph;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      b.appendChild(img);
    }
    const textSpan = document.createElement('span');
    textSpan.className = 'action-text';
    textSpan.textContent = name;
    b.appendChild(textSpan);
    b.addEventListener('click', () => action(id));
    return b;
  }));

  const stageDock = $('stage-action-dock');
  if (stageDock) {
    stageDock.replaceChildren(...currentStateMeta.actions.map(([id, name, glyph]) => {
      const b = document.createElement('button');
      b.className = 'dock-action-btn';
      b.dataset.action = id;
      b.setAttribute('aria-label', name);
      b.title = name;
      if (glyph) {
        const img = document.createElement('img');
        img.className = 'dock-glyph';
        img.src = glyph;
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        b.appendChild(img);
      }
      const label = document.createElement('span');
      label.className = 'dock-label';
      label.textContent = name;
      b.appendChild(label);
      b.addEventListener('click', () => {
        action(id);
        b.classList.add('dock-pulse');
        setTimeout(() => b.classList.remove('dock-pulse'), 450);
      });
      return b;
    }));
  }
}
const renderMorphologySection = renderMorphologyControls;

function setHoodieState(state) {
  if (currentHoodieState === state || morphTransition.active) return;
  
  const fromState = currentHoodieState;
  currentHoodieState = state;
  storage.set('hoodieState', state);

  // Trigger smooth organic transformation
  morphTransition.active = true;
  morphTransition.direction = (state === 'closed') ? 'to_closed' : 'to_open';
  morphTransition.progress = 0;

  renderMorphologySection();

  if (state === 'closed') {
    toast('荔小卫锁进果实里啦，安静小憩中～');
    motionTextMorph($('mood-label'), '锁进果壳小憩');
  } else {
    toast('荔小卫探出头来啦，好心情绽放！');
    motionTextMorph($('mood-label'), '安静陪伴');
  }
}

function switchCompanion(role, initial = false) {
  if (!COMPANIONS[role]) return;
  currentRole = role;
  storage.set('role', role);
  document.body.dataset.role = role;

  const companion = COMPANIONS[role];

  // Header role buttons
  document.querySelectorAll('.role-btn').forEach(b => {
    const active = b.dataset.role === role;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });

  // Stage info with morph
  if (!initial) {
    motionTextMorph($('role-name'), companion.name);
    haptic.click('mechanical');
  } else {
    $('role-name').textContent = companion.name;
  }
  $('role-eyebrow').textContent = companion.eyebrow;
  $('role-description').textContent = companion.description;
  $('chat-state').textContent = `${companion.name}在这里`;
  $('mood-label').textContent = '安静陪伴';

  renderMorphologySection();
  update3DVisibility();
  setEmotion('normal');

  if (initial) {
    $('transcript-list').replaceChildren();
    appendMessage(companion.greeting, 'mascot', companion.name);
  } else {
    stopSpeech();
    fitCamera();
  }
}

function setEmotion(e) {
  getActiveMascot().setEmotion(e);
  document.querySelectorAll('[data-emotion]').forEach(b => {
    b.classList.toggle('active', b.dataset.emotion === e);
    b.setAttribute('aria-pressed', String(b.dataset.emotion === e));
  });
  $('mood-label').textContent = ({
    normal: '安静陪伴',
    happy: '好心情',
    curious: '有点好奇',
    shy: '有点害羞',
    sleepy: '慢慢休息',
    energetic: '元气满满'
  })[e] || '安静陪伴';
}

// Bind header companion buttons
document.querySelectorAll('.role-btn').forEach(b => {
  b.addEventListener('click', () => switchCompanion(b.dataset.role));
});

document.querySelectorAll('[data-emotion]').forEach(b => b.addEventListener('click', () => setEmotion(b.dataset.emotion)));
document.querySelectorAll('.atelier-tab-btn[data-panel]').forEach(b => b.addEventListener('click', () => {
  const panel = b.dataset.panel;
  const atelier = document.querySelector('.atelier');
  atelier.dataset.panel = panel;
  document.querySelectorAll('.atelier-tab-btn[data-panel]').forEach(t => t.setAttribute('aria-selected', String(t === b)));
  if (panel === 'all') {
    atelier.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    const targetSection = atelier.querySelector(`[data-section="${panel}"]`);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}));
document.querySelector('.atelier').dataset.panel = 'all';

function setChat(open) {
  document.body.dataset.chat = open ? 'open' : 'closed';
  $('chat-toggle').setAttribute('aria-expanded', String(open));
  $('conversation').inert = !open;
  if (!open && $('conversation').contains(document.activeElement)) $('chat-toggle').focus();
}

setChat(false);
$('chat-toggle').addEventListener('click', () => setChat(document.body.dataset.chat !== 'open'));
$('chat-close').addEventListener('click', () => setChat(false));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.dataset.chat === 'open') {
    setChat(false);
    $('chat-toggle').focus();
  }
});

$('camera-reset').addEventListener('click', () => fitCamera());

function zoom(factor) {
  if (camera.isOrthographicCamera) {
    camera.zoom = THREE.MathUtils.clamp(camera.zoom / factor, 0.7, 1.6);
    camera.updateProjectionMatrix();
    return;
  }
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

$('camera-minus').addEventListener('click', () => zoom(1.12));
$('camera-plus').addEventListener('click', () => zoom(1 / 1.12));

$('light-preset').addEventListener('change', e => {
  lightPreset = e.target.value;
  if (!LIGHT_PRESETS[lightPreset]) lightPreset = 'studio';
  storage.set('lightPreset', lightPreset);
  applyLighting();
});
// 首次进入即把当前材质与预设配对，避免第一帧用了默认值
applyLighting();

function applyMotion() {
  Object.values(mascots).forEach(m => m.reducedMotion = reducedMotion);
  $('motion-toggle').setAttribute('aria-pressed', String(reducedMotion));
  $('motion-toggle').textContent = reducedMotion ? '轻动效 · 开' : '轻动效';
}

$('motion-toggle').addEventListener('click', () => {
  reducedMotion = !reducedMotion;
  storage.set('reducedMotion', reducedMotion);
  applyMotion();
});
applyMotion();

renderer.domElement.addEventListener('pointermove', e => {
  const rect = renderer.domElement.getBoundingClientRect();
  getActiveMascot().face.targetLook.set(
    (e.clientX - rect.left) / rect.width * 2 - 1,
    1 - (e.clientY - rect.top) / rect.height * 2
  );
});
renderer.domElement.addEventListener('pointerleave', () => getActiveMascot().face.targetLook.set(0, 0));

// Audio, Intent, and Voice setup
const visualizer = new AudioVisualizer(), intent = new LiIntentBridge(), xiaozhi = new XiaoZhiClient();
const rhythm = new RhythmEngine({
  onTrackChange: () => refreshPlaylist(),
  onPlayStateChange: () => refreshMusic(),
  onError: () => toast('音频未能播放，请换一首或导入本地音乐。')
});

function refreshPlaylist() {
  const select = $('rhythmTrackSelect');
  select.replaceChildren(...rhythm.playlist.map((track, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = track.title;
    return o;
  }));
  select.value = rhythm.currentTrackIndex;
}

function refreshMusic() {
  const ready = rhythm.isPlaying && rhythm.audioReady;
  $('rhythmPlayText').textContent = rhythm.isPlaying ? (ready ? '暂停播放' : '正在载入…') : '开始播放';
  $('rhythmPlayIcon').textContent = rhythm.isPlaying ? 'Ⅱ' : '▷';
  $('rhythmPlayBtn').setAttribute('aria-label', rhythm.isPlaying ? '暂停播放' : '开始播放');
  $('bpmBadge').textContent = ready ? `${Math.round(60 / rhythm.beatPeriod)} BPM` : '待播放';
}

refreshPlaylist();
refreshMusic();

$('rhythmPlayBtn').addEventListener('click', () => rhythm.togglePlay());
$('rhythmPrevBtn').addEventListener('click', () => rhythm.prevTrack());
$('rhythmNextBtn').addEventListener('click', () => rhythm.nextTrack());
$('rhythmTrackSelect').addEventListener('change', e => rhythm.playTrack(Number(e.target.value)));

$('music-upload').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await rhythm.loadCustomFile(file);
    refreshPlaylist();
    toast('已加入本地音乐');
  } catch {
    toast('这段音频暂时无法读取，请换一个音频文件。');
  }
  e.target.value = '';
});

$('mic-btn').addEventListener('click', async () => {
  if (visualizer.isListening) visualizer.stopMic();
  else {
    try {
      const ok = await visualizer.startMic();
      if (!ok) toast('未开启麦克风。可检查浏览器权限后再试。');
    } catch {
      toast('当前浏览器暂不支持声音互动。');
    }
  }
  const active = visualizer.isListening;
  $('mic-btn').classList.toggle('recording', active);
  $('mic-btn').setAttribute('aria-pressed', String(active));
  $('mic-btn').setAttribute('aria-label', active ? '关闭声音互动' : '开启声音互动');
  $('voice-note').textContent = active ? '正在感受声音 · 再点麦克风即可关闭' : '声音互动控制表情 · 文字可发送对话';
});

function stopSpeech() { visualizer.stopSpeech(); }
function applySpeech() {
  $('speech-toggle').setAttribute('aria-pressed', String(speechEnabled));
  $('speech-toggle').setAttribute('aria-label', speechEnabled ? '关闭语音朗读' : '开启语音朗读');
}

$('speech-toggle').addEventListener('click', () => {
  speechEnabled = !speechEnabled;
  storage.set('speech', speechEnabled);
  if (!speechEnabled) stopSpeech();
  applySpeech();
});
applySpeech();

function appendMessage(text, type = 'mascot', author = COMPANIONS[currentRole].name) {
  if (!text) return;
  const item = document.createElement('div');
  item.className = `message message-${type}`;
  const label = document.createElement('span');
  label.className = 'message-author';
  label.textContent = type === 'user' ? '你' : type === 'system' ? '提示' : author;
  const p = document.createElement('p');
  p.textContent = text;
  item.append(label, p);
  $('transcript-list').append(item);
  motionRise(item);
  item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

$('clear-chat').addEventListener('click', async () => {
  const children = Array.from($('transcript-list').children);
  if (children.length > 0) {
    await motionLeave(children);
  }
  $('transcript-list').replaceChildren();
  toast('对话手记已清空');
});

function deliverReply(text, actions = [], emotions = [], role = currentRole) {
  const mascot = getActiveMascot();
  actions.forEach(a => mascot.triggerAction(a));
  emotions.forEach(e => mascot.setEmotion(e));
  if (role === currentRole && emotions.length) setEmotion(emotions.at(-1));
  appendMessage(text, 'mascot', COMPANIONS[role].name);
  if (speechEnabled && role === currentRole && text) {
    visualizer.speak(text, COMPANIONS[role].id || 'hoodie');
  }
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

let agyOnline = false;
async function checkBridge() {
  try {
    const status = await fetchJSON('http://127.0.0.1:8768/status');
    agyOnline = status.status === 'running' && status.agy_available;
  } catch {
    agyOnline = false;
  }
  updateConnection();
}

function updateConnection() {
  const engine = $('engine-select').value;
  const online = engine === 'agy' ? agyOnline : engine === 'xiaozhi' ? xiaozhi.isConnected : false;
  $('dot-agy').classList.toggle('green', online);
  $('connection-label').textContent = engine === 'local' ? '本地互动' : online ? '已连接' : engine === 'agy' ? '智能对话离线' : '小智未连接';
}

xiaozhi.on('open', () => updateConnection());
xiaozhi.on('close', () => updateConnection());
xiaozhi.on('llm', data => {
  if ($('engine-select').value !== 'xiaozhi' || !data.text) return;
  const r = intent.resolveIntent(data.text, currentRole);
  deliverReply(r.cleanText, r.actions, r.emotions, currentRole);
});
xiaozhi.on('error', () => {
  updateConnection();
  toast('小智连接不可用，可选择智能对话或本地互动。');
});

$('engine-select').addEventListener('change', async () => {
  xiaozhi.disconnect();
  const engine = $('engine-select').value;
  updateConnection();
  if (engine === 'xiaozhi') {
    await xiaozhi.connect();
    updateConnection();
  } else if (engine === 'agy') checkBridge();
});

$('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    $('chat-form').requestSubmit();
  }
});

$('chat-form').addEventListener('submit', async e => {
  e.preventDefault();
  const message = $('chat-input').value.trim();
  if (!message || busy) return;
  const role = currentRole, engine = $('engine-select').value;
  appendMessage(message, 'user');
  $('chat-input').value = '';
  busy = true;
  $('send-btn').disabled = true;
  $('chat-state').textContent = `${COMPANIONS[role].name}在听…`;
  try {
    if (engine === 'local') {
      const r = intent.getLocalReply(message, role);
      deliverReply(r.clean, r.actions, r.emotions, role);
    } else if (engine === 'xiaozhi') {
      if (!xiaozhi.isConnected) throw new Error('小智尚未连接');
      xiaozhi.sendText(message);
    } else {
      const data = await fetchJSON('http://127.0.0.1:8768/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: COMPANIONS[role].name, message }),
        signal: AbortSignal.timeout(90000)
      });
      const text = data.clean_speech || data.cleanText || data.reply || '';
      if (!text) throw new Error('未收到回复');
      deliverReply(text, data.actions || [], data.emotions || [], role);
      if (data.status && data.status !== 'success') appendMessage('本次使用了备用回复。', 'system');
    }
  } catch (err) {
    appendMessage(engine === 'xiaozhi' ? '小智尚未连接。请检查连接，或切换对话方式。' : '智能对话暂时没有回应。请稍后重试，或选择本地互动。', 'system');
    if (engine === 'agy') {
      agyOnline = false;
      updateConnection();
    }
  } finally {
    busy = false;
    $('send-btn').disabled = false;
    $('chat-state').textContent = `${COMPANIONS[currentRole].name}在这里`;
  }
});

// Render UI controls & switch to initial companion
renderCMFButtons();
switchCompanion(currentRole, true);
checkBridge();

const wave = $('wave-canvas').getContext('2d');
const bars = [...document.querySelectorAll('.music-wave span')];
let lastUI = 0;

function animate(now) {
  if (disposed) return;
  requestAnimationFrame(animate);
  if (document.hidden) {
    lastFrame = 0;
    return;
  }
  const raw = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
  lastFrame = now;
  const dt = window._pauseTime ? 0 : Math.min(0.05, raw);
  time += dt;

  frameTimes.push(raw * 1000);
  if (frameTimes.length > 300) frameTimes.shift();

  const audio = visualizer.getAudioLevel();
  const r = rhythm.update(dt);
  const speech = visualizer.speechMode === 'browser' && visualizer.isSpeaking ? 0.07 + 0.11 * Math.abs(Math.sin(time * 11) * Math.sin(time * 7)) : 0;
  const musicMouth = rhythm.isPlaying && rhythm.audioReady ? Math.min(1, (r.mid || 0) * 0.85) : 0;

  // --- Morph Transition Engine (Smooth Squash & Stretch between open and closed) ---
  if (morphTransition.active) {
    morphTransition.progress += dt / morphTransition.duration;
    const p = Math.min(morphTransition.progress, 1.0);

    if (morphTransition.direction === 'to_closed') {
      if (p <= 0.35) {
        mascots.hoodie_open.group.visible = true;
        mascots.hoodie_closed.group.visible = false;
        const u = p / 0.35;
        const sq = Math.sin(u * Math.PI * 0.5);
        mascots.hoodie_open.pivot.scale.y = 1.0 - sq * 0.38;
        mascots.hoodie_open.pivot.scale.x = 1.0 + sq * 0.22;
        mascots.hoodie_open.pivot.scale.z = 1.0 + sq * 0.22;
        mascots.hoodie_open.group.position.y = -sq * 0.16;
        mascots.hoodie_open.group.rotation.z = Math.sin(u * Math.PI * 8) * 0.05;
      } else {
        mascots.hoodie_open.group.visible = false;
        mascots.hoodie_closed.group.visible = true;
        const u = (p - 0.35) / 0.65;
        const elastic = Math.exp(-4.8 * u) * Math.cos(u * Math.PI * 4);
        mascots.hoodie_closed.pivot.scale.y = 1.0 - elastic * 0.32;
        mascots.hoodie_closed.pivot.scale.x = 1.0 + elastic * 0.18;
        mascots.hoodie_closed.pivot.scale.z = 1.0 + elastic * 0.18;
        mascots.hoodie_closed.group.position.y = -0.16 * (1.0 - u) + Math.sin(u * Math.PI) * 0.09;
        mascots.hoodie_closed.group.rotation.z = elastic * 0.08;
      }
    } else {
      // to_open
      if (p <= 0.30) {
        mascots.hoodie_closed.group.visible = true;
        mascots.hoodie_open.group.visible = false;
        const u = p / 0.30;
        const sq = Math.sin(u * Math.PI * 0.5);
        mascots.hoodie_closed.pivot.scale.y = 1.0 - sq * 0.25;
        mascots.hoodie_closed.pivot.scale.x = 1.0 + sq * 0.15;
        mascots.hoodie_closed.pivot.scale.z = 1.0 + sq * 0.15;
        mascots.hoodie_closed.group.position.y = Math.sin(u * Math.PI) * 0.28;
        mascots.hoodie_closed.group.rotation.z = Math.sin(u * Math.PI * 8) * 0.06;
      } else {
        mascots.hoodie_closed.group.visible = false;
        mascots.hoodie_open.group.visible = true;
        const u = (p - 0.30) / 0.70;
        const elastic = Math.exp(-4.5 * u) * Math.cos(u * Math.PI * 4);
        mascots.hoodie_open.pivot.scale.y = 1.0 - elastic * 0.34;
        mascots.hoodie_open.pivot.scale.x = 1.0 + elastic * 0.18;
        mascots.hoodie_open.pivot.scale.z = 1.0 + elastic * 0.18;
        mascots.hoodie_open.group.position.y = Math.max(0, 0.25 * (1.0 - u * 2)) + Math.max(0, -elastic * 0.08);
        mascots.hoodie_open.group.rotation.z = elastic * 0.12;
      }
    }

    if (p >= 1.0) {
      morphTransition.active = false;
      mascots.hoodie_open.pivot.scale.set(1, 1, 1);
      mascots.hoodie_closed.pivot.scale.set(1, 1, 1);
      mascots.hoodie_open.group.position.y = 0;
      mascots.hoodie_closed.group.position.y = 0;
      update3DVisibility();
    }
  } else {
    // Normal animation update
    getActiveMascot().update(time, dt, Math.max(audio, speech, musicMouth), r);
  }

  // --- SecondaryMotion Physics (Continuous, including during morphTransition) ---
  const activeModel = getActiveMascot();
  if (activeModel && activeModel.group) {
    const activeKey = getActiveModelKey();
    if (secondary[activeKey]) {
      secondary[activeKey].update(dt, activeModel.group);
    }
  }

  // Keep the smaller floating/jetpack gestures framed. The moon jump is
  // deliberately allowed to leave the screen and return on landing.
  const flying = currentRole === 'astro' && !activeModel.actions.has('bounce') && ['jetpack_boost', 'zero_g_float'].some(name => activeModel.actions.has(name));
  const followY = flying ? Math.max(0, activeModel.group.position.y) : 0;
  const followDelta = followY - astroFollowY;
  camera.position.y += followDelta;
  controls.target.y += followDelta;
  astroFollowY = followY;

  // --- CameraDirector (4-Mode FOV Rhythm Engine with Dolly Zoom & Incommensurable Drift) ---
  if (!camera.isOrthographicCamera) {
    director.setViewport(camera.aspect);
    director.setRhythm({ ...r, isPlaying: rhythm.isPlaying && rhythm.audioReady });
    director.setReducedMotion(reducedMotion);
    director.setFit({
      distance: fitDistance,
      target: [controls.target.x, controls.target.y, controls.target.z],
      direction: isUserInteracting ? camera.position.clone().sub(controls.target).toArray() : null,
    });
    director.idleSince = lastInteractionTime;
    director.interacting = isUserInteracting;
    if (director.mode === 'off' && !reducedMotion) director.setMode('bass');
    syncControlLimits();
    director.update(dt, time, camera);
  }

  // --- CMF 自适应影棚布光 + 声光共振 ---
  const lightCfg = LIGHT_PRESETS[lightPreset] || LIGHT_PRESETS.studio;
  const cmfCfg = CMF_LIGHTING[currentMaterialId] || CMF_LIGHTING.default;

  // 首帧直接落到目标，避免开场 1 秒从 1.0 缓慢爬升
  if (!cmfLight.ready) {
    cmfLight.env = lightCfg.env * cmfCfg.env;
    cmfLight.key = lightCfg.keyMix * cmfCfg.key;
    cmfLight.fill = lightCfg.fillMix * cmfCfg.fill;
    cmfLight.rim = lightCfg.rimMix * cmfCfg.rim;
    cmfLight.ready = true;
  }
  const dLight = 1 - Math.exp(-4.2 * dt);
  cmfLight.env += (lightCfg.env * cmfCfg.env - cmfLight.env) * dLight;
  cmfLight.key += (lightCfg.keyMix * cmfCfg.key - cmfLight.key) * dLight;
  cmfLight.fill += (lightCfg.fillMix * cmfCfg.fill - cmfLight.fill) * dLight;
  cmfLight.rim += (lightCfg.rimMix * cmfCfg.rim - cmfLight.rim) * dLight;

  const playing = rhythm.isPlaying && rhythm.audioReady;
  const accent = ((r.beatPulse || 0) * 0.38 + (r.bass || 0) * 0.24) * (playing ? 1 : 0);

  // 广播主题呼吸心跳
  theme.pulse(dt, playing ? ((r.beatPulse || 0) * 0.6 + (r.bass || 0) * 0.4) : 0);

  scene.environmentIntensity = cmfLight.env * (1 + accent * 0.10 + studioFlashPulse * 0.25);
  key.intensity = BASE_KEY_INTENSITY * cmfLight.key * (1 + accent * 0.35 + studioFlashPulse * 0.45);
  fill.intensity = BASE_FILL_INTENSITY * cmfLight.fill * (1 + (r.mid || 0) * 0.15 * (playing ? 1 : 0) + studioFlashPulse * 0.20);
  rim.intensity = BASE_RIM_INTENSITY * cmfLight.rim * (1 + (r.treble || 0) * 0.20 * (playing ? 1 : 0) + studioFlashPulse * 0.20);

  bloom.strength = THREE.MathUtils.lerp(bloom.strength, cmfCfg.bloom.strength + accent * 0.05 + studioFlashPulse * 0.15, 0.15);
  bloom.radius = THREE.MathUtils.lerp(bloom.radius, cmfCfg.bloom.radius, 0.15);
  bloom.threshold = THREE.MathUtils.lerp(bloom.threshold, cmfCfg.bloom.threshold, 0.15);
  studioFlashPulse = Math.max(0, studioFlashPulse - dt * 3.2);

  controls.update();

  // 更新专属粒子特效 (起跳烟雾/砸地冲击波/翻滚微尘/尾焰)
  vfx.update(dt);

  // 阴影空间坐标与物理形变实时联动 (X, Z 彻底同步地面横移，大小透明度随高度衰减)
  const activeModelForShadow = getActiveMascot();
  if (activeModelForShadow && activeModelForShadow.group) {
    contactShadow.position.x = activeModelForShadow.group.position.x;
    contactShadow.position.z = activeModelForShadow.group.position.z;

    const jumpH = Math.max(0, activeModelForShadow.group.position.y);
    const squashFactor = activeModelForShadow.pivot.scale.x;
    const heightDamp = Math.max(0.12, 1.0 - jumpH * 0.22);
    const shadowScale = heightDamp * squashFactor;
    contactShadow.scale.set(shadowScale, shadowScale, shadowScale);

    const baseShadowOpacity = currentRole === 'astro' ? 0.40 : 0.62;
    const heightFade = Math.max(0.04, 1.0 - jumpH * 0.26);
    contactShadow.material.opacity = baseShadowOpacity * heightFade;
  }

  renderer.info.reset();
  composer.render();

  diagnostics = {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    lines: renderer.info.render.lines,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
    cameraDirector: director.telemetry(),
    secondaryMotion: Object.fromEntries(Object.entries(secondary).map(([k, s]) => [k, s.telemetry()])),
    theme: theme.current,
  };

  if (now - lastUI > 100) {
    lastUI = now;
    refreshMusic();
    const seconds = rhythm.isPlaying && rhythm.audioReady ? Math.max(0, rhythm.audioCtx.currentTime - rhythm.playbackStartTime + rhythm.playbackOffset) : rhythm.playbackOffset;
    const min = Math.floor(seconds / 60), sec = Math.floor(seconds % 60);
    $('music-time').textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    bars.forEach((b, i) => {
      const energy = [r.bass, r.mid, r.treble][i % 3];
      b.style.height = `${4 + energy * (13 + Math.sin(i * 2) * 5)}px`;
    });
    wave.clearRect(0, 0, 76, 24);
    wave.strokeStyle = visualizer.isListening ? (theme.current?.accent || '#b74343') : '#9d9b93';
    wave.lineWidth = 1.2;
    wave.beginPath();
    for (let x = 0; x <= 76; x++) {
      const y = 12 + Math.sin(x * 0.35 + time * 8) * audio * 8 * Math.sin(x / 76 * Math.PI);
      x ? wave.lineTo(x, y) : wave.moveTo(x, y);
    }
    wave.stroke();
  }

  if ($('loading-state')) $('loading-state').remove();
}

requestAnimationFrame(animate);

function diagnosticsSnapshot() {
  const samples = frameTimes.slice(30).sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  const root = getActiveMascot().group;
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const points = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        points.push(new THREE.Vector3(x, y, z).project(camera));
      }
    }
  }
  let visibleTriangles = 0, visibleMeshes = 0;
  root.traverseVisible(o => {
    if (o.isMesh) {
      visibleMeshes++;
      visibleTriangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    }
  });

  return {
    role: currentRole,
    hoodieState: currentHoodieState,
    activeModel: getActiveModelKey(),
    source: getActiveMascot().source,
    variant: getActiveMascot().variant,
    lighting: { preset: lightPreset, exposure: renderer.toneMappingExposure, env: scene.environmentIntensity },
    reducedMotion,
    render: diagnostics,
    model: { triangles: visibleTriangles, meshes: visibleMeshes },
    frame: {
      samples: samples.length,
      fps: samples.length ? 1000 / (sum / samples.length) : 0,
      p50: samples[Math.floor(samples.length * 0.5)] || 0,
      p95: samples[Math.floor(samples.length * 0.95)] || 0
    },
    canvas: { width: container.clientWidth, height: container.clientHeight, dpr: renderer.getPixelRatio() },
    camera: {
      distance: camera.position.distanceTo(controls.target),
      fov: camera.fov,
      projection: camera.isOrthographicCamera ? 'orthographic' : 'perspective',
      view: viewPreset
    },
    connection: agyOnline,
    morphTransitionActive: morphTransition.active
  };
}

window.liCMFDebug = Object.freeze({
  capabilities: CMF_CAPABILITIES,
  /** 若微表面看起来「凸起变凹陷」，调一次即可全局反号重烘 */
  flipNormalGreen(flip = true) {
    setNormalGreenSign(flip ? 1 : -1);
    Object.values(mascots).forEach(m => m.setMaterialVariant(currentMaterialId));
  },
  lighting: () => ({ preset: lightPreset, material: currentMaterialId, mix: { ...cmfLight }, exposure: renderer.toneMappingExposure, env: scene.environmentIntensity }),
});

window.liDiagnostics = Object.freeze({ snapshot: diagnosticsSnapshot });
window.switchCompanion = switchCompanion;
window.setHoodieState = setHoodieState;
window.setMascotCMF = applyMaterial;
window.setMascotColorway = applyColorway;
window.triggerMascotAction = action;
window.mascots = mascots;
window.rhythm = rhythm;
window.cameraDirector = director;
window.scene = scene;
window.renderer = renderer;
window.vfx = vfx;

window.addEventListener('pagehide', () => {
  disposed = true;
  rhythm.pause();
  visualizer.stopMic();
  stopSpeech();
  xiaozhi.disconnect();
  controls.dispose();
  composer.dispose();
  environment.dispose();
  renderer.dispose();
});
