import { AVATAR_MANIFEST } from '../../assets/live-avatars/manifest.js';

const byId = new Map(AVATAR_MANIFEST.characters.map(character => [character.id, character]));
const loaded = new Map();
const SIZE = AVATAR_MANIFEST.size;
const DURATION = 28.8;
const CLIP = 4.8;

function image(url) {
  const value = new Image();
  value.src = url;
  return value.decode().then(() => value);
}

async function characterAssets(id) {
  if (!byId.has(id)) throw new Error(`Unknown live avatar: ${id}`);
  if (!loaded.has(id)) {
    const base = new URL(`../../assets/live-avatars/${id}/`, import.meta.url);
    loaded.set(id, Promise.all(['base.png', 'eye-left.png', 'eye-right.png'].map(file => image(new URL(file, base).href)))
      .then(([body, left, right]) => ({ body, left, right, character: byId.get(id), last: null })));
  }
  return loaded.get(id);
}

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

function blinkScale(time) {
  const local = ((time % 5.4) + 5.4) % 5.4;
  const distance = Math.abs(local - 0.52);
  return distance > 0.16 ? 1 : 0.08 + 0.92 * smooth(distance / 0.16);
}

function expression(time, override) {
  if (override && override !== 'normal') {
    if (override === 'sing') return 'happy';
    if (override === 'surprised') return 'surprise';
    return override;
  }
  return ['calm', 'happy', 'wink', 'curious', 'surprise', 'sleepy'][Math.floor((((time % DURATION) + DURATION) % DURATION) / CLIP)];
}

function smileEye(ctx, box, alpha = 1) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#29252b';
  ctx.lineWidth = Math.max(4, box.w * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - box.w * 0.38, cy + box.h * 0.13);
  ctx.quadraticCurveTo(cx, cy - box.h * 0.34, cx + box.w * 0.38, cy + box.h * 0.12);
  ctx.stroke();
  ctx.restore();
}

function eyebrow(ctx, box, lift, tilt) {
  const cx = box.x + box.w / 2;
  const y = box.y - box.h * 0.17 - lift;
  ctx.save();
  ctx.strokeStyle = '#493b3b';
  ctx.lineWidth = Math.max(2.5, box.w * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - box.w * 0.28, y + tilt);
  ctx.quadraticCurveTo(cx, y - box.h * 0.13, cx + box.w * 0.28, y - tilt);
  ctx.stroke();
  ctx.restore();
}

function drawEye(ctx, asset, box, height, width, shiftX, shiftY) {
  const cx = box.x + box.w / 2 + shiftX;
  const cy = box.y + box.h / 2 + shiftY;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(width, Math.max(0.04, height));
  ctx.drawImage(asset, -box.w / 2, -box.h / 2, box.w, box.h);
  ctx.restore();
}

export function drawLiveAvatar(ctx, assets, time, override = 'normal', options = {}) {
  const reduced = Boolean(options.reduced);
  const blink = options.blink !== false;
  const mood = reduced ? 'calm' : expression(time, override);
  const eyeBoxes = assets.character.eyes;
  const sway = reduced ? 0 : Math.sin(time * Math.PI * 2 / 7.2);
  const gazeX = reduced ? 0 : clamp(Number(options.lookX) || 0, -1, 1) * 7;
  const gazeY = reduced ? 0 : clamp(Number(options.lookY) || 0, -1, 1) * 5;
  const lid = reduced || !blink ? 1 : blinkScale(time);

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.translate(SIZE / 2 + sway * 0.9, SIZE / 2 + (reduced ? 0 : Math.sin(time * 0.95) * 1.0));
  if (!reduced) ctx.rotate(sway * 0.003);
  const breath = reduced ? 1 : 1 + Math.sin(time * 0.95) * 0.008;
  ctx.scale(breath, breath);
  ctx.translate(-SIZE / 2, -SIZE / 2);
  ctx.drawImage(assets.body, 0, 0, SIZE, SIZE);

  for (const side of ['left', 'right']) {
    const box = eyeBoxes[side];
    const eye = assets[side];
    if (mood === 'happy' || (mood === 'wink' && side === 'left')) {
      smileEye(ctx, box);
    } else {
      let height = lid;
      let width = 1;
      let moveY = gazeY;
      if (mood === 'curious') {
        height *= side === 'left' ? 1.08 : 0.78;
        moveY += side === 'left' ? -2.4 : 1.2;
      } else if (mood === 'surprise') {
        height *= 1.18;
        width = 1.035;
        moveY -= 3;
      } else if (mood === 'sleepy') {
        height *= 0.23;
        moveY += 2;
      }
      drawEye(ctx, eye, box, height, width, gazeX, moveY);
    }
    if (mood === 'curious') eyebrow(ctx, box, side === 'left' ? 6 : 0, side === 'left' ? 3 : -3);
    if (mood === 'surprise') eyebrow(ctx, box, 11, 0);
  }
  ctx.restore();
  return mood;
}

export async function renderLiveAvatar(id, canvas, time, override = 'normal', options = {}) {
  const assets = await characterAssets(id);
  const reduced = Boolean(options.reduced);
  const identity = `${reduced}|${options.blink !== false}|${override}|${options.lookX || 0}|${options.lookY || 0}`;
  if (reduced && assets.last === identity) return false;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / SIZE, 0, 0, canvas.height / SIZE, 0, 0);
  drawLiveAvatar(ctx, assets, time, override, options);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  assets.last = identity;
  return true;
}

export function avatarDiagnostics() {
  return { total: byId.size, loaded: loaded.size, duration: DURATION, groups: AVATAR_MANIFEST.groups.map(group => group.id) };
}
