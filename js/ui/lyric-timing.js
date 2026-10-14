const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;

const PUNCTUATION_RE = /[，。！？,.!?;；:：、…—\-~～]/u;
const LATIN_RE = /[A-Za-z0-9]/u;
const KANA_RE = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/u;

export function lyricCharacters(text) {
  const chars = segmenter ? [...segmenter.segment(text || '')].map(part => part.segment) : Array.from(text || '');
  return chars.filter(char => char.trim().length > 0);
}

function charPhoneticWeight(char) {
  if (PUNCTUATION_RE.test(char)) return 0.38;
  if (LATIN_RE.test(char)) return 0.42;
  if (KANA_RE.test(char)) return 0.65;
  return 1;
}

function charNaturalDuration(char) {
  if (PUNCTUATION_RE.test(char)) return 0.12;
  if (LATIN_RE.test(char)) return 0.14;
  if (KANA_RE.test(char)) return 0.22;
  return 0.36;
}

export function resolveLyricLineSpan(item, nextTime, trackDuration) {
  const chars = lyricCharacters(item?.text || '');
  const baseStart = Math.max(0, Number(item?.time) || 0);
  const start = Number.isFinite(item?.vocalStart) && item.vocalStart >= baseStart && item.vocalStart < baseStart + 1.2
    ? Number(item.vocalStart)
    : baseStart;
  const hasExplicitEnd = Number.isFinite(item?.end) && item.end > start + 0.2;
  const stop = Math.min(
    Number.isFinite(nextTime) ? nextTime : Infinity,
    Number.isFinite(trackDuration) ? trackDuration : Infinity,
    hasExplicitEnd ? Number(item.end) : Infinity
  );
  const available = Math.max(0.3, (Number.isFinite(stop) ? stop : start + 5) - start);
  const naturalSpan = chars.reduce((sum, char) => sum + charNaturalDuration(char), 0);
  const tailMargin = hasExplicitEnd ? Math.min(0.12, available * 0.04) : Math.min(0.42, available * 0.12);
  const maxSpan = Math.max(0.25, available - tailMargin);
  const sungSpan = hasExplicitEnd
    ? maxSpan
    : Math.min(maxSpan, Math.max(1.1, naturalSpan * 1.12));
  return { start, stop: start + sungSpan, sungSpan, available };
}

export function characterCues(item, nextTime, trackDuration) {
  const chars = lyricCharacters(item?.text || '');
  if (!chars.length) return [];
  if (Array.isArray(item.charTimes) && item.charTimes.length === chars.length) {
    return item.charTimes.map(time => Number(time));
  }
  const { start, sungSpan } = resolveLyricLineSpan(item, nextTime, trackDuration);
  const weights = chars.map(charPhoneticWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let elapsedWeight = 0;
  return weights.map(weight => {
    const cue = start + sungSpan * elapsedWeight / totalWeight;
    elapsedWeight += weight;
    return cue;
  });
}

export function lineProgressAt(item, nextTime, trackDuration, time) {
  if (!item) return 0;
  const { start, sungSpan } = resolveLyricLineSpan(item, nextTime, trackDuration);
  if (sungSpan <= 0) return 0;
  return Math.max(0, Math.min(1, (time - start) / sungSpan));
}

export function characterCursorAt(cues, time) {
  let cursor = 0;
  while (cursor < cues.length && time >= cues[cursor]) cursor++;
  return cursor;
}
