export const SPRINGS = Object.freeze({
  button: { stiffness: 600, damping: 30, mass: 1 },
  panel: { stiffness: 320, damping: 28, mass: 1 }
});

// Exact damped-oscillator step. Retargeting preserves both position and velocity.
export function stepSpring(state, target, dt, { stiffness: k, damping: c, mass: m } = SPRINGS.panel) {
  const x = state.value - target, v = state.velocity, a = c / (2 * m), w2 = k / m, d = w2 - a * a;
  let next, velocity;
  if (d > 1e-8) {
    const w = Math.sqrt(d), b = (v + a * x) / w, e = Math.exp(-a * dt), cos = Math.cos(w * dt), sin = Math.sin(w * dt);
    next = e * (x * cos + b * sin);
    velocity = e * ((b * w - a * x) * cos - (x * w + a * b) * sin);
  } else if (d < -1e-8) {
    const root = Math.sqrt(-d), r1 = -a + root, r2 = -a - root, b = (v - r2 * x) / (r1 - r2), f = x - b;
    next = b * Math.exp(r1 * dt) + f * Math.exp(r2 * dt);
    velocity = b * r1 * Math.exp(r1 * dt) + f * r2 * Math.exp(r2 * dt);
  } else {
    const b = v + a * x, e = Math.exp(-a * dt);
    next = (x + b * dt) * e; velocity = (v - a * b * dt) * e;
  }
  return { value: target + next, velocity };
}

// A display mapping only. The analyser, onset detector and musical clock stay raw.
export function perceptualLevel(value) {
  const x = Math.max(0, Math.min(1, (value - .08) / .92));
  return .94 * Math.tanh(1.45 * Math.pow(x, .7)) / Math.tanh(1.45);
}
