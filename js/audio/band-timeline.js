/**
 * band-timeline.js
 * 律 LÜ 乐队模式独立共享时间轴核心模块 (ES Module)
 * 驱动五角色、灯光与动态谱面渲染，纯函数实现，无外部依赖。
 */

const EPSILON = 0.05;
const ATTACK_DECAY_WINDOW = 0.18;

function isFiniteNumber(val) {
  return typeof val === 'number' && Number.isFinite(val);
}

function isInRange(val, min, max) {
  return isFiniteNumber(val) && val >= min && val <= max;
}

/**
 * 校验 BandScore 结构完整性与数值边界
 * @param {any} score
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateBandScore(score) {
  const errors = [];

  if (!score || typeof score !== 'object') {
    return { ok: false, errors: ['Score must be a non-null object'] };
  }

  if (score.version !== 1) {
    errors.push('score.version must be 1');
  }
  if (score.source !== 'demo' && score.source !== 'analysis') {
    errors.push("score.source must be 'demo' or 'analysis'");
  }
  if (typeof score.title !== 'string' || score.title.trim() === '') {
    errors.push('score.title must be a non-empty string');
  }
  if (!isFiniteNumber(score.duration) || score.duration <= 0) {
    errors.push('score.duration must be a finite positive number');
  }

  const maxDuration = isFiniteNumber(score.duration) && score.duration > 0 ? score.duration : 0;
  const maxAllowedTime = maxDuration + EPSILON;

  if (!Array.isArray(score.stems)) {
    errors.push('score.stems must be an array');
  }

  const stemIds = new Set();

  if (Array.isArray(score.stems)) {
    score.stems.forEach((stem, sIdx) => {
      const prefix = `stem[${sIdx}]`;
      if (!stem || typeof stem !== 'object') {
        errors.push(`${prefix} must be an object`);
        return;
      }
      if (typeof stem.id !== 'string' || stem.id.trim() === '') {
        errors.push(`${prefix}.id must be a non-empty string`);
      } else if (stemIds.has(stem.id)) {
        errors.push(`${prefix}.id '${stem.id}' is duplicate`);
      } else {
        stemIds.add(stem.id);
      }

      if (typeof stem.label !== 'string') {
        errors.push(`${prefix}.label must be a string`);
      }

      // Events validation
      if (!Array.isArray(stem.events)) {
        errors.push(`${prefix}.events must be an array`);
      } else {
        let lastStart = -Infinity;
        stem.events.forEach((ev, eIdx) => {
          const evPrefix = `${prefix}.events[${eIdx}]`;
          if (!ev || typeof ev !== 'object') {
            errors.push(`${evPrefix} must be an object`);
            return;
          }
          if (!isFiniteNumber(ev.start) || ev.start < 0) {
            errors.push(`${evPrefix}.start must be a non-negative finite number`);
          }
          if (!isFiniteNumber(ev.end) || ev.end <= ev.start) {
            errors.push(`${evPrefix}.end must be finite and strictly greater than start`);
          } else if (ev.end > maxAllowedTime) {
            errors.push(`${evPrefix}.end exceeds duration (+${EPSILON}s tolerance)`);
          }
          if (ev.start < lastStart) {
            errors.push(`${evPrefix} start time is not sorted in ascending order`);
          } else {
            lastStart = ev.start;
          }
          if (!isFiniteNumber(ev.midi) || !Number.isInteger(ev.midi) || ev.midi < 0 || ev.midi > 127) {
            errors.push(`${evPrefix}.midi must be an integer between 0 and 127`);
          }
          if (!isInRange(ev.velocity, 0, 1)) {
            errors.push(`${evPrefix}.velocity must be a number between 0 and 1`);
          }
          if (!isInRange(ev.confidence, 0, 1)) {
            errors.push(`${evPrefix}.confidence must be a number between 0 and 1`);
          }
        });
      }

      // Envelope validation
      if (!Array.isArray(stem.envelope)) {
        errors.push(`${prefix}.envelope must be an array`);
      } else {
        let lastTime = -Infinity;
        stem.envelope.forEach((pt, pIdx) => {
          const ptPrefix = `${prefix}.envelope[${pIdx}]`;
          if (!pt || typeof pt !== 'object') {
            errors.push(`${ptPrefix} must be an object`);
            return;
          }
          if (!isFiniteNumber(pt.time) || pt.time < 0 || pt.time > maxAllowedTime) {
            errors.push(`${ptPrefix}.time must be in range [0, duration+tolerance]`);
          }
          if (pt.time < lastTime) {
            errors.push(`${ptPrefix} time is not sorted in ascending order`);
          } else {
            lastTime = pt.time;
          }
          if (!isInRange(pt.value, 0, 1)) {
            errors.push(`${ptPrefix}.value must be a number between 0 and 1`);
          }
        });
      }

      // Onsets validation
      if (!Array.isArray(stem.onsets)) {
        errors.push(`${prefix}.onsets must be an array`);
      } else {
        let lastTime = -Infinity;
        stem.onsets.forEach((on, oIdx) => {
          const onPrefix = `${prefix}.onsets[${oIdx}]`;
          if (!on || typeof on !== 'object') {
            errors.push(`${onPrefix} must be an object`);
            return;
          }
          if (!isFiniteNumber(on.time) || on.time < 0 || on.time > maxAllowedTime) {
            errors.push(`${onPrefix}.time must be in range [0, duration+tolerance]`);
          }
          if (on.time < lastTime) {
            errors.push(`${onPrefix} time is not sorted in ascending order`);
          } else {
            lastTime = on.time;
          }
          if (!isInRange(on.strength, 0, 1)) {
            errors.push(`${onPrefix}.strength must be a number between 0 and 1`);
          }
        });
      }
    });
  }

  // Sections validation
  if (!Array.isArray(score.sections)) {
    errors.push('score.sections must be an array');
  } else {
    score.sections.forEach((sec, sIdx) => {
      const secPrefix = `section[${sIdx}]`;
      if (!sec || typeof sec !== 'object') {
        errors.push(`${secPrefix} must be an object`);
        return;
      }
      if (!isFiniteNumber(sec.start) || sec.start < 0) {
        errors.push(`${secPrefix}.start must be a non-negative finite number`);
      }
      if (!isFiniteNumber(sec.end) || sec.end <= sec.start || sec.end > maxAllowedTime) {
        errors.push(`${secPrefix}.end must be greater than start and <= duration`);
      }
      if (sec.lead !== null && typeof sec.lead !== 'undefined') {
        if (typeof sec.lead !== 'string' || !stemIds.has(sec.lead)) {
          errors.push(`${secPrefix}.lead '${sec.lead}' is not a valid stemId`);
        }
      }
      if (!Array.isArray(sec.active)) {
        errors.push(`${secPrefix}.active must be an array of stemIds`);
      } else {
        sec.active.forEach((actId, aIdx) => {
          if (typeof actId !== 'string' || !stemIds.has(actId)) {
            errors.push(`${secPrefix}.active[${aIdx}] '${actId}' is not a valid stemId`);
          }
        });
      }
      if (typeof sec.label !== 'string') {
        errors.push(`${secPrefix}.label must be a string`);
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function sampleEnvelope(envelope, time) {
  if (!envelope || envelope.length === 0) return 0;
  if (time <= envelope[0].time) return envelope[0].value;
  const len = envelope.length;
  if (time >= envelope[len - 1].time) return envelope[len - 1].value;

  let low = 0;
  let high = len - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (envelope[mid].time === time) {
      return envelope[mid].value;
    } else if (envelope[mid].time < time) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const p0 = envelope[high];
  const p1 = envelope[low];
  const range = p1.time - p0.time;
  if (range <= 0) return p0.value;
  const factor = (time - p0.time) / range;
  return p0.value + (p1.value - p0.value) * factor;
}

function sampleAttack(onsets, time) {
  if (!onsets || onsets.length === 0) return 0;
  const len = onsets.length;

  let low = 0;
  let high = len - 1;
  let bestIdx = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (onsets[mid].time <= time) {
      bestIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestIdx === -1) return 0;

  const onset = onsets[bestIdx];
  const dt = time - onset.time;
  if (dt >= 0 && dt <= ATTACK_DECAY_WINDOW) {
    const decay = Math.exp(-dt * 20);
    return onset.strength * decay;
  }
  return 0;
}

/**
 * 采样指定时间帧的时间轴状态
 * @param {any} score
 * @param {number} time
 * @returns {{time: number, source: string, section: object|null, lead: string|null, stems: Record<string, {energy: number, attack: number, notes: Array}>}}
 */
export function sampleBandFrame(score, time) {
  const duration = score && isFiniteNumber(score.duration) ? score.duration : 0;
  const safeTime = isFiniteNumber(time) ? Math.min(Math.max(time, 0), duration) : 0;
  const source = score?.source || 'demo';

  let currentSection = null;
  let lead = null;

  if (Array.isArray(score?.sections)) {
    for (let i = 0; i < score.sections.length; i++) {
      const sec = score.sections[i];
      if (safeTime >= sec.start && safeTime < sec.end) {
        currentSection = sec;
        lead = sec.lead !== undefined ? sec.lead : null;
        break;
      }
    }
  }

  const isEnd = safeTime === duration;
  const stemResults = {};

  if (Array.isArray(score?.stems)) {
    for (let i = 0; i < score.stems.length; i++) {
      const stem = score.stems[i];
      if (isEnd) {
        stemResults[stem.id] = {
          energy: 0,
          attack: 0,
          notes: []
        };
        continue;
      }

      const energy = sampleEnvelope(stem.envelope, safeTime);
      const attack = sampleAttack(stem.onsets, safeTime);
      const activeNotes = [];

      if (Array.isArray(stem.events)) {
        for (let j = 0; j < stem.events.length; j++) {
          const ev = stem.events[j];
          if (ev.start <= safeTime && safeTime < ev.end) {
            activeNotes.push(ev);
          }
          if (ev.start > safeTime) {
            break;
          }
        }
      }

      stemResults[stem.id] = {
        energy,
        attack,
        notes: activeNotes
      };
    }
  }

  return {
    time: safeTime,
    source,
    section: currentSection,
    lead,
    stems: stemResults
  };
}

function synthesizeEnvelopeFromEvents(events, duration, step = 0.1) {
  const envelope = [];
  const steps = Math.ceil(duration / step);
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(Number((i * step).toFixed(2)), duration);
    let maxVel = 0;
    for (let j = 0; j < events.length; j++) {
      const ev = events[j];
      if (t >= ev.start && t < ev.end) {
        if (ev.velocity > maxVel) {
          maxVel = ev.velocity;
        }
      }
    }
    envelope.push({
      time: t,
      value: Number(maxVel.toFixed(3))
    });
  }
  return envelope;
}

/**
 * 生成内置 32s 律 LÜ 乐队演示时间轴总谱
 * 4 Stems: vocals, drums, bass, other (其他伴奏由吉他/键盘等角色共享，非独立分离)
 * 4 Sections: 0..8 (Vocals), 8..16 (Other), 16..24 (Bass), 24..32 (Tutti Climax Vocals)
 */
export function createBandDemoScore() {
  const duration = 32.0;

  // Stems 事件定义 (丰富克制的固定编排)
  const vocalsEvents = [
    // Part 1: Vocals lead (0..8)
    { start: 0.5, end: 2.0, midi: 60, velocity: 0.85, confidence: 0.95 },
    { start: 2.2, end: 3.8, midi: 64, velocity: 0.88, confidence: 0.96 },
    { start: 4.2, end: 5.6, midi: 67, velocity: 0.92, confidence: 0.98 },
    { start: 6.0, end: 7.5, midi: 65, velocity: 0.80, confidence: 0.90 },
    // Part 4: Tutti Climax Vocals lead (24..32)
    { start: 24.5, end: 26.0, midi: 72, velocity: 0.98, confidence: 0.99 },
    { start: 26.2, end: 27.8, midi: 76, velocity: 0.99, confidence: 0.99 },
    { start: 28.0, end: 29.5, midi: 79, velocity: 0.95, confidence: 0.97 },
    { start: 30.0, end: 31.5, midi: 72, velocity: 0.90, confidence: 0.95 }
  ];

  // Drums: midi 36 (Kick - 低), 38 (Snare - 中), 42 (Hi-Hat - 高)
  const drumsEvents = [];
  // 稳定律动 8 拍每小节模式
  for (let bar = 0; bar < 16; bar++) {
    const bStart = bar * 2.0;
    if (bStart >= duration) break;
    drumsEvents.push({ start: bStart, end: Math.min(bStart + 0.35, duration), midi: 36, velocity: 0.90, confidence: 0.95 });
    drumsEvents.push({ start: bStart + 0.5, end: Math.min(bStart + 0.85, duration), midi: 42, velocity: 0.65, confidence: 0.90 });
    drumsEvents.push({ start: bStart + 1.0, end: Math.min(bStart + 1.35, duration), midi: 38, velocity: 0.85, confidence: 0.95 });
    drumsEvents.push({ start: bStart + 1.5, end: Math.min(bStart + 1.85, duration), midi: 42, velocity: 0.70, confidence: 0.90 });
  }

  // Bass: 低音线条，在 16..24 段落领奏
  const bassEvents = [
    // Part 1
    { start: 0.0, end: 1.8, midi: 36, velocity: 0.75, confidence: 0.92 },
    { start: 2.0, end: 3.8, midi: 41, velocity: 0.75, confidence: 0.92 },
    { start: 4.0, end: 5.8, midi: 43, velocity: 0.78, confidence: 0.93 },
    { start: 6.0, end: 7.8, midi: 36, velocity: 0.75, confidence: 0.90 },
    // Part 2
    { start: 8.0, end: 9.8, midi: 38, velocity: 0.70, confidence: 0.90 },
    { start: 10.0, end: 11.8, midi: 41, velocity: 0.72, confidence: 0.91 },
    { start: 12.0, end: 13.8, midi: 45, velocity: 0.75, confidence: 0.92 },
    { start: 14.0, end: 15.8, midi: 43, velocity: 0.70, confidence: 0.90 },
    // Part 3: Bass Lead (16..24)
    { start: 16.0, end: 17.2, midi: 36, velocity: 0.95, confidence: 0.98 },
    { start: 17.3, end: 18.0, midi: 38, velocity: 0.90, confidence: 0.96 },
    { start: 18.0, end: 19.5, midi: 43, velocity: 0.96, confidence: 0.99 },
    { start: 20.0, end: 21.2, midi: 41, velocity: 0.92, confidence: 0.97 },
    { start: 21.5, end: 22.2, midi: 45, velocity: 0.94, confidence: 0.98 },
    { start: 22.3, end: 23.8, midi: 48, velocity: 0.95, confidence: 0.98 },
    // Part 4: Tutti (24..32)
    { start: 24.0, end: 25.8, midi: 36, velocity: 0.88, confidence: 0.95 },
    { start: 26.0, end: 27.8, midi: 41, velocity: 0.90, confidence: 0.95 },
    { start: 28.0, end: 29.8, midi: 43, velocity: 0.92, confidence: 0.96 },
    { start: 30.0, end: 31.8, midi: 36, velocity: 0.88, confidence: 0.94 }
  ];

  // Other: 和弦/伴奏（吉他与键盘共享），8..16 领奏华彩
  const otherEvents = [
    // Part 1
    { start: 0.0, end: 3.5, midi: 60, velocity: 0.50, confidence: 0.85 },
    { start: 4.0, end: 7.5, midi: 67, velocity: 0.55, confidence: 0.85 },
    // Part 2: Other Lead (8..16) 旋律华彩
    { start: 8.0, end: 9.2, midi: 69, velocity: 0.92, confidence: 0.96 },
    { start: 9.3, end: 10.5, midi: 72, velocity: 0.95, confidence: 0.98 },
    { start: 10.6, end: 11.8, midi: 74, velocity: 0.93, confidence: 0.97 },
    { start: 12.0, end: 13.5, midi: 76, velocity: 0.96, confidence: 0.99 },
    { start: 13.8, end: 15.5, midi: 72, velocity: 0.90, confidence: 0.95 },
    // Part 3
    { start: 16.0, end: 19.5, midi: 62, velocity: 0.55, confidence: 0.85 },
    { start: 20.0, end: 23.5, midi: 65, velocity: 0.58, confidence: 0.86 },
    // Part 4: Tutti
    { start: 24.0, end: 27.5, midi: 72, velocity: 0.85, confidence: 0.92 },
    { start: 28.0, end: 31.5, midi: 76, velocity: 0.88, confidence: 0.94 }
  ];

  const createOnsets = (events) => {
    return events.map(ev => ({
      time: ev.start,
      strength: Number(ev.velocity.toFixed(3))
    })).sort((a, b) => a.time - b.time);
  };

  const stems = [
    {
      id: 'vocals',
      label: '主唱 (Vocals)',
      events: vocalsEvents,
      envelope: synthesizeEnvelopeFromEvents(vocalsEvents, duration),
      onsets: createOnsets(vocalsEvents)
    },
    {
      id: 'drums',
      label: '鼓组 (Drums)',
      events: drumsEvents,
      envelope: synthesizeEnvelopeFromEvents(drumsEvents, duration),
      onsets: createOnsets(drumsEvents)
    },
    {
      id: 'bass',
      label: '贝斯 (Bass)',
      events: bassEvents,
      envelope: synthesizeEnvelopeFromEvents(bassEvents, duration),
      onsets: createOnsets(bassEvents)
    },
    {
      id: 'other',
      label: '共享伴奏',
      events: otherEvents,
      envelope: synthesizeEnvelopeFromEvents(otherEvents, duration),
      onsets: createOnsets(otherEvents)
    }
  ];

  const sections = [
    {
      start: 0.0,
      end: 8.0,
      lead: 'vocals',
      active: ['vocals', 'drums', 'bass', 'other'],
      label: '主旋律领奏'
    },
    {
      start: 8.0,
      end: 16.0,
      lead: 'other',
      active: ['drums', 'bass', 'other'],
      label: '伴奏领奏'
    },
    {
      start: 16.0,
      end: 24.0,
      lead: 'bass',
      active: ['drums', 'bass', 'other'],
      label: '低音领奏'
    },
    {
      start: 24.0,
      end: 32.0,
      lead: 'vocals',
      active: ['vocals', 'drums', 'bass', 'other'],
      label: '多声部合奏'
    }
  ];

  return {
    version: 1,
    source: 'demo',
    title: '律 LÜ 乐队模式预设演示乐章 (Band Demo Score)',
    duration,
    stems,
    sections
  };
}
