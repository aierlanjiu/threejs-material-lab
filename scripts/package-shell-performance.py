"""Package the approved local nine-track draft for the live player.

Preserves the rendered audio and creates short, gapless MP3 segments so phones
do not need to decode nine complete four-minute stereo buffers at once.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output/lu-band-arrangement/one-day-shell-v1'
OUT = ROOT / 'assets/band-shell-performance'
KINDS = {'zoro': ('bass', 'pluck'), 'sanji': ('drums', 'strike'),
         'nami': ('accordion', 'keys'), 'chopper': ('marimba', 'strike'),
         'robin': ('harp', 'sustain'), 'usopp': ('guitar', 'pluck'),
         'ace': ('saxophone', 'wind'), 'law': ('synthesizer', 'keys'),
         'shanks': ('cello', 'sustain')}
CHUNK = 12.


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    data = json.loads((SOURCE / 'arrangement.json').read_text())
    original = json.loads((ROOT / 'output/lu-band-song-parts/anime_op_one_day/score.json').read_text())
    (OUT / 'audio').mkdir(parents=True, exist_ok=True)
    stems, parts = [], []
    voice = {'id': 'one-piece/luffy', 'label': '路飞 · 新合唱待制作', 'events': [], 'envelope': [], 'onsets': [], 'instrumentId': 'vocals'}
    stems.append(voice)
    parts.append({'actorId': voice['id'], 'stemId': None, 'instrumentId': 'vocals', 'technique': 'voice'})
    for part in data['parts']:
        key = part['id']; kind, technique = KINDS[key]
        full = OUT / 'audio' / f'{key}.mp3'
        shutil.copy2(SOURCE / part['preview'], full)
        wave, sr = sf.read(SOURCE / part['audio'], dtype='float32', always_2d=True)
        assert sr == 44100 and len(wave) == round(data['duration'] * sr)
        step = round(.1 * sr)
        power = np.mean(wave * wave, axis=1)
        rms = np.sqrt(np.add.reduceat(power, np.arange(0, len(power), step)) /
                      np.minimum(step, len(power) - np.arange(0, len(power), step)))
        normalizer = max(float(np.quantile(rms[rms > .0001], .85)), .0001)
        envelope = [{'time': round(i * .1, 6), 'value': round(min(1., float(v) / normalizer), 5)} for i, v in enumerate(rms)]
        events = [{**e, 'velocity': round(e['velocity'] / 127, 6), 'confidence': 1.} for e in part['events']]
        chunks = []
        chunk_dir = OUT / 'chunks' / key; chunk_dir.mkdir(parents=True, exist_ok=True)
        for index, start in enumerate(np.arange(0., data['duration'], CHUNK)):
            duration = min(CHUNK, data['duration'] - float(start))
            path = chunk_dir / f'{index:03}.mp3'
            command = ['ffmpeg', '-v', 'error', '-nostdin', '-y', '-ss', str(start),
                                     '-i', str(SOURCE / part['audio']), '-t', str(duration),
                                     '-c:a', 'libmp3lame', '-b:a', '192k', str(path)]
            if '--metadata-only' in sys.argv:
                assert path.is_file() and path.stat().st_size > 1000
            else:
                result = subprocess.run(command, capture_output=True, timeout=90)
                if result.returncode:
                    raise RuntimeError(result.stderr.decode(errors='replace')[-1000:])
            chunks.append({'start': round(float(start), 6), 'duration': round(duration, 6),
                           'audio': './' + str(path.relative_to(ROOT)), 'audioSha256': sha(path)})
        stems.append({'id': part['actorId'], 'label': f"{part['name']} · {part['instrument']}",
                      'instrumentId': kind, 'percussion': key == 'sanji', 'events': events,
                      'envelope': envelope, 'onsets': [{'time': e['start'], 'strength': e['velocity']} for e in events], 'audio': './' + str(full.relative_to(ROOT)),
                      'audioSha256': sha(full), 'chunks': chunks})
        parts.append({'actorId': part['actorId'], 'stemId': part['actorId'],
                      'instrumentId': kind, 'technique': technique})
        print('PACKAGED', key, len(events), 'events', len(chunks), 'chunks', flush=True)
    sections = []
    for section in original['sections']:
        weights = [(sum(max(0., min(e['end'], section['end']) - max(e['start'], section['start'])) * e['velocity'] for e in s['events']), s['id']) for s in stems[1:]]
        sections.append({**section, 'lead': max(weights)[1], 'active': [s['id'] for s in stems[1:] if any(e['start'] < section['end'] and e['end'] > section['start'] for e in s['events'])]})
    score = {'version': 1, 'source': 'arrangement', 'title': 'One day · 珍珠贝壳九件乐器',
             'trackId': 'anime_op_one_day', 'duration': data['duration'], 'instrumental': True,
             'sourceSha256': data['sourceSha256'], 'bpmEstimate': data['bpmMeasured'],
             'beatTimes': original['beatTimes'], 'timeSignature': [4, 4], 'stems': stems,
             'sections': sections, 'choir': data['choir'],
             'arrangement': {'version': 3, 'provenance': 'rendered-independent-midi-v1',
                             'theme': 'one-piece', 'parts': parts,
                             'mixMode': 'rendered-stems', 'takeoverBars': 4},
             'rendered': {'version': 1, 'chunkSeconds': CHUNK, 'instrumentCount': 9,
                          'nativeSampleRate': 44100, 'maxCachedChunks': 2},
             'notice': '九件乐器独立编配制作稿，主观听感待验；新歌词合唱尚未制作。'}
    (OUT / 'score.json').write_text(json.dumps(score, ensure_ascii=False, separators=(',', ':')) + '\n')
    shutil.copy2(SOURCE / 'SOUNDFONT-LICENSE.txt', OUT / 'SOUNDFONT-LICENSE.txt')
    print('DONE', sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file()), 'bytes', flush=True)


if __name__ == '__main__':
    main()
