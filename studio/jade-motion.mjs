// Isolated form study: no coupling to the accepted main-stage motion solver.
const PHI = (1 + Math.sqrt(5)) / 2;
export const PLATE = Object.freeze({ width: 1, height: PHI, depth: 0.35, envelopeDepth: 0.354, radius: 0.085, gap: 0.06, pitchX: 1.06, pitchY: PHI + 0.06, rows: 4, columns: 6 });
export const CYCLE = 11.6;
export const clamp01 = value => Math.max(0, Math.min(1, value));
// Quintic easing has zero velocity AND acceleration at both ends.
export const ease = value => { const t = clamp01(value); return t * t * t * (t * (t * 6 - 15) + 10); };

// Analytic underdamped step response: fast impulse, one visible rebound, then
// a C2 tail to rest. Time-based, deterministic and independent of frame rate.
export function springTurn(seconds) {
  if (seconds <= 0) return 0;
  if (seconds >= 1.5) return 1;
  const damping = 0.72, frequency = 7;
  const oscillation = Math.sqrt(1 - damping * damping);
  const response = 1 - Math.exp(-damping * frequency * seconds) * (Math.cos(frequency * oscillation * seconds) + damping / oscillation * Math.sin(frequency * oscillation * seconds));
  return response + (1 - response) * ease((seconds - 1.08) / 0.42);
}

export function halfHeight(angle) {
  return (PLATE.height * Math.abs(Math.cos(angle)) + PLATE.envelopeDepth * Math.abs(Math.sin(angle))) / 2;
}

export function platePose(time, row, column, mode = 'curtain') {
  const phase = ((time % CYCLE) + CYCLE) % CYCLE;
  if (mode === 'still') return { angle: 0 };
  const delay = mode === 'curtain' ? row * 0.13 + column * 0.085 : 0;
  const center = (row === 1 || row === 2) && (column === 2 || column === 3);
  const distance = Math.abs(row - 1.5) + Math.abs(column - 2.5);
  const returnAt = mode === 'slow' ? 6.8 : center ? 4.7 + (row + column - 3) * 0.13 : 8.0 + (4 - distance) * 0.13;
  const turn = springTurn(phase - 1.0 - delay);
  const settle = springTurn(phase - returnAt);
  const angle = Math.PI * (turn + settle);
  return { angle };
}

export function chapterAt(time, mode) {
  if (mode === 'still') return '静置';
  if (time < 1) return '蓄势';
  if (time < 3.15) return '翻幕';
  if (time < 4.7) return '留白';
  if (time < 6.46) return mode === 'curtain' ? '中心回应' : '停驻';
  if (time < 8) return '停驻';
  if (time < 9.7) return '外围收稳';
  return '停驻';
}

export function supportGap(a, b) {
  return PLATE.pitchY - halfHeight(a.angle) - halfHeight(b.angle);
}
