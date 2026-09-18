// Same pinned Three.js build as the main stage; this preview never writes its state.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import { RoundedBoxGeometry } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/geometries/RoundedBoxGeometry.js/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/controls/OrbitControls.js/+esm';
import { PLATE, CYCLE, platePose, ease, chapterAt } from './jade-motion.mjs';

const stage = document.querySelector('#stage');
const scene = new THREE.Scene();
const installation = new THREE.Group();
scene.add(installation);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.domElement.setAttribute('aria-label', '黄金比例青玉牌阵，金色流体位于牌缝中');
stage.prepend(renderer.domElement);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 70);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.enablePan = false;
controls.minDistance = 5.6;
controls.maxDistance = 32;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = Math.PI * 0.55;

// Broad, blurred softboxes: no thin luminous bands or moving reflection stripes.
const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0x909c95);
function softbox(width, height, position, intensity) {
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity * 0.99, intensity * 0.94) }));
  panel.position.set(...position);
  panel.lookAt(0, 0, 0);
  envScene.add(panel);
}
softbox(10, 9, [-7, 7, 6], 3.2);
softbox(9, 8, [6, 3, -6], 1.8);
softbox(12, 12, [0, 10, 0], 1.3);
softbox(6, 7, [-5, -3, 9], 1.9);
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(envScene, 0.04);
scene.environment = environment.texture;
pmrem.dispose();
envScene.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
scene.add(new THREE.HemisphereLight(0xf0f5e9, 0x3b5147, 0.7));
const key = new THREE.DirectionalLight(0xfff5e6, 2.8);
key.position.set(-4, 7, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -6;
key.shadow.camera.right = key.shadow.camera.top = 6;
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 25;
key.shadow.normalBias = 0.018;
key.shadow.bias = -0.00008;
key.shadow.radius = 18;
key.shadow.blurSamples = 12;
scene.add(key);
const fill = new THREE.DirectionalLight(0xe4f3ef, 0.65);
fill.position.set(5, 2, 4);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xd0e6d5, 1.4);
rim.position.set(2, 4, -5);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x85988d, roughness: 0.88 }));
ground.rotation.x = -Math.PI / 2;
// Keep the LÜ upright sculpture view. The frame has open slots behind the axles.
ground.position.y = -(1.5 * PLATE.pitchY + Math.hypot(PLATE.height, PLATE.envelopeDepth) / 2) - 0.07;
ground.receiveShadow = true;
scene.add(ground);

// Object-space mineral clouds remain continuous over the real curved edges.
// This is an art-directed PBR jade approximation, not a volumetric SSS solver.
const mineralShader = `
varying vec3 vMineralPosition;
uniform float mineralSeed;
float mineralHash(vec3 p) { p=fract(p*0.3183099+vec3(.11,.27,.43)); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float mineralNoise(vec3 p) {
  vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(mineralHash(i),mineralHash(i+vec3(1,0,0)),f.x),mix(mineralHash(i+vec3(0,1,0)),mineralHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(mineralHash(i+vec3(0,0,1)),mineralHash(i+vec3(1,0,1)),f.x),mix(mineralHash(i+vec3(0,1,1)),mineralHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
`;
const finishes = {
  celadon: { label: '青玉', color: 0xb0d5bf, core: 0x76ad8e, attenuation: 0x7cb896, transmission: 0.78, roughness: 0.19 },
  white: { label: '白玉', color: 0xe3eedd, core: 0xc6d6ba, attenuation: 0xb7d5a4, transmission: 0.76, roughness: 0.22 },
  ink: { label: '墨玉', color: 0x80b698, core: 0x244f3b, attenuation: 0x376949, transmission: 0.7, roughness: 0.2 }
};
const geometry = new RoundedBoxGeometry(PLATE.width, PLATE.height, PLATE.depth, 7, PLATE.radius);
geometry.computeBoundingBox();
const panelWidth = (PLATE.columns - 1) * PLATE.pitchX + PLATE.width;
const panelHeight = (PLATE.rows - 1) * PLATE.pitchY + PLATE.height;
// Liquid-gold seams live BETWEEN tiles, below their resting front faces.
// The horizontal meniscus fits inside the narrowest full-turn clearance.
const liquidTime = { value: 0 };
const liquidMaterial = new THREE.MeshPhysicalMaterial({ color: 0xeac16b, metalness: 1, roughness: 0.19, clearcoat: 0.38, clearcoatRoughness: 0.15, envMapIntensity: 1.2 });
liquidMaterial.onBeforeCompile = shader => {
  shader.uniforms.liquidTime = liquidTime;
  shader.vertexShader = 'uniform float liquidTime;\nvarying vec3 vLiquidPosition;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLiquidPosition=position; transformed.z+=sin(position.x*3.+position.y*2.1-liquidTime*.6)*.003;');
  shader.fragmentShader = 'uniform float liquidTime;\nvarying vec3 vLiquidPosition;\n' + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor+=.022*sin(vLiquidPosition.x*4.+vLiquidPosition.y*3.-liquidTime*.6);');
};
liquidMaterial.customProgramCacheKey = () => 'lu-liquid-gold-seam-1';
const goldSeams = [];
function goldSeam(a, b, radius) {
  const line = new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(line, 64, radius, 10, false), liquidMaterial);
  mesh.receiveShadow = true;
  installation.add(mesh);
  goldSeams.push(mesh);
}
const gridHalfWidth = panelWidth / 2;
const gridHalfHeight = panelHeight / 2;
for (let i = 0; i < PLATE.columns - 1; i++) {
  const x = (i - (PLATE.columns - 2) / 2) * PLATE.pitchX;
  goldSeam([x, -gridHalfHeight, .105], [x, gridHalfHeight, .105], .012);
}
for (let i = 0; i < PLATE.rows - 1; i++) {
  const y = (i - (PLATE.rows - 2) / 2) * PLATE.pitchY;
  goldSeam([-gridHalfWidth, y, .105], [gridHalfWidth, y, .105], .006);
}
const coreGeometry = new RoundedBoxGeometry(0.92, PLATE.height - 0.08, 0.13, 5, 0.04);
const tiles = [];
for (let row = 0; row < PLATE.rows; row++) {
  for (let column = 0; column < PLATE.columns; column++) {
    const material = new THREE.MeshPhysicalMaterial({
      color: finishes.celadon.color, metalness: 0, roughness: finishes.celadon.roughness,
      transmission: finishes.celadon.transmission, thickness: PLATE.depth, attenuationDistance: 1.2,
      attenuationColor: finishes.celadon.attenuation, ior: 1.46,
      specularIntensity: 0.9, clearcoat: 0.3, clearcoatRoughness: 0.2,
      envMapIntensity: 0.9
    });
    material.onBeforeCompile = shader => {
      shader.uniforms.mineralSeed = { value: row * 4 + column * 17.31 };
      shader.vertexShader = 'varying vec3 vMineralPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMineralPosition=position;');
      shader.fragmentShader = mineralShader + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 stoneP=vMineralPosition*vec3(3.2,4.8,3.5)+mineralSeed;
        float cloud=mineralNoise(stoneP)*.62+mineralNoise(stoneP*2.7)*.26+mineralNoise(stoneP*7.1)*.12;
        float silk=mineralNoise(stoneP*14.0);
        diffuseColor.rgb*=.995+.01*silk;
        diffuseColor.rgb*=.96+.08*cloud;
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(silk-.5)*.012,.14,.52);');
    };
    material.customProgramCacheKey = () => 'lu-jade-study-1';
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((column - (PLATE.columns - 1) / 2) * PLATE.pitchX, ((PLATE.rows - 1) / 2 - row) * PLATE.pitchY, 0);
    // The opaque core casts the shadow; the transmissive shell must not black
    // out its own interior as if it were an opaque second body.
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData = { row, column, baseY: mesh.position.y };
    const coreMaterial = new THREE.MeshStandardMaterial({ color: finishes.celadon.core, metalness: 0, roughness: 0.48 });
    coreMaterial.onBeforeCompile = material.onBeforeCompile;
    coreMaterial.customProgramCacheKey = () => 'lu-jade-core-1';
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.castShadow = true;
    core.receiveShadow = true;
    core.userData.isCore = true;
    mesh.add(core);
    installation.add(mesh);
    tiles.push(mesh);
  }
}

const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const themePreference = matchMedia('(prefers-color-scheme: dark)');
let mode = motionPreference.matches ? 'still' : 'curtain';
let playing = !motionPreference.matches;
let time = 0;
let frames = 0;
let renderedTime = 0;
let transition = null;
let previousTime = performance.now();
let activeFinish = 'celadon';
const slider = document.querySelector('#progress');
const pause = document.querySelector('#pause');

function setTheme() {
  const color = themePreference.matches ? 0x283e33 : 0x9bac9f;
  scene.background = new THREE.Color(color);
  scene.fog = new THREE.Fog(color, 22, 55);
  ground.material.color.set(themePreference.matches ? 0x3f5948 : 0x85988d);
}
setTheme();
themePreference.addEventListener('change', setTheme);

function syncUI() {
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  pause.textContent = playing ? '暂停' : '播放';
  pause.setAttribute('aria-pressed', String(!playing));
}
syncUI();
function selectMode(nextMode) {
  transition = { elapsed: 0, from: tiles.map(mesh => ({ angle: mesh.rotation.x })) };
  mode = nextMode;
  time = 0;
  playing = nextMode !== 'still' && !motionPreference.matches;
  syncUI();
}
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => selectMode(button.dataset.mode)));
pause.addEventListener('click', () => {
  if (mode === 'still') mode = 'curtain';
  playing = !playing;
  syncUI();
});
slider.addEventListener('input', () => {
  playing = false;
  transition = null;
  if (mode === 'still') mode = 'curtain';
  time = Number(slider.value);
  syncUI();
});
document.querySelectorAll('[data-finish]').forEach(button => button.addEventListener('click', () => {
  activeFinish = button.dataset.finish;
  const finish = finishes[activeFinish];
  for (const mesh of tiles) {
    mesh.material.color.set(finish.color);
    mesh.material.attenuationColor.set(finish.attenuation);
    mesh.material.transmission = finish.transmission;
    mesh.material.roughness = finish.roughness;
    mesh.children.find(child => child.userData.isCore).material.color.set(finish.core);
  }
  renderer.domElement.setAttribute('aria-label', `黄金比例${finish.label}牌阵，金色流体位于牌缝中`);
  document.querySelector('#finishName').textContent = finish.label;
  document.querySelectorAll('[data-finish]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
motionPreference.addEventListener('change', () => { if (motionPreference.matches) { transition = null; mode = 'still'; playing = false; syncUI(); } });
document.addEventListener('visibilitychange', () => { previousTime = performance.now(); });

function resetCamera() {
  controls.target.set(0, 0, 0);
  // Match the main LÜ framing vector and FOV; do not import the film's tabletop camera.
  const direction = new THREE.Vector3(0.55, 0.42, 0.88).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  let distance = 0;
  // Fit the entire turn envelope, not just the front-facing starting frame.
  const halfWidth = panelWidth / 2;
  const turningRadius = Math.hypot(PLATE.height, PLATE.envelopeDepth) / 2;
  const halfLength = panelHeight / 2 + 0.03;
  for (const x of [-halfWidth, halfWidth]) for (const y of [-halfLength, halfLength]) for (const z of [-turningRadius, turningRadius]) {
    const corner = new THREE.Vector3(x, y, z).sub(controls.target);
    const depth = corner.dot(direction);
    distance = Math.max(distance, depth + 1.12 * Math.abs(corner.dot(right)) / (tangent * camera.aspect), depth + 1.12 * Math.abs(corner.dot(up)) / tangent);
  }
  camera.position.copy(controls.target).addScaledVector(direction, distance);
  controls.update();
}
document.querySelector('#reset').addEventListener('click', resetCamera);
let lastAspect = 0;
const observer = new ResizeObserver(() => {
  const { width, height } = stage.getBoundingClientRect();
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (!lastAspect || Math.abs(lastAspect - camera.aspect) > 0.35) resetCamera();
  lastAspect = camera.aspect;
});
observer.observe(stage);

renderer.domElement.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  playing = false;
  const loading = document.querySelector('#loading');
  loading.hidden = false;
  loading.textContent = '三维画面已中断，请刷新恢复。';
});

// Read-only inspection for QA; normal controls are the sole state-changing API.
function projectedBounds() {
  const min = new THREE.Vector2(Infinity, Infinity), max = new THREE.Vector2(-Infinity, -Infinity);
  const point = new THREE.Vector3();
  for (const mesh of tiles) for (const x of [-PLATE.width / 2, PLATE.width / 2]) for (const y of [-PLATE.height / 2, PLATE.height / 2]) for (const z of [-PLATE.envelopeDepth / 2, PLATE.envelopeDepth / 2]) {
    point.set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera);
    min.x = Math.min(min.x, point.x); min.y = Math.min(min.y, point.y);
    max.x = Math.max(max.x, point.x); max.y = Math.max(max.y, point.y);
  }
  return { min: min.toArray(), max: max.toArray() };
}
window.jadePreview = Object.freeze({
  inspect: () => ({
    frames, time: renderedTime, playing, mode, finish: activeFinish,
    reducedMotion: motionPreference.matches, samples: renderer.getContext().getParameter(renderer.getContext().SAMPLES),
    geometry: { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray(), radius: PLATE.radius, pitch: [PLATE.pitchX, PLATE.pitchY], rows: PLATE.rows, columns: PLATE.columns, goldSeams: goldSeams.length, goldWidths: [0.024, 0.012], coreCount: tiles.length, floorY: ground.position.y },
    chapter: chapterAt(renderedTime, mode), cycle: CYCLE,
    tiles: tiles.map(mesh => ({ position: mesh.position.toArray(), rotation: mesh.rotation.toArray().slice(0, 3), scale: mesh.scale.toArray() })),
    camera: camera.position.toArray(), bounds: projectedBounds(), drawCalls: renderer.info.render.calls
  })
});

function render(now) {
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  if (!document.hidden) {
    if (transition) {
      transition.elapsed += dt;
      if (transition.elapsed >= 0.32 || motionPreference.matches) transition = null;
    } else if (playing && !motionPreference.matches) {
      time = (time + dt) % CYCLE;
    }
    tiles.forEach((mesh, index) => {
      const { row, column, baseY } = mesh.userData;
      const pose = platePose(time, row, column, mode);
      if (transition) {
        const progress = ease(transition.elapsed / 0.32);
        // Return by the nearest full turn. Do not snap a 359-degree pose to zero.
        const from = transition.from[index];
        const target = pose.angle + Math.round((from.angle - pose.angle) / (Math.PI * 2)) * Math.PI * 2;
        pose.angle = THREE.MathUtils.lerp(from.angle, target, progress);
      }
      mesh.rotation.x = pose.angle;
      // Fixed mechanical axle. Clearance comes from the recessed slot, not a
      // hovering tile or animated scale. Position stays fixed through rebounds.
      mesh.position.y = baseY;
    });
    controls.update();
    liquidTime.value = time;
    renderer.render(scene, camera);
    frames++;
    renderedTime = time;
    if (document.activeElement !== slider) slider.value = String(time);
    const chapter = document.querySelector('#chapter'), nextChapter = chapterAt(time, mode);
    if (chapter.textContent !== nextChapter) chapter.textContent = nextChapter;
    if (frames === 1) document.querySelector('#loading').hidden = true;
  }
}
renderer.setAnimationLoop(render);
