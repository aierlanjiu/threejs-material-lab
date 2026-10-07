// The performance canvas is the single source captured by MediaRecorder.
// The 3D scene is drawn first, then the visible slot lyric deck is copied
// with the same stage-relative geometry. Editing controls are never drawn.
export const VIDEO_PRESETS = Object.freeze({
  landscape: { width: 1920, height: 1080, label: '16:9' },
  ultrawide: { width: 2560, height: 1080, label: '21:9' },
  portrait: { width: 1080, height: 1920, label: '9:16' }
});

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function drawPerformanceFrame(ctx, sceneCanvas, stageElement, lyricMode) {
  const target = ctx.canvas;
  const width = target.width;
  const height = target.height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(sceneCanvas, 0, 0, width, height);
  if (lyricMode !== 'slot') return;

  const deck = stageElement.querySelector('#cubeLyricsDeck');
  if (!deck || getComputedStyle(deck).display === 'none') return;
  const stageRect = stageElement.getBoundingClientRect();
  const deckRect = deck.getBoundingClientRect();
  if (!stageRect.width || !stageRect.height || !deckRect.width) return;
  const scaleX = width / stageRect.width;
  const scaleY = height / stageRect.height;
  const averageScale = (scaleX + scaleY) / 2;
  const box = element => {
    const rect = element.getBoundingClientRect();
    return {
      x: (rect.left - stageRect.left) * scaleX,
      y: (rect.top - stageRect.top) * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY
    };
  };

  const panel = box(deck);
  const posterMode = stageElement.classList.contains('poster-mode');
  const posterAccent = posterMode
    ? (getComputedStyle(document.body).getPropertyValue('--poster-accent').trim() || '#ce342d')
    : '#3158a6';
  ctx.save();
  ctx.fillStyle = posterMode ? 'rgba(17, 17, 22, 0.96)' : 'rgba(252, 252, 253, 0.96)';
  ctx.strokeStyle = posterMode ? '#ede2cf' : 'rgba(178, 189, 206, 0.95)';
  ctx.lineWidth = Math.max(1, averageScale);
  if (posterMode) {
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    ctx.beginPath();
    ctx.moveTo(panel.x, panel.y + ctx.lineWidth / 2);
    ctx.lineTo(panel.x + panel.width, panel.y + ctx.lineWidth / 2);
    ctx.stroke();
  } else {
    roundedRect(ctx, panel.x, panel.y, panel.width, panel.height, 18 * averageScale);
    ctx.fill();
    ctx.stroke();
  }

  for (const [selector, color] of [['.cube-line-past', '#505e72'], ['.cube-line-next', '#505e72']]) {
    const line = deck.querySelector(selector);
    if (!line?.textContent?.trim() || getComputedStyle(line).display === 'none') continue;
    const lineBox = box(line);
    ctx.fillStyle = posterMode ? '#ede2cf' : color;
    ctx.font = `600 ${Math.max(12, lineBox.height * 0.72)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(line.textContent.trim(), lineBox.x + lineBox.width / 2, lineBox.y + lineBox.height / 2, Math.max(1, panel.width - 24 * scaleX));
  }

  for (const slot of deck.querySelectorAll('.cube-slot')) {
    if (slot.classList.contains('cube-slot-space')) continue;
    const face = slot.querySelector('.cube-face-front');
    if (!face) continue;
    const tile = box(slot);
    const isCurrent = slot.classList.contains('char-active');
    const isSung = slot.classList.contains('char-sung');
    const inner = slot.querySelector('.cube-slot-inner');
    const opacity = inner ? Number.parseFloat(getComputedStyle(inner).opacity) : 1;
    ctx.globalAlpha = Number.isFinite(opacity) ? Math.max(0.35, opacity) : 1;
    ctx.fillStyle = isCurrent ? posterAccent : (posterMode ? '#ede2cf' : '#ffffff');
    ctx.strokeStyle = isCurrent ? posterAccent : (posterMode ? '#ede2cf' : '#cad4e3');
    roundedRect(ctx, tile.x, tile.y, tile.width, tile.height, (posterMode ? 3 : 6) * averageScale);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isCurrent ? '#ffffff' : (isSung ? posterAccent : (posterMode ? '#111116' : '#243448'));
    const fontSize = Math.min(tile.height * 0.62, tile.width * 0.68);
    ctx.font = `700 ${Math.max(12, fontSize)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(face.textContent || '', tile.x + tile.width / 2, tile.y + tile.height / 2 + fontSize * 0.06);
  }
  ctx.restore();
}
