import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import { RoundedBoxGeometry } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/geometries/RoundedBoxGeometry.js/+esm';

// Shared, deterministic assets. No textures or geometry are allocated by update().
const textures = new Map();
const TAU = Math.PI * 2;
export const damp = (a, b, speed, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-speed * dt));
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Reference plate colours (design_sheets/scheme_a_hoodie/04_macro_joint.png CMF table). */
export const PALETTE = {
  rind: 0xd94a57, rindDeep: 0x9f2f3d, rindTip: 0xf4777c, shadowRed: 0xa03a44,
  blush: 0xf5d7d9, flesh: 0xfff8f0, lining: 0xfdf2e2, stem: 0x8ab84a,
  leaf: 0x6faf3e, bootRed: 0xbd3b48, sole: 0xead9be, cord: 0x75923c, aglet: 0x9c6b45,
};

export function surfaceTexture(kind = 'grain') {
  if (textures.has(kind)) return textures.get(kind);
  const n = 256, height = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n, v = y / n;
    const i = y * n + x;
    if (kind === 'tubercle') {
      // Radial spoke crown of a lychee tubercle: ridges from a raised centre to the rim.
      const dx = (u - .5) * 2, dy = (v - .5) * 2, d = Math.hypot(dx, dy);
      const spokes = Math.pow(Math.abs(Math.cos(Math.atan2(dy, dx) * 7)), .75);
      height[i] = Math.max(0, 1 - d * .55) * .55 + spokes * .34 * (1 - Math.min(1, d)) + hash(i) * .035;
    } else if (kind === 'corduroy') {
      height[i] = Math.pow(.5 + .5 * Math.cos(u * TAU * 32), 1.5) * .8 + hash(i) * .07;
    } else if (kind === 'brushed') {
      height[i] = .45 + .11 * Math.sin(v * TAU * 64) + .04 * hash(i);
    } else {
      height[i] = .5 + .10 * hash(i) + .025 * Math.sin(u * TAU * 17) * Math.sin(v * TAU * 13);
    }
  }
  const normal = new Uint8Array(n * n * 4), rough = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, dx = height[y * n + (x + 1) % n] - height[y * n + (x + n - 1) % n];
    const dy = height[((y + 1) % n) * n + x] - height[((y + n - 1) % n) * n + x];
    const v = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
    normal.set([(v.x * .5 + .5) * 255, (v.y * .5 + .5) * 255, v.z * 127 + 128, 255], i * 4);
    const r = 195 + height[i] * 50;
    rough.set([r, r, r, 255], i * 4);
  }
  const make = data => {
    const t = new THREE.DataTexture(data, n, n); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true; t.repeat.set(3, 2); return t;
  };
  const result = { normal: make(normal), roughness: make(rough) }; textures.set(kind, result); return result;
}

export function materialSet() {
  const grain = surfaceTexture('grain'), tubercle = surfaceTexture('tubercle');
  const materials = {
    // Glossy candy silicone rind; per-tubercle vertex tints ride on top of this base.
    shell: new THREE.MeshPhysicalMaterial({ color: PALETTE.rind, roughness: .40, metalness: 0,
      normalMap: tubercle.normal, normalScale: new THREE.Vector2(.26, .26), roughnessMap: tubercle.roughness,
      clearcoat: .30, clearcoatRoughness: .27, sheen: .20, sheenColor: new THREE.Color(PALETTE.rindTip),
      specularIntensity: 1, vertexColors: false }),
    // Milky white lychee flesh: dense, softly waxy, warm light bleeding through the rim.
    flesh: new THREE.MeshPhysicalMaterial({ color: PALETTE.flesh, roughness: .17, metalness: 0,
      transmission: 0, thickness: .55, attenuationColor: new THREE.Color(0xffd9c4),
      attenuationDistance: 1.1, ior: 1.44, clearcoat: .72, clearcoatRoughness: .13,
      sheen: .35, sheenColor: new THREE.Color(0xffe6d4),
      emissive: new THREE.Color(0x4a2a1e), emissiveIntensity: .07 }),
    lining: new THREE.MeshStandardMaterial({ color: PALETTE.lining, roughness: .58 }),
    leaf: new THREE.MeshPhysicalMaterial({ color: PALETTE.leaf, roughness: .34, clearcoat: .45, clearcoatRoughness: .2, side: THREE.DoubleSide }),
    stem: new THREE.MeshStandardMaterial({ color: 0x8b6a45, roughness: .62, normalMap: grain.normal, normalScale: new THREE.Vector2(.25, .25) }),
    cord: new THREE.MeshPhysicalMaterial({ color: PALETTE.cord, roughness: .46, clearcoat: .42, clearcoatRoughness: .24, normalMap: surfaceTexture('corduroy').normal, normalScale: new THREE.Vector2(.16, .16) }),
    boots: new THREE.MeshPhysicalMaterial({ color: PALETTE.bootRed, roughness: .19, clearcoat: .95, clearcoatRoughness: .07 }),
    sole: new THREE.MeshPhysicalMaterial({ color: PALETTE.sole, roughness: .5, clearcoat: .3, clearcoatRoughness: .35 }),
    metal: new THREE.MeshPhysicalMaterial({ color: PALETTE.sole, metalness: .55, roughness: .28, clearcoat: .6, clearcoatRoughness: .18 }),
    gold: new THREE.MeshPhysicalMaterial({ color: 0xd5b77b, metalness: .92, roughness: .29 }),
    seal: new THREE.MeshStandardMaterial({ color: PALETTE.shadowRed, roughness: .6 }),
  };
  // A wrapped diffuse approximation keeps jade milky rather than optically clear.
  materials.flesh.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      float jadeRim = pow(1.0 - saturate(dot(normal, geometryViewDir)), 2.2);
      reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.26, 0.15, 0.075) * jadeRim;
    `);
  };
  materials.flesh.customProgramCacheKey = () => 'li-milky-jade-v2';
  return materials;
}

function mergeGeometries(geometries) {
  const result = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const size = name === 'uv' ? 2 : 3;
    if (geometries.some(g => !g.getAttribute(name))) return null;
    const length = geometries.reduce((n, g) => n + g.getAttribute(name).array.length, 0);
    const array = new Float32Array(length); let offset = 0;
    for (const g of geometries) { const attr = g.getAttribute(name); array.set(attr.array, offset); offset += attr.array.length; }
    result.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  result.computeBoundingSphere(); return result;
}

// Merge static details per material while preserving independently animated groups.
export function batchStaticParts(parent, excluded = []) {
  parent.updateWorldMatrix(true, true);
  const inverse = parent.matrixWorld.clone().invert(), buckets = new Map();
  const visit = node => {
    if (excluded.includes(node) || node.isInstancedMesh) return;
    if (node.isMesh && !Array.isArray(node.material)) {
      const key = `${node.material.uuid}:${node.castShadow}:${node.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(node);
    }
    node.children.forEach(visit);
  };
  parent.children.forEach(visit);
  for (const nodes of buckets.values()) {
    // Do not absorb a transform that parents another independently rendered mesh.
    const leaves = nodes.filter(n => n.children.length === 0);
    if (leaves.length < 2) continue;
    const geometries = leaves.map(n => {
      const g = n.geometry.index ? n.geometry.toNonIndexed() : n.geometry.clone();
      return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, n.matrixWorld));
    });
    const merged = mergeGeometries(geometries, false);
    if (merged) {
      const result = mesh(parent, merged, leaves[0].material);
      result.castShadow = leaves[0].castShadow; result.receiveShadow = leaves[0].receiveShadow;
      leaves.forEach(n => { n.removeFromParent(); n.geometry.dispose(); });
    }
    geometries.forEach(g => g.dispose());
  }
}

export function mesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...position); m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export const sphere = (parent, mat, p, s, segments = 28) => mesh(parent, new THREE.SphereGeometry(1, segments, 20), mat, p, s);
export const rounded = (parent, mat, size, radius, p) => mesh(parent, new RoundedBoxGeometry(...size, 3, radius), mat, p);
export function tube(parent, mat, points, radius = .018, closed = false, tubular = 0) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
  return mesh(parent, new THREE.TubeGeometry(curve, tubular || Math.max(14, points.length * 4), radius, 6, closed), mat);
}
export const capsule = (parent, mat, radius, length, p) => mesh(parent, new THREE.CapsuleGeometry(radius, length, 6, 14), mat, p);

export function ring(parent, mat, radius, thickness, p, wave = 0) {
  const points = Array.from({ length: 65 }, (_, i) => {
    const a = TAU * i / 64, r = radius + Math.sin(a * 18) * wave + Math.sin(a * 11 + .4) * wave * .4;
    return [Math.cos(a) * r, Math.sin(a) * r, 0];
  });
  const curve = new THREE.CatmullRomCurve3(points.slice(0, -1).map(p => new THREE.Vector3(...p)), true);
  const m = mesh(parent, new THREE.TubeGeometry(curve, 48, thickness, 5, true), mat); m.position.set(...p); return m;
}

/** Scalloped band around the hood opening — the fur-lined rim of the reference plate. */
export function scallopRing(radius, thickness, lobes = 22, depth = .34) {
  const points = Array.from({ length: lobes * 6 + 1 }, (_, i) => {
    const a = TAU * i / (lobes * 6), r = radius + thickness * depth * Math.cos(a * lobes);
    return [Math.cos(a) * r, Math.sin(a) * r, 0];
  });
  const curve = new THREE.CatmullRomCurve3(points.slice(0, -1).map(p => new THREE.Vector3(...p)), true);
  return new THREE.TubeGeometry(curve, lobes * 5, thickness, 6, true);
}

/** Elliptical ring with a scalloped inner edge, used for the hood face opening. */
export function scallopEllipse(rx, ry, thickness, lobes = 20, depth = .5) {
  const segments = lobes * 6, points = [];
  for (let i = 0; i < segments; i++) {
    const a = TAU * i / segments, k = thickness * depth * Math.cos(a * lobes);
    points.push(new THREE.Vector3(Math.cos(a) * (rx + k), Math.sin(a) * (ry + k), 0));
  }
  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, Math.round(segments * 1.5), thickness, 6, true);
}

/** A single lychee tubercle: a chunky, faceted crown on a skirt that sits flush in the rind. */
export function tubercleGeometry(sides = 5, levels = [1, .85, .64, .38, .13]) {
  const position = [], uv = [], index = [];
  // A deep, slightly tapered skirt below the surface plus a wide crown: neighbouring crowns
  // overlap, so no gap between them can expose the base rind at grazing angles.
  const rows = [[-.30,.94],[0,1],[.55,.76],[.89,.29]];
  for (let l = 0; l < rows.length; l++) {
    const [z, r] = rows[l];
    for (let i = 0; i < sides; i++) {
      const a = TAU * i / sides + l * .07;
      position.push(Math.cos(a) * r, Math.sin(a) * r, z);
      // Map to the crown of the shared tubercle texture so every facet shares the spoke crown.
      uv.push(.5 + Math.cos(a) * r * .30, .5 + Math.sin(a) * r * .30);
      if (l < rows.length - 1) {
        const k = l * sides + i, next = l * sides + (i + 1) % sides;
        index.push(k, next, k + sides, next, next + sides, k + sides);
      }
    }
  }
  const tip = rows.length * sides;
  position.push(0, 0, 1); uv.push(.5, .5);
  for (let i = 0; i < sides; i++) index.push((rows.length - 1) * sides + i, (rows.length - 1) * sides + (i + 1) % sides, tip);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}

// An open spherical shell plus true, low-poly rind relief rendered in one instanced draw.
// The aperture is +Z; all silhouette scales are local, so closing the hood has no clip planes.
export class RindShell {
  constructor(material, { radius = .83, aperture = .83, count = 660, scale = [1, 1, 1], seed = 2, shape = null, tilt = 0, packing = .98, relief = 1 } = {}) {
    this.group = new THREE.Group(); this.radius = radius; this.count = count; this.seed = seed; this.shape = shape; this.tilt = tilt;
    this.work = new THREE.Vector3(); this.mapped = new THREE.Vector3(); this.tangent = new THREE.Vector3(); this.bitangent = new THREE.Vector3(); this.sampleA = new THREE.Vector3(); this.sampleB = new THREE.Vector3(); this.surfaceNormal = new THREE.Vector3();
    this.reliefScale = relief;
    this.group.scale.set(...scale); this.segments = 64; this.rings = 30;
    const vertices = new Float32Array((this.segments + 1) * (this.rings + 1) * 3);
    const uv = new Float32Array((this.segments + 1) * (this.rings + 1) * 2), indices = [];
    for (let j = 0; j <= this.rings; j++) for (let i = 0; i <= this.segments; i++) {
      const id = j * (this.segments + 1) + i; uv.set([i / this.segments * 2, j / this.rings], id * 2);
      if (i < this.segments && j < this.rings) {
        const b = id + this.segments + 1; indices.push(id, b, id + 1, id + 1, b, b + 1);
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); this.geometry.setIndex(indices);
    this.base = mesh(this.group, this.geometry, material);
    // One shared tubercle geometry per shell, drawn as a single instanced call.
    const bump = tubercleGeometry(5, [1, .86, .66, .38, .13]);
    this.relief = new THREE.InstancedMesh(bump, material, count); this.relief.castShadow = true;
    this.relief.receiveShadow = true; this.group.add(this.relief);
    this.packing = packing;
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // Tips catch light (brighter rind), a few shoulders sit in the crevice shadow (deep wine red).
      const warm = hash(i + seed), cool = hash(i * 2 + seed);
      color.setHex(PALETTE.rind).lerp(new THREE.Color(PALETTE.rindTip), .04 + warm * .16);
      if (cool > .62) color.lerp(new THREE.Color(PALETTE.rindDeep), (cool - .62) * 1.5);
      this.relief.setColorAt(i, color);
    }
    if (this.relief.instanceColor) this.relief.instanceColor.needsUpdate = true;
    this.dummy = new THREE.Object3D(); this.direction = new THREE.Vector3(); this.forward = new THREE.Vector3(0, 0, 1);
    this.setAperture(aperture);
  }
  mapPoint(x, y, z, target) {
    const c = Math.cos(this.tilt), s = Math.sin(this.tilt);
    target.set(x, y * c - z * s, y * s + z * c);
    return this.shape ? this.shape(target) : target.multiplyScalar(this.radius);
  }
  setAperture(angle) {
    if (Math.abs((this.aperture ?? -1) - angle) < .001) return;
    this.aperture = angle;
    const pos = this.geometry.attributes.position;
    for (let j = 0; j <= this.rings; j++) for (let i = 0; i <= this.segments; i++) {
      const t = angle + (Math.PI - angle) * j / this.rings, a = TAU * i / this.segments;
      this.mapPoint(Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t), this.work);
      pos.setXYZ(j * (this.segments + 1) + i, this.work.x, this.work.y, this.work.z);
    }
    pos.needsUpdate = true; this.geometry.computeVertexNormals(); this.geometry.computeBoundingSphere();
    const cap = Math.cos(angle), area = TAU * this.radius * this.radius * (1 + cap);
    const spacing = Math.sqrt(area / this.count) * this.packing;
    // Wide, overlapping crowns; the deep skirt hides the base rind between neighbours.
    const girth = spacing * .82 * this.reliefScale, height = spacing * .46 * this.reliefScale;
    for (let i = 0; i < this.count; i++) {
      const rimCap = angle > .04 ? Math.cos(Math.min(Math.PI, angle + .085)) : 1;
      const z = rimCap - (1 + rimCap) * (i + .5) / this.count;
      const a = i * 2.399963229728653 + this.seed, r = Math.sqrt(1 - z * z);
      this.direction.set(Math.cos(a) * r, Math.sin(a) * r, z);
      this.mapPoint(this.direction.x, this.direction.y, this.direction.z, this.mapped);
      this.tangent.set(0, 1, 0).cross(this.direction).normalize();
      this.bitangent.crossVectors(this.direction, this.tangent).normalize();
      this.work.copy(this.direction).addScaledVector(this.tangent, .001).normalize();
      this.mapPoint(this.work.x, this.work.y, this.work.z, this.sampleA).sub(this.mapped);
      this.work.copy(this.direction).addScaledVector(this.bitangent, .001).normalize();
      this.mapPoint(this.work.x, this.work.y, this.work.z, this.sampleB).sub(this.mapped);
      this.surfaceNormal.crossVectors(this.sampleA, this.sampleB).normalize();
      this.dummy.position.copy(this.mapped).addScaledVector(this.surfaceNormal, -.003);
      this.dummy.quaternion.setFromUnitVectors(this.forward, this.surfaceNormal);
      this.dummy.rotateZ(hash(i + 87) * TAU);
      const areaStretch=this.shape?Math.min(1.9,Math.max(.55,Math.sqrt(this.sampleA.length()*this.sampleB.length())/.001)):1;
      this.dummy.scale.set(girth*1.15*areaStretch*(.94+hash(i+43)*.13),girth*1.15*areaStretch*(.96+hash(i+54)*.12),height*(.9+hash(i+71)*.24));
      this.dummy.updateMatrix(); this.relief.setMatrixAt(i, this.dummy.matrix);
    }
    this.relief.instanceMatrix.needsUpdate = true; this.relief.computeBoundingSphere();
  }
}

/** Short woody stalk in a green calyx, plus the broad ovate leaf of the mother sheet. */
export function sprig(materials, { scale = 1 } = {}) {
  const g = new THREE.Group(); g.scale.setScalar(scale);
  // Stubby stalk, L/D ~1.3 as on the plate, with a green calyx and rounded sepal buds.
  tube(g, materials.stem, [[0, -.01, 0], [.006, .05, .002], [-.004, .10, .002], [.002, .145, .001]], .048);
  mesh(g, new THREE.CylinderGeometry(.049, .049, .012, 18), materials.stem, [.002, .152, .001]);
  for (let i = 0; i < 6; i++) {
    const a = TAU * i / 6 + .3, s = new THREE.Group();
    s.rotation.y = a; s.rotation.x = -.55;
    sphere(s, materials.cord, [0, .022, .020], [.026, .026, .028], 12);
    g.add(s);
  }
  // Broad ovate blade with a lifted midrib, a pointed tip and clear side veins.
  const p = [], uv = [], ids = [];
  for (let i = 0; i <= 28; i++) for (let j = 0; j <= 10; j++) {
    const u = i / 28, v = j / 10 * 2 - 1;
    const flare = Math.pow(Math.sin(Math.PI * Math.pow(u, .72)), .62);
    const width = flare * .215, lift = Math.sin(u * Math.PI) * .085 - u * .045;
    p.push(.004 + u * .66, .195 + lift + v * width * (1 - Math.abs(v) * .5), Math.abs(v) * flare * .085 + Math.sin(u * 2.6) * .014);
    uv.push(u, (v + 1) / 2);
    if (i < 28 && j < 10) { const k = i * 11 + j; ids.push(k, k + 11, k + 1, k + 1, k + 11, k + 12); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ids); geo.computeVertexNormals();
  mesh(g, geo, materials.leaf);
  tube(g, materials.cord, [[.012, .196, -.008], [.20, .226, .012], [.40, .224, .020], [.58, .204, .012], [.67, .196, -.002]], .007);
  for (let i = 0; i < 4; i++) {
    const u = .16 + i * .17;
    const bx = .004 + u * .66, by = .195 + Math.sin(u * Math.PI) * .085 - u * .045;
    for (const side of [-1, 1]) tube(g, materials.cord, [[bx, by + .004, -.010], [.004 + (u + .085) * .66, by + side * .070, .012]], .0045);
  }
  return g;
}

function blushMap() {
  if (textures.has('blush')) return textures.get('blush');
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, 'rgba(224,84,94,.96)'); g.addColorStop(.36, 'rgba(231,110,114,.66)');
  g.addColorStop(.70, 'rgba(238,150,146,.28)'); g.addColorStop(1, 'rgba(242,180,172,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  textures.set('blush', t); return t;
}

export class FaceRig {
  constructor(flesh, { width=.68, height=.655, depth=.28, centerZ=.40, eyeX=.235, eyeY=.047, eyeSize=1.20, mouthY=-.145, brows=false, boundary=null } = {}) {
    this.group = new THREE.Group(); this.emotion = 'normal'; this.look = new THREE.Vector2(); this.targetLook = new THREE.Vector2(); this.eyeSize = eyeSize;
    const ellipseSurface=(x,y)=>centerZ+depth*Math.sqrt(Math.max(.02,1-(x/width)**2-(y/height)**2));
    const edgeAt = angle => {
      const dx=Math.cos(angle),dy=Math.sin(angle);let result=null;
      for(let i=0;i<boundary.length;i++){
        const a=boundary[i],b=boundary[(i+1)%boundary.length],sx=b[0]-a[0],sy=b[1]-a[1],cross=dx*sy-dy*sx;
        if(Math.abs(cross)<1e-7)continue;
        const t=(a[0]*sy-a[1]*sx)/cross,u=(a[0]*dy-a[1]*dx)/cross;
        if(t>0&&u>=0&&u<=1){result={distance:t,z:a[2]+(b[2]-a[2])*u};break;}
      }
      return result||{distance:width,z:centerZ};
    };
    const surface=boundary?(x,y)=>{const edge=edgeAt(Math.atan2(y,x)),r=Math.min(1,Math.hypot(x,y)/edge.distance);return edge.z+(centerZ+depth-edge.z)*(1-r*r);}:ellipseSurface;
    if(boundary){
      const positions=[],normals=[],uv=[],indices=[],segments=72,rings=18;
      for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
        const a=i/segments*Math.PI*2,edge=edgeAt(a),r=j/rings*.992,x=Math.cos(a)*edge.distance*r,y=Math.sin(a)*edge.distance*r;
        positions.push(x,y,surface(x,y));uv.push(x/(width*2)+.5,y/(height*2)+.5);
        if(j<rings&&i<segments){const v=j*(segments+1)+i;indices.push(v,v+segments+1,v+1,v+1,v+segments+1,v+segments+2);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();this.face=mesh(this.group,g,flesh);
    }else this.face=sphere(this.group,flesh,[0,0,centerZ],[width,height,depth],48);
    this.face.name='FruitFlesh';
    // Cheek tint is part of the opaque skin, so it remains visible through a physical visor.
    const facePositions=this.face.geometry.attributes.position,colors=[],pink=new THREE.Color(0xfa8387),white=new THREE.Color(0xffffff),paint=new THREE.Color();
    for(let i=0;i<facePositions.count;i++){
      const x=boundary?facePositions.getX(i):facePositions.getX(i)*width,y=boundary?facePositions.getY(i):facePositions.getY(i)*height;
      const mask=Math.exp(-Math.pow((Math.abs(x)-(eyeX+.045))/.155,2)-Math.pow((y-(mouthY+.015))/.115,2))*.72;
      paint.copy(white).lerp(pink,mask);colors.push(paint.r,paint.g,paint.b);
    }
    this.face.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.face.material=flesh.clone();this.face.material.vertexColors=true;this.face.material.onBeforeCompile=flesh.onBeforeCompile;this.face.material.customProgramCacheKey=flesh.customProgramCacheKey;

    const sclera = new THREE.MeshPhysicalMaterial({ color: 0xfff7e7, roughness: .24, clearcoat: .65 });
    const obsidian = new THREE.MeshPhysicalMaterial({ color: 0x251b14, roughness: .09, clearcoat: 1, clearcoatRoughness: .055, ior: 1.5 });
    this.eyes = []; this.pupils = []; this.brows = [];
    for (const side of [-1,1]) {
      const eye = new THREE.Group(); eye.position.set(side * eyeX, eyeY, surface(eyeX,eyeY)+.006); eye.rotation.y = side * .14; eye.scale.setScalar(eyeSize);
      sphere(eye,sclera,[0,0,0],[.13,.149,.024],24);
      const pupil = sphere(eye,obsidian,[0,.002,.021],[.112,.133,.044],28);
      const glint = new THREE.MeshBasicMaterial({color:0xfffcf6});
      sphere(pupil,glint,[-.25,.38,.92],[.16,.13,.025],12).castShadow=false;
      sphere(pupil,glint,[.28,-.34,.95],[.038,.032,.01],8).castShadow=false;
      this.group.add(eye); this.eyes.push(eye); this.pupils.push(pupil);
      if (brows) {
        const x=side*eyeX, y=eyeY+.235;
        const eyebrow=tube(this.group,new THREE.MeshStandardMaterial({color:0x936448,roughness:.5}),[[x-.078,y,surface(x-.078,y)+.011],[x,y+.03,surface(x,y+.03)+.011],[x+.078,y,surface(x+.078,y)+.011]],.008);
        eyebrow.castShadow=false;this.brows.push(eyebrow);
      }
    }
    this.blushMat = new THREE.MeshBasicMaterial({ map:blushMap(),transparent:true,depthWrite:false,opacity:.85,polygonOffset:true,polygonOffsetFactor:-1 });
    // Decals follow the face curvature instead of intersecting the cheeks as flat planes.
    this.mouthMat = new THREE.MeshStandardMaterial({color:0xa71f1b,roughness:.3});
    this.smile=tube(this.group,this.mouthMat,[[-.105,mouthY+.035,surface(-.105,mouthY+.035)+.008],[-.06,mouthY-.004,surface(-.06,mouthY-.004)+.008],[0,mouthY-.013,surface(0,mouthY-.013)+.008],[.06,mouthY-.004,surface(.06,mouthY-.004)+.008],[.105,mouthY+.035,surface(.105,mouthY+.035)+.008]],.009);
    const mouthShape=new THREE.Shape();mouthShape.moveTo(-1,.55);mouthShape.quadraticCurveTo(-.45,.25,0,.43);mouthShape.quadraticCurveTo(.55,.23,1,.55);mouthShape.bezierCurveTo(1.08,-.25,.72,-1,0,-1);mouthShape.bezierCurveTo(-.72,-1,-1.08,-.25,-1,.55);
    this.openMouth=mesh(this.group,new THREE.ShapeGeometry(mouthShape,16),new THREE.MeshStandardMaterial({color:0x8f291b,roughness:.5}),[0,mouthY,surface(0,mouthY)+.02],[.125,.095,.018]);
    this.tongue=sphere(this.openMouth,new THREE.MeshStandardMaterial({color:0xef8266,roughness:.4}),[0,-.37,.83],[.76,.31,.25],18);
    this.openMouth.visible=false;this.speech=0;
  }
  setEmotion(e) { this.emotion=({friendly:'happy',thinking:'curious',excited:'energetic',proud:'energetic'})[e]||e; }
  update(time,dt,level=0,reduced=false) {
    this.speech=damp(this.speech,Math.min(1,level*2.4),18,dt);
    this.look.x=damp(this.look.x,this.targetLook.x,5,dt);this.look.y=damp(this.look.y,this.targetLook.y,5,dt);
    const phase=time%4.3,blink=!reduced&&phase>3.92&&phase<4.1?Math.max(.055,Math.abs(phase-4.01)/.09):1;
    const sleepy=this.emotion==='sleepy',happy=this.emotion==='happy',shy=this.emotion==='shy',open=this.emotion==='energetic';
    this.eyes.forEach((e,i)=>{e.scale.y=this.eyeSize*(sleepy?.08:happy?.83:shy?.88:1)*blink;this.pupils[i].position.x=this.look.x*.012;this.pupils[i].position.y=.002+this.look.y*.012;});
    this.openMouth.visible=this.speech>.07||open;this.smile.visible=!this.openMouth.visible;
    this.openMouth.scale.y=(open?.095:.025)+this.speech*.068;
    this.blushMat.opacity=shy?1:happy?.92:.8;
    this.group.rotation.z=damp(this.group.rotation.z,this.emotion==='curious'?-.045:0,5,dt);
  }
}

export function applyShellVariant(mats, variant) {
  const m = mats.shell, cord = variant === 'corduroy', lacquer = variant === 'cinnabar_jade';
  const tex = surfaceTexture(cord ? 'corduroy' : 'tubercle');
  m.color.set(cord ? 0x8a6247 : lacquer ? 0x8e1f2b : PALETTE.rind);
  m.roughness = cord ? .9 : lacquer ? .22 : .40; m.metalness = 0;
  m.clearcoat = cord ? .05 : lacquer ? 1 : .30; m.clearcoatRoughness = lacquer ? .1 : .22;
  m.sheen = cord ? 1 : .22; m.sheenColor.set(cord ? 0xe5b38d : PALETTE.rindTip); m.sheenRoughness = .7;
  m.normalMap = tex.normal; m.normalScale.setScalar(cord ? .7 : .26); m.roughnessMap = tex.roughness;
  mats.lining.color.set(lacquer ? 0xdfc58e : cord ? 0xf3e4cb : PALETTE.lining);
  mats.lining.metalness = lacquer ? .62 : 0; mats.lining.roughness = lacquer ? .28 : .58;
  m.needsUpdate = true;
}
