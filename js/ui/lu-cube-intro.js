import { renderLiveAvatar } from '../avatar/live.js';

const MOODS = ['calm', 'happy', 'wink', 'curious', 'surprised', 'sleepy'];
const FACE_COLORS = ['#ce342d', '#dcc4a0', '#b96450', '#aab5ad', '#b88c6d', '#a7a1af'];
const PITCH = 0.97;
const TURN = Math.PI / 2;
const TURN_RECORDINGS = [
  { file: '../../assets/sfx/lu-cube-turn-4.mp3', offset: .39, length: .27, gain: 2.0 },
  { file: '../../assets/sfx/lu-cube-turn-5.mp3', offset: .38, length: .29, gain: 2.4 },
  { file: '../../assets/sfx/lu-cube-turn-6.mp3', offset: .38, length: .27, gain: 1.5 }
];
const ease = t => t * t * (3 - 2 * t);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeSticker(THREE, character, mood, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#221e22';
  ctx.fillRect(0, 0, 160, 160);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const ready = renderLiveAvatar(character.id, canvas, 0, mood)
    .then(() => {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#d7c9b5';
      ctx.fillRect(0, 0, 160, 160);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#211b21';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, 146, 146);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(14, 14, 132, 132);
      texture.needsUpdate = true;
    })
    .catch(() => {
      ctx.fillStyle = accent;
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(character.name.slice(0, 1), 80, 80);
      texture.needsUpdate = true;
    });
  return { texture, ready };
}

function createSound() {
  let context;
  let enabled = true;
  let recordingBytes;
  let recordingPromise;
  let recordings;
  let fallbackNoise;
  let mediaFallback;
  try { enabled = localStorage.getItem('luIntroSound') !== 'off'; } catch {}
  function preloadMediaFallback() {
    mediaFallback ||= TURN_RECORDINGS.map(({ file }) => {
      const player = new Audio(new URL(file, import.meta.url).href);
      player.preload = 'auto';
      return player;
    });
  }
  function preload() {
    recordingBytes ||= Promise.all(TURN_RECORDINGS.map(async ({ file }) => {
      const response = await fetch(new URL(file, import.meta.url));
      if (!response.ok) throw new Error(`Cube turn recording unavailable: ${response.status}`);
      return response.arrayBuffer();
    })).catch(() => { preloadMediaFallback(); return null; });
    return recordingBytes;
  }
  if (enabled) preload();
  function unlock() {
    if (!enabled) return;
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch {}
  }
  function prepare() {
    if (!enabled || !context || context.state === 'closed' || recordings) return Promise.resolve();
    recordingPromise ||= preload().then(bytes => bytes
      ? Promise.all(bytes.map(data => context.decodeAudioData(data.slice(0))))
      : null).then(decoded => { recordings = decoded; }).catch(() => {});
    return recordingPromise;
  }
  function tone(frequency, length = 0.09, gain = 0.05, type = 'sine', delay = 0) {
    if (!enabled || !context || context.state === 'closed') return;
    const at = context.currentTime + delay;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(70, frequency * .57), at + length);
    amp.gain.setValueAtTime(.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + .012);
    amp.gain.exponentialRampToValueAtTime(.0001, at + length);
    osc.connect(amp);
    amp.connect(context.destination);
    osc.start(at);
    osc.stop(at + length + .025);
  }
  function fallbackClack(duration) {
    if (!context || context.state === 'closed') return;
    const rate = context.sampleRate;
    fallbackNoise ||= (() => {
      const buffer = context.createBuffer(1, Math.floor(rate * .035), rate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        const decay = Math.pow(1 - i / samples.length, 3);
        samples[i] = (Math.random() * 2 - 1) * decay;
      }
      return buffer;
    })();
    const at = context.currentTime;
    for (const delay of [0, Math.max(.065, duration / 1000 - .045)]) {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const amp = context.createGain();
      source.buffer = fallbackNoise;
      filter.type = 'bandpass';
      filter.frequency.value = delay ? 1900 : 1250;
      filter.Q.value = .72;
      amp.gain.value = delay ? .09 : .065;
      source.connect(filter).connect(amp).connect(context.destination);
      source.start(at + delay);
    }
  }
  function recordedClack(index, move, duration) {
    if (!enabled || !context || context.state === 'closed') return;
    const choice = index % TURN_RECORDINGS.length;
    const config = TURN_RECORDINGS[choice];
    const at = context.currentTime;
    const length = Math.min(.26, duration / 1000 + .055);
    if (!recordings) {
      const player = mediaFallback?.[choice];
      if (!player || player.readyState < 2) { fallbackClack(duration); return; }
      player.pause();
      player.currentTime = config.offset;
      player.playbackRate = config.length / length;
      player.preservesPitch = false;
      player.volume = 1;
      player.play().catch(() => fallbackClack(duration));
      setTimeout(() => player.pause(), length * 1000);
      return;
    }
    const source = context.createBufferSource();
    const amp = context.createGain();
    source.buffer = recordings[choice];
    source.playbackRate.setValueAtTime(config.length / length, at);
    amp.gain.setValueAtTime(.0001, at);
    amp.gain.linearRampToValueAtTime(config.gain, at + .007);
    amp.gain.setValueAtTime(config.gain, at + length - .026);
    amp.gain.linearRampToValueAtTime(0, at + length);
    if (context.createStereoPanner) {
      const pan = context.createStereoPanner();
      pan.pan.value = (move?.layer || 0) * .16;
      source.connect(pan).connect(amp);
    } else source.connect(amp);
    amp.connect(context.destination);
    source.start(at, config.offset, config.length);
    source.stop(at + length + .01);
  }
  return {
    get enabled() { return enabled; },
    set enabled(value) {
      enabled = Boolean(value);
      try { localStorage.setItem('luIntroSound', enabled ? 'on' : 'off'); } catch {}
      if (enabled) preload();
    },
    unlock,
    prepare,
    wake() { tone(196, .20, .05, 'sine'); tone(294, .26, .035, 'triangle', .07); },
    turn: recordedClack,
    solved() { recordedClack(1, { layer: 0 }, 200); tone(118, .13, .018, 'triangle'); },
    unfold() { tone(220, .48, .028, 'sine'); tone(440, .42, .018, 'triangle', .11); },
    tap() { tone(296, .06, .018, 'triangle'); }
  };
}

export function createLuCubeIntro({ THREE, manifest, stageState, cubeGeometry, cubeMaterial, environment, getStageCells, onComplete }) {
  const overlay = document.querySelector('#luIntroOverlay');
  const app = document.querySelector('.app');
  const activate = document.querySelector('#luIntroActivate');
  const skipButton = document.querySelector('#luIntroSkip');
  const introMute = document.querySelector('#luIntroMute');
  const coreMute = document.querySelector('#luCoreMute');
  const coreReplay = document.querySelector('#luCoreReplay');
  const label = document.querySelector('#luIntroStatus');
  const hint = document.querySelector('.lu-intro-hint');
  const mark = document.querySelector('#performanceCapsule .performance-capsule-mark');
  const sound = createSound();
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && !document.documentElement.classList.contains('lu-full-motion');
  const scene = new THREE.Scene();
  scene.environment = environment;
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40);
  camera.position.set(0, 0, 6.5);
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const light = new THREE.DirectionalLight(0xffffff, 2.35);
  light.position.set(2, 5, 7);
  scene.add(light);
  const rim = new THREE.DirectionalLight(0xe5c5aa, 2.3);
  rim.position.set(-5, -1, -4);
  scene.add(rim);
  const glassBounceLeft = new THREE.PointLight(0xffaa51, 1.55, 12, 2);
  const glassBounceRight = new THREE.PointLight(0xffaa51, 1.55, 12, 2);
  glassBounceLeft.position.set(-4.2, -1.6, 3.6);
  glassBounceRight.position.set(4.2, -1.6, 3.6);
  scene.add(glassBounceLeft, glassBounceRight);
  const root = new THREE.Group();
  root.rotation.set(-.27, .54, -.05);
  scene.add(root);
  const pivot = new THREE.Group();
  root.add(pivot);
  const innerGeometry = new THREE.BoxGeometry(.77, .77, .77);
  const innerMaterial = new THREE.MeshStandardMaterial({ color: '#1b161a', roughness: .44, metalness: .22 });
  const decalGeometry = new THREE.PlaneGeometry(.70, .70);
  const faceOrientation = [
    { position: [.455, 0, 0], rotation: [0, Math.PI / 2, 0] },
    { position: [-.455, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    { position: [0, .455, 0], rotation: [-Math.PI / 2, 0, 0] },
    { position: [0, -.455, 0], rotation: [Math.PI / 2, 0, 0] },
    { position: [0, 0, .455], rotation: [0, 0, 0] },
    { position: [0, 0, -.455], rotation: [0, Math.PI, 0] }
  ];
  const chosen = [manifest.characters.find(item => item.id === stageState.selectedAvatar) || manifest.characters[0]];
  chosen.push(...shuffled(manifest.characters.filter(item => item !== chosen[0])).slice(0, 5));
  const stickers = chosen.map((character, face) => MOODS.map(mood => makeSticker(THREE, character, mood, FACE_COLORS[face])));
  const faceMaterials = stickers.map(row => row.map(item => new THREE.MeshPhysicalMaterial({
    map: item.texture, roughness: .36, metalness: .04, clearcoat: .35, clearcoatRoughness: .2
  })));
  const cubies = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(cubeGeometry, cubeMaterial);
    body.scale.setScalar(.88);
    mesh.add(new THREE.Mesh(innerGeometry, innerMaterial), body);
    const isCenter = x === 0 && y === 0 && z === 0;
    const faces = [x === 1, x === -1, y === 1, y === -1, z === 1 || isCenter, z === -1];
    faces.forEach((visible, face) => {
      if (!visible) return;
      const sticker = new THREE.Mesh(decalGeometry, faceMaterials[face][Math.floor(Math.random() * MOODS.length)]);
      const { position, rotation } = faceOrientation[face];
      sticker.position.set(...position);
      sticker.rotation.set(...rotation);
      mesh.add(sticker);
    });
    mesh.position.set(x * PITCH, y * PITCH, z * PITCH);
    mesh.userData.home = { x, y, z };
    mesh.userData.coord = { x, y, z };
    root.add(mesh);
    cubies.push(mesh);
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'lu-cube-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    activate.prepend(renderer.domElement);
  } catch (error) {
    console.warn('LÜ intro cube renderer unavailable:', error);
  }
  let phase = 'waiting';
  let operation = 0;
  let frame = 0;
  let activeTurn = null;
  let scramble = [];
  let lastLightFrame = 0;
  let lightImpulse = 0;

  function setSize(size) {
    if (!renderer) return;
    renderer.setSize(size, size, false);
    renderer.domElement.style.width = `${size}px`;
    renderer.domElement.style.height = `${size}px`;
  }
  function draw() { if (renderer) renderer.render(scene, camera); }
  function syncLighting(now) {
    if (now - lastLightFrame < 32) return;
    lastLightFrame = now;
    const turnEnergy = Math.abs(Math.sin(pivot.rotation.x))
      + Math.abs(Math.sin(pivot.rotation.y)) + Math.abs(Math.sin(pivot.rotation.z));
    const energy = Math.min(1, lightImpulse + turnEnergy * .34);
    const shift = Math.sin(root.rotation.y) * 27
      + Math.sin(pivot.rotation.x + pivot.rotation.y + pivot.rotation.z) * 13;
    const glow = .38 + energy * .34;
    overlay.style.setProperty('--lu-light-shift', `${Math.round(shift)}px`);
    overlay.style.setProperty('--lu-light-scale', (1.02 + energy * .33).toFixed(3));
    overlay.style.setProperty('--lu-light-opacity', glow.toFixed(3));
    overlay.style.setProperty('--lu-floor-opacity', (.38 + energy * .27).toFixed(3));
    overlay.style.setProperty('--lu-floor-spread', (1 + energy * .32).toFixed(3));
    light.position.x = 2 + shift * .035;
    light.intensity = 2.35 + energy * .75;
    rim.intensity = 2.3 + energy * .55;
    const sideBias = Math.max(-1, Math.min(1, shift / 40));
    glassBounceLeft.intensity = 1.55 + energy * .45 - sideBias * .35;
    glassBounceRight.intensity = 1.55 + energy * .45 + sideBias * .35;
    lightImpulse *= .82;
  }
  function loop(now) {
    if (phase === 'complete') return;
    if (phase === 'waiting' && !reduced()) root.rotation.y = .54 + Math.sin(now * .00055) * .21;
    syncLighting(now);
    draw();
    frame = requestAnimationFrame(loop);
  }
  function snapCubie(mesh) {
    const x = Math.round(mesh.position.x / PITCH);
    const y = Math.round(mesh.position.y / PITCH);
    const z = Math.round(mesh.position.z / PITCH);
    mesh.position.set(x * PITCH, y * PITCH, z * PITCH);
    mesh.userData.coord = { x, y, z };
  }
  function settleTurn(axis, angle, selected) {
    pivot.rotation[axis] = angle;
    pivot.updateMatrixWorld(true);
    for (const mesh of selected) {
      root.attach(mesh);
      snapCubie(mesh);
    }
    pivot.rotation[axis] = 0;
    pivot.updateMatrixWorld(true);
  }
  function turnNow(move) {
    const selected = cubies.filter(mesh => mesh.userData.coord[move.axis] === move.layer);
    selected.forEach(mesh => pivot.attach(mesh));
    settleTurn(move.axis, move.quarter * TURN, selected);
  }
  function resetSolved() {
    for (const mesh of [...pivot.children]) root.attach(mesh);
    pivot.rotation.set(0, 0, 0);
    for (const mesh of cubies) {
      const { x, y, z } = mesh.userData.home;
      mesh.position.set(x * PITCH, y * PITCH, z * PITCH);
      mesh.quaternion.identity();
      mesh.scale.setScalar(1);
      mesh.userData.coord = { x, y, z };
    }
  }
  function scrambleCube() {
    resetSolved();
    scramble = [];
    let lastAxis;
    for (let i = 0; i < 8; i++) {
      const axis = shuffled(['x', 'y', 'z'].filter(value => value !== lastAxis))[0];
      const move = { axis, layer: shuffled([-1, 0, 1])[0], quarter: Math.random() < .5 ? -1 : 1 };
      turnNow(move);
      scramble.push(move);
      lastAxis = axis;
    }
    root.rotation.set(-.27, .54, -.05);
    lightImpulse = 0;
    lastLightFrame = 0;
    syncLighting(performance.now());
    draw();
  }
  function animateTurn(move, duration, token) {
    return new Promise(resolve => {
      const selected = cubies.filter(mesh => mesh.userData.coord[move.axis] === move.layer);
      selected.forEach(mesh => pivot.attach(mesh));
      let start;
      const step = now => {
        if (token !== operation) { resolve(false); return; }
        start ??= now;
        const t = Math.min(1, (now - start) / duration);
        pivot.rotation[move.axis] = move.quarter * TURN * ease(t);
        if (t < 1) requestAnimationFrame(step);
        else { settleTurn(move.axis, move.quarter * TURN, selected); resolve(true); }
      };
      requestAnimationFrame(step);
    });
  }
  function targetCell(index, stageCells) {
    if (stageCells.length) {
      const cell = stageCells[index % stageCells.length];
      const extent = Math.max(1, ...stageCells.flatMap(item => [Math.abs(item.x), Math.abs(item.y), Math.abs(item.z)]));
      const extra = Math.floor(index / stageCells.length);
      return new THREE.Vector3(cell.x / extent * 2.05, cell.y / extent * 2.05,
        cell.z / extent * 2.05 - extra * .48);
    }
    const cols = Math.max(1, stageState.gridCols || 4);
    const rows = Math.max(1, stageState.gridRows || 4);
    const layers = Math.max(1, stageState.gridLayers || 1);
    const total = cols * rows * layers;
    const slot = index % total;
    const c = slot % cols;
    const r = Math.floor(slot / cols) % rows;
    const l = Math.floor(slot / (cols * rows)) % layers;
    const span = Math.max(cols, rows, layers, 3);
    const step = 3.3 / Math.max(1, span - 1);
    const extra = Math.floor(index / total);
    return new THREE.Vector3((c - (cols - 1) / 2) * step,
      ((rows - 1) / 2 - r) * step,
      (l - (layers - 1) / 2) * step * .7 - extra * .5);
  }
  function unfold(token) {
    return new Promise(resolve => {
      const starts = cubies.map(mesh => mesh.position.clone());
      const startsRotation = cubies.map(mesh => mesh.quaternion.clone());
      const rootStart = root.rotation.clone();
      const stageCells = (getStageCells?.() || []).filter(item =>
        Number.isFinite(item.x) && Number.isFinite(item.y) && Number.isFinite(item.z));
      const ends = cubies.map((mesh, index) => {
        if (mesh.userData.home.x === 0 && mesh.userData.home.y === 0 && mesh.userData.home.z === 0) {
          return new THREE.Vector3(0, 0, .7);
        }
        const target = targetCell(index, stageCells).multiplyScalar(1.35);
        const { x, y, z } = mesh.userData.home;
        return target.add(new THREE.Vector3(x * .34, y * .34, z * .25));
      });
      const endRotation = cubies.map((mesh, index) => mesh.userData.home.x === 0
        && mesh.userData.home.y === 0 && mesh.userData.home.z === 0
        ? mesh.quaternion.clone()
        : mesh.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
          ((index % 3) - 1) * .6, ((index % 5) - 2) * .45, ((index % 7) - 3) * .25
        ))));
      let start;
      overlay.classList.add('is-revealing');
      document.body.classList.add('lu-intro-revealing');
      label.textContent = '律，已就位';
      sound.unfold();
      const step = now => {
        if (token !== operation) { resolve(false); return; }
        start ??= now;
        const t = Math.min(1, (now - start) / 1180);
        const progress = 1 - Math.pow(1 - t, 4);
        root.rotation.set(rootStart.x * (1 - progress), rootStart.y * (1 - progress), rootStart.z * (1 - progress));
        cubies.forEach((mesh, index) => {
          mesh.position.lerpVectors(starts[index], ends[index], progress);
          mesh.quaternion.copy(startsRotation[index]).slerp(endRotation[index], progress);
          const isCenter = mesh.userData.home.x === 0 && mesh.userData.home.y === 0 && mesh.userData.home.z === 0;
          mesh.scale.setScalar(isCenter ? 1 - progress * .22 : 1 - progress * .49);
        });
        if (t < 1) requestAnimationFrame(step);
        else resolve(true);
      };
      requestAnimationFrame(step);
    });
  }
  function updateSoundButtons() {
    coreMute.textContent = sound.enabled ? '入场音效：开' : '入场音效：关';
    const title = sound.enabled ? '关闭入场音效' : '开启入场音效';
    introMute.setAttribute('aria-label', title);
    introMute.title = title;
    introMute.setAttribute('aria-pressed', String(sound.enabled));
    coreMute.setAttribute('aria-pressed', String(sound.enabled));
  }
  function complete() {
    if (phase === 'complete') return;
    operation++;
    if (activeTurn) activeTurn = null;
    cancelAnimationFrame(frame);
    resetSolved();
    phase = 'complete';
    overlay.hidden = true;
    overlay.classList.remove('is-revealing');
    app.inert = false;
    document.body.classList.remove('lu-intro-active');
    document.body.classList.remove('lu-intro-revealing');
    mark.dataset.facet = 'play';
    document.querySelector('#performanceCapsule')?.focus({ preventScroll: true });
    onComplete?.();
  }
  async function activateIntro() {
    if (phase !== 'waiting') return;
    const token = ++operation;
    phase = 'solving';
    activate.disabled = true;
    sound.unlock();
    sound.wake();
    label.textContent = '正在唤醒律';
    hint.textContent = '正在归位';
    if (!renderer || reduced()) { complete(); return; }
    await Promise.allSettled([...stickers.flat().map(item => item.ready), sound.prepare()]);
    if (token !== operation) return;
    const solution = [...scramble].reverse().map(move => ({ ...move, quarter: -move.quarter }));
    for (let i = 0; i < solution.length; i++) {
      sound.turn(i, solution[i], i === solution.length - 1 ? 210 : 155);
      lightImpulse = .4;
      if (!await animateTurn(solution[i], i === solution.length - 1 ? 210 : 155, token)) return;
    }
    sound.solved();
    lightImpulse = 1;
    label.textContent = '魔方归位';
    hint.textContent = '';
    overlay.classList.add('is-solved');
    await pause(250);
    if (token !== operation) return;
    if (await unfold(token)) complete();
  }
  function show() {
    if (stageState.isRecording) return false;
    operation++;
    phase = 'waiting';
    activate.disabled = false;
    overlay.hidden = false;
    overlay.classList.remove('is-revealing', 'is-solved');
    document.body.classList.remove('lu-intro-revealing');
    label.textContent = '点击魔方，唤醒律';
    hint.textContent = '轻触魔方';
    document.body.classList.add('lu-intro-active');
    app.inert = true;
    if (renderer) {
      activate.prepend(renderer.domElement);
      setSize(Math.min(430, Math.max(260, window.innerWidth * .86)));
    }
    scrambleCube();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
    document.querySelector('#luIntroHeading')?.focus({ preventScroll: true });
    return true;
  }
  function turnToFacet(facet) {
    if (phase !== 'complete' || !['play', 'choreo', 'create', 'record'].includes(facet)) return;
    sound.unlock();
    sound.tap();
    mark.dataset.facet = facet;
  }
  const controller = {
    get phase() { return phase; },
    get cubieCount() { return cubies.length; },
    get scrambleMoves() { return scramble.length; },
    get shellVertexCount() { return cubeGeometry.attributes.position.count; },
    get shellMaterialFamily() { return cubeMaterial.userData.family; },
    get solved() { return cubies.every(mesh =>
      Object.keys(mesh.userData.home).every(axis => mesh.userData.coord[axis] === mesh.userData.home[axis])
      && Math.abs(mesh.quaternion.w) > .999); },
    get soundEnabled() { return sound.enabled; },
    activate: activateIntro,
    skip: complete,
    replay: show,
    turnToFacet
  };
  activate.addEventListener('click', activateIntro);
  skipButton.addEventListener('click', complete);
  [introMute, coreMute].forEach(button => button.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    updateSoundButtons();
  }));
  coreReplay.addEventListener('click', () => {
    if (stageState.isRecording) return;
    document.querySelector('#lueDrawerCloseBtn')?.click();
    show();
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); complete(); }
    else if (event.key === 'Tab') {
      const focusables = [activate, introMute, skipButton];
      const current = focusables.indexOf(document.activeElement);
      const next = current < 0 ? (event.shiftKey ? focusables.length - 1 : 0)
        : (current + (event.shiftKey ? focusables.length - 1 : 1)) % focusables.length;
      event.preventDefault();
      focusables[next].focus();
    }
  });
  updateSoundButtons();
  if (new URLSearchParams(location.search).get('intro') === 'skip') {
    complete();
  } else {
    show();
  }
  return controller;
}
