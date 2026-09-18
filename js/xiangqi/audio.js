// 弈律 · Web Audio 音效系统 (无需外部音频文件)

let ctx = null;
let audioEnabled = true;

function getAudioContext() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      ctx = new AudioContextClass();
    }
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

export function setAudioEnabled(enabled) {
  audioEnabled = enabled;
}

export function getAudioEnabled() {
  return audioEnabled;
}

// 物理落子音效 —— 木质清脆碰撞
export function playMoveSound() {
  if (!audioEnabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.08);

  // 添加微弱高频敲击声
  const oscHigh = ac.createOscillator();
  const gainHigh = ac.createGain();
  oscHigh.type = 'triangle';
  oscHigh.frequency.setValueAtTime(1200, now);
  oscHigh.frequency.exponentialRampToValueAtTime(300, now + 0.03);
  gainHigh.gain.setValueAtTime(0.2, now);
  gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  oscHigh.connect(gainHigh);
  gainHigh.connect(ac.destination);
  oscHigh.start(now);
  oscHigh.stop(now + 0.03);
}

// 吃子音效 —— 坚硬碎石/击打沉重感
export function playCaptureSound() {
  if (!audioEnabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  
  // 冲击沉重低音
  const lowOsc = ac.createOscillator();
  const lowGain = ac.createGain();
  lowOsc.type = 'sine';
  lowOsc.frequency.setValueAtTime(280, now);
  lowOsc.frequency.exponentialRampToValueAtTime(60, now + 0.15);

  lowGain.gain.setValueAtTime(0.6, now);
  lowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  lowOsc.connect(lowGain);
  lowGain.connect(ac.destination);
  lowOsc.start(now);
  lowOsc.stop(now + 0.15);

  // 噪点撞击声
  const bufferSize = ac.sampleRate * 0.06;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1600;
  filter.Q.value = 3;

  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.4, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ac.destination);

  noise.start(now);
}

// 将军音效 —— 双音和弦警示音
export function playCheckSound() {
  if (!audioEnabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  const freqs = [587.33, 880]; // D5 + A5

  freqs.forEach(freq => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + 0.25);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  });
}

// 胜负/绝杀音效 —— 胜利三连琶音
export function playVictorySound() {
  if (!audioEnabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const startTime = now + idx * 0.1;
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.4);
  });
}
