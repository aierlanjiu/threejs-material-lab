/**
 * 荔 / LI · 场景级粒子特效系统 (Scene VFX Engine)
 * 专为 3D 摄影棚台面交互设计：包含起跳烟雾环、重力砸地扬尘冲击波、地表翻滚摩擦轨迹云与喷气尾焰。
 * 针对浅色米宣纸摄影棚背景深度调色：具备体积感明暗质感、大尺度外炸气浪与动漫风冲击波环。
 * 纯程序化 Canvas 烘焙，恒定 60 FPS 对象池复用。
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';

// ---------------------------------------------------------------------------
// 1. 程序化柔和烟尘与光环纹理生成器 (Procedural Textures)
// ---------------------------------------------------------------------------
function createPuffTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // 具有高对比度与体积阴影的工坊级烟雾粒子（深浅双球叠加）
  // 主气团高光与阴影
  const grad = ctx.createRadialGradient(56, 52, 6, 64, 64, 58);
  grad.addColorStop(0, 'rgba(255, 250, 245, 0.98)');
  grad.addColorStop(0.28, 'rgba(240, 226, 212, 0.92)');
  grad.addColorStop(0.55, 'rgba(215, 192, 175, 0.80)');
  grad.addColorStop(0.78, 'rgba(185, 160, 142, 0.45)');
  grad.addColorStop(1, 'rgba(165, 140, 122, 0.00)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();

  // 次级絮状边缘高光
  const subGrad = ctx.createRadialGradient(42, 40, 2, 44, 42, 28);
  subGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  subGrad.addColorStop(0.7, 'rgba(255, 245, 235, 0.25)');
  subGrad.addColorStop(1, 'rgba(255, 245, 235, 0)');
  ctx.fillStyle = subGrad;
  ctx.beginPath();
  ctx.arc(44, 42, 28, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createRingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // 外围扩散冲击波环
  const grad = ctx.createRadialGradient(128, 128, 75, 128, 128, 122);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.25, 'rgba(255, 230, 205, 0.95)');
  grad.addColorStop(0.55, 'rgba(240, 185, 150, 0.85)');
  grad.addColorStop(0.85, 'rgba(210, 150, 115, 0.40)');
  grad.addColorStop(1, 'rgba(180, 120, 90, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();

  // 放射状气浪刻线（Anime Shockwave Spikes）
  ctx.strokeStyle = 'rgba(255, 245, 235, 0.75)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r1 = 85 + (i % 2) * 10;
    const r2 = 120;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
    ctx.lineTo(128 + Math.cos(a) * r2, 128 + Math.sin(a) * r2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSparkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(255, 205, 130, 0.95)');
  grad.addColorStop(0.70, 'rgba(255, 110, 45, 0.65)');
  grad.addColorStop(1, 'rgba(255, 60, 20, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// 2. 粒子类 (VFXParticle)
// ---------------------------------------------------------------------------
class VFXParticle {
  constructor(sprite) {
    this.sprite = sprite;
    this.active = false;
    this.life = 0;
    this.maxLife = 1;
    this.velocity = new THREE.Vector3();
    this.gravity = new THREE.Vector3(0, -0.15, 0);
    this.drag = 0.95;
    this.startScale = 0.4;
    this.endScale = 1.6;
    this.startOpacity = 0.95;
    this.endOpacity = 0;
    this.rotSpeed = 0;
  }

  init(options) {
    this.active = true;
    this.life = 0;
    this.maxLife = options.maxLife || 1.1;
    this.sprite.position.copy(options.position);
    this.velocity.copy(options.velocity || new THREE.Vector3());
    this.gravity.copy(options.gravity || new THREE.Vector3(0, -0.05, 0));
    this.drag = options.drag !== undefined ? options.drag : 0.94;
    this.startScale = options.startScale || 0.4;
    this.endScale = options.endScale || 1.6;
    this.startOpacity = options.startOpacity || 0.92;
    this.endOpacity = options.endOpacity !== undefined ? options.endOpacity : 0;
    this.rotSpeed = (Math.random() - 0.5) * (options.rotSpeed || 2.2);

    this.sprite.scale.set(this.startScale, this.startScale, 1);
    this.sprite.material.opacity = this.startOpacity;
    this.sprite.material.rotation = Math.random() * Math.PI * 2;
    if (options.color) {
      this.sprite.material.color.set(options.color);
    } else {
      this.sprite.material.color.set(0xffffff);
    }
    this.sprite.renderOrder = 200;
    this.sprite.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    this.life += dt;
    const progress = Math.min(this.life / this.maxLife, 1.0);

    if (progress >= 1.0) {
      this.active = false;
      this.sprite.visible = false;
      return;
    }

    // 物理积分
    this.velocity.addScaledVector(this.gravity, dt);
    this.velocity.multiplyScalar(Math.pow(this.drag, dt * 60));
    this.sprite.position.addScaledVector(this.velocity, dt);

    // 地面反弹缓冲 (台面 y ≈ 0.05)
    if (this.sprite.position.y < 0.06 && this.velocity.y < 0) {
      this.sprite.position.y = 0.06;
      this.velocity.y *= -0.25;
      this.velocity.x *= 0.85;
      this.velocity.z *= 0.85;
    }

    // 非线性气浪膨胀
    const scaleEase = 1 - Math.pow(1 - progress, 2.5);
    const currentScale = this.startScale + (this.endScale - this.startScale) * scaleEase;
    this.sprite.scale.set(currentScale, currentScale, 1);

    // 渐隐
    const fadeEase = Math.pow(progress, 1.35);
    this.sprite.material.opacity = THREE.MathUtils.lerp(this.startOpacity, this.endOpacity, fadeEase);
    this.sprite.material.rotation += this.rotSpeed * dt;
  }
}

// ---------------------------------------------------------------------------
// 3. 冲击波环类 (VFXShockwaveRing)
// ---------------------------------------------------------------------------
class VFXShockwaveRing {
  constructor(mesh) {
    this.mesh = mesh;
    this.active = false;
    this.life = 0;
    this.maxLife = 0.8;
    this.startRadius = 0.3;
    this.endRadius = 3.6;
    this.startOpacity = 0.95;
  }

  init(options) {
    this.active = true;
    this.life = 0;
    this.maxLife = options.maxLife || 0.85;
    this.startRadius = options.startRadius || 0.4;
    this.endRadius = options.endRadius || 3.8;
    this.startOpacity = options.startOpacity || 0.95;

    this.mesh.position.set(options.x || 0, 0.025, options.z || 0);
    this.mesh.scale.set(this.startRadius, this.startRadius, 1);
    this.mesh.material.opacity = this.startOpacity;
    if (options.color) {
      this.mesh.material.color.set(options.color);
    } else {
      this.mesh.material.color.set(0xffffff);
    }
    this.mesh.renderOrder = 150;
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    this.life += dt;
    const progress = Math.min(this.life / this.maxLife, 1.0);

    if (progress >= 1.0) {
      this.active = false;
      this.mesh.visible = false;
      return;
    }

    // 爆发式急速外展
    const easeOut = 1 - Math.pow(1 - progress, 3.2);
    const radius = this.startRadius + (this.endRadius - this.startRadius) * easeOut;
    this.mesh.scale.set(radius, radius, 1);

    // 渐隐
    const fadeOut = Math.pow(progress, 1.6);
    this.mesh.material.opacity = this.startOpacity * (1.0 - fadeOut);
  }
}

// ---------------------------------------------------------------------------
// 4. 主粒子特效管理器 (MascotVFX)
// ---------------------------------------------------------------------------
export class MascotVFX {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'MascotVFX_Container';
    scene.add(this.group);

    this.puffTexture = createPuffTexture();
    this.ringTexture = createRingTexture();
    this.sparkTexture = createSparkTexture();

    this.puffMaterial = new THREE.SpriteMaterial({
      map: this.puffTexture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending
    });

    this.sparkMaterial = new THREE.SpriteMaterial({
      map: this.sparkTexture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending
    });

    this.ringGeo = new THREE.PlaneGeometry(1, 1);

    this.particlePool = [];
    this.ringPool = [];

    this.initPools(160, 10);
  }

  initPools(particleCount, ringCount) {
    for (let i = 0; i < particleCount; i++) {
      const mat = this.puffMaterial.clone();
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 200;
      sprite.visible = false;
      this.group.add(sprite);
      this.particlePool.push(new VFXParticle(sprite));
    }

    for (let i = 0; i < ringCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.ringTexture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 150;
      mesh.visible = false;
      this.group.add(mesh);
      this.ringPool.push(new VFXShockwaveRing(mesh));
    }
  }

  getParticle() {
    let p = this.particlePool.find(item => !item.active);
    if (!p) {
      const mat = this.puffMaterial.clone();
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 200;
      this.group.add(sprite);
      p = new VFXParticle(sprite);
      this.particlePool.push(p);
    }
    return p;
  }

  getRing() {
    let r = this.ringPool.find(item => !item.active);
    if (!r) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.ringTexture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 150;
      this.group.add(mesh);
      r = new VFXShockwaveRing(mesh);
      this.ringPool.push(r);
    }
    return r;
  }

  /**
   * 1. 起跳爆发烟雾环 (Launch Smoke Ring & Outward Puffs)
   * 伴随月球大跳跃起瞬间，在地面炸开 3.8 米冲击波环与向外翻滚的浓郁烟云
   */
  spawnLaunchRing(x = 0, z = 0, intensity = 1.0) {
    const ring = this.getRing();
    ring.init({
      x, z,
      startRadius: 0.5 * intensity,
      endRadius: 4.2 * intensity,
      startOpacity: 0.95,
      maxLife: 0.90,
      color: 0xffffff
    });

    const puffCount = Math.floor(22 * intensity);
    for (let i = 0; i < puffCount; i++) {
      const angle = (i / puffCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const speed = (1.6 + Math.random() * 1.4) * intensity;
      const vx = Math.cos(angle) * speed;
      const vz = Math.sin(angle) * speed;
      const vy = 0.15 + Math.random() * 0.35;

      const p = this.getParticle();
      p.sprite.material.map = this.puffTexture;
      p.sprite.material.blending = THREE.NormalBlending;
      p.init({
        position: new THREE.Vector3(x + Math.cos(angle) * 0.25, 0.12, z + Math.sin(angle) * 0.25),
        velocity: new THREE.Vector3(vx, vy, vz),
        gravity: new THREE.Vector3(0, -0.06, 0),
        drag: 0.90,
        startScale: 0.45 * intensity,
        endScale: (1.5 + Math.random() * 0.6) * intensity,
        startOpacity: 0.95,
        endOpacity: 0.0,
        maxLife: 1.05 + Math.random() * 0.4,
        color: Math.random() > 0.4 ? 0xfff8f0 : 0xf2e2d0
      });
    }
  }

  /**
   * 2. 重力着陆冲击波扬尘 (Landing Impact Burst)
   * 从视口高空急坠砸地瞬间，激发两道超大地表冲击波与环形灰尘巨浪
   */
  spawnImpactBurst(x = 0, z = 0, intensity = 1.0) {
    const r1 = this.getRing();
    r1.init({
      x, z,
      startRadius: 0.4,
      endRadius: 4.8 * intensity,
      startOpacity: 0.98,
      maxLife: 0.75,
      color: 0xffffff
    });

    const r2 = this.getRing();
    r2.init({
      x, z,
      startRadius: 0.2,
      endRadius: 2.8 * intensity,
      startOpacity: 0.85,
      maxLife: 0.55,
      color: 0xffeedd
    });

    const count = Math.floor(26 * intensity);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = (2.2 + Math.random() * 2.2) * intensity;
      const p = this.getParticle();
      p.sprite.material.map = this.puffTexture;
      p.sprite.material.blending = THREE.NormalBlending;
      p.init({
        position: new THREE.Vector3(x + Math.cos(angle) * 0.15, 0.10, z + Math.sin(angle) * 0.15),
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 0.25 + Math.random() * 0.45, Math.sin(angle) * speed),
        gravity: new THREE.Vector3(0, -0.22, 0),
        drag: 0.87,
        startScale: 0.50 * intensity,
        endScale: (1.8 + Math.random() * 0.8) * intensity,
        startOpacity: 0.95,
        endOpacity: 0,
        maxLife: 0.90 + Math.random() * 0.4,
        color: Math.random() > 0.5 ? 0xfff6ea : 0xedd6c2
      });
    }
  }

  /**
   * 3. 地面翻滚摩擦扬尘 (Ground Roll Contact Dust)
   * 沿台面翻滚时沿途拖出显眼的蓬松烟尘团
   */
  spawnRollDust(x = 0, y = 0.12, z = 0, velocityX = 0) {
    const puffCount = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < puffCount; i++) {
      const p = this.getParticle();
      p.sprite.material.map = this.puffTexture;
      p.sprite.material.blending = THREE.NormalBlending;

      const vx = -velocityX * 0.35 + (Math.random() - 0.5) * 0.6;
      const vy = 0.18 + Math.random() * 0.28;
      const vz = (Math.random() - 0.5) * 0.6;

      p.init({
        position: new THREE.Vector3(x + (Math.random() - 0.5) * 0.2, Math.max(0.08, y), z + (Math.random() - 0.5) * 0.2),
        velocity: new THREE.Vector3(vx, vy, vz),
        gravity: new THREE.Vector3(0, -0.08, 0),
        drag: 0.90,
        startScale: 0.35 + Math.random() * 0.15,
        endScale: 0.95 + Math.random() * 0.45,
        startOpacity: 0.88,
        endOpacity: 0,
        maxLife: 0.75 + Math.random() * 0.3,
        color: 0xede0ce
      });
    }
  }

  /**
   * 4. 背包助推喷气火焰 (Jetpack Thruster Stream)
   */
  spawnJetpackThrust(x = 0, y = 1.0, z = 0, dirX = 0, dirY = -1, dirZ = 0) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const p = this.getParticle();
      p.sprite.material.map = Math.random() > 0.4 ? this.sparkTexture : this.puffTexture;
      p.sprite.material.blending = THREE.AdditiveBlending;

      const spread = 0.35;
      const vx = dirX * 2.2 + (Math.random() - 0.5) * spread;
      const vy = dirY * 2.2 + (Math.random() - 0.5) * spread;
      const vz = dirZ * 2.2 + (Math.random() - 0.5) * spread;

      p.init({
        position: new THREE.Vector3(x + (Math.random() - 0.5) * 0.15, y, z + (Math.random() - 0.5) * 0.15),
        velocity: new THREE.Vector3(vx, vy, vz),
        gravity: new THREE.Vector3(0, -0.15, 0),
        drag: 0.92,
        startScale: 0.25,
        endScale: 0.65,
        startOpacity: 0.98,
        endOpacity: 0,
        maxLife: 0.50 + Math.random() * 0.2,
        color: Math.random() > 0.5 ? 0xffbb44 : 0xff6622
      });
    }
  }

  /**
   * 5. 失重星尘微光 (Zero-G Stardust)
   */
  spawnStardust(x = 0, y = 1.5, z = 0) {
    if (Math.random() > 0.40) return;
    const p = this.getParticle();
    p.sprite.material.map = this.sparkTexture;
    p.sprite.material.blending = THREE.AdditiveBlending;

    p.init({
      position: new THREE.Vector3(
        x + (Math.random() - 0.5) * 2.0,
        y + (Math.random() - 0.5) * 1.5,
        z + (Math.random() - 0.5) * 2.0
      ),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12),
      gravity: new THREE.Vector3(0, 0, 0),
      drag: 0.99,
      startScale: 0.10,
      endScale: 0.35,
      startOpacity: 0.92,
      endOpacity: 0,
      maxLife: 1.4 + Math.random() * 0.6,
      color: 0x88ddff
    });
  }

  update(dt) {
    for (let i = 0; i < this.particlePool.length; i++) {
      if (this.particlePool[i].active) {
        this.particlePool[i].update(dt);
      }
    }
    for (let i = 0; i < this.ringPool.length; i++) {
      if (this.ringPool[i].active) {
        this.ringPool[i].update(dt);
      }
    }
  }

  dispose() {
    this.group.clear();
    if (this.scene) this.scene.remove(this.group);
    this.puffTexture.dispose();
    this.ringTexture.dispose();
    this.sparkTexture.dispose();
  }
}
