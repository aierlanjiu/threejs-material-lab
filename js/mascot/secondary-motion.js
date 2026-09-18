/**
 * 肢体动作与次级动力学：把二阶弹簧接到资产管线上。
 *
 *   ShaderSpringBinding —— 线上路径。混元单体网格无骨骼，故叶片/抽绳滞后由 GPU 顶点形变实现；
 *     激活权重 aSpring(vec2) 在加载时于 CPU 烘焙成顶点属性。
 *   BoneSpringBinding   —— Blender 骨骼路径。Leaf_Antenna 骨骼存在时用欧拉角叠加驱动。
 *
 * 驱动信号取「可见物体的实际运动学差分」而不是动作名：
 *   跳跃/招手/摇晃/音乐律动/待机呼吸/morph 过渡全部自动覆盖。
 * 离散节拍（起跳/落地）另由 impulse() 叠加，作为物理求解之上的编排层。
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import { Spring2D, KinematicTrack, damp, smoothstep } from './spring.js';

/* ---------------------------------------------------------------------------
 * 区域表（按模型自身局部包围盒归一化）
 * ------------------------------------------------------------------------ */
export const SPRING_REGIONS = {
  hoodie_open: {
    leaf: { pivot: 0.8535, tip: 0.8902 },
    cord: { yBottom: 0.175, yTop: 0.417, zFront: 0.847, xHalf: 0.196, colorGate: true },
  },
  hoodie_closed: { leaf: { pivot: 0.90, tip: 0.965 }, cord: null },
  astro: {
    leaf: { pivot: 0.8913, tip: 0.9284 },
    cord: null,
  },
};

/** 颜色门判断绿色抽绳（避免误伤双手与胸口） */
const CORD_GATE = (r, g, b) => g > r * 0.61 && b < g * 0.58;

/** 采样原始未调色贴图 */
function makeSampler(map) {
  const img = map && map.image;
  if (!img || !img.width || !img.height) return null;
  const w = img.width, h = img.height;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  try { ctx.drawImage(img, 0, 0, w, h); } catch { return null; }
  let data;
  try { data = ctx.getImageData(0, 0, w, h).data; } catch { return null; }
  return (u, v) => {
    const fu = u - Math.floor(u), fv = v - Math.floor(v);
    const px = Math.min(w - 1, Math.max(0, Math.round(fu * (w - 1))));
    const py = Math.min(h - 1, Math.max(0, Math.round(fv * (h - 1))));
    const i = (py * w + px) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
}

/**
 * 把叶片/抽绳权重烘成 vec2 顶点属性（x=leaf, y=cord）。
 */
function bakeSpringAttribute(mesh, region, sourceMap) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  if (!pos) return null;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const hgt = Math.max(1e-6, bb.max.y - bb.min.y);
  const dep = Math.max(1e-6, bb.max.z - bb.min.z);
  const wid = Math.max(1e-6, bb.max.x - bb.min.x);

  const uv = geo.attributes.uv;
  const sampler = region.cord && region.cord.colorGate ? makeSampler(sourceMap) : null;
  const arr = new Float32Array(pos.count * 2);
  let leaf = 0, cord = 0, gated = 0;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const yn = (y - bb.min.y) / hgt;

    if (region.leaf) {
      const w = smoothstep(region.leaf.pivot, region.leaf.tip, yn);
      if (w > 1e-4) { arr[i * 2] = w; leaf++; }
    }
    if (region.cord) {
      const c = region.cord;
      const zn = (z - bb.min.z) / dep, xn = (x - bb.min.x) / wid;
      if (yn > c.yBottom && yn < c.yTop && zn > c.zFront && Math.abs(xn - 0.5) < c.xHalf) {
        let pass = true;
        if (sampler && uv) {
          const [r, g, b] = sampler(uv.getX(i), uv.getY(i));
          pass = CORD_GATE(r, g, b);
        }
        if (pass) { arr[i * 2 + 1] = 1 - smoothstep(c.yBottom, c.yTop, yn); cord++; }
        else gated++;
      }
    }
  }
  geo.setAttribute('aSpring', new THREE.BufferAttribute(arr, 2));
  return { leaf, cord, gated, gateDegraded: !!(region.cord && region.cord.colorGate && !sampler), total: pos.count };
}

/* ---------------------------------------------------------------------------
 * GLSL 注入
 * ------------------------------------------------------------------------ */
const UNIFORM_DECL = `
// LI_SECONDARY_PARS
attribute vec2 aSpring;
uniform vec2  uLeafBend;
uniform vec2  uCordBend;
uniform float uLeafPivotY;
uniform float uCordPivotY;
// LI_SECONDARY_PARS_END
`;

const BEND_FN = `
// LI_SECONDARY_FN
vec3 liRotateDir(vec3 d, vec2 bend, float w) {
  float cx = cos(bend.x * w), sx = sin(bend.x * w);
  float cz = cos(bend.y * w), sz = sin(bend.y * w);
  vec3 r = vec3(d.x, d.y * cx - d.z * sx, d.y * sx + d.z * cx);
  return vec3(r.x * cz - r.y * sz, r.x * sz + r.y * cz, r.z);
}
vec3 liSecondaryPos(vec3 p) {
  if (aSpring.x > 0.0001) {
    vec3 base = vec3(p.x, uLeafPivotY, p.z);
    p = base + liRotateDir(p - base, uLeafBend, aSpring.x);
  }
  if (aSpring.y > 0.0001) {
    vec3 base = vec3(p.x, uCordPivotY, p.z);
    p = base + liRotateDir(p - base, uCordBend, aSpring.y);
  }
  return p;
}
vec3 liSecondaryNrm(vec3 n) {
  if (aSpring.x > 0.0001) n = normalize(liRotateDir(n, uLeafBend, aSpring.x));
  if (aSpring.y > 0.0001) n = normalize(liRotateDir(n, uCordBend, aSpring.y));
  return n;
}
// LI_SECONDARY_FN_END
`;

const CACHE_KEY = 'li-secondary-v1';

function injectUniforms(shader, u) {
  shader.uniforms.uLeafBend = u.leafBend;
  shader.uniforms.uCordBend = u.cordBend;
  shader.uniforms.uLeafPivotY = u.leafPivotY;
  shader.uniforms.uCordPivotY = u.cordPivotY;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + UNIFORM_DECL + '\n' + BEND_FN)
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = liSecondaryNrm(objectNormal);')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = liSecondaryPos(transformed);');
}

export class ShaderSpringBinding {
  constructor(mascot, { regionKey } = {}) {
    this.mascot = mascot;
    this.key = regionKey;
    const region = SPRING_REGIONS[regionKey] || SPRING_REGIONS.hoodie_open;
    this.region = region;

    this.u = {
      leafBend: { value: new THREE.Vector2() },
      cordBend: { value: new THREE.Vector2() },
      leafPivotY: { value: 0 },
      cordPivotY: { value: 0 },
    };

    this.coverage = { leaf: 0, cord: 0, gated: 0, total: 0, gateDegraded: false };
    this._install();
  }

  _install() {
    let leaf = 0, cord = 0, gated = 0, total = 0, gateDegraded = false;

    for (const mesh of this.mascot.meshes) {
      const source = this.mascot.origMaterials?.get(mesh);
      const sourceMap = (Array.isArray(source) ? source[0] : source)?.map || null;
      const r = bakeSpringAttribute(mesh, this.region, sourceMap);
      if (!r) continue;
      leaf += r.leaf; cord += r.cord; gated += r.gated; total += r.total;
      gateDegraded = gateDegraded || r.gateDegraded;

      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      const hgt = bb.max.y - bb.min.y;
      if (this.region.leaf) {
        const v = bb.min.y + hgt * this.region.leaf.pivot;
        if (!Number.isFinite(this.u.leafPivotY.value) || this.u.leafPivotY.value === 0) this.u.leafPivotY.value = v;
      }
      if (this.region.cord) {
        const c = this.region.cord;
        const v = bb.min.y + hgt * (c.yBottom + c.yTop) * 0.5;
        if (this.u.cordPivotY.value === 0) this.u.cordPivotY.value = v;
      }

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m || m.userData.liSpring) continue;
        m.userData.liSpring = true;
        const prevOnBeforeCompile = m.onBeforeCompile;
        const prevCacheKey = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
        m.onBeforeCompile = (shader, renderer) => {
          if (prevOnBeforeCompile) prevOnBeforeCompile(shader, renderer);
          injectUniforms(shader, this.u);
        };
        m.customProgramCacheKey = () => `${prevCacheKey}_${CACHE_KEY}`;
        m.needsUpdate = true;
      }

      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      depth.onBeforeCompile = (shader) => {
        shader.uniforms.uLeafBend = this.u.leafBend;
        shader.uniforms.uCordBend = this.u.cordBend;
        shader.uniforms.uLeafPivotY = this.u.leafPivotY;
        shader.uniforms.uCordPivotY = this.u.cordPivotY;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + UNIFORM_DECL + '\n' + BEND_FN)
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = liSecondaryPos(transformed);');
      };
      depth.customProgramCacheKey = () => `${CACHE_KEY}-depth`;
      mesh.customDepthMaterial = depth;

      if (this.mascot.userData) this.mascot.userData.liSpringBound = true;
    }

    this.coverage = {
      leaf, cord, gated, total, gateDegraded,
      leafRatio: total ? leaf / total : 0,
      cordRatio: total ? cord / total : 0,
      degraded: leaf === 0,
    };
    if (this.coverage.degraded && typeof console !== 'undefined') {
      console.warn('[SecondaryMotion] spring mask 命中为 0，叶片/抽绳不会形变', this.coverage);
    }
  }

  apply(leafBend, cordBend) {
    this.u.leafBend.value.set(leafBend[0], leafBend[1]);
    this.u.cordBend.value.set(cordBend[0], cordBend[1]);
  }
}

/** Blender 骨骼路径：把弹簧二维状态转成绕局部轴的旋转，叠加到骨骼 home 四元数上。 */
// The leaf and hood were split from one sculpture. Their shared rim must keep
// identical Head weights; otherwise even a small spring rotation opens a crack.
function pinLeafRoot(mascot) {
  if (mascot.morphologyKey !== 'hoodie_open') return 0;
  const leaf = mascot.meshes.find(m => m.userData.li_part === 'Leaf_Antenna_Surface');
  const hood = mascot.meshes.find(m => m.userData.li_part === 'Hood_Shell');
  if (!leaf?.isSkinnedMesh || !hood) return 0;
  const pos = leaf.geometry.attributes.position, shell = hood.geometry.attributes.position;
  const key = (p, i) => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(',');
  const shellPoints = new Set(Array.from({ length: shell.count }, (_, i) => key(shell, i)));
  const roots = [], rootIndices = new Set();
  for (let i = 0; i < pos.count; i++) if (shellPoints.has(key(pos, i))) {
    roots.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    rootIndices.add(i);
  }
  const head = leaf.skeleton.bones.indexOf(mascot.bones.Head);
  if (!roots.length || head < 0) return 0;
  const joints = leaf.geometry.attributes.skinIndex, weights = leaf.geometry.attributes.skinWeight;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    let distanceSq = Infinity;
    for (const root of roots) distanceSq = Math.min(distanceSq, p.distanceToSquared(root));
    const flex = rootIndices.has(i) ? 0 : smoothstep(0, 0.20, Math.sqrt(distanceSq));
    const influences = new Map([[head, 1 - flex]]);
    for (let j = 0; j < 4; j++) {
      const bone = joints.getComponent(i, j);
      influences.set(bone, (influences.get(bone) || 0) + weights.getComponent(i, j) * flex);
    }
    const sorted = [...influences].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = sorted.reduce((sum, [, w]) => sum + w, 0);
    for (let j = 0; j < 4; j++) {
      joints.setComponent(i, j, sorted[j]?.[0] ?? head);
      weights.setComponent(i, j, (sorted[j]?.[1] ?? 0) / total);
    }
  }
  joints.needsUpdate = weights.needsUpdate = true;
  return rootIndices.size;
}

export class BoneSpringBinding {
  constructor(mascot) {
    this.mascot = mascot;
    this.leaves = ['Leaf_Antenna_01', 'Leaf_Antenna_02'].map(n => mascot.bones[n]).filter(Boolean);
    if (!this.leaves.length && mascot.bones.Leaf_Antenna) this.leaves.push(mascot.bones.Leaf_Antenna);
    this.cords = ['L', 'R'].flatMap(side => [1, 2, 3].map(i => mascot.bones[`Drawcord_0${i}.${side}`])).filter(Boolean);
    this.coverage = { leaf: this.leaves.length, cord: this.cords.length, leafRootAnchors: pinLeafRoot(mascot), total: this.leaves.length + this.cords.length, degraded: !this.leaves.length };
  }
  apply(leafBend, cordBend, dt) {
    const turn = (bone, x, z) => {
      const h = this.mascot.home.get(bone);
      if (!h) return;
      const q = h.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, 0, z)));
      bone.quaternion.slerp(q, 1 - Math.exp(-12 * dt));
    };
    const leafSwing = this.mascot.role === 'hoodie' ? 0.45 : 1;
    this.leaves.forEach((b, i) => turn(b, leafBend[0] * (0.7 + i * 0.3) * leafSwing, leafBend[1] * (0.7 + i * 0.3) * leafSwing));
    // Cords swing away from the chest; a bounded outward bias prevents backward penetration.
    this.cords.forEach((b, i) => turn(b, -Math.min(0.10, Math.abs(cordBend[0]) * 0.28 + 0.012) * (0.5 + (i % 3) * 0.25), Math.max(-0.035, Math.min(0.035, cordBend[1] * 0.18))));
  }
}

/* ---------------------------------------------------------------------------
 * 编排器
 * ------------------------------------------------------------------------ */
const ACTION_IMPULSES = {
  bounce:        [[0.0, -2.6], [0.0, 1.1]],
  roll:          [[1.8, 0.6]],
  jetpack_boost: [[0.0, -3.2]],
  wave:          [[0.9, 1.6]],
  shake:         [[2.2, 0.0]],
  sway:          [[0.7, 1.9]],
  pop_out:       [[0.0, -2.2]],
  lock_fruit:    [[0.0, 1.6]],
};

export class SecondaryMotion {
  constructor(config = {}) {
    this.leaf = new Spring2D({ stiffness: config.leafStiffness ?? 46, dampingRatio: config.leafZeta ?? 0.13 });
    this.cord = new Spring2D({ stiffness: config.cordStiffness ?? 30, dampingRatio: config.cordZeta ?? 0.19 });
    this.track = new KinematicTrack({ smoothing: config.smoothing ?? 22 });
    this.inertia = config.inertia ?? 0.055;
    this.angular = config.angular ?? 0.085;
    this.maxBend = config.maxBend ?? 0.42;
    this.reducedMotion = false;
    this.binding = null;
    this.lastDrive = [0, 0];
    this._tmp = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }

  bind(mascot) {
    const key = mascot.morphologyKey;
    this.mascot = mascot;
    this.binding = mascot.bones && mascot.bones.Leaf_Antenna
      ? new BoneSpringBinding(mascot)
      : new ShaderSpringBinding(mascot, { regionKey: key });
    return this;
  }

  get coverage() { return this.binding?.coverage || { leaf: 0, cord: 0, total: 0, degraded: true }; }

  impulse(name) {
    const seq = ACTION_IMPULSES[name];
    if (!seq) return this;
    const [a] = seq;
    this.leaf.impulse(a[0] * 1.6, a[1] * 1.6);
    this.cord.impulse(a[0] * 1.1, a[1] * 1.1);
    return this;
  }

  /**
   * @param {number} dt
   * @param {THREE.Object3D} target 可见的 mascot group
   */
  update(dt, target) {
    if (!this.binding || !target) return this.telemetry();
    if (!Number.isFinite(dt) || dt <= 0) return this.telemetry();
    dt = Math.min(dt, 0.05);

    const p = target.position, r = target.rotation;
    this.track.sample(p.x, p.y, p.z, r.x, r.y, r.z, dt);

    this._q.copy(target.quaternion).invert();
    const toLocal = (a0, a1, a2) => this._tmp.set(a0, a1, a2).applyQuaternion(this._q);
    const aL = toLocal(this.track.a[0], this.track.a[1], this.track.a[2]).clone();
    const aa = toLocal(this.track.aa[0], this.track.aa[1], this.track.aa[2]).clone();
    const av = toLocal(this.track.av[0], this.track.av[1], this.track.av[2]).clone();

    let dx = this.inertia * aL.z - this.angular * aa.x;
    let dz = -this.inertia * aL.x - this.angular * aa.z;
    dz += -0.02 * av.x * Math.abs(av.y);
    dx += 0.02 * av.z * Math.abs(av.y);

    if (this.reducedMotion) {
      this.leaf.rest = [0, 0]; this.cord.rest = [0, 0];
      dx = 0; dz = 0;
      this.leaf.x = damp(this.leaf.x, 0, 18, dt); this.leaf.z = damp(this.leaf.z, 0, 18, dt);
      this.cord.x = damp(this.cord.x, 0, 18, dt); this.cord.z = damp(this.cord.z, 0, 18, dt);
      this.leaf.vx = this.leaf.vz = this.cord.vx = this.cord.vz = 0;
    } else {
      this.leaf.step(dx, dz, dt);
      this.cord.step(dx * 0.85, dz * 0.85, dt);
    }
    this.lastDrive = [dx, dz];

    const clampB = (v) => Math.max(-this.maxBend, Math.min(this.maxBend, v));
    const leafBend = [clampB(this.leaf.x), clampB(this.leaf.z)];
    const cordBend = [clampB(this.cord.x), clampB(this.cord.z)];

    if (this.binding instanceof BoneSpringBinding) this.binding.apply(leafBend, cordBend, dt);
    else this.binding.apply(leafBend, cordBend);

    return this.telemetry();
  }

  telemetry() {
    return {
      leaf: { x: this.leaf.x, z: this.leaf.z, vx: this.leaf.vx, vz: this.leaf.vz, omega: this.leaf.omega, zeta: this.leaf.zetaActual },
      cord: { x: this.cord.x, z: this.cord.z, vx: this.cord.vx, vz: this.cord.vz, omega: this.cord.omega, zeta: this.cord.zetaActual },
      drive: this.lastDrive,
      coverage: this.coverage,
      reducedMotion: this.reducedMotion,
    };
  }
}

export const __selftest = { bakeSpringAttribute, CORD_GATE, CACHE_KEY };
