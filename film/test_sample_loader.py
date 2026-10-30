import json
import subprocess
import numpy as np
from pathlib import Path

ROOT = Path('.').resolve()
banks = json.load(open('assets/band-audio/banks.json'))['banks']

def load_mp3(path, sr=48000):
    cmd = [
        'ffmpeg', '-v', 'error',
        '-i', str(path),
        '-f', 'f32le', '-ac', '2', '-ar', str(sr), 'pipe:1'
    ]
    res = subprocess.run(cmd, capture_output=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.decode()[:200])
    arr = np.frombuffer(res.stdout, dtype=np.float32).reshape(-1, 2)
    return arr

# Test loading a few samples
m_sample = load_mp3('assets/band-audio/samples/marimba/60.mp3')
print("Marimba 60 shape:", m_sample.shape)
p_sample = load_mp3('assets/band-audio/samples/percussion/36.mp3')
print("Kick 36 shape:", p_sample.shape)
