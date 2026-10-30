"""Isolated One day / nine-instrument arrangement production draft.

Run with output/lu-band-runtime/bin/python. Uses the existing local audio,
measured beats, and GeneralUser GS. Does not manufacture a choir or edit the
player. Harmony is an estimated arrangement, pending a human musical audition.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import shutil
import subprocess

import librosa
import mido
import numpy as np
import soundfile as sf
from scipy.ndimage import uniform_filter1d
from scipy.signal import butter, sosfilt

PROJECT = Path(__file__).resolve().parents[1]
ANALYSIS = PROJECT / 'output/lu-band-song-parts/anime_op_one_day'
SOURCE = PROJECT / 'output/audio/anime_op_one_day.mp3'
DEFAULT_OUT = PROJECT / 'output/lu-band-arrangement/one-day-shell-v1'
RATE = 44100
PITCH_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def dump(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def encode(source, target, start=None, duration=None):
    command = ['ffmpeg', '-hide_banner', '-v', 'error', '-nostdin', '-y']
    if start is not None:
        command += ['-ss', str(start)]
    command += ['-i', str(source)]
    if duration is not None:
        command += ['-t', str(duration), '-af', 'afade=t=in:d=0.06,afade=t=out:st=29.5:d=0.5']
    command += ['-c:a', 'libmp3lame', '-b:a', '192k', str(target)]
    result = subprocess.run(command, capture_output=True, timeout=240)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-1800:])


def helper_module(duration):
    spec = importlib.util.spec_from_file_location('existing_audition_dsp',
                                                 PROJECT / 'scripts/render-pianai-audition.py')
    dsp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(dsp)
    dsp.START, dsp.END, dsp.DURATION = 0.0, duration, duration
    dsp.FRAMES = round(duration * RATE)
    return dsp


def infer_harmony(score):
    # Actual local waveforms provide chroma; no invented published score.
    guitar, _ = librosa.load(ANALYSIS / 'guitar.wav', sr=22050, mono=True)
    other, _ = librosa.load(ANALYSIS / 'other.wav', sr=22050, mono=True)
    chroma = librosa.feature.chroma_stft(y=guitar + other * .45, sr=22050,
                                       n_fft=4096, hop_length=512)
    frames = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=22050, hop_length=512)
    beats = np.asarray(score['beatTimes'])
    boundaries = np.r_[0., beats[::2], score['duration']]
    boundaries = np.unique(boundaries)
    boundaries = boundaries[np.r_[np.diff(boundaries) > .2, True]]
    templates = []
    for minor in (False, True):
        for root in range(12):
            template = np.zeros(12)
            template[root], template[(root + (3 if minor else 4)) % 12], template[(root + 7) % 12] = 1., .85, .85
            templates.append(template / np.linalg.norm(template))
    templates = np.asarray(templates)
    bass = next(p for p in score['stems'] if p['id'] == 'bass')['events']
    observations = []
    energies = []
    for a, b in zip(boundaries[:-1], boundaries[1:]):
        mask = (frames >= a) & (frames < b)
        c = np.mean(chroma[:, mask], axis=1) if mask.any() else np.zeros(12)
        c /= max(np.linalg.norm(c), 1e-8)
        bass_pc = np.zeros(12)
        for event in bass:
            overlap = max(0., min(b, event['end']) - max(a, event['start']))
            if event['midi'] <= 59 and event.get('confidence', 0) >= .4:
                bass_pc[event['midi'] % 12] += overlap * event['velocity']
        bass_pc /= max(bass_pc.sum(), 1e-8)
        observations.append(templates @ c + .40 * np.tile(bass_pc, 2))
        energies.append(float(np.sqrt(np.mean((guitar[round(a * 22050):round(b * 22050)] +
                                                other[round(a * 22050):round(b * 22050)] * .45) ** 2))))
    observations = np.asarray(observations)
    # Dynamic programming discourages isolated detector flicker without fixing
    # the song to an assumed key or pre-written progression.
    roots = np.arange(24) % 12
    transition = np.full((24, 24), -.18)
    transition[roots[:, None] == roots[None, :]] = -.09
    np.fill_diagonal(transition, 0.)
    best = observations[0].copy()
    parents = []
    for row in observations[1:]:
        candidate = best[:, None] + transition
        parents.append(np.argmax(candidate, axis=0))
        best = candidate.max(axis=0) + row
    path = [int(np.argmax(best))]
    for parent in reversed(parents):
        path.append(int(parent[path[-1]]))
    path.reverse()
    normalizer = max(np.quantile(energies, .85), 1e-6)
    return [{'start': round(float(a), 6), 'end': round(float(b), 6),
             'root': state % 12, 'minor': state >= 12,
             'chord': PITCH_NAMES[state % 12] + ('m' if state >= 12 else ''),
             'energy': round(min(1., energy / normalizer), 4),
             'status': 'waveform-derived arrangement estimate'}
            for a, b, state, energy in zip(boundaries[:-1], boundaries[1:], path, energies)]


def compose(score, harmony, gaps, dsp):
    parts = {key: {'id': key, 'actorId': f'one-piece/{key}', 'name': name,
                   'instrument': label, 'program': program, 'pan': pan,
                   'room': room, 'targetActiveRms': target, 'events': [],
                   'source': 'newly-arranged-midi'}
             for key, name, label, program, pan, room, target in dsp.DEFS}
    beats = np.asarray(score['beatTimes'])
    quarter = float(np.median(np.diff(beats)))
    def when(index):
        return float(np.interp(index, np.arange(len(beats)), beats))
    def chord(at):
        return next((h for h in reversed(harmony) if h['start'] <= at), harmony[0])
    def add(key, at, pitch, length, velocity):
        dsp.note(parts[key], at, pitch, length, velocity, .003)
    for i, at in enumerate(beats):
        if at > score['duration'] - 1.8:
            continue
        h = chord(at)
        root = 36 + h['root']
        third = 3 if h['minor'] else 4
        triad = [root + 12, root + 12 + third, root + 19]
        energy, beat = h['energy'], i % 4
        strong = energy >= .65
        add('zoro', at, root - (12 if root > 43 else 0), quarter * .78, 59 + 15 * energy)
        if strong and beat == 3:
            add('zoro', when(i + .5), root + 7 - (12 if root > 43 else 0), quarter * .34, 51)
        if beat in (0, 2):
            add('sanji', at, 36, .13, 66 + 16 * energy)
        if beat in (1, 3):
            add('sanji', at, 38 if strong else 37, .13, 64 if strong else 46)
        for off in (0, .5):
            add('sanji', when(i + off), 42, .07, 41 + 9 * energy - 7 * off)
        if i % 16 == 0 and strong:
            add('sanji', at, 49, .35, 58)
        if i % 16 == 15 and strong:
            for off, drum in ((.5, 38), (.75, 45)):
                add('sanji', when(i + off), drum, .12, 48)
        for off in ((0, .75) if strong else (0,)):
            if not strong and beat not in (0, 2):
                continue
            for j, pitch in enumerate(triad):
                add('usopp', when(i + off) + j * .012, pitch, quarter * .56, 48 + 9 * energy - j * 3)
        for off in (0, .5):
            pitch = [triad[0], triad[2], triad[1], triad[2] + 5][(beat * 2 + int(off * 2)) % 4]
            add('robin', when(i + off), pitch + 12, quarter * .57, 35 + 10 * energy)
        if beat in (1, 3) and (strong or i % 8 == 3):
            add('chopper', when(i + .5), triad[beat % 3] + 24, quarter * .34, 37 + 7 * energy)
        if beat in (0, 2):
            for pitch in triad[:2]:
                add('nami', at + .035, pitch + 12, quarter * (1.5 if strong else 1.1), 36 + 7 * energy)
            for pitch in triad:
                add('law', at + .06, pitch + 12, quarter * 1.85, 32 + 7 * energy)
            add('shanks', at + .025, min(triad, key=lambda n: abs(n - 54)), quarter * 1.80, 40 + 13 * energy)
    responses = []
    for a, b in gaps:
        a, b = a + .12, min(b - .15, score['duration'] - 2.)
        if b - a < .62:
            continue
        h = chord(a)
        third = 3 if h['minor'] else 4
        pitches = [60 + h['root'] + third, 67 + h['root'], 60 + h['root'], 60 + h['root'] + third]
        count = min(4, max(2, int((b - a) / (quarter * .5))))
        spacing = min(quarter * .5, (b - a) / count)
        for j in range(count):
            add('ace', a + j * spacing, pitches[j], spacing * .72, 48 + (5 if j == 0 else -j))
        responses.append([round(a, 3), round(a + count * spacing, 3)])
    for part in parts.values():
        part['events'].sort(key=lambda e: (e['start'], e['midi']))
        previous = {}
        clean = []
        for event in part['events']:
            prior = previous.get(event['midi'])
            if prior and event['start'] - prior['start'] < .008:
                prior['end'] = max(prior['end'], event['end'])
                prior['velocity'] = max(prior['velocity'], event['velocity'])
                continue
            if prior and prior['end'] >= event['start']:
                prior['end'] = round(event['start'] - .001, 6)
            previous[event['midi']] = event
            clean.append(event)
        part['events'] = clean
        assert part['events'], part['id']
    return parts, 60 / quarter, responses


def write_midi(parts, bpm, output):
    midi = mido.MidiFile(ticks_per_beat=960)
    tempo = mido.bpm2tempo(bpm)
    meta = mido.MidiTrack(); midi.tracks.append(meta)
    meta.append(mido.MetaMessage('set_tempo', tempo=tempo))
    channel = 0
    for part in parts.values():
        chan = 9 if part['id'] == 'sanji' else channel
        if chan != 9:
            channel += 1
        track = mido.MidiTrack(); midi.tracks.append(track)
        track.append(mido.MetaMessage('track_name', name=part['id']))
        track.append(mido.Message('program_change', channel=chan, program=part['program']))
        events = []
        for event in part['events']:
            for at, on in ((event['start'], True), (event['end'], False)):
                events.append((round(mido.second2tick(at, 960, tempo)), on, event['midi'], event['velocity']))
        last = 0
        for tick, on, pitch, velocity in sorted(events):
            track.append(mido.Message('note_on' if on else 'note_off', channel=chan, note=pitch,
                                      velocity=velocity if on else 0, time=tick-last))
            last = tick
    midi.save(output)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    out = args.out.resolve(); out.mkdir(parents=True, exist_ok=True)
    for name in ['stems', 'solo-mp3', 'solo-30s']:
        (out / name).mkdir(exist_ok=True)
    score = json.loads((ANALYSIS / 'score.json').read_text())
    assert sha(SOURCE) == score['sourceSha256']
    duration = score['duration']; frames = round(duration * RATE)
    dsp = helper_module(duration)
    print('Inferring source-derived harmonic draft', flush=True)
    harmony = infer_harmony(score)
    dump(out / 'harmony.json', harmony)
    raw, sr = sf.read(ANALYSIS / 'vocals.wav', dtype='float32', always_2d=True)
    assert sr == RATE and len(raw) == frames
    _, activity, gaps = dsp.vocal_activity(raw)
    parts, bpm, responses = compose(score, harmony, gaps, dsp)
    ir = dsp.room_impulse()
    backing = np.zeros((frames, 2), dtype='float32')
    fade = np.minimum(np.clip(np.arange(frames) / (.10 * RATE), 0, 1),
                      np.clip((frames - 1 - np.arange(frames)) / (1.3 * RATE), 0, 1)).astype('float32')
    for key, part in parts.items():
        print('Rendering', key, len(part['events']), 'notes', flush=True)
        audio = dsp.render_instrument(part, ir) * fade[:, None]
        assert np.isfinite(audio).all()
        backing += audio
        sf.write(out / 'stems' / f'{key}.wav', audio, RATE, subtype='FLOAT')
    # Rolling sums can have tiny negative roundoff in long silent passages.
    # Clamp power before sqrt; the old short-excerpt helper did not need this.
    guide = sosfilt(butter(2, 85, fs=RATE, btype='highpass', output='sos'), raw, axis=0)
    power = uniform_filter1d(np.mean(guide * guide, axis=1), round(.04 * RATE))
    envelope = np.sqrt(np.maximum(power, 0.))
    gain = np.minimum(1., (.10 / np.maximum(envelope, 1e-8)) ** (1. - 1. / 2.2))
    guide *= uniform_filter1d(gain, round(.03 * RATE))[:, None]
    levels = np.array([dsp.rms(guide[i:i+8820]) for i in range(0, frames, 8820)])
    active = levels[levels > max(float(levels.max()) * .1, .001)]
    assert active.size and np.isfinite(guide).all(), 'Original vocal guide is empty or invalid'
    guide *= .105 / float(np.quantile(active, .65))
    guide *= fade[:, None]
    # A guide using the existing original voice is explicitly separate from the
    # future choir; no copies, pitch shifts, or TTS are labelled new singers.
    scale = min(1., .88 / max(float(np.abs(backing).max()), float(np.abs(backing + guide).max())))
    backing *= scale; guide *= scale
    sf.write(out / 'one-day-accompaniment.wav', backing, RATE, subtype='PCM_24')
    sf.write(out / 'one-day-original-vocal-guide.wav', backing + guide, RATE, subtype='PCM_24')
    records, reconstructed = [], np.zeros_like(backing)
    for key, part in parts.items():
        path = out / 'stems' / f'{key}.wav'
        audio, _ = sf.read(path, dtype='float32', always_2d=True)
        sf.write(path, audio * scale, RATE, subtype='PCM_24')
        audio, sr = sf.read(path, dtype='float32', always_2d=True)
        reconstructed += audio
        part['audio'] = f'stems/{key}.wav'
        part['preview'] = f'solo-mp3/{key}.mp3'
        part['audioSha256'] = sha(path)
        rms = float(np.sqrt(np.mean(audio ** 2)))
        peak = float(np.abs(audio).max())
        assert sr == RATE and audio.shape == (frames, 2) and rms > .0001 and peak < .99
        assert all(0 <= e['start'] < e['end'] <= duration for e in part['events'])
        assert float(np.abs(audio[-round(.05 * RATE):]).max()) < .005
        records.append({'id': key, 'notes': len(part['events']), 'rms': rms, 'peak': peak,
                        'frames': len(audio), 'sha256': part['audioSha256']})
        encode(path, out / part['preview'])
        encode(path, out / 'solo-30s' / f'{key}.mp3', 65., 30.)
    error = float(np.sqrt(np.mean((reconstructed - backing) ** 2)))
    assert error < 1e-6 and len({p['sha256'] for p in records}) == 9
    write_midi(parts, bpm, out / 'one-day-nine-instruments.mid')
    manifest = {'version': 1, 'title': 'One day · 珍珠贝壳九件乐器制作稿',
                'trackId': 'anime_op_one_day', 'duration': duration, 'sampleRate': RATE,
                'sourceSha256': sha(SOURCE), 'bpmMeasured': bpm,
                'source': 'new-independent-arrangement', 'status': 'musical-audition-pending',
                'audition': {'sourceStart': 65., 'duration': 30., 'directory': 'solo-30s'},
                'harmonyStatus': 'waveform-derived estimate, not a certified score',
                'soundfont': {'file': str(dsp.FONT.relative_to(PROJECT)), 'sha256': sha(dsp.FONT)},
                'mixScale': scale, 'saxResponseWindows': responses,
                'vocalGuideActivity': activity, 'parts': list(parts.values()),
                'choir': {'status': 'blocked-source-required', 'generated': False,
                          'notice': 'Guide is separated original vocal. No newly performed choir is delivered.'},
                'integration': 'isolated production package; main player unchanged'}
    dump(out / 'arrangement.json', manifest)
    for name in ['one-day-accompaniment', 'one-day-original-vocal-guide']:
        encode(out / f'{name}.wav', out / f'{name}.mp3')
    encode(out / 'one-day-accompaniment.wav', out / 'audition-30s.mp3', 65., 30.)
    encode(out / 'one-day-original-vocal-guide.wav', out / 'guide-30s.mp3', 65., 30.)
    for name in ['anime_op_one_day.lrc', 'anime_op_one_day.zh.lrc']:
        shutil.copy2(PROJECT / 'output/audio' / name, out / name)
    license_path = dsp.FONT.parent / 'LICENSE.txt'
    if license_path.is_file():
        shutil.copy2(license_path, out / 'SOUNDFONT-LICENSE.txt')
    validation = {'passed': True, 'duration': duration, 'sampleRate': RATE,
                  'independentInstrumentCount': 9, 'parts': records,
                  'additiveMixRmsError': error,
                  'humanListeningPassed': False, 'choirDelivered': False,
                  'mainPlayerModified': False}
    dump(out / 'validation.json', validation)
    print(json.dumps({k:v for k,v in validation.items() if k != 'parts'}), flush=True)


if __name__ == '__main__':
    main()
