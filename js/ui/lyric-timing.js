const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;

export function lyricCharacters(text) {
  const chars = segmenter ? [...segmenter.segment(text || '')].map(part => part.segment) : Array.from(text || '');
  return chars.filter(char => char.trim().length > 0);
}

export function characterCues(item, nextTime, trackDuration) {
  const chars = lyricCharacters(item.text || '');
  if (!chars.length) return [];
  if (Array.isArray(item.charTimes) && item.charTimes.length === chars.length) {
    return item.charTimes.map(time => Number(time));
  }
  const start = Math.max(0, Number(item.time) || 0);
  const stop = Math.min(Number.isFinite(nextTime) ? nextTime : Infinity,
    Number.isFinite(trackDuration) ? trackDuration : Infinity,
    Number.isFinite(item.end) ? item.end : Infinity);
  const available = Math.max(0.3, (Number.isFinite(stop) ? stop : start + 5) - start);
  // LRC only marks whole lines. Use a conservative singing span and leave instrumental tails dark.
  const sungSpan = Math.min(Math.max(0.25, available - Math.min(0.42, available * 0.12)),
    Math.max(1.1, chars.length * 0.49));
  const weights = chars.map(char => /[，。！？,.!?;；:：]/u.test(char) ? 0.38 : 1);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let elapsedWeight = 0;
  return weights.map(weight => {
    const cue = start + sungSpan * elapsedWeight / totalWeight;
    elapsedWeight += weight;
    return cue;
  });
}

export function characterCursorAt(cues, time) {
  let cursor = 0;
  while (cursor < cues.length && time >= cues[cursor]) cursor++;
  return cursor;
}
