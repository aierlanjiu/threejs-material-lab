"""Original-first audition: untouched master plus one optional, quiet overdub.

Run with output/lu-band-runtime/bin/python. No player/stage changes. Keep the
rejected full-arrangement trial so its audio and provenance remain recoverable.
"""
from pathlib import Path
import hashlib
import json
import subprocess

import mido
import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt
import tinysoundfont

PROJECT = Path(__file__).resolve().parent.parent
ROOT = PROJECT / 'output/lu-band-arrangement/pianai-original-first'
SOURCE = PROJECT / 'audio/pianai.mp3'
PRIOR = PROJECT / 'output/lu-band-arrangement/pianai-trial/arrangement.json'
FONT = PROJECT / 'output/lu-band-arrangement/bolero-trial/GeneralUser-GS.sf2'
RATE, START, END = 44100, 37.0, 96.0
DURATION = END - START
FRAMES = round(DURATION * RATE)
WINDOWS = [(3.82, 5.10), (30.98, 31.74)]
# New, optional replies: B/F# across E(add9)->Bm, then F#/C# over F#m.
# These are new notes; no claim that a harp exists in the original recording.
NOTES = [
    {'start': 3.88, 'end': 4.13, 'midi': 71, 'velocity': 41},
    {'start': 4.32, 'end': 4.59, 'midi': 66, 'velocity': 36},
    {'start': 31.04, 'end': 31.23, 'midi': 66, 'velocity': 39},
    {'start': 31.39, 'end': 31.54, 'midi': 73, 'velocity': 33},
]


def run(command):
    result = subprocess.run(command, capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-1400:])
    return result.stdout


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def rms(samples):
    return float(np.sqrt(np.mean(np.asarray(samples, dtype='float64') ** 2)))


def decode_source():
    raw = run(['ffmpeg', '-v', 'error', '-ss', str(START), '-i', str(SOURCE),
               '-t', str(DURATION), '-f', 'f32le', '-ar', str(RATE), '-ac', '2', '-'])
    data = np.frombuffer(raw, dtype='float32').reshape(-1, 2)
    assert data.shape == (FRAMES, 2)
    return data.astype('float64')


def render_harp():
    synth = tinysoundfont.Synth(gain=-9, samplerate=RATE)
    sfid = synth.sfload(str(FONT))
    synth.program_select(0, sfid, 0, 46)
    queue = []
    for e in NOTES:
        queue.extend([(round(e['start'] * RATE), True, e['midi'], e['velocity']),
                      (round(e['end'] * RATE), False, e['midi'], 0)])
    audio = np.zeros((FRAMES, 2), dtype='float32')
    cursor = 0
    for at, on, pitch, velocity in sorted(queue) + [(FRAMES, False, -1, 0)]:
        if at > cursor:
            audio[cursor:at] = np.frombuffer(synth.generate(at-cursor), dtype='float32').reshape(-1, 2)
            cursor = at
        if pitch >= 0:
            if on:
                assert synth.noteon(0, pitch, velocity)
            else:
                synth.noteoff(0, pitch)
    mono = sosfilt(butter(2, 180, fs=RATE, btype='highpass', output='sos'), audio.mean(axis=1))
    t = np.arange(round(.28 * RATE)) / RATE
    ir = np.random.default_rng(16).normal(size=len(t)) * np.exp(-t * 22)
    ir[:round(.018 * RATE)] = 0
    ir *= .025 / np.sqrt(np.sum(ir * ir))
    wet = fftconvolve(mono, ir)[:FRAMES]
    return np.column_stack([mono * .82 + wet, mono * .57 + wet * .8])


def write_mp3(wav, mp3):
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-codec:a', 'libmp3lame',
         '-b:a', '256k', str(mp3)])


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    prior = json.loads(PRIOR.read_text())
    assert sha(SOURCE) == prior['sourceSha256']
    voice_intervals = prior['parts'][0]['activityIntervals']
    for start, end in WINDOWS:
        assert all(min(end, b) <= max(start, a) for a, b in voice_intervals)
    original = decode_source()
    fade = np.ones(FRAMES)
    fade[:round(.10 * RATE)] = np.linspace(0, 1, round(.10 * RATE))
    fade[-round(.60 * RATE):] = np.linspace(1, 0, round(.60 * RATE))
    original *= fade[:, None]
    raw_harp = render_harp()
    extra = np.zeros_like(original)
    support = np.zeros(FRAMES, dtype=bool)
    levels = []
    for start, end in WINDOWS:
        a, b = round(start * RATE), round(end * RATE)
        mask = np.ones(b-a)
        attack, release = round(.06 * RATE), round(.18 * RATE)
        mask[:attack] = np.sin(np.linspace(0, np.pi/2, attack)) ** 2
        mask[-release:] = np.cos(np.linspace(0, np.pi/2, release)) ** 2
        samples = raw_harp[a:b] * mask[:, None]
        before = rms(samples)
        assert before > 1e-6
        # At most -20dB relative to the original in its own window. This leaves
        # the recording's master balance intact and makes the added part optional.
        gain = min(rms(original[a:b]) * .10 / before,
                   np.abs(original[a:b]).max() * .12 / np.abs(samples).max())
        extra[a:b] = samples * gain
        support[a:b] = True
        levels.append({'start': start, 'end': end,
                       'rmsBelowOriginalDb': 20 * np.log10(rms(extra[a:b]) / rms(original[a:b]))})
    # One fixed gain shared by both versions; no EQ, compression, vocal
    # separation, stretching or replacement of anything in the original master.
    gain = .76 / max(np.abs(original).max(), np.abs(original + extra).max())
    base, overdub = original * gain, extra * gain
    enhanced = base + overdub
    wavs = {'pianai-original': base, 'pianai-original-plus-harp': enhanced,
            'robin-optional-harp': overdub}
    for name, samples in wavs.items():
        sf.write(ROOT / f'{name}.wav', samples, RATE, subtype='PCM_24')
        write_mp3(ROOT / f'{name}.wav', ROOT / f'{name}.mp3')
    # Short A/B sequence: each pair is dry then optional harp, at the same gain.
    silence = np.zeros((round(.35 * RATE), 2))
    comparisons, cue = [], []
    cursor = 0.0
    for start in [2.0, 29.0]:
        a, b = round(start * RATE), round((start+5) * RATE)
        for label, samples in [('原曲', base), ('加入轻竖琴', enhanced)]:
            segment = samples[a:b].copy()
            edge = round(.035 * RATE)
            segment[:edge] *= np.linspace(0, 1, edge)[:, None]
            segment[-edge:] *= np.linspace(1, 0, edge)[:, None]
            comparisons.extend([segment, silence])
            cue.append({'time': cursor, 'label': label, 'sourceStart': START + start})
            cursor += 5.35
    comparison = np.concatenate(comparisons)
    sf.write(ROOT / 'pianai-ab-comparison.wav', comparison, RATE, subtype='PCM_24')
    write_mp3(ROOT / 'pianai-ab-comparison.wav', ROOT / 'pianai-ab-comparison.mp3')
    # Exact rendering events, only for the added harp. The original is a single
    # group, so it must never masquerade as ten independent role stems.
    midi = mido.MidiFile(ticks_per_beat=960)
    meta = mido.MidiTrack(); midi.tracks.append(meta)
    meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(70)))
    track = mido.MidiTrack(); midi.tracks.append(track)
    track.append(mido.MetaMessage('track_name', name='Robin optional harp'))
    track.append(mido.Message('program_change', channel=0, program=46))
    queue = []
    for e in NOTES:
        for at, on in [(e['start'], True), (e['end'], False)]:
            queue.append((round(mido.second2tick(at, 960, mido.bpm2tempo(70))),
                          on, e['midi'], e['velocity']))
    previous = 0
    for at, on, pitch, velocity in sorted(queue):
        track.append(mido.Message('note_on' if on else 'note_off', channel=0,
                                  note=pitch, velocity=velocity if on else 0, time=at-previous))
        previous = at
    midi.save(ROOT / 'robin-optional-harp.mid')
    manifest = {'version': 1, 'source': 'original-master-with-optional-overdub',
                'title': '偏爱 · 原曲优先试听', 'duration': DURATION,
                'sourceTrackId': 'track_4', 'sourceSha256': sha(SOURCE),
                'sourceExcerpt': {'start': START, 'end': END},
                'originalProcessing': {'fixedGain': gain, 'headFadeSeconds': .1, 'tailFadeSeconds': .6},
                'base': {'id': 'original-master', 'audio': 'pianai-original.wav',
                         'independentInstrumentStems': False,
                         'controlScope': 'whole original recording; instrument identity remains unverified'},
                'optionalParts': [{'id': 'robin-harp', 'actorId': 'one-piece/robin',
                                   'instrumentId': 'harp', 'source': 'newly-arranged-midi',
                                   'audio': 'robin-optional-harp.wav', 'events': NOTES,
                                   'windows': WINDOWS, 'windowLevels': levels}],
                'comparisonCues': cue, 'subjectiveListening': 'pending user audition',
                'playerIntegration': 'not part of this audio-only phase'}
    for item in [manifest['base'], *manifest['optionalParts']]:
        item['audioSha256'] = sha(ROOT / item['audio'])
    (ROOT / 'arrangement.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    # Validate against the decoded source, not just self-reported metadata.
    decoded = decode_source() * fade[:, None] * gain
    stored_base, rate = sf.read(ROOT / 'pianai-original.wav', always_2d=True)
    stored_mix, _ = sf.read(ROOT / 'pianai-original-plus-harp.wav', always_2d=True)
    stored_extra, _ = sf.read(ROOT / 'robin-optional-harp.wav', always_2d=True)
    base_error = float(np.abs(stored_base - decoded).max())
    sum_error = float(np.abs(stored_mix - stored_base - stored_extra).max())
    recovery_error = float(np.abs((stored_mix-stored_extra) - stored_base).max())
    outside_error = float(np.abs(stored_mix[~support] - stored_base[~support]).max())
    assert rate == RATE and stored_mix.shape == (FRAMES, 2)
    assert base_error < 1.3e-7 and sum_error < 2.5e-7
    assert recovery_error < 2.5e-7 and outside_error == 0
    assert rms(stored_extra) > 1e-5 and np.isfinite(stored_mix).all()
    assert np.abs(stored_mix).max() < .8
    assert rms(stored_mix[-round(.02 * RATE):]) < .001
    for name, expected_duration in [('pianai-original', DURATION),
                                    ('pianai-original-plus-harp', DURATION),
                                    ('robin-optional-harp', DURATION),
                                    ('pianai-ab-comparison', len(comparison)/RATE)]:
        info = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams',
                               '-of', 'json', str(ROOT / f'{name}.mp3')]))
        assert info['streams'][0]['channels'] == 2
        assert abs(float(info['format']['duration']) - expected_duration) < .15
    result = {'status': 'pass', 'duration': DURATION,
              'originalProcessing': 'only a common fixed gain and clip-edge fades',
              'maxSourcePreservationError': base_error,
              'maxAdditiveMixError': sum_error, 'maxBypassRecoveryError': recovery_error,
              'maxDifferenceOutsideOverdubWindows': outside_error,
              'overdubWindowsSeconds': sum(b-a for a, b in WINDOWS),
              'newInstrumentParts': 1, 'newNotes': len(NOTES),
              'mixPeak': float(np.abs(stored_mix).max()), 'windowLevels': levels,
              'subjectiveListening': 'pending user audition'}
    (ROOT / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
