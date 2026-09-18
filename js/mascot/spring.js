/**
 * 二阶质点弹簧阻尼求解器 (Second-Order Mass-Spring-Damper)
 * 纯数学模块：不依赖 Three.js，可确定性复现与单测。
 *
 *   θ'' = ( −k·(θ − θeq) − c·θ' ) / m + drive
 *   c   = 2ζ√(km)     ζ<1 欠阻尼 → 有惯性滞后与回弹；ζ=1 临界阻尼
 *
 * 积分：半隐式（先速度后位置）+ 固定 1/120s 子步，防止大帧间隔下振铃或发散。
 */

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** 与 fidelity-kit 同款的帧率无关指数阻尼 */
export const damp = (a, b, speed, dt) => a + (b - a) * (1 - Math.exp(-speed * dt));

/** 升沿 smoothstep（GLSL 语义） */
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-9), 0, 1);
  return t * t * (3 - 2 * t);
};

const SUBSTEP = 1 / 120;
const MAX_SUBSTEPS = 8;

export class Spring2D {
  constructor({ stiffness = 46, dampingRatio = 0.13, mass = 1, rest = [0, 0] } = {}) {
    this.k = stiffness;
    this.zeta = dampingRatio;
    this.m = Math.max(mass, 1e-6);
    this.rest = [rest[0], rest[1]];
    this.x = rest[0]; this.z = rest[1];
    this.vx = 0; this.vz = 0;
    this.substeps = 0;
  }
  get damping() { return 2 * this.zeta * Math.sqrt(this.k * this.m); }
  get omega() { return Math.sqrt(this.k / this.m); }
  get zetaActual() { return this.damping / (2 * Math.sqrt(this.k * this.m)); }

  reset(x = this.rest[0], z = this.rest[1]) {
    this.x = x; this.z = z; this.vx = 0; this.vz = 0;
    return this;
  }
  /** 速度脉冲（起跳/落地等瞬时冲量） */
  impulse(vx = 0, vz = 0) { this.vx += vx; this.vz += vz; return this; }

  /**
   * @param {number} dx 驱动加速度 X
   * @param {number} dz 驱动加速度 Z
   * @param {number} dt 帧步长（秒）
   */
  step(dx, dz, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return this;
    const c = this.damping, inv = 1 / this.m;
    const rx = this.rest[0], rz = this.rest[1];
    let remaining = Math.min(dt, MAX_SUBSTEPS * SUBSTEP);
    this.substeps = 0;
    while (remaining > 1e-6) {
      const h = Math.min(SUBSTEP, remaining);
      remaining -= h;
      this.vx += (-this.k * (this.x - rx) - c * this.vx) * inv * h + dx * h;
      this.vz += (-this.k * (this.z - rz) - c * this.vz) * inv * h + dz * h;
      if (!Number.isFinite(this.vx) || !Number.isFinite(this.vz)) { this.reset(rx, rz); break; }
      this.x += this.vx * h;
      this.z += this.vz * h;
      this.substeps++;
    }
    return this;
  }
}

const shortestAngle = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/**
 * 有限差分运动学：平滑位置与欧拉角的一阶速度与二阶加速度。
 */
export class KinematicTrack {
  constructor({ smoothing = 22 } = {}) {
    this.speed = smoothing;
    this.have = false;
    this.p = [0, 0, 0]; this.r = [0, 0, 0];
    this.v = [0, 0, 0]; this.a = [0, 0, 0];
    this.av = [0, 0, 0]; this.aa = [0, 0, 0];
  }
  sample(px, py, pz, rx, ry, rz, dt) {
    if (!Number.isFinite(dt) || dt <= 1e-6) return this;
    if (!this.have) {
      this.p = [px, py, pz]; this.r = [rx, ry, rz]; this.have = true;
      return this;
    }
    const h = dt;
    const np = [px, py, pz], nr = [rx, ry, rz];
    const nv = [0, 0, 0], nav = [0, 0, 0];
    for (let i = 0; i < 3; i++) nv[i] = (np[i] - this.p[i]) / h;
    for (let i = 0; i < 3; i++) nav[i] = shortestAngle(this.r[i], nr[i]) / h;

    const na = [0, 0, 0], naa = [0, 0, 0];
    for (let i = 0; i < 3; i++) { na[i] = (nv[i] - this.v[i]) / h; naa[i] = (nav[i] - this.av[i]) / h; }

    const w = 1 - Math.exp(-this.speed * h);
    for (let i = 0; i < 3; i++) {
      this.v[i] += (nv[i] - this.v[i]) * w;
      this.av[i] += (nav[i] - this.av[i]) * w;
      this.a[i] += (na[i] - this.a[i]) * w;
      this.aa[i] += (naa[i] - this.aa[i]) * w;
    }
    this.p = np; this.r = nr;
    return this;
  }
}
