"""Render the approved local Pian Ai audition without changing the player.

Run with output/lu-band-runtime/bin/python. Nine newly arranged MIDI parts
and one separated original vocal have independent, additive audio ownership.
The source's model notes are evidence for editing, not a certified score.
"""
from pathlib import Path
import hashlib
import json
import math
import shutil
import subprocess
import sys
import zipfile

import mido
import numpy as np
import soundfile as sf
from scipy.ndimage import uniform_filter1d
from scipy.signal import butter, fftconvolve, sosfilt
import tinysoundfont

PROJECT = Path(__file__).resolve().parent.parent
ROOT = PROJECT / 'output/lu-band-arrangement/pianai-trial'
SOURCE = PROJECT / 'audio/pianai.mp3'
ANALYSIS = PROJECT / 'output/lu-band-song-parts/track_4'
FONT = PROJECT / 'output/lu-band-arrangement/bolero-trial/GeneralUser-GS.sf2'
RATE = 44100
START, END = 37.0, 96.0
DURATION = END - START
FRAMES = round(DURATION * RATE)
RNG = np.random.default_rng(20261016)

# These edited boundaries follow the measured bass changes and upper-voice
# pitch classes. They are a harmonic draft for user audition, not an original
# published score. Extensions below are new voicings for this ensemble.
HARMONY = [
    (37.0, 'E'), (41.657, 'Bm'), (43.375, 'E'), (45.093, 'F#m'),
    (46.811, 'D'), (48.530, 'Bm'), (51.943, 'E'), (55.380, 'F#m'),
    (57.098, 'E'), (58.816, 'Bm'), (60.534, 'F#m'), (62.229, 'D'),
    (63.948, 'E'), (65.666, 'F#m'), (69.079, 'Bm'), (70.798, 'E'),
    (72.516, 'F#m'), (74.234, 'D'), (75.952, 'Bm'), (77.671, 'D'),
    (79.389, 'E'), (82.826, 'F#m'), (84.521, 'D'), (86.239, 'E'),
    (89.652, 'F#m'), (91.394, 'D'), (93.112, 'E'),
]
CHORDS = {
    'E': {'root': 40, 'triad': [52, 56, 59], 'color': 66},
    'Bm': {'root': 35, 'triad': [50, 54, 59], 'color': 57},
    'F#m': {'root': 42, 'triad': [49, 54, 57], 'color': 64},
    'D': {'root': 38, 'triad': [50, 54, 57], 'color': 64},
}
DEFS = [
    ('sanji', '山治', '爵士鼓', 0, 0.00, .06, .030),
    ('zoro', '索隆', '指弹贝斯', 33, -.04, .02, .037),
    ('robin', '罗宾', '竖琴', 46, -.43, .23, .016),
    ('usopp', '乌索普', '尼龙弦吉他', 24, .35, .12, .031),
    ('ace', '艾斯', '次中音萨克斯', 66, -.18, .19, .025),
    ('nami', '娜美', '手风琴', 21, .25, .17, .018),
    ('chopper', '乔巴', '马林巴', 12, -.28, .22, .013),
    ('law', '罗', '温暖合成器', 89, .18, .26, .015),
    ('shanks', '香克斯', '大提琴', 42, -.23, .19, .023),
]


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def run(command):
    result = subprocess.run(command, capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-1800:])
    return result.stdout


def rms(data):
    return float(np.sqrt(np.mean(np.asarray(data, dtype='float64') ** 2)))


def read_segment(path):
    data, rate = sf.read(path, start=round(START * RATE), stop=round(END * RATE),
                         dtype='float32', always_2d=True)
    assert rate == RATE and data.shape == (FRAMES, 2), path
    return data


def note(part, at, pitch, length, velocity, jitter=.006):
    start = max(0.0, at - START + float(RNG.uniform(-jitter, jitter)))
    end = min(DURATION - .75, start + length)
    if end <= start or start >= DURATION - 1:
        return
    part['events'].append({'start': round(start, 6), 'end': round(end, 6),
                           'midi': int(pitch), 'velocity': int(np.clip(velocity, 1, 120))})


def chord_at(at):
    return next(label for when, label in reversed(HARMONY) if when <= max(START, at))


def vocal_activity(audio):
    # Measure the actual waveform, not the model's guessed vocal notes.
    step = round(.02 * RATE)
    frames = np.pad(audio.mean(axis=1), (0, (-len(audio)) % step)).reshape(-1, step)
    levels = np.sqrt(np.mean(frames * frames, axis=1))
    levels = uniform_filter1d(levels, 7)
    gate = max(.009, float(np.quantile(levels, .9)) * .19)
    mask = levels > gate
    # Bridge short gaps within syllables; retain longer breaths for responses.
    off = np.flatnonzero(np.diff(np.r_[True, mask, True].astype(int)))
    for a, b in zip(off[::2], off[1::2]):
        if (b - a) * .02 < .30:
            mask[a:b] = True
    transitions = np.flatnonzero(np.diff(np.r_[False, mask, False].astype(int)))
    active = [(max(0, a * .02 - .10), min(DURATION, b * .02 + .12))
              for a, b in zip(transitions[::2], transitions[1::2])]
    gaps, last = [], 0.0
    for a, b in active + [(DURATION, DURATION)]:
        if a - last >= .65:
            gaps.append((last, a))
        last = max(last, b)
    return levels, active, gaps


def build_parts(score, gaps):
    parts = {key: {'id': key, 'actorId': f'one-piece/{key}', 'name': name,
                   'instrument': label, 'program': program, 'pan': pan,
                   'room': room, 'targetActiveRms': target,
                   'source': 'newly-arranged-midi', 'events': []}
             for key, name, label, program, pan, room, target in DEFS}
    original_beats = np.array(score['beatTimes'])
    selected = original_beats[(original_beats >= 35) & (original_beats <= 96)]
    quarter, _ = np.polyfit(np.arange(len(selected)), selected, 1)
    bpm = 60 / quarter
    # Use measured beat timestamps for scheduling; fit only labels the tempo.
    def tick(index):
        return float(np.interp(index, np.arange(len(original_beats)), original_beats))
    anchor = int(np.argmin(abs(original_beats - 55.380)))
    for index, at in enumerate(original_beats):
        if not START <= at < END - .8:
            continue
        beat = (index - anchor) % 4
        chorus = at >= 55.3
        intensity = .78 if chorus else .48
        c = CHORDS[chord_at(at)]
        root, triad = c['root'], c['triad']
        # Main pulse has independent bass articulation and drum fills.
        note(parts['zoro'], at, root, quarter * (.86 if beat != 3 else .64),
             65 + round(15 * intensity) + (5 if beat == 0 else 0))
        if chorus and beat in (1, 3):
            note(parts['zoro'], tick(index + .5), root + (7 if beat == 1 else 12),
                 quarter * .30, 52)
        if beat in (0, 2):
            note(parts['sanji'], at, 36, .13, 62 + int(22 * intensity), .002)
        if beat in (1, 3):
            note(parts['sanji'], at, 38 if chorus else 37, .12,
                 66 if chorus else 48, .002)
        for half in (0, .5):
            note(parts['sanji'], tick(index + half), 42, .07,
                 (38 if half else 49) + (7 if chorus else 0), .003)
        if index == anchor:
            note(parts['sanji'], at, 49, .32, 64, .002)
        if chorus and beat == 3 and (index - anchor) % 16 == 15:
            for fraction, drum in [(.50, 38), (.75, 45)]:
                note(parts['sanji'], tick(index + fraction), drum, .1, 52, .002)
        # Guitar supplies short, interleaved chord strokes; harp separates notes.
        strokes = (0, .75) if chorus else (0,)
        for stroke in strokes:
            if not chorus and beat not in (0, 2):
                continue
            for j, pitch in enumerate(triad):
                note(parts['usopp'], tick(index + stroke) + j * .014, pitch,
                     quarter * (.36 if stroke else .65),
                     49 + (10 if chorus else 0) - j * 3)
        for half in (0, .5):
            harp = [triad[0] + 12, triad[2] + 12, triad[1] + 12, c['color'] + 12]
            note(parts['robin'], tick(index + half), harp[(beat * 2 + int(half * 2)) % 4],
                 quarter * .63, 40 + (6 if chorus else 0))
        # Sustained voices enter with space around the singer.
        boundary = index == anchor or any(abs(at - t) < .06 for t, _ in HARMONY)
        if boundary:
            next_change = next((t for t, _ in HARMONY if t > at + .06), END)
            length = min(next_change - at - .10, quarter * 3.8)
            if length > .1:
                if chorus:
                    for pitch in triad[:2]:
                        note(parts['nami'], at + .035, pitch + 12, length * .78, 42)
                    for pitch in triad:
                        note(parts['law'], at + .06, pitch + 12, length, 40)
                cello = min(triad, key=lambda n: abs(n - (54 if chorus else 50)))
                note(parts['shanks'], at + .025, cello, length * .96,
                     54 if chorus else 40)
        if chorus and beat in (1, 3):
            note(parts['chopper'], tick(index + .5), triad[beat % 3] + 24,
                 quarter * .35, 43 if beat == 1 else 37)

    # Brass answers are composed inside measured vocal gaps, with margins.
    sax_windows = []
    for a, b in gaps:
        a, b = a + .10, min(b - .12, DURATION - 1.2)
        if b - a < .48 or a < 1.1:
            continue
        count = min(4, max(2, int((b - a) / (quarter * .45))))
        spacing = min(quarter * .5, (b - a) / count)
        c = CHORDS[chord_at(START + a)]
        pitches = [c['triad'][1] + 12, c['triad'][2] + 12,
                   c['triad'][0] + 12, c['triad'][1] + 12]
        for i in range(count):
            note(parts['ace'], START + a + i * spacing, pitches[i],
                 spacing * .74, 52 + (5 if i == 0 else -i * 2), .003)
        sax_windows.append([round(a, 3), round(a + count * spacing, 3)])
    if not parts['ace']['events']:
        raise RuntimeError('No usable vocal gap for saxophone; revise the excerpt')
    # A head cut can begin inside a sustained chord. Give those parts a short
    # pickup instead of starting with an unsupported, arbitrary downbeat.
    for key in ['shanks']:
        note(parts[key], START + .06, 52, .62, 38, .001)
    for part in parts.values():
        part['events'].sort(key=lambda e: (e['start'], e['midi']))
        previous = {}
        for event in part['events']:
            prior = previous.get(event['midi'])
            if prior and prior['end'] >= event['start']:
                prior['end'] = round(max(prior['start'] + .001, event['start'] - .003), 6)
            previous[event['midi']] = event
    return parts, float(bpm), sax_windows


def room_impulse():
    t = np.arange(round(.9 * RATE)) / RATE
    ir = np.random.default_rng(77).normal(size=len(t)) * np.exp(-t * 7)
    ir[:round(.023 * RATE)] = 0
    for delay, gain in [(.029, 9), (.047, 6), (.071, 4)]:
        ir[round(delay * RATE)] += gain
    return (ir * .10 / np.sqrt(np.sum(ir * ir))).astype('float32')


def render_instrument(part, ir):
    synth = tinysoundfont.Synth(gain=-9, samplerate=RATE)
    sfid = synth.sfload(str(FONT))
    drums = part['id'] == 'sanji'
    synth.program_select(0, sfid, 128 if drums else 0, part['program'], is_drums=drums)
    synth.control_change(0, 7, 108)
    queue = []
    for event in part['events']:
        queue += [(round(event['start'] * RATE), 1, event['midi'], event['velocity']),
                  (round(event['end'] * RATE), 0, event['midi'], 0)]
    queue.sort()
    data = np.zeros((FRAMES, 2), dtype='float32')
    cursor = 0
    # Count overlapping equal pitches so one note-off cannot kill a later note.
    sounding = {}
    for at, on, pitch, velocity in queue + [(FRAMES, 0, -1, 0)]:
        if at > cursor:
            data[cursor:at] = np.frombuffer(synth.generate(at - cursor), dtype='float32').reshape(-1, 2)
            cursor = at
        if pitch < 0:
            continue
        if on:
            sounding[pitch] = sounding.get(pitch, 0) + 1
            assert synth.noteon(0, pitch, velocity), (part['id'], pitch)
        else:
            sounding[pitch] -= 1
            if sounding[pitch] == 0:
                synth.noteoff(0, pitch)
    mono = data.mean(axis=1)
    if part['id'] != 'zoro':
        cutoff = 130 if part['id'] in ['law', 'nami'] else 75
        mono = sosfilt(butter(2, cutoff, btype='highpass', fs=RATE, output='sos'), mono).astype('float32')
    angle = (part['pan'] + 1) * math.pi / 4
    stereo = mono[:, None] * np.array([math.cos(angle), math.sin(angle)], dtype='float32')
    wet = fftconvolve(mono, ir)[:FRAMES].astype('float32')
    other = np.r_[np.zeros(round(.011 * RATE)), wet[:-round(.011 * RATE)]]
    stereo += part['room'] * np.column_stack([wet, other])
    # Use active 200ms blocks for calibration; sparse fills keep natural rests.
    step = round(.2 * RATE)
    levels = np.array([rms(stereo[i:i+step]) for i in range(0, FRAMES, step)])
    active = levels[levels > max(1e-7, float(levels.max()) * .06)]
    assert len(active), part['id']
    measured = float(np.quantile(active, .65))
    gain = part['targetActiveRms'] / measured
    stereo *= gain
    part['calibration'] = {'activeBlockRms': measured, 'gain': gain}
    return stereo.astype('float32')


def process_vocal(raw):
    data = sosfilt(butter(2, 85, fs=RATE, btype='highpass', output='sos'), raw, axis=0)
    # Mild, linked compression preserves the recorded performance and stereo.
    envelope = np.sqrt(uniform_filter1d(np.mean(data * data, axis=1), round(.04 * RATE)))
    threshold, ratio = .10, 2.2
    gain = np.minimum(1, (threshold / np.maximum(envelope, 1e-8)) ** (1 - 1/ratio))
    gain = uniform_filter1d(gain, round(.03 * RATE))
    data *= gain[:, None]
    # No invented vocal notes and no re-synthesized singer in the audition.
    step = round(.2 * RATE)
    levels = np.array([rms(data[i:i+step]) for i in range(0, FRAMES, step)])
    active = levels[levels > max(levels.max() * .1, .001)]
    calibration = .105 / float(np.quantile(active, .65))
    return (data * calibration).astype('float32'), calibration


def export_midi(parts, bpm):
    midi = mido.MidiFile(ticks_per_beat=960, charset='utf-8')
    tempo = mido.bpm2tempo(bpm)
    meta = mido.MidiTrack(); midi.tracks.append(meta)
    meta.append(mido.MetaMessage('set_tempo', tempo=tempo))
    meta.append(mido.MetaMessage('time_signature', numerator=4, denominator=4))
    meta.append(mido.MetaMessage('track_name', name='New accompaniment; original vocal is audio only'))
    channel = 0
    for part in parts.values():
        chan = 9 if part['id'] == 'sanji' else channel
        if chan != 9:
            channel += 1
        track = mido.MidiTrack(); midi.tracks.append(track)
        track.append(mido.MetaMessage('track_name', name=f"{part['id']} - {part['instrument']}"))
        track.append(mido.Message('program_change', channel=chan, program=part['program']))
        queue = []
        for e in part['events']:
            for when, on in [(e['start'], True), (e['end'], False)]:
                ticks = round(mido.second2tick(when, 960, tempo))
                queue.append((ticks, on, e['midi'], e['velocity']))
        previous = 0
        for ticks, on, pitch, velocity in sorted(queue):
            track.append(mido.Message('note_on' if on else 'note_off', channel=chan,
                                      note=pitch, velocity=velocity if on else 0, time=ticks - previous))
            previous = ticks
    midi.save(ROOT / 'pianai-accompaniment.mid')


def mp3(wav, target, bitrate='256k'):
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-codec:a', 'libmp3lame',
         '-b:a', bitrate, str(target)])


def validate(manifest):
    mix, rate = sf.read(ROOT / 'pianai-vocal-band.wav', always_2d=True)
    backing, _ = sf.read(ROOT / 'pianai-accompaniment.wav', always_2d=True)
    summed, band = np.zeros_like(mix), np.zeros_like(mix)
    checks = []
    assert rate == RATE and mix.shape == (FRAMES, 2)
    assert len(manifest['parts']) == 10
    assert len({p['actorId'] for p in manifest['parts']}) == 10
    for p in manifest['parts']:
        path = ROOT / p['audio']
        audio, sr = sf.read(path, always_2d=True)
        assert sr == rate and audio.shape == mix.shape
        assert sha(path) == p['audioSha256']
        assert np.isfinite(audio).all() and np.abs(audio).max() < .99
        assert rms(audio) > 1e-4, p['id']
        summed += audio
        if p['source'] == 'newly-arranged-midi':
            band += audio
            assert p['events'] and all(0 <= e['start'] < e['end'] <= DURATION and
                   0 <= e['midi'] <= 127 and 0 < e['velocity'] <= 127 for e in p['events'])
            previous = {}
            for e in p['events']:
                assert previous.get(e['midi'], -1) < e['start'], p['id']
                previous[e['midi']] = e['end']
        assert rms(audio[-round(.05 * RATE):]) < .001, p['id']
        checks.append({'actor': p['name'], 'source': p['source'], 'rms': rms(audio),
                       'peak': float(np.abs(audio).max()), 'notes': len(p.get('events', []))})
    error = rms(mix - summed); band_error = rms(backing - band)
    assert np.isfinite(mix).all() and np.abs(mix).max() < .95
    assert error < 2e-6 and band_error < 2e-6
    midi = mido.MidiFile(ROOT / 'pianai-accompaniment.mid')
    onsets = sum(m.type == 'note_on' and m.velocity > 0 for t in midi.tracks for m in t)
    assert len(midi.tracks) == 10
    assert onsets == sum(len(p.get('events', [])) for p in manifest['parts'])
    tempo = next(m.tempo for m in midi.tracks[0] if m.type == 'set_tempo')
    midi_error = 0.0
    for track, part in zip(midi.tracks[1:], [p for p in manifest['parts'] if p['source'] == 'newly-arranged-midi']):
        tick, actual, expected = 0, {}, {}
        for message in track:
            tick += message.time
            if message.type in ['note_on', 'note_off']:
                key = (message.type, message.note, message.velocity)
                actual.setdefault(key, []).append(mido.tick2second(tick, midi.ticks_per_beat, tempo))
        for event in part['events']:
            expected.setdefault(('note_on', event['midi'], event['velocity']), []).append(event['start'])
            expected.setdefault(('note_off', event['midi'], 0), []).append(event['end'])
        assert actual.keys() == expected.keys()
        # Events that quantize to one MIDI tick may change their relative order.
        # Match within pitch/type/velocity instead of comparing adjacent events.
        for key in expected:
            assert len(actual[key]) == len(expected[key])
            for a, e in zip(sorted(actual[key]), sorted(expected[key])):
                midi_error = max(midi_error, abs(a - e))
    assert midi_error < .001
    assert rms(mix - backing) > .015
    for name in ['pianai-vocal-band', 'pianai-accompaniment', 'pianai-original-reference']:
        info = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams',
                               '-of', 'json', str(ROOT / f'{name}.mp3')]))
        assert info['streams'][0]['channels'] == 2
        assert abs(float(info['format']['duration']) - DURATION) < .15
    solo_files = sorted((ROOT / 'solo-mp3').glob('*.mp3'))
    assert len(solo_files) == 10
    for path in solo_files:
        info = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams',
                               '-of', 'json', str(path)]))
        assert info['streams'][0]['channels'] == 2
        assert abs(float(info['format']['duration']) - DURATION) < .15
    result = {'status': 'pass', 'duration': DURATION, 'channels': 2,
              'sampleRate': RATE, 'mixPeak': float(np.abs(mix).max()),
              'mixRms': rms(mix), 'mixEqualsTenStemSumRmsError': error,
              'backingEqualsNineStemSumRmsError': band_error,
              'independentStems': 10, 'synthesizedParts': 9,
              'midiTracksIncludingMeta': len(midi.tracks), 'midiNotes': onsets,
              'midiEventMaxErrorSeconds': midi_error, 'soloMp3Files': len(solo_files),
              'subjectiveListening': 'pending user audition',
              'harmonyReview': 'edited candidate from source measurements; listening pending',
              'playerIntegration': 'not part of this phase', 'parts': checks}
    (ROOT / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / 'stems').mkdir(exist_ok=True)
    (ROOT / 'solo-mp3').mkdir(exist_ok=True)
    score = json.loads((ANALYSIS / 'score.json').read_text())
    assert sha(SOURCE) == score['sourceSha256'], 'Source audio changed; re-analyze first'
    assert FONT.is_file()
    raw_vocal = read_segment(ANALYSIS / 'vocals.wav')
    levels, activity, gaps = vocal_activity(raw_vocal)
    parts, bpm, responses = build_parts(score, gaps)
    ir = room_impulse()
    voice, voice_calibration = process_vocal(raw_vocal)
    # Linked backing ducking leaves room for the actual singer without muting
    # sparse response phrases. The gains are baked into independent stems.
    loudness = np.interp(np.arange(FRAMES) / RATE, np.arange(len(levels)) * .02, levels)
    speech = np.clip(loudness / max(float(np.quantile(levels, .75)), .01), 0, 1)
    fade = np.ones(FRAMES, dtype='float32')
    fade[:round(.18 * RATE)] = np.linspace(0, 1, round(.18 * RATE))
    fade[-round(1.1 * RATE):] = np.linspace(1, 0, round(1.1 * RATE))
    voice *= fade[:, None]
    backing = np.zeros_like(voice, dtype='float64')
    for key, part in parts.items():
        audio = render_instrument(part, ir)
        duck = .24 if key in ['nami', 'law'] else .13 if key in ['robin', 'usopp'] else .06
        audio *= ((1 - duck * speech) * fade)[:, None]
        sf.write(ROOT / 'stems' / f'{key}.wav', audio, RATE, subtype='FLOAT')
        backing += audio
        print('Rendered', part['name'], part['instrument'], len(part['events']), flush=True)
    mix = backing + voice
    scale = .87 / max(float(np.abs(mix).max()), float(np.abs(backing).max()))
    mix *= scale; backing *= scale; voice *= scale
    sf.write(ROOT / 'pianai-vocal-band.wav', mix, RATE, subtype='PCM_24')
    sf.write(ROOT / 'pianai-accompaniment.wav', backing, RATE, subtype='PCM_24')
    sf.write(ROOT / 'stems/luffy.wav', voice, RATE, subtype='PCM_24')
    for key, part in parts.items():
        path = ROOT / 'stems' / f'{key}.wav'
        audio, _ = sf.read(path, dtype='float32', always_2d=True)
        sf.write(path, audio * scale, RATE, subtype='PCM_24')
        part['audio'] = f'stems/{key}.wav'
        part['audioSha256'] = sha(path)
    vocal = {'id': 'luffy', 'actorId': 'one-piece/luffy', 'name': '路飞',
             'instrument': '主唱 · 分离原唱', 'source': 'separated-original-vocal',
             'audio': 'stems/luffy.wav', 'audioSha256': sha(ROOT / 'stems/luffy.wav'),
             'sourceAudio': str((ANALYSIS / 'vocals.wav').relative_to(PROJECT)),
             'sourceAudioSha256': sha(ANALYSIS / 'vocals.wav'),
             'processing': {'highpassHz': 85, 'compressionRatio': 2.2,
                            'calibrationGain': voice_calibration},
             'activityIntervals': activity, 'events': [],
             'notice': 'Recorded vocal retained; no synthesized vocal notes or original-score claim'}
    export_midi(parts, bpm)
    source_bytes = run(['ffmpeg', '-v', 'error', '-ss', str(START), '-i', str(SOURCE),
                        '-t', str(DURATION), '-f', 'f32le', '-ar', str(RATE), '-ac', '2', '-'])
    reference = np.frombuffer(source_bytes, dtype='float32').reshape(-1, 2).copy()
    assert reference.shape == mix.shape
    # Match overall RMS for A/B evaluation rather than making the new mix win
    # just by being louder. Limit only by static gain to keep the reference intact.
    reference *= min(rms(mix) / rms(reference), .95 / np.abs(reference).max())
    reference *= fade[:, None]
    sf.write(ROOT / 'pianai-original-reference.wav', reference, RATE, subtype='PCM_24')
    manifest = {'version': 1, 'title': '偏爱 · 原唱与十人乐队试听',
                'source': 'hybrid-arrangement-audition', 'sourceTrackId': 'track_4',
                'sourceSha256': sha(SOURCE), 'sourceExcerpt': {'start': START, 'end': END},
                'duration': DURATION, 'bpmMeasured': bpm,
                'timeSignature': [4, 4], 'timeSignatureStatus': 'arrangement choice',
                'theme': 'one-piece', 'mixScale': scale,
                'soundfont': {'path': str(FONT.relative_to(PROJECT)), 'sha256': sha(FONT)},
                'harmony': [{'sourceTime': t, 'time': round(t - START, 4), 'chord': c}
                            for t, c in HARMONY],
                'harmonyStatus': 'edited source-derived draft; user listening pending',
                'saxResponseWindows': responses,
                'parts': [vocal, *parts.values()],
                'integration': 'isolated audition only; main player unchanged'}
    (ROOT / 'arrangement.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    for name in ['pianai-vocal-band', 'pianai-accompaniment', 'pianai-original-reference']:
        mp3(ROOT / f'{name}.wav', ROOT / f'{name}.mp3')
    for index, part in enumerate(manifest['parts'], 1):
        filename = f'{index:02d}-{part["name"]}-{part["instrument"]}.mp3'
        mp3(ROOT / part['audio'], ROOT / 'solo-mp3' / filename, '192k')
    license_source = FONT.parent / 'LICENSE.txt'
    if license_source.is_file():
        shutil.copy2(license_source, ROOT / 'SOUNDFONT-LICENSE.txt')
    finalize(manifest)


def finalize(manifest):
    result = validate(manifest)
    audition_index = {'title': manifest['title'], 'duration': DURATION,
                      'sourceExcerpt': manifest['sourceExcerpt'],
                      'parts': [{'actor': p['name'], 'instrument': p['instrument'],
                                 'source': p['source'],
                                 'file': f'solo-mp3/{i:02d}-{p["name"]}-{p["instrument"]}.mp3'}
                                for i, p in enumerate(manifest['parts'], 1)],
                      'note': 'MP3s retain the mix gain and aligned start. Full WAVs and renderer remain in the local project.'}
    (ROOT / 'audition-index.json').write_text(json.dumps(audition_index, ensure_ascii=False, indent=2))
    (ROOT / 'AUDITION-README.txt').write_text(
        '偏爱 · 59 秒十人乐队试听\n'
        'solo-mp3 为对齐起点、保留混音音量的十名角色独立试听。\n'
        '路飞为分离原唱，其余九人为新写 MIDI 配器的采样合成音轨。\n'
        'audition-index.json 对应包内 MP3；arrangement.json 记录完整制作事件，'
        '其中 WAV 与音源路径对应本地项目，不包含在此试听包。\n'
        'pianai-accompaniment.mid 包含九件乐器，人声保持音频形式。\n'
        '数值检查通过；和声、配器、音色及分离人声听感待用户试听确认。\n')
    # A self-contained audition handoff; original/reference audio remains local.
    with zipfile.ZipFile(ROOT / 'pianai-solo-auditions.zip', 'w', zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted((ROOT / 'solo-mp3').glob('*.mp3')):
            bundle.write(path, path.relative_to(ROOT))
        for name in ['AUDITION-README.txt', 'audition-index.json', 'arrangement.json', 'validation.json', 'pianai-accompaniment.mid', 'SOUNDFONT-LICENSE.txt']:
            path = ROOT / name
            if path.exists():
                bundle.write(path, path.name)
    with zipfile.ZipFile(ROOT / 'pianai-solo-auditions.zip') as bundle:
        assert bundle.testzip() is None
        assert len([p for p in bundle.namelist() if p.endswith('.mp3')]) == 10
    print(json.dumps({k: v for k, v in result.items() if k != 'parts'}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    if '--validate-only' in sys.argv:
        finalize(json.loads((ROOT / 'arrangement.json').read_text()))
    else:
        main()
