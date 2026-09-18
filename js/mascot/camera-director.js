/**
 * 『律』LÜ 移植：FOV 视角律动与镜头编排。
 * 纯数学模块：只操作「相机接口」(fov/aspect/position/updateProjectionMatrix)，
 * 4 模态：bass 低音脉冲 / dolly 希区柯克（含 tan 反向补偿） / sine 慢呼吸 / snap 节拍瞬切
 */
import { damp, smoothstep } from './spring.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const DEG = Math.PI / 180;

/**
 * 较紧轴的等效半角正切。
 */
export const tightHalfTan = (fov, aspect) => Math.tan(fov * DEG * 0.5) * Math.min(1, aspect);

/**
 * 保持主体构图不缩放所需的距离比 d1/d0。
 *   H = 2·d·tan(fov/2)  ⇒  令占比 h/H 不变：d1·t(fov1) = d0·t(fov0)
 */
export const framingScale = (fov, baseFov, aspect) =>
  tightHalfTan(baseFov, aspect) / tightHalfTan(fov, aspect);

export const DEFAULT_DIRECTOR_CONFIG = {
  baseFov: 28,
  fovRange: [16, 62],
  dollyRange: [0.55, 1.9],
  bass:  { depth: 2.8, midLift: 0.8, rate: 12 },
  dolly: { depth: 9.0, rate: 5.5 },
  sine:  { amplitude: 1.9, period: 8.0, harmonic: 0.35, rate: 1.6 },
  snap:  { depth: 7.0, release: 9.0 },
  drift: {
    rates: [0.09, 0.021, 0.05],                          // 3 频不可通约呼吸
    phases: [0, 1.7, 2.6, 4.1],
    yawGain: [0.012, 0.006], elevGain: 0.010, radiusGain: 0.008, // 微幅柔和呼吸，绝不在 3/4 视角打转
    rate: 1.2,
    idleDelay: 4000,
    baseRadiusGain: 0.0,
  },
};

export class CameraDirector {
  constructor(config = {}) {
    const d = DEFAULT_DIRECTOR_CONFIG;
    this.cfg = {
      ...d, ...config,
      bass: { ...d.bass, ...config.bass },
      dolly: { ...d.dolly, ...config.dolly },
      sine: { ...d.sine, ...config.sine },
      snap: { ...d.snap, ...config.snap },
      drift: { ...d.drift, ...config.drift },
    };
    this.mode = 'off';
    this.prevMode = 'off';
    this.blend = 1;
    this.blendRate = 0;
    this.fov = this.cfg.baseFov;
    this.distanceScale = 1;
    this.reducedMotion = false;

    this.fitDistance = 6;
    this.target = [0, 0, 0];
    this.aspect = 1;
    this.baseYaw = 0;
    this.baseElev = 0;
    this.hasAnchor = false;

    this.rhythm = { bass: 0, mid: 0, treble: 0, beatPulse: 0, beatPhase: 1, isPlaying: false };
    this.idleSince = 0;
    this.interacting = false;
    this.driftActive = false;
    this.engaged = false;
    this._lastBeatPhase = 1;
    this._drift = { yaw: 0, elev: 0, radius: 0 };
  }

  setMode(mode, { blend = 0.6 } = {}) {
    if (mode === this.mode) return this;
    this.prevMode = this.mode;
    this.mode = mode;
    if (blend > 0 && this.prevMode !== 'off') {
      this.blend = 0;
      this.blendRate = 1 / blend;
    } else {
      this.blend = 1; this.blendRate = 0;
    }
    return this;
  }

  setRhythm(r) { Object.assign(this.rhythm, r); return this; }
  setReducedMotion(v) { this.reducedMotion = !!v; return this; }
  setViewport(aspect) { this.aspect = aspect > 0 ? aspect : 1; return this; }

  anchorView(direction) {
    if (direction) {
      const len = Math.hypot(direction[0], direction[1], direction[2]) || 1;
      this.baseYaw = Math.atan2(direction[0] / len, direction[2] / len);
      this.baseElev = Math.asin(clamp(direction[1] / len, -1, 1));
      this.hasAnchor = true;
      this._drift.yaw = 0;
      this._drift.elev = 0;
      this._drift.radius = 0;
    }
    return this;
  }

  setFit({ distance, target, direction }) {
    if (Number.isFinite(distance)) this.fitDistance = distance;
    if (target) this.target = [target[0], target[1], target[2]];
    if (direction && (!this.hasAnchor || this.interacting)) {
      const len = Math.hypot(direction[0], direction[1], direction[2]) || 1;
      this.baseYaw = Math.atan2(direction[0] / len, direction[2] / len);
      this.baseElev = Math.asin(clamp(direction[1] / len, -1, 1));
      this.hasAnchor = true;
    }
    return this;
  }

  _target(time, mode) {
    const c = this.cfg, r = this.rhythm, base = c.baseFov;
    switch (mode) {
      case 'bass': {
        const amp = r.isPlaying ? r.bass : 0;
        return { fov: base - amp * c.bass.depth + (r.isPlaying ? r.mid : 0) * c.bass.midLift, rate: c.bass.rate, instant: false };
      }
      case 'dolly': {
        const amp = r.isPlaying ? r.bass * 0.5 + r.mid * 0.5 : 0;
        const env = 0.5 - 0.5 * Math.cos(time * 0.7);
        return { fov: base - (0.35 + env * 0.65) * c.dolly.depth * (r.isPlaying ? Math.max(0.35, amp) : 1), rate: c.dolly.rate, instant: false };
      }
      case 'sine': {
        const w = (Math.PI * 2) / c.sine.period;
        const s = Math.sin(time * w) + c.sine.harmonic * Math.sin(time * w * 2.7 + 1.1);
        return { fov: base + c.sine.amplitude * s / (1 + c.sine.harmonic), rate: c.sine.rate, instant: false };
      }
      case 'snap': {
        const newBeat = r.isPlaying && r.beatPhase < this._lastBeatPhase;
        if (newBeat) return { fov: base - c.snap.depth * Math.max(0.35, r.beatPulse), rate: 0, instant: true };
        return { fov: base, rate: c.snap.release, instant: false };
      }
      default:
        return { fov: base, rate: 4, instant: false };
    }
  }

  _driftPhases(time) {
    const d = this.cfg.drift, [r0, r1, r2] = d.rates, [p0, p1, p2, p3] = d.phases;
    return {
      yaw: d.yawGain[0] * Math.sin(time * r0 + p0) + d.yawGain[1] * Math.sin(time * r1 + p1),
      elev: d.elevGain * Math.sin(time * r2 + p2),
      radius: d.radiusGain * Math.sin(time * r1 + p3),
    };
  }

  update(dt, time, cam) {
    const c = this.cfg;
    if (!Number.isFinite(dt) || dt <= 0) return this.telemetry();
    this._lastBeatPhase = this.rhythm.isPlaying ? this.rhythm.beatPhase : 1;

    const off = this.reducedMotion;
    const mode = off ? 'off' : this.mode;

    // A. FOV
    const cur = this._target(time, mode);
    let want = cur.fov;
    if (!cur.instant && this.blend < 1 && this.prevMode !== mode) {
      const prev = this._target(time, this.prevMode);
      want = prev.fov + (cur.fov - prev.fov) * smoothstep(0, 1, this.blend);
    }
    if (this.blend < 1) this.blend = Math.min(1, this.blend + this.blendRate * dt);

    const [lo, hi] = c.fovRange;
    want = clamp(want, lo, hi);
    this.fov = (cur.instant && this.blend >= 1) ? want : damp(this.fov, want, cur.rate, dt);
    this.fov = clamp(this.fov, lo, hi);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();

    // B. 距离反向 tan 补偿
    const wantScale = (mode === 'dolly' && !off)
      ? clamp(framingScale(this.fov, c.baseFov, this.aspect), c.dollyRange[0], c.dollyRange[1])
      : 1;
    this.distanceScale = damp(this.distanceScale, wantScale, 6, dt);

    // C. 3 频漂移
    const idleFor = performance.now() - this.idleSince;
    this.driftActive = !off
      && !this.interacting
      && idleFor > c.drift.idleDelay
      && mode !== 'off';
    const ph = this._driftPhases(time);
    const k = 1 - Math.exp(-c.drift.rate * dt);
    if (this.driftActive) {
      this._drift.yaw += (ph.yaw - this._drift.yaw) * k;
      this._drift.elev += (ph.elev - this._drift.elev) * k;
      this._drift.radius += (ph.radius - this._drift.radius) * k;
    } else {
      this._drift.yaw = damp(this._drift.yaw, 0, c.drift.rate, dt);
      this._drift.elev = damp(this._drift.elev, 0, c.drift.rate, dt);
      this._drift.radius = damp(this._drift.radius, 0, c.drift.rate, dt);
    }

    // D. 统一落位
    const takeDistance = Math.abs(this.distanceScale - 1) > 1e-3 || this.driftActive
      || Math.abs(this._drift.radius) > 1e-4;
    const p = cam.position;
    if (this.driftActive && this.hasAnchor) {
      const yaw = this.baseYaw + this._drift.yaw;
      const elev = clamp(this.baseElev + this._drift.elev, -1.35, 1.35);
      const wantLen = Math.max(0.05, this.fitDistance * this.distanceScale * (1 + this._drift.radius));
      const rad = Math.cos(elev) * wantLen;
      p.x = this.target[0] + rad * Math.sin(yaw);
      p.y = this.target[1] + wantLen * Math.sin(elev);
      p.z = this.target[2] + rad * Math.cos(yaw);
    } else if (takeDistance) {
      let ox = p.x - this.target[0], oy = p.y - this.target[1], oz = p.z - this.target[2];
      const curLen = Math.hypot(ox, oy, oz) || 1e-6;
      const wantLen = Math.max(0.05, this.fitDistance * this.distanceScale * (1 + this._drift.radius));
      const s = wantLen / curLen;
      p.x = this.target[0] + ox * s;
      p.y = this.target[1] + oy * s;
      p.z = this.target[2] + oz * s;
    }
    this.engaged = takeDistance;
    return this.telemetry();
  }

  telemetry() {
    return {
      mode: this.mode, prevMode: this.prevMode, blend: this.blend,
      fov: this.fov, distanceScale: this.distanceScale,
      driftActive: this.driftActive, engaged: this.engaged,
      drift: { ...this._drift },
    };
  }
}
