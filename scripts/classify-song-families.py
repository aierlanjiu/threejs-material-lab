"""Independent audio-model evidence for supplied song-family annotations.

Uses local PCM and the public AST AudioSet model, never titles or lyric text.
Probabilities are uncalibrated model scores; these are not human listening records.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import time
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
import torch
from transformers import ASTFeatureExtractor, ASTForAudioClassification

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'output/lu-band-song-parts'
MODEL = 'MIT/ast-finetuned-audioset-10-10-0.4593'
REVISION = 'f826b80d28226b62986cc218e5cec390b1096902'
LABELS = {
    'vocals': ['Singing', 'Male singing', 'Female singing', 'Choir', 'Rapping', 'Vocal music', 'Chant'],
    'bass': ['Bass guitar', 'Double bass'],
    'percussion': ['Drum', 'Drum kit', 'Percussion', 'Snare drum', 'Bass drum', 'Cymbal', 'Hi-hat', 'Tabla', 'Timpani', 'Drum machine', 'Mallet percussion'],
    'plucked_strings': ['Guitar', 'Electric guitar', 'Acoustic guitar', 'Plucked string instrument', 'Strum', 'Harp', 'Banjo', 'Ukulele', 'Sitar', 'Mandolin'],
    'keys': ['Piano', 'Electric piano', 'Keyboard (musical)', 'Organ', 'Electronic organ', 'Synthesizer', 'Accordion'],
    'winds': ['Wind instrument, woodwind instrument', 'Brass instrument', 'Trumpet', 'Trombone', 'French horn', 'Saxophone', 'Flute', 'Clarinet', 'Harmonica', 'Oboe', 'Bagpipes'],
    'bowed_strings': ['Bowed string instrument', 'String section', 'Violin, fiddle', 'Cello'],
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--track', action='append')
    args = parser.parse_args()
    torch.set_num_threads(4)
    extractor = ASTFeatureExtractor.from_pretrained(MODEL, revision=REVISION, cache_dir=ROOT/'output/lu-band-models/ast', local_files_only=True)
    model = ASTForAudioClassification.from_pretrained(MODEL, revision=REVISION, cache_dir=ROOT/'output/lu-band-models/ast', local_files_only=True, use_safetensors=True)
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    model = model.to(device).eval()
    ids = {name: [index for index, label in model.config.id2label.items() if label in names] for name, names in LABELS.items()}
    paths = [DATA/track/'score.json' for track in args.track] if args.track else sorted(DATA.glob('*/score.json'))
    for score_path in paths:
        score = json.loads(score_path.read_text())
        target = score_path.with_name('family-classification.json')
        if target.is_file():
            previous = json.loads(target.read_text())
            expected = {stem['id']:stem['audioSha256'] for stem in score['stems'] if stem['events'] or stem['id']=='other'}
            recorded = {stem['id']:stem['audioSha256'] for stem in previous.get('stems',[])}
            if previous.get('sourceSha256') == score['sourceSha256'] and previous.get('revision') == REVISION and expected == recorded:
                print('SKIP', score['trackId'], flush=True)
                continue
        started = time.monotonic()
        result = {'version': 1, 'trackId': score['trackId'], 'sourceSha256': score['sourceSha256'],
                  'model': MODEL, 'revision': REVISION, 'device': device, 'method': 'local-PCM-AST-AudioSet-classification',
                  'notice': 'Uncalibrated model evidence, not native Gemini listening or proof of instrument identity.', 'stems': []}
        for stem in score['stems']:
            if not stem['events'] and stem['id'] != 'other':
                continue
            # Classify every remaining-accompaniment window; sample 3 loud measured
            # windows for each independently separated model source.
            if stem['id'] == 'other':
                starts = list(np.arange(0, max(.01, score['duration']-2), 8))
            else:
                candidates = sorted(stem['reviewClips'], key=lambda clip: clip['start'])
                starts = [clip['start'] for clip in candidates[:3]]
            windows = []
            source_path = score_path.parent / f"{stem['id']}.wav"
            with sf.SoundFile(source_path) as source:
                rate = source.samplerate
                for start in starts:
                    source.seek(min(len(source)-1, round(float(start)*rate)))
                    audio = source.read(round(10*rate), dtype='float32', always_2d=True).mean(axis=1)
                    if not len(audio):
                        continue
                    rms = float(np.sqrt(np.mean(audio**2)))
                    if rms < 1e-5:
                        continue
                    # Uniform gain changes do not change class identity; prevent
                    # the network from treating a quiet stem as an empty signal.
                    audio = audio / max(float(np.max(np.abs(audio))), 1e-5) * .8
                    audio = resample_poly(audio, 160, 441) if rate == 44100 else resample_poly(audio, 16000, rate)
                    inputs = extractor(audio, sampling_rate=16000, return_tensors='pt')
                    with torch.inference_mode():
                        values = model(**{key: value.to(device) for key, value in inputs.items()}).logits.sigmoid()[0].cpu()
                    families = {name: round(max((float(values[index]) for index in indices), default=0), 5) for name, indices in ids.items()}
                    windows.append({'start': round(float(start), 3), 'end': round(min(score['duration'], float(start)+len(audio)/16000), 3),
                                    'rms': round(rms, 7), 'families': families,
                                    'topLabels': [{'label': model.config.id2label[int(index)], 'score': round(float(values[index]), 5)} for index in torch.topk(values, 8).indices]})
            result['stems'].append({'id': stem['id'], 'audioSha256': stem['audioSha256'], 'pcmSha256': sha(source_path), 'windows': windows})
            print(score['trackId'], stem['id'], len(windows), 'windows', flush=True)
        result['elapsedSeconds'] = round(time.monotonic()-started, 2)
        target.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
        print('DONE', score['trackId'], result['elapsedSeconds'], flush=True)


if __name__ == '__main__':
    main()
