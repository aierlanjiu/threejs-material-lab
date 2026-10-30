#!/usr/bin/env python3
"""
Master Audio Synthesizer for 『 律 』(LÜ) Band Mode 30-Second Commercial Film.
- Exactly 30.000s duration (1,440,000 samples @ 48000 Hz, stereo).
- 120 BPM (0.500s / beat, 2.000s / bar, 15 bars total).
- Real SoundFont instrument samples (GeneralUser GS 2.0.3) + real stems + physical pyro synthesis.
- Dynamic spatial panning + distance HF roll-off (LPF 3.2kHz -> Hi-Shelf +3.5dB) during Luffy drag (9.5s-12.0s).
- Pyro segment (17.5s-21.5s) verified >= -20 LUFS.
- Mastered to -14.0 LUFS (+-0.5) and True Peak <= -1.0 dBTP after AAC encoding.
"""

import math
import subprocess
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
DURATION = 30.000
TOTAL_SAMPLES = int(round(DURATION * SR))
BPM = 120.0
BEAT_SEC = 60.0 / BPM  # 0.500s
BAR_SEC = 4 * BEAT_SEC  # 2.000s

SAMPLE_CACHE = {}

def load_audio(path, start_sec=0.0, duration_sec=None):
    """Loads an audio file via ffmpeg as float32 stereo array at 48kHz."""
    cache_key = (str(path), start_sec, duration_sec)
    if cache_key in SAMPLE_CACHE:
        return SAMPLE_CACHE[cache_key].copy()
    
    cmd = ['ffmpeg', '-v', 'error']
    if start_sec > 0:
        cmd += ['-ss', f'{start_sec:.4f}']
    if duration_sec is not None:
        cmd += ['-t', f'{duration_sec:.4f}']
    cmd += ['-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), 'pipe:1']
    
    res = subprocess.run(cmd, capture_output=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg decode failed for {path}: {res.stderr.decode()[:400]}")
    
    arr = np.frombuffer(res.stdout, dtype=np.float32).reshape(-1, 2)
    SAMPLE_CACHE[cache_key] = arr
    return arr.copy()

def resample_pitch(arr, semitones):
    """Pitch shift via linear interpolation resampling."""
    if abs(semitones) < 0.01 or len(arr) == 0:
        return arr
    ratio = 2.0 ** (semitones / 12.0)
    old_len = len(arr)
    new_len = int(round(old_len / ratio))
    if new_len <= 1:
        return arr
    indices = np.linspace(0, old_len - 1, new_len)
    idx_floor = np.floor(indices).astype(np.int32)
    idx_ceil = np.minimum(idx_floor + 1, old_len - 1)
    weight = (indices - idx_floor)[:, None]
    out = arr[idx_floor] * (1.0 - weight) + arr[idx_ceil] * weight
    return out.astype(np.float32)

def play_note(track, inst_name, midi_pitch, start_time, duration, velocity=0.8, pan=0.0, fade_out=0.04):
    """Plays a note from instrument samples into the stereo track."""
    samples_dir = ROOT / 'assets/band-audio/samples' / inst_name
    if not samples_dir.exists():
        return
    
    available_midis = []
    for f in samples_dir.glob('*.mp3'):
        try:
            available_midis.append(int(f.stem))
        except ValueError:
            pass
    if not available_midis:
        return
    
    best_midi = min(available_midis, key=lambda m: abs(m - midi_pitch))
    semitone_diff = midi_pitch - best_midi
    
    sample = load_audio(samples_dir / f'{best_midi}.mp3')
    if semitone_diff != 0:
        sample = resample_pitch(sample, semitone_diff)
    
    target_len = int(duration * SR)
    if len(sample) > target_len:
        sample = sample[:target_len].copy()
    else:
        sample = sample.copy()
        target_len = len(sample)
    
    fade_len = int(fade_out * SR)
    if fade_len > 0 and len(sample) > fade_len:
        fade = np.linspace(1.0, 0.0, fade_len, dtype=np.float32)[:, None]
        sample[-fade_len:] *= fade
    
    pan_clamped = max(-1.0, min(1.0, pan))
    left_gain = math.cos((pan_clamped + 1.0) * math.pi / 4.0) * velocity
    right_gain = math.sin((pan_clamped + 1.0) * math.pi / 4.0) * velocity
    
    sample[:, 0] *= left_gain
    sample[:, 1] *= right_gain
    
    start_idx = int(round(start_time * SR))
    end_idx = min(TOTAL_SAMPLES, start_idx + len(sample))
    actual_len = end_idx - start_idx
    if actual_len > 0 and start_idx < TOTAL_SAMPLES:
        track[start_idx:end_idx] += sample[:actual_len]

def play_drum(track, drum_midi, start_time, velocity=0.9, pan=0.0):
    """Triggers a percussion sample (36=kick, 38=snare, 42=hihat, 46=openhh, 49=crash)."""
    p_path = ROOT / f'assets/band-audio/samples/percussion/{drum_midi}.mp3'
    if not p_path.exists():
        return
    sample = load_audio(p_path)
    pan_clamped = max(-1.0, min(1.0, pan))
    left_gain = math.cos((pan_clamped + 1.0) * math.pi / 4.0) * velocity
    right_gain = math.sin((pan_clamped + 1.0) * math.pi / 4.0) * velocity
    sample = sample.copy()
    sample[:, 0] *= left_gain
    sample[:, 1] *= right_gain
    
    start_idx = int(round(start_time * SR))
    end_idx = min(TOTAL_SAMPLES, start_idx + len(sample))
    actual_len = end_idx - start_idx
    if actual_len > 0 and start_idx < TOTAL_SAMPLES:
        track[start_idx:end_idx] += sample[:actual_len]

def add_water_ambiance(track):
    """Generates gentle morning & sunset water lap ambiance."""
    np.random.seed(42)
    noise = np.random.randn(TOTAL_SAMPLES, 2).astype(np.float32) * 0.0032
    kernel_len = 160
    kernel = np.hanning(kernel_len).astype(np.float32)
    kernel /= kernel.sum()
    water_l = np.convolve(noise[:, 0], kernel, mode='same')
    water_r = np.convolve(noise[:, 1], kernel, mode='same')
    
    t = np.arange(TOTAL_SAMPLES) / SR
    swell = (0.6 + 0.4 * np.sin(2 * np.pi * 0.28 * t))[:, None]
    water = np.stack([water_l, water_r], axis=1) * swell
    
    amb_env = np.ones(TOTAL_SAMPLES, dtype=np.float32)
    amb_env[int(6*SR):int(23*SR)] *= 0.15
    t_end = np.clip((t - 24.0) / 3.0, 0.0, 1.0)
    amb_env[int(24*SR):] = 0.15 + 0.95 * t_end[int(24*SR):]
    t_fade = np.clip((30.0 - t) / 0.65, 0.0, 1.0)
    amb_env *= t_fade
    
    track += water * amb_env[:, None] * 1.9

def add_pyro_sound(track, start_time, duration=4.2):
    """Synthesizes high-fidelity fireworks: jet hisses + 3 massive airbursts + willow fall crackle."""
    np.random.seed(1337)
    t_span = np.arange(int(duration * SR)) / SR
    
    # 1. 8-nozzle Jet spray hisses ("呲——", 0.0s to 3.6s)
    jet_noise = np.random.randn(len(t_span), 2).astype(np.float32)
    b_kernel = np.sin(2 * np.pi * 2350 * np.arange(128) / SR) * np.hanning(128)
    b_kernel /= np.sqrt(np.sum(b_kernel**2)) + 1e-6
    jet_filtered_l = np.convolve(jet_noise[:, 0], b_kernel, mode='same')
    jet_filtered_r = np.convolve(jet_noise[:, 1], b_kernel, mode='same')
    jet = np.stack([jet_filtered_l, jet_filtered_r], axis=1)
    
    jet_env = np.clip(t_span / 0.06, 0.0, 1.0) * np.clip((3.5 - t_span) / 0.6, 0.0, 1.0)
    jet *= jet_env[:, None] * 0.46
    
    # 2. Airburst #1 (at delay +0.72s, pan left -0.45)
    t1 = t_span - 0.72
    mask1 = t1 >= 0
    boom1 = np.sin(2 * np.pi * (78.0 - 46.0 * np.clip(t1 * 2.5, 0, 1)) * t1) * np.exp(-t1 * 4.2) * mask1
    boom1 += np.random.randn(len(t_span)) * 0.38 * np.exp(-t1 * 11.0) * mask1
    
    # 3. Airburst #2 (at delay +1.18s, pan right +0.45)
    t2 = t_span - 1.18
    mask2 = t2 >= 0
    boom2 = np.sin(2 * np.pi * (70.0 - 42.0 * np.clip(t2 * 2.5, 0, 1)) * t2) * np.exp(-t2 * 4.0) * mask2
    boom2 += np.random.randn(len(t_span)) * 0.40 * np.exp(-t2 * 10.5) * mask2

    # 4. Airburst #3 (at delay +2.32s, center-wide)
    t3 = t_span - 2.32
    mask3 = t3 >= 0
    boom3 = np.sin(2 * np.pi * (74.0 - 44.0 * np.clip(t3 * 2.5, 0, 1)) * t3) * np.exp(-t3 * 4.1) * mask3
    boom3 += np.random.randn(len(t_span)) * 0.36 * np.exp(-t3 * 11.0) * mask3
    
    airburst = np.zeros((len(t_span), 2), dtype=np.float32)
    airburst[:, 0] += boom1 * 0.88 + boom2 * 0.35 + boom3 * 0.65
    airburst[:, 1] += boom1 * 0.35 + boom2 * 0.88 + boom3 * 0.65
    
    # 5. Willow fall sparkle crackle (from 1.3s to 3.9s)
    crackle = np.zeros(len(t_span), dtype=np.float32)
    spark_times = np.random.uniform(1.3, 3.8, 56)
    for st in spark_times:
        idx = int(st * SR)
        dur = int(0.025 * SR)
        if idx + dur < len(crackle):
            crackle[idx:idx+dur] += np.random.randn(dur) * np.linspace(0.45, 0.0, dur)
    
    total_pyro = (jet + airburst * 1.05 + crackle[:, None] * 0.32).astype(np.float32)
    
    start_idx = int(round(start_time * SR))
    end_idx = min(TOTAL_SAMPLES, start_idx + len(total_pyro))
    actual_len = end_idx - start_idx
    if actual_len > 0:
        track[start_idx:end_idx] += total_pyro[:actual_len]
    return total_pyro

def add_tactile_sfx(track):
    """Adds tactile micro-interaction sounds: clicks, zoro solo hum, landing thud, shockwave."""
    # 1. 0.50s: Capsule Click / Awakening Chime ("Bubble / Snap")
    idx = int(0.50 * SR)
    dur = int(0.18 * SR)
    ts = np.arange(dur) / SR
    click = (np.sin(2 * np.pi * 1520 * ts) * 0.28 + np.sin(2 * np.pi * 3040 * ts) * 0.14) * np.exp(-ts * 40.0)
    track[idx:idx+dur, 0] += click
    track[idx:idx+dur, 1] += click
    
    # 2. 6.00s: Sanji Drum Rest Tap ("Bubble / Snap")
    idx = int(6.00 * SR)
    dur = int(0.12 * SR)
    ts = np.arange(dur) / SR
    tap = (np.sin(2 * np.pi * 920 * ts) * 0.30 + np.sin(2 * np.pi * 1840 * ts) * 0.12) * np.exp(-ts * 46.0)
    track[idx:idx+dur, 0] += tap * 0.85
    track[idx:idx+dur, 1] += tap * 0.35
    
    # 3. 7.45s: Zoro Solo Spotlight Lock-on (High-freq current snap + low-freq stage air hum)
    idx = int(7.45 * SR)
    dur = int(2.05 * SR)
    ts = np.arange(dur) / SR
    snap = np.sin(2 * np.pi * 2400 * ts) * np.exp(-ts * 55.0) * 0.18
    hum = (np.sin(2 * np.pi * 65.0 * ts) * 0.18 + np.sin(2 * np.pi * 130.0 * ts) * 0.08 + np.sin(2 * np.pi * 3800 * ts) * 0.015) * np.clip(ts / 0.18, 0, 1) * np.clip((2.05 - ts) / 0.28, 0, 1)
    track[idx:idx+dur, 0] += (snap + hum) * 0.85
    track[idx:idx+dur, 1] += (snap + hum) * 0.55
    
    # 4. 9.50s: Luffy Drag Lift Swoosh & Snap (Left-Back)
    idx = int(9.50 * SR)
    dur = int(0.32 * SR)
    ts = np.arange(dur) / SR
    freq = np.linspace(240, 720, dur)
    swoosh = np.sin(2 * np.pi * freq * ts) * 0.16 * np.sin(np.pi * ts / (dur / SR))
    track[idx:idx+dur, 0] += swoosh * 0.92
    track[idx:idx+dur, 1] += swoosh * 0.22
    
    # 5. 12.00s: Luffy Spring Landing Thud (Teak / Jade Stage Contact) & Concentric Shockwave (Right-Front)
    idx = int(12.00 * SR)
    dur = int(0.85 * SR)
    ts = np.arange(dur) / SR
    # Thud: warm wooden/jade stage impact
    thud = np.sin(2 * np.pi * (84.0 - 48.0 * np.clip(ts * 8.5, 0, 1)) * ts) * np.exp(-ts * 18.0) * 0.72
    # Damped spring oscillation at 24 Hz matching visual landingPulse
    spring = np.cos(2 * np.pi * 24.0 * ts) * np.exp(-ts * 6.8) * 0.30
    # Shockwave stereo shimmer expanding outward
    chime_l = np.sin(2 * np.pi * 1760.0 * ts) * np.exp(-ts * 6.2) * 0.12
    chime_r = np.sin(2 * np.pi * 1766.0 * ts) * np.exp(-ts * 6.2) * 0.16
    track[idx:idx+dur, 0] += (thud * 0.45 + spring * 0.45 + chime_l)
    track[idx:idx+dur, 1] += (thud * 0.95 + spring * 0.95 + chime_r)
    
    # 6. 14.00s: 550ms Look Crossfade Transition Shimmer Whoosh
    idx = int(14.00 * SR)
    dur = int(0.55 * SR)
    ts = np.arange(dur) / SR
    xwhoosh = np.sin(2 * np.pi * np.linspace(320, 1280, dur) * ts) * 0.16 * np.sin(np.pi * ts / (dur / SR))
    track[idx:idx+dur, 0] += xwhoosh
    track[idx:idx+dur, 1] += xwhoosh

def apply_dynamic_spatial_depth(vocal_sample):
    """
    Applies synchronized Spatial Panning (-0.85 -> +0.85) AND Depth EQ:
    - At t=0.0 (9.5s, Left-Back): Pan = -0.85, High-frequency attenuated (warm low-passed far-field)
    - At t=1.0 (12.0s, Right-Front): Pan = +0.85, High-frequency boosted (+3.5 dB air presence, bright near-field)
    """
    v_len = len(vocal_sample)
    # Compute low-passed version (~2.8 kHz) and high-frequency detail component
    k_len = 21
    lp_kernel = np.hanning(k_len).astype(np.float32)
    lp_kernel /= lp_kernel.sum()
    low_l = np.convolve(vocal_sample[:, 0], lp_kernel, mode='same')
    low_r = np.convolve(vocal_sample[:, 1], lp_kernel, mode='same')
    low_band = np.stack([low_l, low_r], axis=1)
    high_band = vocal_sample - low_band

    # Progress from 0.0 to 1.0 matching smoothstep(9.5, 12.0, time)
    u = np.linspace(0.0, 1.0, v_len, dtype=np.float32)
    progress = u * u * (3.0 - 2.0 * u)

    # Distance gain (0.85 in back -> 1.18 in front) and High-frequency gain (0.25 in back -> 1.55 in front)
    depth_gain = (0.85 + 0.33 * progress)[:, None]
    hf_gain = (0.25 + 1.30 * progress)[:, None]
    filtered = (low_band + high_band * hf_gain) * depth_gain

    # Equal-power stereo panning from -0.85 (Left) to +0.85 (Right)
    v_pan = -0.85 + 1.70 * progress
    v_left_gain = np.cos((v_pan + 1.0) * math.pi / 4.0)
    v_right_gain = np.sin((v_pan + 1.0) * math.pi / 4.0)

    mono_sum = 0.5 * (filtered[:, 0] + filtered[:, 1])
    out = np.zeros_like(vocal_sample)
    out[:, 0] = mono_sum * v_left_gain
    out[:, 1] = mono_sum * v_right_gain
    return out

def synthesize_band_master():
    """Builds the entire 15-bar, 30.000s master audio track."""
    print("[*] Synthesizing 30.000s Master Audio at 120 BPM...")
    master = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    
    # Add ambient water baseline
    add_water_ambiance(master)
    
    # --- ACT 1: Intro (0.0s - 6.0s / Bars 1, 2, 3) ---
    # Bar 1 (0.0 - 2.0s): 0.5s Chopper's Marimba motif
    marimba_notes_b1 = [
        (60, 0.50, 0.35, 0.85, 0.25), # C4
        (64, 0.75, 0.35, 0.80, 0.20), # E4
        (67, 1.00, 0.35, 0.88, 0.25), # G4
        (71, 1.25, 0.35, 0.78, 0.20), # B4
        (72, 1.50, 0.45, 0.92, 0.25), # C5
    ]
    for midi, t_n, dur, vel, p in marimba_notes_b1:
        play_note(master, 'marimba', midi, t_n, dur, vel, p)
        play_note(master, 'piano', midi - 12, t_n, dur * 1.2, vel * 0.45, p)
    
    # Bars 2 & 3 (2.0s - 6.0s): Full Band Awakening
    for bar in [1, 2]:
        b_start = (bar + 1) * BAR_SEC
        for beat in range(4):
            t_b = b_start + beat * BEAT_SEC
            play_drum(master, 42, t_b, velocity=0.55, pan=-0.2)
            play_drum(master, 42, t_b + 0.25, velocity=0.40, pan=-0.2)
            if beat in [0, 2]:
                play_drum(master, 36, t_b, velocity=0.75, pan=0.0)
            if beat in [1, 3]:
                play_drum(master, 38, t_b, velocity=0.68, pan=-0.1)
        
        bass_notes = [
            (36, b_start + 0.0, 0.45, 0.78, -0.45),
            (40, b_start + 0.5, 0.45, 0.72, -0.45),
            (43, b_start + 1.0, 0.45, 0.75, -0.45),
            (45, b_start + 1.5, 0.45, 0.70, -0.45),
        ]
        for midi, t_n, dur, vel, p in bass_notes:
            play_note(master, 'bass', midi, t_n, dur, vel, p)
        
        sax_notes = [
            (67, b_start + 0.00, 0.45, 0.75, 0.15),
            (69, b_start + 0.50, 0.45, 0.78, 0.15),
            (72, b_start + 1.00, 0.45, 0.88, 0.15),
            (74, b_start + 1.50, 0.45, 0.82, 0.15),
        ]
        for midi, t_n, dur, vel, p in sax_notes:
            play_note(master, 'saxophone', midi, t_n, dur, vel, p)
        
        for i, midi in enumerate([72, 76, 79, 76]):
            play_note(master, 'marimba', midi, b_start + i * 0.5, 0.35, 0.75, 0.35)
            play_note(master, 'guitar', midi - 12, b_start + i * 0.5, 0.38, 0.65, -0.25)
    
    # --- ACT 2: Interactive Sandbox & Spatial Panning (6.0s - 14.0s / Bars 4, 5, 6, 7) ---
    # Bar 4 (6.0 - 7.5s): Sanji drum rest! Percussion stops immediately at 6.0s.
    b_start = 6.0
    for i, midi in enumerate([72, 74, 76]):
        play_note(master, 'marimba', midi, b_start + i * 0.5, 0.35, 0.60, 0.35)
        play_note(master, 'guitar', midi - 12, b_start + i * 0.5, 0.40, 0.52, -0.25)
    
    # Bar 5 (7.5 - 9.5s): Zoro Solo Spotlight! Background bed suppressed (-15dB), Zoro Bass Solo upfront
    for i, midi in enumerate([60, 64, 67, 71]):
        play_note(master, 'piano', midi, 7.5 + i * 0.5, 0.45, 0.16, 0.1)
    
    zoro_solo = [
        (40, 7.55, 0.34, 0.96, -0.35), # E2 slap
        (43, 7.90, 0.34, 0.94, -0.35), # G2
        (45, 8.25, 0.34, 0.99, -0.35), # A2
        (47, 8.60, 0.34, 0.96, -0.35), # B2
        (50, 8.95, 0.28, 1.02, -0.35), # D3 pop
        (52, 9.22, 0.30, 1.06, -0.35), # E3
    ]
    for midi, t_n, dur, vel, p in zoro_solo:
        play_note(master, 'bass', midi, t_n, dur, vel, p)
    
    # Bars 6 & 7 (9.5s - 14.0s): Luffy Spatial Panning Drag (-0.85 Left-Back -> +0.85 Right-Front) & Landing
    vocal_sample = load_audio(ROOT / 'assets/band-audio/controls/anime_op_we_are/vocals.mp3', start_sec=30.8, duration_sec=2.5)
    vocal_sample *= 1.52
    vocal_panned = apply_dynamic_spatial_depth(vocal_sample)
    
    start_v = int(9.5 * SR)
    master[start_v:start_v + len(vocal_panned)] += vocal_panned
    
    # Subtle chordal accompaniment during vocal drag (9.5 - 12.0s)
    for i, midi in enumerate([60, 64, 67, 72, 67]):
        play_note(master, 'guitar', midi, 9.5 + i * 0.5, 0.45, 0.50, -0.15)
    
    # 12.0s: Landing impact! (Handled by add_tactile_sfx)
    # 12.5s - 14.0s: Sanji & Band rejoin with energetic drum fill
    for beat, t_fill in enumerate([12.5, 12.75, 13.0, 13.25, 13.5, 13.75]):
        play_drum(master, 38 if beat % 2 else 45, t_fill, velocity=0.75 + beat * 0.04, pan=0.0)
    play_drum(master, 49, 13.0, velocity=0.75, pan=-0.3)
    
    # --- ACT 3: Stage Metamorphosis & Climax (14.0s - 23.0s / Bars 8, 9, 10, 11) ---
    # 14.0s - 17.5s: Snare Roll Crescendo & Synth Arp Climb
    roll_times = np.linspace(14.5, 17.45, 48)
    for i, t_roll in enumerate(roll_times):
        vel = 0.22 + 0.76 * (i / len(roll_times)) ** 1.8
        play_drum(master, 38, t_roll, velocity=vel, pan=0.0)
    
    for t_k in np.arange(14.0, 17.5, 0.5):
        play_drum(master, 36, t_k, velocity=0.88, pan=0.0)
        play_drum(master, 42, t_k + 0.25, velocity=0.60, pan=-0.2)
    
    climb_pitches = [48, 52, 55, 60, 64, 67, 72, 76, 79, 84, 88]
    for i, midi in enumerate(climb_pitches):
        t_climb = 14.0 + i * (3.4 / len(climb_pitches))
        play_note(master, 'synthesizer', midi, t_climb, 0.35, 0.65 + i * 0.03, pan=math.sin(i))
        play_note(master, 'piano', midi, t_climb, 0.35, 0.65 + i * 0.03, pan=-math.sin(i))
    
    # 17.5s (FULL BAND DROP & CLIMAX!): (17.5s to 21.5s / 8 beats)
    play_drum(master, 49, 17.5, velocity=1.10, pan=0.0)
    play_drum(master, 49, 19.5, velocity=0.95, pan=0.3)
    
    climax_vocal = load_audio(ROOT / 'assets/band-audio/controls/anime_op_we_are/vocals.mp3', start_sec=62.2, duration_sec=4.0)
    climax_vocal *= 1.35
    start_c = int(17.5 * SR)
    master[start_c:start_c + len(climax_vocal)] += climax_vocal
    
    for beat in range(8):
        t_d = 17.5 + beat * 0.5
        play_drum(master, 36, t_d, velocity=1.05, pan=0.0)
        play_drum(master, 38, t_d + 0.25, velocity=0.95, pan=-0.1)
        play_drum(master, 46, t_d, velocity=0.75, pan=0.25)
        play_drum(master, 42, t_d + 0.25, velocity=0.70, pan=0.25)
    
    climax_sax = [
        (72, 17.50, 0.45, 0.95, 0.4),
        (76, 18.00, 0.45, 0.98, 0.4),
        (79, 18.50, 0.45, 1.02, 0.4),
        (84, 19.00, 0.90, 1.08, 0.4),
        (83, 20.00, 0.45, 0.98, 0.4),
        (79, 20.50, 0.45, 0.95, 0.4),
        (84, 21.00, 0.50, 1.05, 0.4),
    ]
    for midi, t_n, dur, vel, p in climax_sax:
        play_note(master, 'saxophone', midi, t_n, dur, vel, p)
        play_note(master, 'electric-guitar', midi - 12, t_n, dur, vel * 0.85, -0.4)
    
    for beat in range(8):
        t_b = 17.5 + beat * 0.5
        midi = 36 if beat < 4 else 41
        play_note(master, 'bass', midi, t_b, 0.48, 0.95, -0.5)
    
    # Pyro sound at 17.5s (8 jets + 3 airbursts + willow fall)
    pyro_only = add_pyro_sound(master, start_time=17.5, duration=4.2)
    
    # --- ACT 4: Sandbox Reveal & Brand Outro (21.5s - 30.0s / Bars 12, 13, 14, 15) ---
    play_note(master, 'marimba', 72, 21.5, 0.8, 0.70, -0.3)
    play_note(master, 'piano', 60, 21.5, 1.2, 0.65, 0.0)
    
    # 23.0s - 26.5s: Gentle Acoustic Sandbox Chords (Fmaj7 -> G7)
    for midi in [41, 57, 60, 64]:
        play_note(master, 'piano', midi, 23.0, 1.8, 0.62, 0.1)
        play_note(master, 'guitar', midi, 23.0, 1.8, 0.55, -0.2)
    for midi in [43, 59, 62, 65]:
        play_note(master, 'piano', midi, 24.8, 1.6, 0.60, 0.1)
        play_note(master, 'marimba', midi + 12, 24.8, 0.8, 0.55, 0.3)
    
    # 26.5s: Final Cmaj9 Brand Lockup Chord (with 2s+ pure water & harmonic tail breathing room)
    cmaj9 = [36, 48, 55, 59, 62, 64, 67]
    for midi in cmaj9:
        play_note(master, 'piano', midi, 26.5, 3.1, 0.78, 0.0, fade_out=1.5)
        play_note(master, 'marimba', midi + 12, 26.5, 2.2, 0.65, -0.2, fade_out=1.2)
    
    add_tactile_sfx(master)
    
    fade_in_len = int(0.04 * SR)
    master[:fade_in_len] *= np.linspace(0.0, 1.0, fade_in_len)[:, None]
    
    master = master[:TOTAL_SAMPLES]
    if len(master) < TOTAL_SAMPLES:
        pad = np.zeros((TOTAL_SAMPLES - len(master), 2), dtype=np.float32)
        master = np.vstack([master, pad])
    
    return master, pyro_only

def measure_audio(wav_path):
    """Runs ebur128 scanner on wav/mp4 to measure Integrated LUFS and True Peak."""
    cmd = [
        'ffmpeg', '-nostats', '-i', str(wav_path),
        '-filter_complex', 'ebur128=peak=true',
        '-f', 'null', '-'
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    lines = res.stderr.splitlines()
    lufs = None
    true_peak = None
    for i, line in enumerate(lines):
        if 'Integrated loudness:' in line and i + 1 < len(lines):
            lufs = float(lines[i+1].split('I:')[1].replace('LUFS', '').strip())
        if 'True peak:' in line and i + 1 < len(lines):
            true_peak = float(lines[i+1].split('Peak:')[1].replace('dBFS', '').replace('dBTP', '').strip())
    return lufs, true_peak

def save_wav(path, audio):
    pcm16 = (np.clip(audio, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(str(path), 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm16.tobytes())

def main():
    out_dir = ROOT / 'output/film'
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_wav = out_dir / 'raw_mix.wav'
    pyro_wav = out_dir / 'pyro_only.wav'
    master_wav = out_dir / 'film_master.wav'
    final_wav = out_dir / 'film_master_final.wav'
    final_aac = out_dir / 'film_master_final.m4a'
    
    audio, pyro_only = synthesize_band_master()
    save_wav(raw_wav, audio)
    
    lufs, tp = measure_audio(raw_wav)
    print(f"[*] Raw Mix: Integrated = {lufs:.2f} LUFS, True Peak = {tp:.2f} dB")
    
    # Gain stage to -14.0 LUFS
    target_lufs = -14.0
    gain_db = target_lufs - lufs
    gain_linear = 10.0 ** (gain_db / 20.0)
    audio *= gain_linear
    pyro_only *= gain_linear

    # Verify Pyro standalone loudness >= -20.0 LUFS
    save_wav(pyro_wav, pyro_only)
    pyro_lufs, pyro_tp = measure_audio(pyro_wav)
    print(f"[*] Pyro Standalone Segment (17.5s-21.7s): Integrated = {pyro_lufs:.2f} LUFS (Spec: >= -20.0 LUFS)")
    assert pyro_lufs >= -20.0, f"Pyro loudness too low: {pyro_lufs}"
    
    # Soft saturation ceiling before precision brickwall limiter
    ceiling = 10.0 ** (-3.2 / 20.0)
    mag = np.maximum(np.abs(audio[:, 0]), np.abs(audio[:, 1]))
    over = mag > ceiling
    if np.any(over):
        scale = np.ones_like(mag)
        scale[over] = (ceiling + (1.0 - ceiling) * np.tanh((mag[over] - ceiling) / (1.0 - ceiling))) / mag[over]
        audio *= scale[:, None]
    
    save_wav(master_wav, audio)
    
    # Precision post-limiter + iterative gain/ceiling trim so post-AAC Integrated Loudness == -14.0 LUFS and True Peak <= -1.0 dBTP
    trim_db = 0.0
    limit_db = -2.4
    for attempt in range(8):
        subprocess.run([
            'ffmpeg', '-y', '-v', 'error',
            '-i', str(master_wav),
            '-af', f'volume={trim_db:.2f}dB,alimiter=limit={limit_db:.2f}dB:attack=2:release=45:asc=1:level=false',
            str(final_wav)
        ], check=True)

        subprocess.run([
            'ffmpeg', '-y', '-v', 'error',
            '-i', str(final_wav),
            '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
            str(final_aac)
        ], check=True)

        final_lufs, final_tp = measure_audio(final_aac)
        if abs(final_lufs - (-14.0)) <= 0.15 and final_tp <= -1.0:
            break
        trim_db += (-14.0 - final_lufs)
        if final_tp > -1.05:
            limit_db -= (final_tp - (-1.25))

    print(f"[+] Final AAC Master ({final_aac}):")
    print(f"    Integrated Loudness: {final_lufs:.2f} LUFS (Spec: -14.0 +- 0.5)")
    print(f"    True Peak:           {final_tp:.2f} dBTP (Spec: <= -1.0 dBTP)")
    print(f"    Pyro Loudness:       {pyro_lufs:.2f} LUFS (Spec: >= -20.0 LUFS)")
    assert -14.5 <= final_lufs <= -13.5, f"LUFS out of spec: {final_lufs}"
    assert final_tp <= -1.0, f"True peak out of spec: {final_tp}"
    print("[SUCCESS] Audio master fully complies with broadcast & streaming specs!")

if __name__ == '__main__':
    main()
