// 弈律 · 3D 中国象棋 Three.js 舞台与交互核心
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/controls/OrbitControls.js/+esm';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/environments/RoomEnvironment.js/+esm';

import { RED, BLACK, ROWS, COLS, GLYPH, pieceAt, legalMoves } from './rules.js';
import { playMoveSound, playCaptureSound } from './audio.js';

const LIVING_PORTRAITS = {
  red: {
    general: 'assets/xiangqi/portraits/red-general.png',
    advisor: 'assets/xiangqi/portraits/red-advisor.png',
    elephant: 'assets/xiangqi/portraits/red-elephant.png',
    horse: 'assets/xiangqi/portraits/red-horse.png',
    chariot: 'assets/xiangqi/portraits/red-chariot.png',
    cannon: 'assets/xiangqi/portraits/red-cannon.png',
    soldier: 'assets/xiangqi/portraits/red-soldier.png',
  },
  black: {
    general: 'assets/xiangqi/portraits/black-general.png',
    advisor: 'assets/xiangqi/portraits/black-advisor.png',
    elephant: 'assets/xiangqi/portraits/black-elephant.png',
    horse: 'assets/xiangqi/portraits/black-horse.png',
    chariot: 'assets/xiangqi/portraits/black-chariot.png',
    cannon: 'assets/xiangqi/portraits/black-cannon.png',
    soldier: 'assets/xiangqi/portraits/black-soldier.png',
  }
};

const EPIC_PORTRAITS = {
  red: {
    general: 'assets/xiangqi/portraits-epic/red-general.png', advisor: 'assets/xiangqi/portraits-epic/red-advisor.png',
    elephant: 'assets/xiangqi/portraits-epic/red-elephant.png', horse: 'assets/xiangqi/portraits-epic/red-horse.png',
    chariot: 'assets/xiangqi/portraits-epic/red-chariot.png', cannon: 'assets/xiangqi/portraits-epic/red-cannon.png',
    soldier: 'assets/xiangqi/portraits-epic/red-soldier.png',
  },
  black: {
    general: 'assets/xiangqi/portraits-epic/black-general.png', advisor: 'assets/xiangqi/portraits-epic/black-advisor.png',
    elephant: 'assets/xiangqi/portraits-epic/black-elephant.png', horse: 'assets/xiangqi/portraits-epic/black-horse.png',
    chariot: 'assets/xiangqi/portraits-epic/black-chariot.png', cannon: 'assets/xiangqi/portraits-epic/black-cannon.png',
    soldier: 'assets/xiangqi/portraits-epic/black-soldier.png',
  }
};

const PORTRAIT_SETS = { living: LIVING_PORTRAITS, epic: EPIC_PORTRAITS };
const BOARD_TEXTURES = {
  living: 'assets/xiangqi/boards/living-mineral.png',
  epic: 'assets/xiangqi/boards/hero-tactical-v2.png',
};

const HERO_MEDALLION_ATLASES = {
  red: 'assets/xiangqi/hero-medallions-v2/red-atlas.png',
  black: 'assets/xiangqi/hero-medallions-v2/black-atlas.png',
};

const HERO_MEDALLION_INDEX = {
  general: 0,
  advisor: 1,
  elephant: 2,
  horse: 3,
  chariot: 4,
  cannon: 5,
  soldier: 6,
};

const HERO_PALETTES = {
  red: { primary: 0x6f211f, secondary: 0xd8c7a6, metal: 0xa9834f, dark: 0x171a1f, energy: 0x39c8d4 },
  black: { primary: 0x202c61, secondary: 0xc8ccd2, metal: 0x8f7955, dark: 0x11151e, energy: 0xe0a34b },
};

const CELL_SIZE = 1.2;
const BOARD_WIDTH = 9 * CELL_SIZE; // 10.8
const BOARD_HEIGHT = 10 * CELL_SIZE; // 12.0
const BOARD_CANVAS_WIDTH = 1024;
const BOARD_CANVAS_HEIGHT = 1152;
// Keep the painted intersections on the same world-space coordinates as pieces.
const BOARD_GRID_MARGIN_X = 57;
const BOARD_GRID_MARGIN_Y = 58;

export function rowToZ(row) {
  return (row - 4.5) * CELL_SIZE;
}

export function colToX(col) {
  return (col - 4) * CELL_SIZE;
}

export function zToRow(z) {
  return Math.round(z / CELL_SIZE + 4.5);
}

export function xToCol(x) {
  return Math.round(x / CELL_SIZE + 4);
}

export class XiangqiBoard3D {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      playerColor: RED,
      reducedMotion: false,
      theme: 'living',
      material: { roughness: 0.24, metalness: 0.18, clearcoat: 0.58, pulse: 0.42 },
      onSelectPiece: null,
      onMakeMove: null,
      ...options
    };

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.pieceMeshes = new Map(); // pieceId -> THREE.Mesh
    this.loadedTextures = new Map(); // key -> CanvasTexture
    this.pieceMaterials = new Set();
    this.boardMesh = null;
    this.boardCanvas = null;
    this.boardContext = null;
    this.boardTexture = null;
    this.boardSurfaceMaterial = null;

    this.selectedPiece = null;
    this.legalMoveDots = [];
    this.selectionRing = null;
    this.lastMoveMarkers = [];

    this.animatingPieces = []; // { mesh, start, target, startTime, duration, onComplete }
    this.particles = []; // active capture particles
    this.eventRings = [];

    this.state = null;
    this.isInteractable = true;

    this.initScene();
    this.initLights();
    this.createBoardMesh();
    this.initInteraction();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd8e0e8);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 100);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableRotate = false;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 45;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;

    window.addEventListener('resize', () => this.onResize());
  }

  updateCameraPosition() {
    const isBlack = this.options.playerColor === BLACK;
    const compact = this.container.clientWidth <= 600;
    this.camera.fov = compact ? 35 : 38;
    this.camera.position.set(0, compact ? 21 : 19.5, isBlack ? (compact ? -2.6 : -3.4) : (compact ? 2.6 : 3.4));
    this.camera.up.set(0, 0, isBlack ? 1 : -1);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 0, 0);
  }

  setPlayerColor(color) {
    this.options.playerColor = color;
    this.updateCameraPosition();
    if (this.controls) this.controls.update();
  }

  setReducedMotion(enabled) {
    this.options.reducedMotion = enabled;
  }

  initLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.46);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    keyLight.position.set(8, 16, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 35;
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -8;
    this.scene.add(keyLight);

    this.rimLight = new THREE.PointLight(0x3158a6, 0.82, 20);
    this.rimLight.position.set(-8, 10, -10);
    this.scene.add(this.rimLight);

    this.warmFill = new THREE.PointLight(0xfff4df, 0.48, 20);
    this.warmFill.position.set(0, 8, 0);
    this.scene.add(this.warmFill);
  }

  createBoardMesh() {
    // 棋盘基座 (Mineral White PBR)
    const baseGeo = new THREE.BoxGeometry(11.6, 0.45, 12.8);
    const baseMat = new THREE.MeshPhysicalMaterial({
      color: 0x4a3829,
      roughness: 0.42,
      metalness: 0.05,
      clearcoat: 0.52,
    });
    this.boardMesh = new THREE.Mesh(baseGeo, baseMat);
    this.boardMesh.position.y = -0.225;
    this.boardMesh.receiveShadow = true;
    this.boardMesh.castShadow = true;
    this.scene.add(this.boardMesh);

    // 棋盘表面网格贴图 (Canvas绘制)
    const canvas = document.createElement('canvas');
    canvas.width = BOARD_CANVAS_WIDTH;
    canvas.height = BOARD_CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    this.boardCanvas = canvas;
    this.boardContext = ctx;

    // 背景底色
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 边框装饰
    ctx.strokeStyle = '#3158A6';
    ctx.lineWidth = 12;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    const marginX = BOARD_GRID_MARGIN_X;
    const marginY = BOARD_GRID_MARGIN_Y;
    const stepX = (canvas.width - 2 * marginX) / 8;
    const stepY = (canvas.height - 2 * marginY) / 9;

    ctx.strokeStyle = 'rgba(49, 88, 166, 0.85)';
    ctx.lineWidth = 4;

    // 横线 (10 条)
    for (let r = 0; r < 10; r++) {
      const y = marginY + r * stepY;
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(canvas.width - marginX, y);
      ctx.stroke();
    }

    // 竖线 (9 条，中间楚河汉界断开)
    for (let c = 0; c < 9; c++) {
      const x = marginX + c * stepX;
      if (c === 0 || c === 8) {
        ctx.beginPath();
        ctx.moveTo(x, marginY);
        ctx.lineTo(x, canvas.height - marginY);
        ctx.stroke();
      } else {
        // 上半段 (r0 ~ r4)
        ctx.beginPath();
        ctx.moveTo(x, marginY);
        ctx.lineTo(x, marginY + 4 * stepY);
        ctx.stroke();
        // 下半段 (r5 ~ r9)
        ctx.beginPath();
        ctx.moveTo(x, marginY + 5 * stepY);
        ctx.lineTo(x, canvas.height - marginY);
        ctx.stroke();
      }
    }

    // 九宫斜线
    ctx.beginPath();
    ctx.moveTo(marginX + 3 * stepX, marginY);
    ctx.lineTo(marginX + 5 * stepX, marginY + 2 * stepY);
    ctx.moveTo(marginX + 5 * stepX, marginY);
    ctx.lineTo(marginX + 3 * stepX, marginY + 2 * stepY);

    ctx.moveTo(marginX + 3 * stepX, marginY + 7 * stepY);
    ctx.lineTo(marginX + 5 * stepX, marginY + 9 * stepY);
    ctx.moveTo(marginX + 5 * stepX, marginY + 7 * stepY);
    ctx.lineTo(marginX + 3 * stepX, marginY + 9 * stepY);
    ctx.stroke();

    // 楚河 漢界 书法文字
    ctx.font = 'bold 54px "PingFang SC", "STKaiti", "KaiTi", serif';
    ctx.fillStyle = 'rgba(49, 88, 166, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const riverY = marginY + 4.5 * stepY;
    ctx.fillText('楚  河', marginX + 2 * stepX, riverY);
    ctx.fillText('漢  界', marginX + 6 * stepX, riverY);

    const surfaceTex = new THREE.CanvasTexture(canvas);
    surfaceTex.anisotropy = 16;
    const surfaceGeo = new THREE.PlaneGeometry(10.8, 12.0);
    const surfaceMat = new THREE.MeshPhysicalMaterial({
      map: surfaceTex,
      roughness: 0.3,
      metalness: 0.05,
      clearcoat: 0.42,
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.rotation.x = -Math.PI / 2;
    surfaceMesh.position.y = 0.005;
    surfaceMesh.receiveShadow = true;
    this.scene.add(surfaceMesh);
    this.boardTexture = surfaceTex;
    this.boardSurfaceMaterial = surfaceMat;
    this.drawBoardTexture();

    // 选中指示光环 mesh
    const ringGeo = new THREE.RingGeometry(0.52, 0.62, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    this.selectionRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.02;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);
  }

  drawBoardTexture() {
    const canvas = this.boardCanvas;
    const ctx = this.boardContext;
    if (!canvas || !ctx) return;
    const theme = this.options.theme === 'epic' ? 'epic' : 'living';
    const draw = (img = null) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      else {
        ctx.fillStyle = theme === 'epic' ? '#15181e' : '#e7ddca';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.fillStyle = theme === 'epic' ? 'rgba(4, 8, 14, 0.12)' : 'rgba(238, 227, 204, 0.48)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const marginX = BOARD_GRID_MARGIN_X;
      const marginY = BOARD_GRID_MARGIN_Y;
      const stepX = (canvas.width - 2 * marginX) / 8;
      const stepY = (canvas.height - 2 * marginY) / 9;
      const line = theme === 'epic' ? 'rgba(190, 160, 105, 0.62)' : 'rgba(45, 80, 67, 0.92)';
      ctx.strokeStyle = line;
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
      for (let r = 0; r < 10; r++) {
        const y = marginY + r * stepY;
        ctx.beginPath(); ctx.moveTo(marginX, y); ctx.lineTo(canvas.width - marginX, y); ctx.stroke();
      }
      for (let c = 0; c < 9; c++) {
        const x = marginX + c * stepX;
        ctx.beginPath();
        if (c === 0 || c === 8) {
          ctx.moveTo(x, marginY); ctx.lineTo(x, canvas.height - marginY);
        } else {
          ctx.moveTo(x, marginY); ctx.lineTo(x, marginY + 4 * stepY);
          ctx.moveTo(x, marginY + 5 * stepY); ctx.lineTo(x, canvas.height - marginY);
        }
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(marginX + 3 * stepX, marginY); ctx.lineTo(marginX + 5 * stepX, marginY + 2 * stepY);
      ctx.moveTo(marginX + 5 * stepX, marginY); ctx.lineTo(marginX + 3 * stepX, marginY + 2 * stepY);
      ctx.moveTo(marginX + 3 * stepX, marginY + 7 * stepY); ctx.lineTo(marginX + 5 * stepX, marginY + 9 * stepY);
      ctx.moveTo(marginX + 5 * stepX, marginY + 7 * stepY); ctx.lineTo(marginX + 3 * stepX, marginY + 9 * stepY);
      ctx.stroke();
      ctx.font = 'bold 54px "PingFang SC", "STKaiti", "KaiTi", serif';
      ctx.fillStyle = line;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const riverY = marginY + 4.5 * stepY;
      ctx.fillText('楚  河', marginX + 2 * stepX, riverY);
      ctx.fillText('漢  界', marginX + 6 * stepX, riverY);
      if (this.boardTexture) this.boardTexture.needsUpdate = true;
    };
    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => draw();
    img.src = BOARD_TEXTURES[theme];
    if (this.boardSurfaceMaterial) {
      this.boardSurfaceMaterial.color.set(theme === 'epic' ? 0x686d74 : 0xffffff);
      this.boardSurfaceMaterial.roughness = theme === 'epic' ? 0.76 : 0.31;
      this.boardSurfaceMaterial.metalness = theme === 'epic' ? 0.06 : 0.05;
      this.boardSurfaceMaterial.clearcoat = theme === 'epic' ? 0 : 0.48;
      this.boardSurfaceMaterial.envMapIntensity = theme === 'epic' ? 0.06 : 0.42;
    }
    if (this.boardMesh?.material) this.boardMesh.material.color.set(theme === 'epic' ? 0x17191e : 0x4a3829);
    if (this.selectionRing?.material) this.selectionRing.material.color.set(theme === 'epic' ? 0xffa62b : 0x356857);
    this.scene.background = new THREE.Color(theme === 'epic' ? 0x090c12 : 0x756c5e);
    if (this.rimLight) {
      this.rimLight.color.set(theme === 'epic' ? 0x4a70d6 : 0x78988a);
      this.rimLight.intensity = theme === 'epic' ? 1.1 : 0.62;
    }
  }

  setTheme(theme) {
    const next = theme === 'epic' ? 'epic' : 'living';
    if (this.options.theme === next && this.pieceMeshes.size) return;
    this.options.theme = next;
    this.loadedTextures.clear();
    for (const mesh of this.pieceMeshes.values()) this.scene.remove(mesh);
    this.pieceMeshes.clear();
    this.pieceMaterials.clear();
    this.drawBoardTexture();
    if (this.state) this.renderState(this.state);
  }

  getBoardAlignmentMetrics() {
    const gridWorldWidth = ((BOARD_CANVAS_WIDTH - 2 * BOARD_GRID_MARGIN_X) / BOARD_CANVAS_WIDTH) * BOARD_WIDTH;
    const gridWorldHeight = ((BOARD_CANVAS_HEIGHT - 2 * BOARD_GRID_MARGIN_Y) / BOARD_CANVAS_HEIGHT) * BOARD_HEIGHT;
    return {
      gridWorldWidth,
      gridWorldHeight,
      pieceWorldWidth: (COLS - 1) * CELL_SIZE,
      pieceWorldHeight: (ROWS - 1) * CELL_SIZE,
      marginX: BOARD_GRID_MARGIN_X,
      marginY: BOARD_GRID_MARGIN_Y,
    };
  }

  updateMaterialSettings(settings = {}) {
    this.options.material = { ...this.options.material, ...settings };
    for (const mesh of this.pieceMeshes.values()) this.applyMaterialSettings(mesh);
  }

  applyMaterialSettings(mesh) {
    if (!mesh) return;
    const { roughness, metalness, clearcoat, pulse } = this.options.material;
    mesh.traverse((node) => {
      const materials = Array.isArray(node.material) ? node.material : (node.material ? [node.material] : []);
      for (const mat of materials) {
        if (!('roughness' in mat)) continue;
        mat.roughness = Math.min(0.94, Math.max(0.04, roughness + (mat.userData.roughnessOffset || 0)));
        mat.metalness = Math.min(1, Math.max(0, metalness + (mat.userData.metalnessOffset || 0)));
        mat.clearcoat = clearcoat;
        mat.clearcoatRoughness = Math.min(0.82, roughness + 0.08);
        if (mat.userData.isEnergy) mat.userData.baseEmissive = Math.max(0, pulse) * 1.8;
        else if (mat.emissiveMap) mat.userData.baseEmissive = Math.max(0, pulse) * 0.18;
        mat.needsUpdate = true;
      }
    });
  }

  // 传统棋子与英雄棋子共用的程序化汉字铭牌。
  createPieceTexture(color, type) {
    const theme = this.options.theme === 'epic' ? 'epic' : 'living';
    const key = `${theme}-${color}-${type}`;
    if (this.loadedTextures.has(key)) return this.loadedTextures.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(220, 180, 36, 256, 256, 250);
    if (theme === 'epic') {
      gradient.addColorStop(0, color === RED ? '#f3dfca' : '#e3ebf1');
      gradient.addColorStop(1, color === RED ? '#b9473c' : '#294789');
    } else if (color === RED) {
      gradient.addColorStop(0, '#f7eddb');
      gradient.addColorStop(1, '#d7c19c');
    } else {
      gradient.addColorStop(0, '#426458');
      gradient.addColorStop(1, '#1f3a32');
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme === 'epic' ? (color === RED ? '#ffd08d' : '#ffb24a') : (color === RED ? '#a63d35' : '#d6c39c');
    ctx.lineWidth = theme === 'epic' ? 18 : 13;
    ctx.beginPath();
    ctx.arc(256, 256, 235, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 72; i++) {
      const a = i * 2.399;
      const r = 28 + (i * 37) % 185;
      ctx.fillStyle = i % 2 ? '#fff7e7' : '#213a33';
      ctx.beginPath();
      ctx.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 1 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const glyph = GLYPH[color][type];
    ctx.font = `900 ${theme === 'epic' ? 188 : 214}px "Songti SC", "STKaiti", "KaiTi", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color === RED ? 'rgba(112, 26, 25, 0.32)' : 'rgba(5, 18, 24, 0.4)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = theme === 'epic' ? '#fff6e7' : (color === RED ? '#98332d' : '#f3e6c8');
    ctx.fillText(glyph, 256, 268);
    ctx.shadowBlur = 0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.loadedTextures.set(key, tex);
    return tex;
  }

  createPieceMesh(piece) {
    return this.options.theme === 'epic' ? this.createHeroPieceMesh(piece) : this.createClassicPieceMesh(piece);
  }

  createHeroMedallionTexture(color, type) {
    const key = `hero-medallion-v2-${color}-${type}`;
    if (this.loadedTextures.has(key)) return this.loadedTextures.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const palette = color === RED
      ? { field: '#341817', edge: '#b68a4f', glyph: '#f3dbc0', seal: '#641f1d' }
      : { field: '#121a3a', edge: '#a78c60', glyph: '#f1eee8', seal: '#1d2859' };

    const paintBase = () => {
      const gradient = ctx.createRadialGradient(220, 178, 24, 256, 256, 252);
      gradient.addColorStop(0, color === RED ? '#81403a' : '#37437a');
      gradient.addColorStop(0.6, palette.field);
      gradient.addColorStop(1, '#090b10');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
    };
    const paintSeal = () => {
      ctx.beginPath();
      ctx.arc(256, 421, 57, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(7, 9, 13, 0.84)';
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = palette.edge;
      ctx.stroke();
      ctx.font = '900 68px "Songti SC", "STKaiti", "KaiTi", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.glyph;
      ctx.shadowColor = color === RED ? 'rgba(139, 37, 30, 0.8)' : 'rgba(44, 66, 153, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText(GLYPH[color][type], 256, 427);
      ctx.shadowBlur = 0;
    };

    paintBase();
    paintSeal();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    texture.center.set(0.5, 0.5);
    texture.userData.baseRotation = Math.PI / 2;
    texture.rotation = texture.userData.baseRotation;
    this.loadedTextures.set(key, texture);

    const image = new Image();
    image.onload = () => {
      paintBase();
      const index = HERO_MEDALLION_INDEX[type];
      const col = index % 4;
      const row = Math.floor(index / 4);
      const cellWidth = image.width / 4;
      const cellHeight = image.height / 2;
      const cropSize = Math.min(cellWidth, cellHeight);
      const sx = col * cellWidth + (cellWidth - cropSize) / 2;
      const sy = row * cellHeight + (cellHeight - cropSize) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(256, 256, 244, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(image, sx, sy, cropSize, cropSize, 0, 0, 512, 512);
      const vignette = ctx.createRadialGradient(256, 220, 130, 256, 256, 260);
      vignette.addColorStop(0.65, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.46)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, 512, 512);
      ctx.restore();
      paintSeal();
      texture.needsUpdate = true;
    };
    image.src = HERO_MEDALLION_ATLASES[color];
    return texture;
  }

  createClassicPieceMesh(piece) {
    const geo = new THREE.CylinderGeometry(0.52, 0.54, 0.26, 48);
    const topTex = this.createPieceTexture(piece.color, piece.type);

    const sideColor = piece.color === RED ? 0xe0c9a2 : 0x274a3f;
    const sideMat = new THREE.MeshPhysicalMaterial({
      color: sideColor,
      roughness: 0.3,
      metalness: 0.06,
      clearcoat: 0.62,
    });

    const topMat = new THREE.MeshPhysicalMaterial({
      map: topTex,
      emissiveMap: topTex,
      emissive: piece.color === RED ? 0x7c281f : 0x173d32,
      emissiveIntensity: 0.04,
      roughness: this.options.material.roughness,
      metalness: this.options.material.metalness,
      clearcoat: this.options.material.clearcoat,
      clearcoatRoughness: Math.min(0.8, this.options.material.roughness + 0.08),
    });

    const materials = [sideMat, topMat, sideMat];
    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { pieceId: piece.id, pieceType: piece.type, pieceColor: piece.color, topMaterial: topMat };
    topTex.center.set(0.5, 0.5);
    topTex.userData.phase = Math.random() * Math.PI * 2;
    topTex.userData.baseRotation = Math.PI / 2;
    topTex.rotation = topTex.userData.baseRotation;
    this.pieceMaterials.add(sideMat);
    this.pieceMaterials.add(topMat);
    this.applyMaterialSettings(mesh);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.026, 10, 48),
      new THREE.MeshPhysicalMaterial({ color: piece.color === RED ? 0xa97842 : 0xc8b88d, roughness: 0.28, metalness: 0.45, clearcoat: 0.45 })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.138;
    rim.raycast = () => {};
    mesh.add(rim);

    const cap = new THREE.Mesh(
      new THREE.CircleGeometry(0.485, 48),
      new THREE.MeshPhysicalMaterial({
        color: piece.color === RED ? 0xffeee0 : 0xe7f3ed,
        transparent: true,
        opacity: 0.1,
        transmission: 0.18,
        roughness: 0.08,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        depthWrite: false,
      })
    );
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = 0.136;
    cap.raycast = () => {};
    mesh.add(cap);

    return mesh;
  }

  heroMaterial(color, role, energy = false) {
    const palette = HERO_PALETTES[color];
    const mat = new THREE.MeshPhysicalMaterial({
      color: palette[role],
      roughness: energy ? 0.12 : 0.28,
      metalness: energy ? 0.08 : (role === 'secondary' ? 0.16 : 0.35),
      clearcoat: 0.58,
      clearcoatRoughness: 0.16,
      emissive: energy ? palette.energy : 0x000000,
      emissiveIntensity: energy ? 0.72 : 0,
      transparent: energy,
      opacity: energy ? 0.94 : 1,
    });
    mat.userData.isEnergy = energy;
    mat.userData.baseEmissive = energy ? 0.72 : 0;
    mat.userData.roughnessOffset = energy ? -0.12 : 0;
    mat.userData.metalnessOffset = role === 'metal' ? 0.24 : 0;
    this.pieceMaterials.add(mat);
    return mat;
  }

  addHeroPart(group, geometry, material, position, rotation = null, scale = null) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.pieceId = group.userData.pieceId;
    group.add(mesh);
    return mesh;
  }

  createHeroPieceMesh(piece) {
    const group = new THREE.Group();
    group.userData = { pieceId: piece.id, pieceType: piece.type, pieceColor: piece.color, hero: true, energyMaterials: [], floaters: [] };
    const primary = this.heroMaterial(piece.color, 'primary');
    const secondary = this.heroMaterial(piece.color, 'secondary');
    const metal = this.heroMaterial(piece.color, 'metal');
    const dark = this.heroMaterial(piece.color, 'dark');
    const energy = this.heroMaterial(piece.color, 'primary', true);
    group.userData.energyMaterials.push(energy);

    // A shared collectible-puck silhouette keeps these readable as Xiangqi.
    // Class identity now comes from authored relief art instead of toy primitives.
    this.addHeroPart(group, new THREE.CylinderGeometry(0.54, 0.57, 0.15, 48), dark, [0, 0, 0]);
    this.addHeroPart(group, new THREE.CylinderGeometry(0.51, 0.53, 0.13, 48), primary, [0, 0.115, 0]);
    this.addHeroPart(group, new THREE.TorusGeometry(0.49, 0.025, 10, 48), metal, [0, 0.19, 0], [-Math.PI / 2, 0, 0]);

    const medallionTexture = this.createHeroMedallionTexture(piece.color, piece.type);
    const medallionMaterial = new THREE.MeshPhysicalMaterial({
      map: medallionTexture,
      emissiveMap: medallionTexture,
      emissive: piece.color === RED ? 0x2b0a08 : 0x09102f,
      emissiveIntensity: 0.055,
      roughness: 0.27,
      metalness: 0.2,
      clearcoat: 0.78,
      clearcoatRoughness: 0.12,
    });
    medallionMaterial.userData.baseEmissive = 0.055;
    this.pieceMaterials.add(medallionMaterial);
    this.addHeroPart(
      group,
      new THREE.CylinderGeometry(0.455, 0.47, 0.06, 48),
      [metal, medallionMaterial, secondary],
      [0, 0.205, 0]
    );

    const energyRing = this.addHeroPart(group, new THREE.TorusGeometry(0.405, 0.012, 8, 48), energy, [0, 0.242, 0], [-Math.PI / 2, 0, 0]);
    group.userData.floaters.push(energyRing);

    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      this.addHeroPart(
        group,
        new THREE.BoxGeometry(0.07, 0.045, 0.14),
        metal,
        [Math.sin(angle) * 0.48, 0.205, Math.cos(angle) * 0.48],
        [0, angle, 0]
      );
    }

    group.rotation.y = piece.color === BLACK ? Math.PI : 0;
    this.applyMaterialSettings(group);
    return group;
  }

  renderState(state) {
    this.state = state;
    const currentPieceIds = new Set(state.pieces.map(p => p.id));

    // 移除已吃棋子
    for (const [id, mesh] of this.pieceMeshes.entries()) {
      if (!currentPieceIds.has(id)) {
        this.spawnCaptureParticles(mesh.position);
        this.scene.remove(mesh);
        this.pieceMeshes.delete(id);
      }
    }

    // 更新或新增棋子 Mesh
    for (const p of state.pieces) {
      let mesh = this.pieceMeshes.get(p.id);

      // 局面导入/重开时，棋子编号可能被复用给不同阵营或兵种。
      // 不能只按 id 复用旧 Mesh，否则画面与命中对象会和规则状态错位。
      if (mesh && (
        mesh.userData.pieceType !== p.type ||
        mesh.userData.pieceColor !== p.color
      )) {
        this.scene.remove(mesh);
        this.pieceMeshes.delete(p.id);
        mesh = null;
      }

      const targetX = colToX(p.col);
      const targetZ = rowToZ(p.row);
      const targetY = 0.13;

      if (!mesh) {
        mesh = this.createPieceMesh(p);
        mesh.position.set(targetX, targetY, targetZ);
        this.scene.add(mesh);
        this.pieceMeshes.set(p.id, mesh);
      } else {
        const dist = mesh.position.distanceTo(new THREE.Vector3(targetX, targetY, targetZ));
        if (dist > 0.05) {
          if (this.options.reducedMotion) {
            mesh.position.set(targetX, targetY, targetZ);
          } else {
            this.animateMove(mesh, new THREE.Vector3(targetX, targetY, targetZ));
          }
        }
      }
    }

    this.updateLastMoveMarkers();
  }

  animateMove(mesh, targetPos) {
    const startPos = mesh.position.clone();
    const duration = 240; // ms
    const startTime = performance.now();

    this.animatingPieces.push({
      mesh,
      startPos,
      targetPos,
      startTime,
      duration
    });
  }

  spawnCaptureParticles(pos) {
    const count = 28;
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions.push(pos.x, pos.y + 0.1, pos.z);
      velocities.push(
        (Math.random() - 0.5) * 4.5,
        Math.random() * 4 + 1.5,
        (Math.random() - 0.5) * 4.5
      );
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: this.state?.turn === RED ? 0x4d72d7 : 0xe45d4f,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
    });

    const pSystem = new THREE.Points(geo, mat);
    this.scene.add(pSystem);

    this.particles.push({
      system: pSystem,
      velocities,
      startTime: performance.now(),
      duration: 500
    });
  }

  updateLastMoveMarkers() {
    this.lastMoveMarkers.forEach(m => this.scene.remove(m));
    this.lastMoveMarkers = [];

    if (!this.state || !this.state.lastMove) return;
    const { from, to } = this.state.lastMove;
    const fromPoint = new THREE.Vector3(colToX(from.col), 0.035, rowToZ(from.row));
    const toPoint = new THREE.Vector3(colToX(to.col), 0.035, rowToZ(to.row));
    const direction = new THREE.Vector3().subVectors(toPoint, fromPoint);
    const distance = direction.length();

    // The origin is a compact cyan dot, deliberately unlike legal-move dots.
    const origin = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 24),
      new THREE.MeshBasicMaterial({
        color: 0x2c92b8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.82,
        depthTest: false,
        depthWrite: false,
      })
    );
    origin.rotation.x = -Math.PI / 2;
    origin.position.copy(fromPoint);
    origin.renderOrder = 12;
    origin.userData.markerKind = 'last-origin';
    this.scene.add(origin);
    this.lastMoveMarkers.push(origin);

    if (distance > 0.001) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([fromPoint, toPoint]),
        new THREE.LineBasicMaterial({
          color: 0xb88a52,
          transparent: true,
          opacity: 0.58,
          depthTest: false,
          depthWrite: false,
        })
      );
      line.renderOrder = 10;
      line.userData.markerKind = 'last-path';
      this.scene.add(line);
      this.lastMoveMarkers.push(line);

      const unit = direction.clone().normalize();
      const side = new THREE.Vector3(-unit.z, 0, unit.x);
      const center = fromPoint.clone().lerp(toPoint, 0.68);
      const tip = center.clone().addScaledVector(unit, 0.2);
      const back = center.clone().addScaledVector(unit, -0.15);
      const arrowGeometry = new THREE.BufferGeometry();
      arrowGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
        tip.x, 0.045, tip.z,
        back.x + side.x * 0.12, 0.045, back.z + side.z * 0.12,
        back.x - side.x * 0.12, 0.045, back.z - side.z * 0.12,
      ], 3));
      const arrow = new THREE.Mesh(
        arrowGeometry,
        new THREE.MeshBasicMaterial({
          color: 0xd7ae68,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88,
          depthTest: false,
          depthWrite: false,
        })
      );
      arrow.renderOrder = 11;
      arrow.userData.markerKind = 'last-arrow';
      this.scene.add(arrow);
      this.lastMoveMarkers.push(arrow);
    }

    // Render the destination halo over the moved piece instead of underneath it.
    const destination = new THREE.Mesh(
      new THREE.RingGeometry(0.57, 0.64, 40),
      new THREE.MeshBasicMaterial({
        color: 0xd14a40,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
      })
    );
    destination.rotation.x = -Math.PI / 2;
    destination.position.set(toPoint.x, 0.43, toPoint.z);
    destination.renderOrder = 13;
    destination.userData.markerKind = 'last-destination';
    this.scene.add(destination);
    this.lastMoveMarkers.push(destination);
  }

  clearLegalDots() {
    this.legalMoveDots.forEach(d => this.scene.remove(d));
    this.legalMoveDots = [];
    this.selectionRing.visible = false;
  }

  showLegalMoves(piece) {
    this.clearLegalDots();
    if (!piece) return [];

    this.selectedPiece = piece;
    this.selectionRing.position.set(colToX(piece.col), 0.02, rowToZ(piece.row));
    this.selectionRing.visible = true;

    const moves = legalMoves(this.state.pieces, piece);
    for (const m of moves) {
      const targetP = pieceAt(this.state.pieces, m.row, m.col);
      const isCapture = !!targetP;

      // Keep the visual dot compact, but give every destination a generous
      // hit area. The previous 0.18-radius move dot was only about 10 px wide
      // on mobile and made diagonal advisor moves feel broken.
      const dotGeo = new THREE.CircleGeometry(isCapture ? 0.58 : 0.46, 32);
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.001,
        depthWrite: false,
      });

      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(colToX(m.col), 0.025, rowToZ(m.row));
      dot.userData = { row: m.row, col: m.col };

      const visibleMarker = new THREE.Mesh(
        isCapture ? new THREE.RingGeometry(0.4, 0.54, 32) : new THREE.CircleGeometry(0.18, 24),
        new THREE.MeshBasicMaterial({
          color: isCapture ? 0xef4444 : 0x059669,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isCapture ? 0.82 : 0.9,
          depthTest: false,
          depthWrite: false,
        })
      );
      visibleMarker.position.z = 0.004;
      visibleMarker.renderOrder = 14;
      visibleMarker.raycast = () => {};
      dot.add(visibleMarker);
      this.scene.add(dot);
      this.legalMoveDots.push(dot);
    }
    return moves;
  }

  initInteraction() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      if (!this.isInteractable || !this.state) return;

      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      // 检查点击的可走点标记
      const dotIntersects = this.raycaster.intersectObjects(this.legalMoveDots);
      if (dotIntersects.length > 0 && this.selectedPiece) {
        const target = dotIntersects[0].object.userData;
        if (this.options.onMakeMove) {
          this.options.onMakeMove(this.selectedPiece, target);
        }
        this.clearLegalDots();
        this.selectedPiece = null;
        return;
      }

      // 检查点击的棋子
      const pieceMeshes = Array.from(this.pieceMeshes.values());
      const pieceIntersects = this.raycaster.intersectObjects(pieceMeshes, true);
      if (pieceIntersects.length > 0) {
        let hit = pieceIntersects[0].object;
        while (hit && !hit.userData.pieceId) hit = hit.parent;
        const pieceId = hit?.userData.pieceId;
        const clickedPiece = this.state.pieces.find(p => p.id === pieceId);
        if (clickedPiece && this.selectedPiece && clickedPiece.color !== this.selectedPiece.color) {
          const canCapture = legalMoves(this.state.pieces, this.selectedPiece)
            .some(move => move.row === clickedPiece.row && move.col === clickedPiece.col);
          if (canCapture) {
            if (this.options.onMakeMove) {
              this.options.onMakeMove(this.selectedPiece, { row: clickedPiece.row, col: clickedPiece.col });
            }
            this.clearLegalDots();
            this.selectedPiece = null;
            return;
          }
        }
        if (clickedPiece && clickedPiece.color === this.state.turn) {
          const moves = this.showLegalMoves(clickedPiece);
          if (this.options.onSelectPiece) this.options.onSelectPiece(clickedPiece, moves);
          return;
        }
      }

      // 点击空白区域清空选择
      this.clearLegalDots();
      this.selectedPiece = null;
    });
  }

  animate(now) {
    requestAnimationFrame(this.animate);

    // 移动动画处理
    for (let i = this.animatingPieces.length - 1; i >= 0; i--) {
      const anim = this.animatingPieces[i];
      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);

      // Arc height
      const arc = Math.sin(progress * Math.PI) * 0.45;
      anim.mesh.position.lerpVectors(anim.startPos, anim.targetPos, progress);
      anim.mesh.position.y = 0.13 + arc;

      if (progress >= 1) {
        anim.mesh.position.copy(anim.targetPos);
        this.animatingPieces.splice(i, 1);
      }
    }

    // 粒子动画处理
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const elapsed = now - p.startTime;
      const progress = elapsed / p.duration;

      if (progress >= 1) {
        this.scene.remove(p.system);
        p.system.geometry.dispose();
        p.system.material.dispose();
        this.particles.splice(i, 1);
      } else {
        const positions = p.system.geometry.attributes.position.array;
        for (let j = 0; j < p.velocities.length / 3; j++) {
          positions[j * 3] += p.velocities[j * 3] * 0.016;
          positions[j * 3 + 1] += (p.velocities[j * 3 + 1] - 9.8 * 0.016) * 0.016;
          positions[j * 3 + 2] += p.velocities[j * 3 + 2] * 0.016;
        }
        p.system.geometry.attributes.position.needsUpdate = true;
        p.system.material.opacity = 1 - progress;
      }
    }

    for (let i = this.eventRings.length - 1; i >= 0; i--) {
      const event = this.eventRings[i];
      const progress = Math.min((now - event.startTime) / event.duration, 1);
      event.mesh.scale.setScalar(0.55 + progress * 2.6);
      event.mesh.material.opacity = (1 - progress) * 0.72;
      if (progress >= 1) {
        this.scene.remove(event.mesh);
        event.mesh.geometry.dispose();
        event.mesh.material.dispose();
        this.eventRings.splice(i, 1);
      }
    }

    // 两套棋子各自保留克制的材质响应：玉衡是釉面呼吸，先锋是能源核心与悬浮模块。
    if (!this.options.reducedMotion) {
      for (const mesh of this.pieceMeshes.values()) {
        const phase = mesh.userData.phase || (mesh.userData.phase = Math.random() * Math.PI * 2);
        const breath = 0.5 + 0.5 * Math.sin(now * 0.00135 + phase);
        if (mesh.userData.hero) {
          for (const mat of mesh.userData.energyMaterials || []) {
            mat.emissiveIntensity = (mat.userData.baseEmissive || 0.7) * (0.7 + breath * 0.55);
          }
          for (const floater of mesh.userData.floaters || []) {
            if (floater.userData.floatBase == null) floater.userData.floatBase = floater.position.y;
            floater.position.y = floater.userData.floatBase + Math.sin(now * 0.0012 + phase) * 0.018;
          }
        } else {
          const top = mesh.userData.topMaterial;
          if (top) top.emissiveIntensity = (top.userData.baseEmissive || 0.035) * (0.72 + breath * 0.4);
          const cap = mesh.children.find(child => child.geometry?.type === 'CircleGeometry');
          if (cap?.material) cap.material.opacity = 0.08 + breath * 0.035;
        }
      }
    }

    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.updateCameraPosition();
    this.renderer.setSize(w, h);
  }

  triggerEventPulse(color, kind = 'capture') {
    if (!this.state?.lastMove) return;
    const pos = this.state.lastMove.to;
    const pulseColor = color === RED ? 0xe45d4f : 0x4d72d7;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.5, 40),
      new THREE.MeshBasicMaterial({ color: pulseColor, side: THREE.DoubleSide, transparent: true, opacity: 0.72, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(colToX(pos.col), 0.035, rowToZ(pos.row));
    this.scene.add(ring);
    this.eventRings.push({ mesh: ring, startTime: performance.now(), duration: kind === 'victory' ? 1100 : 720 });
  }
}
