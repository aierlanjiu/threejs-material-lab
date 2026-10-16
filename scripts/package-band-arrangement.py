"""Package the approved, explicitly composed ten-part audition for the player."""
from pathlib import Path
import hashlib
import json
import subprocess

import numpy as np
import soundfile as sf

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / 'output/lu-band-arrangement/bolero-trial'
TARGET = ROOT / 'web'
TARGET.mkdir(exist_ok=True)
source = json.loads((ROOT / 'arrangement.json').read_text())
definitions = {
    'sanji': ('drums', 'strike'), 'zoro': ('bass', 'pluck'),
    'robin': ('harp', 'pluck'), 'usopp': ('guitar', 'pluck'),
    'ace': ('saxophone', 'wind'), 'nami': ('accordion', 'keys'),
    'chopper': ('marimba', 'strike'), 'law': ('synthesizer', 'keys'),
    'shanks': ('cello', 'sustain'), 'luffy': ('vocals', 'voice'),
}
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
duration = source['duration']
score = {'version': 1, 'source': 'arrangement', 'trackId': 'arrangement_bolero',
         'title': '波莱罗 · 十人改编', 'duration': duration,
         'bpmEstimate': source['bpm'], 'timeSignature': source['timeSignature'],
         'sourceSha256': digest(ROOT / 'bolero-pet-ensemble.mp3'),
         'arrangement': {'version': 1, 'theme': 'one-piece',
                         'provenance': 'rendered-midi-events-v1',
                         'mixMode': 'independent-stems', 'takeoverBars': 4, 'parts': []},
         'stems': [], 'sections': [], 'beatTimes': list(np.arange(0, duration, 60/source['bpm']))}
for part in source['parts']:
    kind, technique = definitions[part['id']]
    audio = TARGET / f"{part['id']}.mp3"
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i',
                    str(ROOT / part['audio']), '-codec:a', 'libmp3lame', '-b:a', '192k', str(audio)], check=True)
    samples, rate = sf.read(ROOT / part['audio'], always_2d=True, dtype='float32')
    mono = np.sqrt(np.mean(samples * samples, axis=1))
    step = round(rate * .04)
    powers = np.array([np.sqrt(np.mean(mono[i:i+step] ** 2)) for i in range(0, len(mono), step)])
    reference = max(.001, float(np.quantile(powers[powers > .0001], .95)))
    envelope = [{'time': round(i * step/rate, 4), 'value': round(float(min(1, value/reference)), 5)}
                for i, value in enumerate(powers)]
    envelope.append({'time': duration, 'value': 0})
    events = [{**e, 'velocity': e['velocity']/127, 'confidence': 1} for e in part['events']]
    score['stems'].append({'id': kind, 'instrumentId': kind, 'label': part['instrument'],
                           'audio': './' + str(audio.relative_to(PROJECT)), 'audioSha256': digest(audio),
                           'events': events, 'envelope': envelope,
                           'onsets': [{'time': e['start'], 'strength': e['velocity']} for e in events],
                           'percussion': kind == 'drums', 'polyphonic': technique in ['keys', 'pluck']})
    score['arrangement']['parts'].append({'actorId': part['actorId'], 'stemId': kind,
                                        'instrumentId': kind, 'technique': technique})
leaders = ['drums', 'saxophone', 'accordion', 'cello', 'vocals', 'vocals']
for i, section in enumerate(source['sections']):
    end = duration if i == len(source['sections'])-1 else section['end']
    active = [s['id'] for s in score['stems'] if any(e['start'] < end and e['end'] > section['start'] for e in s['events'])]
    score['sections'].append({**section, 'end': end, 'lead': leaders[i], 'active': active, 'energy': .28+i*.11})
(TARGET / 'score.json').write_text(json.dumps(score, ensure_ascii=False, separators=(',', ':')))
print('Packaged', len(score['stems']), 'independent MP3 stems and exact note events:', TARGET)
