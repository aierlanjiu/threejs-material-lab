#!/usr/bin/env python3
"""
V2 Redesigned 30-Second Promotional Video Engine for 『 律 』(LÜ) Band Mode.
Core Promise: "这支动漫乐队，听你指挥。" (30.0s, 30fps, 900 frames)

Key Upgrades Addressing Review & User Instructions:
1. 0-3s   : Immediate close-up of Luffy (lead singer) + tap interaction within the first 1.3s.
2. 3-9s   : Complete Mute -> Restore vocal interaction cycle ("点按进退") with clear audio/visual contrast.
3. 9-15s  : Usopp centered macro close-up ("长按独奏"), dramatic spotlight + real guitar stem solo boost.
4. 15-21s : 3 Themes rapid relay with position Match-Cuts, 2 clear formation morphs with parallax,
            AND real theme song switching:
              - One Piece  : 《One day》 (anime_op_one_day)
              - Dragon Ball: 《CHA-LA HEAD-CHA-LA》 (anime_db_chala)
              - Naruto     : 《Blue Bird》 (anime_nr_blue_bird)
5. 21-26s : Climax using NATIVE SOURCE WebGL footage & renders of shoulder particle wings and
            stage pyro fountains (NO custom fake particle code), with a 0.7s pre-climax dim/pause
            followed by a beat-synced explosion and camera push-in.
6. 26-30s : Full 4.0s clean, stable end card with only Brand, QR code, and "打开网页，指挥你的乐队"
            (zero technical jargon, zero overlapping text, zero fake 60FPS labels, zero missing glyph boxes).
"""

import math
import os
import subprocess
import time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'output'
WORK_DIR = Path('/tmp/lu_v2_promo_work')
FFMPEG = '/opt/homebrew/bin/ffmpeg'
FFPROBE = '/opt/homebrew/bin/ffprobe'

FPS = 30
DURATION = 30.0
TOTAL_FRAMES = int(FPS * DURATION)  # 900 frames
SR = 48000

# Use PingFang.ttc / Hiragino Sans GB.ttc exclusively for 100% CJK + Latin coverage (ZERO tofu boxes!)
FONT_PINGFANG = '/System/Library/Fonts/PingFang.ttc'
FONT_HIRAGINO = '/System/Library/Fonts/Hiragino Sans GB.ttc'
FONT_KAI = str(ROOT / 'assets/fonts/TsangerJinKai02-W05.ttf')

ROSTER = {
    'one-piece': [
        ('luffy', '路飞', '草帽麦克风', (251, 113, 133)),
        ('zoro', '索隆', '三弦脊贝斯', (52, 211, 153)),
        ('nami', '娜美', '航海手风琴', (251, 191, 36)),
        ('sanji', '山治', '海蓝爵士鼓', (56, 189, 248)),
        ('chopper', '乔巴', '鹿角木琴', (244, 114, 182)),
        ('robin', '罗宾', '花瓣竖琴', (192, 132, 252)),
        ('usopp', '乌索普', '弹弓吉他', (250, 204, 21)),
        ('ace', '艾斯', '焰红萨克斯', (249, 115, 22)),
        ('law', '罗', '刻度合成器', (45, 212, 191)),
        ('shanks', '香克斯', '酒红大提琴', (248, 113, 113)),
    ],
    'dragon-ball': [
        ('goku', '悟空', '星球麦克风', (251, 146, 60)),
        ('vegeta', '贝吉塔', '装甲电吉他', (129, 140, 248)),
        ('bulma', '布尔玛', '胶囊合成器', (56, 189, 248)),
        ('krillin', '克林', '六点双手鼓', (251, 191, 36)),
        ('piccolo', '比克', '披风长笛', (74, 222, 128)),
        ('frieza', '弗利萨', '角形特雷门', (216, 180, 254)),
        ('cell', '沙鲁', '甲壳合成器', (163, 230, 53)),
        ('gohan', '悟饭', '书页小钢琴', (96, 165, 250)),
        ('buu', '布欧', '糖果大号', (244, 114, 182)),
        ('trunks', '特兰克斯', '剑鞘键盘', (167, 139, 250)),
    ],
    'naruto': [
        ('naruto', '鸣人', '螺旋麦克风', (251, 146, 60)),
        ('sasuke', '佐助', '闪电电吉他', (129, 140, 248)),
        ('sakura', '小樱', '花瓣小军鼓', (244, 114, 182)),
        ('itachi', '鼬', '乌羽尺八', (248, 113, 113)),
        ('gaara', '我爱罗', '砂陶乌杜鼓', (217, 119, 6)),
        ('ninja-06', '金发忍者', '金色陶笛', (250, 204, 21)),
        ('madara', '斑', '铠甲大鼓', (225, 29, 72)),
        ('jiraiya', '自来也', '卷轴三味线', (239, 68, 68)),
        ('pain', '佩恩', '六管管风琴', (168, 85, 247)),
    ],
}

_FONT_CACHE = {}


def get_font(size, bold=False):
    key = (int(size), bold)
    if key not in _FONT_CACHE:
        path = FONT_PINGFANG if os.path.exists(FONT_PINGFANG) else FONT_HIRAGINO
        # PingFang.ttc index 0 is Regular, index 2 is Medium/Semibold in macOS PingFang
        try:
            _FONT_CACHE[key] = ImageFont.truetype(path, int(size), index=2 if bold else 0)
        except Exception:
            _FONT_CACHE[key] = ImageFont.truetype(FONT_HIRAGINO, int(size), index=0)
    return _FONT_CACHE[key]


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / max(1e-6, e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


def spring_ease(t, zeta=0.62, omega=15.0):
    if t <= 0.0:
        return 0.0
    if t >= 1.5:
        return 1.0
    wd = omega * math.sqrt(max(1e-4, 1.0 - zeta * zeta))
    return float(
        1.0
        - math.exp(-zeta * omega * t)
        * (math.cos(wd * t) + (zeta / math.sqrt(max(1e-4, 1.0 - zeta * zeta))) * math.sin(wd * t))
    )


def load_pcm_stereo(path, start_sec, duration_sec):
    cmd = [
        FFMPEG, '-v', 'error',
        '-ss', f'{start_sec:.3f}',
        '-t', f'{duration_sec:.3f}',
        '-i', str(path),
        '-f', 'f32le', '-ac', '2', '-ar', str(SR), 'pipe:1',
    ]
    res = subprocess.run(cmd, capture_output=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg decode failed for {path}: {res.stderr.decode()[-1000:]}")
    arr = np.frombuffer(res.stdout, dtype=np.float32)
    n_samples = int(round(duration_sec * SR))
    if len(arr) < n_samples * 2:
        arr = np.pad(arr, (0, n_samples * 2 - len(arr)))
    else:
        arr = arr[: n_samples * 2]
    return arr.reshape((n_samples, 2))


def crossfade_join(segments, xfade_sec=0.18):
    """Joins a list of stereo numpy arrays with equal-power crossfades while keeping exact total length."""
    out = np.zeros((int(DURATION * SR), 2), dtype=np.float32)
    xf = int(xfade_sec * SR)
    cursor = 0
    for idx, seg in enumerate(segments):
        L = len(seg)
        end = min(len(out), cursor + L)
        actual_L = end - cursor
        s = seg[:actual_L].copy()
        if idx > 0 and xf > 0:
            fade_in = np.sin(np.linspace(0, np.pi / 2, xf, dtype=np.float32))[:, None]
            s[:xf] *= fade_in
        if idx < len(segments) - 1 and xf > 0:
            fade_out = np.cos(np.linspace(0, np.pi / 2, xf, dtype=np.float32))[:, None]
            s[-xf:] *= fade_out
        out[cursor:end] += s
        cursor = end
    return out


def build_multi_song_audio_and_telemetry():
    """
    Builds the 30-second stereo audio master with theme-specific songs:
      - 0.0s - 17.0s : One Piece 《One day》 (anime_op_one_day, starting at chorus 69.5s)
          * 0.0s - 1.3s  : Full vocal + band opening
          * 1.3s - 5.2s  : Tap Luffy -> Vocal stem attenuated (-85%), band continues
          * 5.2s - 9.6s  : Tap Luffy again -> Vocal stem restored (100% full chorus)
          * 9.6s - 14.0s : Hold Usopp -> Guitar stem solo boosted (2.1x), bed ducked (18%)
          * 14.0s - 17.0s: Full band restored + One Piece formation morph
      - 17.0s - 19.0s: Dragon Ball 《CHA-LA HEAD-CHA-LA》 (anime_db_chala, chorus at 58.2s)
      - 19.0s - 21.0s: Naruto 《Blue Bird》 (anime_nr_blue_bird, chorus at 53.5s)
      - 21.0s - 30.0s: One Piece 《One day》 Climax (147.2s..156.2s):
          * 21.0s - 21.65s: Pre-climax dip/pause (ducked to 22% with low-pass hush)
          * 21.65s - 26.0s: Full climax explosion on beat + native pyro sound
          * 26.0s - 30.0s : Warm outro sustain & smooth fade out
    """
    print("[*] Building 30s multi-theme interactive audio track (One day / CHA-LA / Blue Bird)...")
    op_master = load_pcm_stereo(ROOT / 'output/audio/anime_op_one_day.mp3', 69.5, 17.0)
    op_stems_dir = ROOT / 'assets/band-audio/controls/anime_op_one_day'
    op_vocals = load_pcm_stereo(op_stems_dir / 'vocals.mp3', 69.5, 17.0)
    op_guitar = load_pcm_stereo(op_stems_dir / 'guitar.mp3', 69.5, 17.0)
    op_bass = load_pcm_stereo(op_stems_dir / 'bass.mp3', 69.5, 17.0)
    op_drums = load_pcm_stereo(op_stems_dir / 'drums.mp3', 69.5, 17.0)
    op_piano = load_pcm_stereo(op_stems_dir / 'piano.mp3', 69.5, 17.0)

    n_op = len(op_master)
    # Vocal mute envelope: muted from 1.3s to 5.2s
    mute_env = np.zeros(n_op, dtype=np.float32)
    mute_env[int(1.3 * SR) : int(5.2 * SR)] = 1.0
    mute_env = np.convolve(mute_env, np.ones(int(0.06 * SR)) / int(0.06 * SR), mode='same')

    # Guitar solo envelope: solo from 9.6s to 14.0s
    solo_env = np.zeros(n_op, dtype=np.float32)
    solo_env[int(9.6 * SR) : int(14.0 * SR)] = 1.0
    solo_env = np.convolve(solo_env, np.ones(int(0.10 * SR)) / int(0.10 * SR), mode='same')

    # Instrumental backing constructed from stems so vocal muting is 100% unmistakable!
    inst_backing = (op_guitar * 0.85 + op_bass * 0.90 + op_drums * 0.90 + op_piano * 0.75)
    normal_mix = op_master * 0.75 + inst_backing * 0.28
    muted_vocal_mix = inst_backing * 0.95 + op_vocals * 0.08
    solo_guitar_mix = op_guitar * 1.95 + inst_backing * 0.22 + op_vocals * 0.08

    w_mute = mute_env[:, None] * (1.0 - solo_env[:, None])
    w_solo = solo_env[:, None]
    w_norm = np.maximum(0.0, 1.0 - w_mute - w_solo)
    seg_0_17 = normal_mix * w_norm + muted_vocal_mix * w_mute + solo_guitar_mix * w_solo

    # Segment 17.0s - 19.0s: Dragon Ball 《CHA-LA HEAD-CHA-LA》 chorus (58.2s)
    db_master = load_pcm_stereo(ROOT / 'output/audio/anime_db_chala.mp3', 58.2, 2.0)
    db_drums = load_pcm_stereo(ROOT / 'assets/band-audio/controls/anime_db_chala/drums.mp3', 58.2, 2.0)
    seg_17_19 = db_master * 0.88 + db_drums * 0.22

    # Segment 19.0s - 21.0s: Naruto 《Blue Bird》 chorus (53.5s)
    nr_master = load_pcm_stereo(ROOT / 'output/audio/anime_nr_blue_bird.mp3', 53.5, 2.0)
    nr_drums = load_pcm_stereo(ROOT / 'assets/band-audio/controls/anime_nr_blue_bird/drums.mp3', 53.5, 2.0)
    seg_19_21 = nr_master * 0.88 + nr_drums * 0.22

    # Segment 21.0s - 30.0s: One Piece 《One day》 Climax (147.2s..156.2s)
    # 21.0s - 21.65s is the pre-climax hush/pause (0.65s), then 21.65s bursts into full chorus!
    op_climax = load_pcm_stereo(ROOT / 'output/audio/anime_op_one_day.mp3', 147.15, 9.0)
    op_c_drums = load_pcm_stereo(ROOT / 'assets/band-audio/controls/anime_op_one_day/drums.mp3', 147.15, 9.0)
    op_c_guitar = load_pcm_stereo(ROOT / 'assets/band-audio/controls/anime_op_one_day/guitar.mp3', 147.15, 9.0)
    seg_21_30 = op_climax * 0.84 + (op_c_drums + op_c_guitar) * 0.24

    # Apply pre-climax hush dip (0.0s..0.65s of seg_21_30 -> video 21.0s..21.65s)
    hush_len = int(0.65 * SR)
    hush_curve = np.ones(len(seg_21_30), dtype=np.float32)
    t_hush = np.linspace(0.0, 1.0, hush_len, dtype=np.float32)
    # Drops to 0.14 during pause, then snaps to 1.08 on the beat at 21.65s
    hush_curve[:hush_len] = 0.15 + 0.15 * np.cos(t_hush * np.pi)
    hush_curve[hush_len : hush_len + int(2.5 * SR)] = 1.08
    hush_curve = np.convolve(hush_curve, np.ones(int(0.03 * SR)) / int(0.03 * SR), mode='same')
    seg_21_30 *= hush_curve[:, None]

    # Join all segments
    full_mix = crossfade_join([seg_0_17, seg_17_19, seg_19_21, seg_21_30], xfade_sec=0.08)

    # Subtle tactile interaction chimes at tap (1.3s, 5.2s), solo hold (9.6s), and climax impact (21.65s)
    n_total = len(full_mix)
    for click_t, freq, amp in [(1.3, 740.0, 0.14), (5.2, 1108.7, 0.15), (9.6, 880.0, 0.13), (21.65, 110.0, 0.22)]:
        i0 = int(click_t * SR)
        l_s = int(0.22 * SR)
        if i0 + l_s < n_total:
            ts = np.arange(l_s, dtype=np.float32) / SR
            tone = amp * np.sin(2 * np.pi * freq * ts) * np.exp(-ts * 22.0)
            full_mix[i0 : i0 + l_s, 0] += tone
            full_mix[i0 : i0 + l_s, 1] += tone

    # Fade in (0.15s) and smooth outro fade out (28.2s -> 30.0s)
    t_all = np.arange(n_total, dtype=np.float32) / SR
    fade_in = np.minimum(1.0, t_all / 0.15)[:, None]
    fade_out = np.minimum(1.0, np.maximum(0.0, (30.0 - t_all) / 1.6))[:, None]
    # Gentle duck during 26.0-30.0s outro card so music remains warm and resolved
    outro_duck = np.where(t_all >= 26.0, 0.72, 1.0)[:, None]
    full_mix = full_mix * fade_in * outro_duck * fade_out

    peak = float(np.max(np.abs(full_mix)))
    if peak > 1e-5:
        full_mix = np.tanh(full_mix / peak * 1.12) / np.tanh(1.12) * 0.86

    wav_path = WORK_DIR / 'v2_30s_master.wav'
    subprocess.run(
        [
            FFMPEG, '-v', 'error', '-y',
            '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', 'pipe:0',
            '-c:a', 'pcm_s16le', str(wav_path),
        ],
        input=full_mix.astype(np.float32).tobytes(),
        check=True,
    )

    # Extract per-frame energy telemetry
    spf = SR // FPS
    telemetry = []
    for f in range(TOTAL_FRAMES):
        i0 = f * spf
        i1 = min(n_total, i0 + spf)
        seg = full_mix[i0:i1]
        rms = float(np.sqrt(np.mean(seg * seg) + 1e-12))
        telemetry.append({'energy': min(1.0, rms * 5.2)})

    return wav_path, telemetry


def load_native_webgl_climax_frames():
    """
    Decodes the project's NATIVE WebGL climax recordings so the 21-26s climax uses 100% genuine
    source-code particle wings & concert pyro fountains:
      - Portrait 9:16 source : output/edit/codex-20261016-lu-band-promo/sources-v2/06-climax.mp4 (1080x1920, HUD-free)
      - Landscape 16:9 source: output/wing-stage-20261016/stage-climax-landscape.mp4 (1920x1080)
      - Wing close-up source : output/wing-shoulder-20261016/energy-wing-closeup.mp4 (1440x794)
      - Front-three wings PNG: output/playwright/band-front-wings/one-piece-{390,1440}.png
    """
    print("[*] Loading native WebGL climax frames (particle wings & concert pyro from project source)...")
    n_climax_frames = int(5.0 * FPS)  # 150 frames for 21.0s - 26.0s

    def decode_frames(mp4_path, start_s, count, w, h, crop_hud=False):
        vf = f'fps={FPS},scale={w}:{h}:flags=lanczos'
        if crop_hud:
            # Crop out top score box (top 14%) and bottom status bar (bottom 9%) from stage-climax-landscape.mp4
            vf = f'fps={FPS},crop=iw:ih*0.76:0:ih*0.14,scale={w}:{h}:flags=lanczos'
        cmd = [
            FFMPEG, '-v', 'error',
            '-ss', f'{start_s:.2f}',
            '-i', str(mp4_path),
            '-vf', vf,
            '-frames:v', str(count),
            '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
        ]
        res = subprocess.run(cmd, capture_output=True, check=True)
        raw = np.frombuffer(res.stdout, dtype=np.uint8)
        frame_sz = w * h * 3
        actual = len(raw) // frame_sz
        frames = [Image.fromarray(raw[i * frame_sz : (i + 1) * frame_sz].reshape((h, w, 3))) for i in range(actual)]
        while len(frames) < count:
            frames.append(frames[-1].copy())
        return frames

    port_climax = decode_frames(
        ROOT / 'output/edit/codex-20261016-lu-band-promo/sources-v2/06-climax.mp4',
        0.2, n_climax_frames, 1080, 1920, crop_hud=False,
    )
    land_climax = decode_frames(
        ROOT / 'output/wing-stage-20261016/stage-climax-landscape.mp4',
        1.6, n_climax_frames, 1920, 1080, crop_hud=True,
    )
    wing_closeup = decode_frames(
        ROOT / 'output/wing-shoulder-20261016/energy-wing-closeup.mp4',
        0.5, n_climax_frames, 1440, 794, crop_hud=False,
    )
    front3_port = Image.open(ROOT / 'output/playwright/band-front-wings/one-piece-390.png').convert('RGB')
    front3_land = Image.open(ROOT / 'output/playwright/band-front-wings/one-piece-1440.png').convert('RGB')

    return {
        'port_climax': port_climax,
        'land_climax': land_climax,
        'wing_closeup': wing_closeup,
        'front3_port': front3_port,
        'front3_land': front3_land,
    }


def load_sprites_and_stages():
    sprites = {}
    for theme, members in ROSTER.items():
        sprites[theme] = []
        for cid, cname, inst_name, color in members:
            sheet = Image.open(ROOT / f'assets/band-pets/{theme}/{cid}.webp').convert('RGBA')
            frames = [sheet.crop((i * 256, 0, (i + 1) * 256, 320)) for i in range(4)]
            dim = frames[0].copy()
            r, g, b, a = dim.split()
            dim = Image.merge(
                'RGBA',
                (
                    r.point(lambda x: int(x * 0.42)),
                    g.point(lambda x: int(x * 0.45)),
                    b.point(lambda x: int(x * 0.52)),
                    a.point(lambda x: int(x * 0.68)),
                ),
            )
            sprites[theme].append({
                'id': cid,
                'name': cname,
                'instrument': inst_name,
                'color': color,
                'frames': frames,
                'dim_frame': dim,
            })

    stages = {
        th: Image.open(ROOT / f'assets/band-stage-v3/{th}.webp').convert('RGBA')
        for th in ['one-piece', 'dragon-ball', 'naruto']
    }
    emblem = Image.open(ROOT / 'assets/lu-core-emblem.png').convert('RGBA')
    qr_img = Image.open(ROOT / 'output/edit/codex-20261016-lu-band-promo/graphics/experience-qr.png').convert('RGBA')
    return sprites, stages, emblem, qr_img


def get_formation_layout(formation, count=10):
    """
    Returns (x, y, depth_scale, layer_rank) for each character so that:
    - Index 0 (lead singer) is ALWAYS at front-center (0.0, 0.52) for seamless Match-Cuts across themes!
    - Index 1 & 2 (front partners) are always front-left and front-right.
    """
    coords = []
    for i in range(count):
        if formation == 'terrace':
            if i == 0:
                coords.append((0.0, 0.52, 1.15, 0))
            elif i == 1:
                coords.append((-0.52, 0.46, 1.02, 0))
            elif i == 2:
                coords.append((0.52, 0.46, 1.02, 0))
            elif i in (3, 4, 5, 6):
                xs = [-0.74, -0.26, 0.26, 0.74]
                coords.append((xs[i - 3], 0.04, 0.86, 1))
            else:
                xs = [-0.50, 0.0, 0.50]
                coords.append((xs[(i - 7) % 3], -0.34, 0.74, 2))
        elif formation == 'arc':
            if i == 0:
                coords.append((0.0, 0.52, 1.15, 0))
            elif i == 1:
                coords.append((-0.46, 0.34, 1.00, 0))
            elif i == 2:
                coords.append((0.46, 0.34, 1.00, 0))
            else:
                idx = i - 3
                ang = math.pi * (0.12 + 0.76 * (idx / max(1, count - 4)))
                x = math.cos(ang) * 0.84
                y = -0.05 - math.sin(ang) * 0.34
                coords.append((x, y, 0.82, 1))
        elif formation == 'wings':
            if i == 0:
                coords.append((0.0, 0.52, 1.18, 0))
            elif i == 1:
                coords.append((-0.38, 0.26, 1.02, 0))
            elif i == 2:
                coords.append((0.38, 0.26, 1.02, 0))
            else:
                side = -1 if i % 2 == 1 else 1
                rank = (i - 1) // 2
                x = side * (0.34 + rank * 0.16)
                y = 0.18 - rank * 0.18
                coords.append((x, y, 0.92 - rank * 0.05, rank))
    return coords


def draw_clean_caption(canvas, is_vertical, pill_text, headline, subline, accent_rgb, t_local):
    """
    Draws a minimal, high-contrast cinema caption at the bottom with zero technical clutter
    and guaranteed PingFang CJK glyph rendering.
    """
    w, h = canvas.size
    veil = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    vd = ImageDraw.Draw(veil)

    # Soft bottom vignette for crystal-clear typography without boxing off the stage
    grad_h = int(h * (0.26 if is_vertical else 0.30))
    for y in range(h - grad_h, h):
        u = (y - (h - grad_h)) / max(1, grad_h)
        a = int(225 * (u ** 1.35))
        vd.line((0, y, w, y), fill=(6, 11, 18, a))

    s_in = spring_ease(t_local, zeta=0.68, omega=16.0)
    y_off = int((1.0 - s_in) * 28)

    pad_x = 68 if is_vertical else 88
    base_y = (h - 285 + y_off) if is_vertical else (h - 215 + y_off)

    # Pill tag
    f_pill = get_font(24 if is_vertical else 22, bold=True)
    pw = int(vd.textlength(pill_text, font=f_pill)) + 36
    vd.rounded_rectangle(
        (pad_x, base_y, pad_x + pw, base_y + 44),
        radius=22,
        fill=(14, 24, 36, 230),
        outline=(*accent_rgb, 210),
        width=2,
    )
    vd.text((pad_x + 18, base_y + 7), pill_text, font=f_pill, fill=(*accent_rgb, 255))

    # Main Headline
    f_head = get_font(62 if is_vertical else 54, bold=True)
    vd.text((pad_x, base_y + 58), headline, font=f_head, fill=(250, 246, 238, 255))

    # Subline
    f_sub = get_font(30 if is_vertical else 27, bold=False)
    vd.text((pad_x, base_y + (138 if is_vertical else 126)), subline, font=f_sub, fill=(196, 210, 222, 245))

    canvas.alpha_composite(veil)


def draw_touch_ripple(draw, cx, cy, age, color_rgb, label_text=None):
    """Draws an unmistakable concentric touch ripple and floating action pill."""
    if not (0.0 <= age < 0.95):
        return
    p = age / 0.95
    ease = 1.0 - (1.0 - p) ** 3
    r1 = 28 + ease * 135
    r2 = 16 + ease * 85
    alpha = int(250 * (1.0 - p))
    draw.ellipse((cx - r1, cy - r1, cx + r1, cy + r1), outline=(*color_rgb, alpha), width=6)
    draw.ellipse((cx - r2, cy - r2, cx + r2, cy + r2), outline=(255, 255, 255, alpha), width=4)
    draw.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=(255, 255, 255, min(255, alpha + 40)))

    if label_text:
        f_lbl = get_font(26, bold=True)
        tw = int(draw.textlength(label_text, font=f_lbl))
        bx0 = int(cx - tw // 2 - 22)
        by0 = int(cy - 135 - ease * 28)
        bx1 = int(cx + tw // 2 + 22)
        by1 = by0 + 48
        draw.rounded_rectangle(
            (bx0, by0, bx1, by1),
            radius=24,
            fill=(10, 18, 28, min(240, alpha + 50)),
            outline=(*color_rgb, min(255, alpha + 40)),
            width=3,
        )
        draw.text((bx0 + 22, by0 + 8), label_text, font=f_lbl, fill=(255, 255, 255, min(255, alpha + 50)))


def render_stage_camera(
    canvas,
    theme_key,
    sprites_dict,
    stages_dict,
    coords,
    t,
    energy,
    cam_zoom=1.0,
    cam_focus_xy=(0.0, 0.0),
    muted_indices=(),
    solo_index=None,
    bg_dim=0.48,
    parallax_x=0.0,
):
    """
    Renders the 3D stage with true camera zoom (pan & scale), foreground/background parallax,
    volumetric spotlights, and high-occupation character sprites.
    """
    w, h = canvas.size
    is_vertical = h > w

    # 1. Stage backdrop with camera zoom & parallax shift
    stage_bg = stages_dict[theme_key]
    bg_scale = max(w / stage_bg.width, h / stage_bg.height) * (1.0 + (cam_zoom - 1.0) * 0.35)
    bw, bh = int(stage_bg.width * bg_scale), int(stage_bg.height * bg_scale)
    bg_resized = stage_bg.resize((bw, bh), Image.Resampling.BILINEAR)
    bx = int((w - bw) * 0.5 - cam_focus_xy[0] * w * 0.12 - parallax_x * 35)
    by = int((h - bh) * 0.5 - cam_focus_xy[1] * h * 0.12)
    canvas.paste(bg_resized, (bx, by))

    # Darken backdrop slightly so characters pop with maximum clarity
    dark_layer = Image.new('RGBA', (w, h), (7, 12, 20, int(255 * (1.0 - bg_dim))))
    canvas.alpha_composite(dark_layer)

    # Stage center reference
    cx_stage = w * 0.5 - cam_focus_xy[0] * w * 0.42 * cam_zoom
    cy_stage = (h * 0.50 if is_vertical else h * 0.54) - cam_focus_xy[1] * h * 0.36 * cam_zoom
    span_x = (w * 0.40 if is_vertical else w * 0.36) * cam_zoom
    span_y = (h * 0.22 if is_vertical else h * 0.25) * cam_zoom

    roster = sprites_dict[theme_key]
    indexed = list(enumerate(zip(roster, coords)))
    indexed.sort(key=lambda item: item[1][1][1])  # back-to-front

    # 2. Volumetric spotlights
    beam_layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(beam_layer)
    for idx, (actor, (nx, ny, d_scale, layer_rank)) in indexed:
        if solo_index is not None and idx != solo_index:
            continue
        if idx in muted_indices:
            continue
        layer_parallax = (1.25 if layer_rank == 0 else (0.85 if layer_rank == 1 else 0.55)) * parallax_x
        px = cx_stage + (nx + layer_parallax) * span_x
        py = cy_stage + ny * span_y
        col = actor['color']
        alpha = 72 if solo_index == idx else int(26 + 24 * energy)
        cone_w = (150 if solo_index == idx else 78) * d_scale * cam_zoom * (w / 1080.0)
        b_draw.polygon(
            [(px - cone_w * 0.18, 0), (px + cone_w * 0.18, 0), (px + cone_w, py + 24), (px - cone_w, py + 24)],
            fill=(*col, alpha),
        )
    canvas.alpha_composite(beam_layer)

    # 3. Characters
    char_layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(char_layer)
    base_unit = (330.0 if is_vertical else 285.0) * (w / 1080.0 if is_vertical else h / 1080.0)

    screen_positions = {}
    for idx, (actor, (nx, ny, d_scale, layer_rank)) in indexed:
        layer_parallax = (1.25 if layer_rank == 0 else (0.85 if layer_rank == 1 else 0.55)) * parallax_x
        px = cx_stage + (nx + layer_parallax) * span_x
        py = cy_stage + ny * span_y

        is_muted = idx in muted_indices
        is_dim_other = solo_index is not None and idx != solo_index
        is_solo_star = solo_index == idx

        if is_muted or is_dim_other:
            sprite = actor['dim_frame']
            bounce_y = 0.0
            sx_mult, sy_mult = 1.0, 1.0
        else:
            cycle = [1, 2, 3, 2]
            step = int(t * 8.0 + idx) % 4
            sprite = actor['frames'][cycle[step]]
            pulse = (0.5 + 0.5 * math.sin(t * 15.0 + idx * 0.8)) * (0.45 + 0.55 * energy)
            bounce_y = -14.0 * pulse * d_scale * cam_zoom
            sy_mult = 1.0 + 0.048 * pulse
            sx_mult = 1.0 / math.sqrt(sy_mult)

        solo_boost = 1.32 if is_solo_star else (0.82 if is_dim_other else 1.0)
        ch = int(max(32, base_unit * d_scale * cam_zoom * solo_boost * sy_mult))
        cw = int(max(32, ch * (256.0 / 320.0) * sx_mult))

        # Skip offscreen characters when zoomed in tight
        if px + cw < -100 or px - cw > w + 100 or py - ch > h + 100 or py + 100 < 0:
            continue

        # Glowing stage ring under feet
        fw = int(cw * 0.65)
        fh = int(fw * 0.23)
        col = actor['color']
        ring_a = 235 if is_solo_star else (45 if (is_muted or is_dim_other) else 135)
        c_draw.ellipse(
            (px - fw // 2, py - fh // 2, px + fw // 2, py + fh // 2),
            fill=(6, 11, 18, 165),
            outline=(*col, ring_a),
            width=4 if is_solo_star else 2,
        )

        resized = sprite.resize((cw, ch), Image.Resampling.BILINEAR)
        paste_x = int(px - cw * 0.5)
        paste_y = int(py + bounce_y - ch * 0.92)
        char_layer.alpha_composite(resized, (paste_x, paste_y))

        # Clean character role badge on front-row or solo star
        if (idx == 0 and cam_zoom >= 1.25) or is_solo_star or (idx < 3 and solo_index is None):
            state_suffix = ' · 已静音' if is_muted else (' · 独奏中' if is_solo_star else f" · {actor['instrument']}")
            badge_str = f"{actor['name']}{state_suffix}"
            f_b = get_font(22 if (is_solo_star or cam_zoom >= 1.3) else 18, bold=True)
            tw = int(c_draw.textlength(badge_str, font=f_b))
            bx0 = int(px - tw // 2 - 16)
            by0 = int(py + 14)
            bx1 = int(px + tw // 2 + 16)
            by1 = by0 + (38 if (is_solo_star or cam_zoom >= 1.3) else 32)
            c_draw.rounded_rectangle(
                (bx0, by0, bx1, by1),
                radius=16,
                fill=(10, 18, 28, 225 if not is_dim_other else 110),
                outline=(*col, 220 if not is_muted else 90),
                width=2,
            )
            c_draw.text(
                (bx0 + 16, by0 + 5),
                badge_str,
                font=f_b,
                fill=(255, 255, 255, 245) if not is_muted else (165, 175, 185, 200),
            )

        screen_positions[idx] = (px, py - ch * 0.48, cw, ch)

    canvas.alpha_composite(char_layer)
    return screen_positions


def render_single_frame(f_idx, is_vertical, sprites, stages, emblem, qr_img, telemetry, native_climax):
    w, h = (1080, 1920) if is_vertical else (1920, 1080)
    t = f_idx / FPS
    energy = telemetry[f_idx]['energy']
    canvas = Image.new('RGBA', (w, h), (7, 12, 20, 255))

    # =========================================================================
    # 0.0s - 3.0s: 主唱近景，立刻展示点按造成的音画变化
    # =========================================================================
    if t < 3.0:
        is_muted = t >= 1.3
        # Tight macro close-up on Luffy (index 0, at (0.0, 0.52)), gently pulling back after tap
        zoom = 1.95 - 0.25 * smoothstep(1.3, 3.0, t)
        focus_y = 0.26 - 0.04 * smoothstep(1.3, 3.0, t)
        coords = get_formation_layout('terrace', 10)
        pos = render_stage_camera(
            canvas, 'one-piece', sprites, stages, coords, t, energy,
            cam_zoom=zoom, cam_focus_xy=(0.0, focus_y),
            muted_indices=(0,) if is_muted else (),
            bg_dim=0.38 if is_muted else 0.54,
        )
        draw = ImageDraw.Draw(canvas)
        if 0 in pos:
            lx, ly, _, _ = pos[0]
            draw_touch_ripple(draw, lx, ly, t - 1.3, (56, 189, 248), '点按主唱 · 人声减弱')

        draw_clean_caption(
            canvas, is_vertical,
            '律 LÜ · 互动动漫乐队',
            '这支动漫乐队，听你指挥。',
            '点一下主唱路飞，人声立即减弱退场，器乐伴奏继续流淌',
            (56, 189, 248),
            t,
        )

    # =========================================================================
    # 3.0s - 9.0s: 退出 → 回归，完整证明一次点按进退交互
    # =========================================================================
    elif t < 9.0:
        local_t = t - 3.0
        is_muted = t < 5.2
        # Smooth camera pull from medium-close (1.55x) to medium front-trio framing (1.28x), then push on restore
        if t < 5.2:
            zoom = 1.48 - 0.16 * smoothstep(3.0, 5.0, t)
        else:
            zoom = 1.32 + 0.14 * spring_ease(t - 5.2, zeta=0.58, omega=12.0)

        coords = get_formation_layout('terrace', 10)
        pos = render_stage_camera(
            canvas, 'one-piece', sprites, stages, coords, t, energy,
            cam_zoom=zoom, cam_focus_xy=(0.0, 0.18),
            muted_indices=(0,) if is_muted else (),
            bg_dim=0.38 if is_muted else 0.56,
        )
        draw = ImageDraw.Draw(canvas)
        if 0 in pos:
            lx, ly, _, _ = pos[0]
            draw_touch_ripple(draw, lx, ly, t - 5.2, (251, 191, 36), '再次点按 · 主唱重回舞台')

        sub_msg = '当前：主唱休止 · 贝斯与手风琴独立声部清晰可辨' if is_muted else '当前：主唱重燃 · 再点一下即刻合拍回归全员合奏'
        draw_clean_caption(
            canvas, is_vertical,
            '点按进退 · 实时声轨差分',
            '点一下退场，再点一下归队。',
            sub_msg,
            (251, 191, 36) if not is_muted else (56, 189, 248),
            local_t,
        )

    # =========================================================================
    # 9.0s - 15.0s: 乌索普独奏特写，居中明显放大，突出声音与聚光灯变化
    # =========================================================================
    elif t < 15.0:
        local_t = t - 9.0
        is_solo = 9.6 <= t < 14.0
        coords = get_formation_layout('terrace', 10)
        # Move Usopp (index 6) smoothly to front-center hero position during solo!
        enter_p = smoothstep(9.0, 9.8, t) * (1.0 - smoothstep(14.0, 14.8, t))
        ux, uy, uscale, urank = coords[6]
        coords[6] = (
            ux * (1.0 - enter_p) + 0.0 * enter_p,
            uy * (1.0 - enter_p) + 0.42 * enter_p,
            uscale * (1.0 - enter_p) + 1.38 * enter_p,
            0,
        )
        # Push Luffy slightly left so Usopp commands the dead-center close-up
        lx0, ly0, lsc0, lr0 = coords[0]
        coords[0] = (lx0 - 0.44 * enter_p, ly0 - 0.15 * enter_p, lsc0 * (1.0 - 0.22 * enter_p), 1)

        zoom = 1.25 + 0.52 * enter_p
        focus_y = 0.12 + 0.12 * enter_p
        pos = render_stage_camera(
            canvas, 'one-piece', sprites, stages, coords, t, energy,
            cam_zoom=zoom, cam_focus_xy=(0.0, focus_y),
            solo_index=6 if is_solo else None,
            bg_dim=0.22 if is_solo else 0.50,
        )
        draw = ImageDraw.Draw(canvas)
        if 6 in pos and is_solo:
            ux_s, uy_s, uw_s, uh_s = pos[6]
            hold_prog = min(1.0, (t - 9.6) / 4.0)
            # Expanding acoustic wave rings around Usopp's slingshot guitar (zero missing-glyph symbols!)
            for w_i in range(3):
                wp = (t * 1.4 + w_i * 0.33) % 1.0
                wr = int(uw_s * 0.38 + wp * uw_s * 0.85)
                wa = int(210 * (1.0 - wp))
                draw.ellipse((ux_s - wr, uy_s - wr, ux_s + wr, uy_s + wr), outline=(250, 204, 21, wa), width=4)

            arc_r = int(uw_s * 0.46)
            draw.arc(
                (ux_s - arc_r, uy_s - arc_r, ux_s + arc_r, uy_s + arc_r),
                start=-90,
                end=-90 + int(360 * hold_prog),
                fill=(250, 204, 21, 255),
                width=8,
            )

        draw_clean_caption(
            canvas, is_vertical,
            '长按独奏 · 聚光灯锁定',
            '按住吉他手，把主场交给他。',
            '长按乌索普放大居中，吉他独立声轨突出，原曲退为轻柔伴奏',
            (250, 204, 21),
            local_t,
        )

    # =========================================================================
    # 15.0s - 21.0s: 三主题快速接棒（同位置角色衔接 + 两次清晰队形变化 + 切换主题乐曲）
    # =========================================================================
    elif t < 21.0:
        local_t = t - 15.0
        if t < 17.0:
            # 15.0s - 17.0s: One Piece (《One day》) · Terrace -> Arc formation morph with parallax
            sub_t = t - 15.0
            m_prog = smoothstep(0.15, 1.65, sub_t)
            c0 = get_formation_layout('terrace', 10)
            c1 = get_formation_layout('arc', 10)
            coords = [
                (
                    c0[i][0] + (c1[i][0] - c0[i][0]) * m_prog,
                    c0[i][1] + (c1[i][1] - c0[i][1]) * m_prog,
                    c0[i][2] + (c1[i][2] - c0[i][2]) * m_prog,
                    c1[i][3],
                )
                for i in range(10)
            ]
            parallax = -0.06 + 0.12 * (sub_t / 2.0)
            render_stage_camera(
                canvas, 'one-piece', sprites, stages, coords, t, energy,
                cam_zoom=1.22 + 0.08 * math.sin(sub_t * math.pi / 2.0),
                cam_focus_xy=(0.0, 0.12),
                parallax_x=parallax,
            )
            draw_clean_caption(
                canvas, is_vertical,
                '海贼王 · 主题曲《One day》',
                '换一支乐队，换一首主题曲。',
                '队形变换 01：阶梯阵列 → 弧形阵列（前后景视差流转）',
                (251, 113, 133),
                sub_t,
            )
        elif t < 19.0:
            # 17.0s - 19.0s: Dragon Ball (《CHA-LA HEAD-CHA-LA》) · Match-Cut on center vocalist + Arc -> Wings morph
            sub_t = t - 17.0
            m_prog = smoothstep(0.15, 1.65, sub_t)
            c0 = get_formation_layout('arc', 10)
            c1 = get_formation_layout('wings', 10)
            coords = [
                (
                    c0[i][0] + (c1[i][0] - c0[i][0]) * m_prog,
                    c0[i][1] + (c1[i][1] - c0[i][1]) * m_prog,
                    c0[i][2] + (c1[i][2] - c0[i][2]) * m_prog,
                    c1[i][3],
                )
                for i in range(10)
            ]
            parallax = 0.06 - 0.12 * (sub_t / 2.0)
            render_stage_camera(
                canvas, 'dragon-ball', sprites, stages, coords, t, energy,
                cam_zoom=1.28,
                cam_focus_xy=(0.0, 0.12),
                parallax_x=parallax,
            )
            # Subtle match-cut flash ring around Goku (same center spot as Luffy!)
            if sub_t < 0.45:
                draw = ImageDraw.Draw(canvas)
                draw_touch_ripple(draw, w * 0.5, h * 0.54, sub_t, (251, 146, 60), None)
            draw_clean_caption(
                canvas, is_vertical,
                '龙珠 · 主题曲《CHA-LA HEAD-CHA-LA》',
                '悟空同位接棒，燃魂开唱。',
                '队形变换 02：弧形阵列 → 双翼阵列（十人乐团同步换装）',
                (251, 146, 60),
                sub_t,
            )
        else:
            # 19.0s - 21.0s: Naruto (《Blue Bird》) · Match-Cut on center vocalist in Wings formation
            sub_t = t - 19.0
            coords = get_formation_layout('wings', 9)
            parallax = -0.05 + 0.10 * (sub_t / 2.0)
            render_stage_camera(
                canvas, 'naruto', sprites, stages, coords, t, energy,
                cam_zoom=1.28 + 0.10 * (sub_t / 2.0),
                cam_focus_xy=(0.0, 0.14),
                parallax_x=parallax,
            )
            if sub_t < 0.45:
                draw = ImageDraw.Draw(canvas)
                draw_touch_ripple(draw, w * 0.5, h * 0.54, sub_t, (168, 85, 247), None)
            draw_clean_caption(
                canvas, is_vertical,
                '火影忍者 · 主题曲《Blue Bird》',
                '鸣人领衔木叶乐团，无缝接力。',
                '三大动漫主题共 29 位角色，各自执掌专属定制乐器',
                (168, 85, 247),
                sub_t,
            )

    # =========================================================================
    # 21.0s - 26.0s: 全员合奏高潮（原生源码 WebGL 粒子翼与焰火 + 先收暗停顿再爆发推镜）
    # =========================================================================
    elif t < 26.0:
        local_t = t - 21.0
        c_idx = min(len(native_climax['port_climax']) - 1, int(local_t * FPS))

        # Native WebGL frame from the project's actual Three.js stage + shoulder wing renders
        if is_vertical:
            base_webgl = native_climax['port_climax'][c_idx].copy()
            front3_wing = native_climax['front3_port'].resize((w, h), Image.Resampling.LANCZOS)
        else:
            base_webgl = native_climax['land_climax'][c_idx].copy()
            front3_wing = native_climax['front3_land'].resize((w, h), Image.Resampling.LANCZOS)

        if local_t < 0.65:
            # 21.0s - 21.65s: Pre-climax dim & pause (先收暗、短暂停顿蓄力)
            dim_factor = 0.32 - 0.12 * math.sin((local_t / 0.65) * math.pi)
            frame_im = ImageEnhance.Brightness(base_webgl).enhance(dim_factor)
            canvas.paste(frame_im.convert('RGBA'), (0, 0))
            draw_clean_caption(
                canvas, is_vertical,
                '副歌蓄力 · 屏息一瞬',
                '灯光收暗，等待高潮降临……',
                '前排三人肩部粒子羽翼与 360° 舞台焰火即将同步迸发',
                (155, 238, 236),
                local_t,
            )
        else:
            # 21.65s - 26.0s: Beat explosion + native WebGL shoulder wings & pyro + clear camera Push-In!
            burst_t = local_t - 0.65
            # Screen-blend the front-three native shoulder particle wings + live WebGL pyro fountain frame
            arr_a = np.array(base_webgl, dtype=np.float32)
            arr_b = np.array(front3_wing, dtype=np.float32)
            # Screen blend highlights from native front-three shoulder wings so all 3 front characters glow with native wings
            blended = 255.0 - (255.0 - arr_a) * (255.0 - arr_b * 0.55) / 255.0
            # Add brief golden impact flash right at t=21.65s
            flash = max(0.0, 1.0 - burst_t / 0.28) * 48.0
            blended = np.clip(blended + flash, 0, 255).astype(np.uint8)
            merged_im = Image.fromarray(blended)

            # Explicit Camera Push-In (1.00x -> 1.24x centered on the front trio & shoulder wings!)
            push_prog = smoothstep(0.0, 3.6, burst_t)
            zoom = 1.00 + 0.24 * push_prog
            cw_crop = int(w / zoom)
            ch_crop = int(h / zoom)
            cx0 = (w - cw_crop) // 2
            # Bias crop slightly toward the front-row characters and their shoulder particle wings
            cy0 = int((h - ch_crop) * (0.54 if is_vertical else 0.48))
            pushed = merged_im.crop((cx0, cy0, cx0 + cw_crop, cy0 + ch_crop)).resize((w, h), Image.Resampling.LANCZOS)
            canvas.paste(pushed.convert('RGBA'), (0, 0))

            # Optional inset of the native 50fps close-up shoulder wing render during peak (23.2s-25.6s)
            if 1.5 <= burst_t < 3.9:
                inset_alpha = smoothstep(1.5, 1.85, burst_t) * (1.0 - smoothstep(3.55, 3.9, burst_t))
                if inset_alpha > 0.05:
                    cu_frame = native_climax['wing_closeup'][c_idx]
                    iw = int(w * (0.44 if is_vertical else 0.32))
                    ih = int(iw * (794.0 / 1440.0))
                    cu_resized = cu_frame.resize((iw, ih), Image.Resampling.LANCZOS).convert('RGBA')
                    ix = w - iw - (56 if is_vertical else 76)
                    iy = (110 if is_vertical else 72)
                    draw = ImageDraw.Draw(canvas)
                    draw.rounded_rectangle((ix - 4, iy - 4, ix + iw + 4, iy + ih + 4), radius=18, fill=(8, 14, 22, int(220 * inset_alpha)), outline=(251, 191, 36, int(245 * inset_alpha)), width=3)
                    cu_resized.putalpha(int(255 * inset_alpha))
                    canvas.alpha_composite(cu_resized, (ix, iy))
                    f_cu = get_font(20, bold=True)
                    draw.text((ix + 16, iy + ih - 34), '源码实景：肩部纯粒子翼近景', font=f_cu, fill=(255, 248, 220, int(250 * inset_alpha)))

            draw_clean_caption(
                canvas, is_vertical,
                '高潮全开 · 源码原生粒子翼与焰火',
                '当音乐抵达高潮，舞台随之绽放。',
                '前排三人肩部展开纯粒子能量翼，舞台喷泉焰火与礼花齐鸣',
                (251, 191, 36),
                burst_t,
            )

    # =========================================================================
    # 26.0s - 30.0s: 品牌与体验入口稳定收尾（整整 4 秒，只留品牌、二维码和核心号召）
    # =========================================================================
    else:
        local_t = t - 26.0
        # Soft atmospheric stage backdrop with gentle breathing
        bg = stages['one-piece'].resize((w, h), Image.Resampling.BILINEAR)
        canvas.paste(bg, (0, 0))
        veil = Image.new('RGBA', (w, h), (6, 11, 18, 212))
        canvas.alpha_composite(veil)
        draw = ImageDraw.Draw(canvas)

        s_card = spring_ease(local_t, zeta=0.72, omega=14.0)
        y_slide = int((1.0 - s_card) * 24)

        if is_vertical:
            # Clean centered vertical layout — generous spacing, zero overlap
            emb_sz = 168
            emb_im = emblem.resize((emb_sz, emb_sz), Image.Resampling.LANCZOS)
            canvas.alpha_composite(emb_im, ((w - emb_sz) // 2, 270 + y_slide))

            f_brand = get_font(76, bold=True)
            b_txt = '律  LÜ'
            bw = draw.textlength(b_txt, font=f_brand)
            draw.text(((w - bw) / 2, 470 + y_slide), b_txt, font=f_brand, fill=(250, 246, 238, 255))

            f_cta = get_font(56, bold=True)
            cta_txt = '打开网页，指挥你的乐队'
            cw_t = draw.textlength(cta_txt, font=f_cta)
            draw.text(((w - cw_t) / 2, 595 + y_slide), cta_txt, font=f_cta, fill=(155, 238, 236, 255))

            f_sub = get_font(30, bold=False)
            sub_txt = '这支动漫乐队，听你指挥。'
            sw_t = draw.textlength(sub_txt, font=f_sub)
            draw.text(((w - sw_t) / 2, 685 + y_slide), sub_txt, font=f_sub, fill=(196, 210, 222, 240))

            # Dedicated QR Code Card in lower-middle area (completely separated from text)
            qr_sz = 360
            qx = (w - qr_sz) // 2
            qy = 830 + y_slide
            draw.rounded_rectangle(
                (qx - 28, qy - 28, qx + qr_sz + 28, qy + qr_sz + 92),
                radius=32,
                fill=(12, 22, 34, 240),
                outline=(155, 238, 236, 185),
                width=3,
            )
            draw.rounded_rectangle((qx - 12, qy - 12, qx + qr_sz + 12, qy + qr_sz + 12), radius=18, fill=(255, 255, 255, 255))
            canvas.alpha_composite(qr_img.resize((qr_sz, qr_sz), Image.Resampling.NEAREST), (qx, qy))

            f_scan = get_font(28, bold=True)
            scan_txt = '扫码即刻登台体验'
            sc_w = draw.textlength(scan_txt, font=f_scan)
            draw.text(((w - sc_w) / 2, qy + qr_sz + 26), scan_txt, font=f_scan, fill=(250, 246, 238, 255))
        else:
            # Clean two-column widescreen layout (Left: Brand & Headline; Right: Dedicated QR Card)
            emb_sz = 148
            emb_im = emblem.resize((emb_sz, emb_sz), Image.Resampling.LANCZOS)
            canvas.alpha_composite(emb_im, (160, 250 + y_slide))

            f_brand = get_font(82, bold=True)
            draw.text((336, 275 + y_slide), '律  LÜ', font=f_brand, fill=(250, 246, 238, 255))

            f_cta = get_font(64, bold=True)
            draw.text((160, 465 + y_slide), '打开网页，指挥你的乐队', font=f_cta, fill=(155, 238, 236, 255))

            f_sub = get_font(34, bold=False)
            draw.text((160, 568 + y_slide), '这支动漫乐队，听你指挥。', font=f_sub, fill=(196, 210, 222, 240))

            # Right QR Card (x=1220..1680) — zero overlap with left text!
            qr_sz = 340
            qx = 1280
            qy = 270 + y_slide
            draw.rounded_rectangle(
                (qx - 28, qy - 28, qx + qr_sz + 28, qy + qr_sz + 90),
                radius=32,
                fill=(12, 22, 34, 240),
                outline=(155, 238, 236, 185),
                width=3,
            )
            draw.rounded_rectangle((qx - 12, qy - 12, qx + qr_sz + 12, qy + qr_sz + 12), radius=18, fill=(255, 255, 255, 255))
            canvas.alpha_composite(qr_img.resize((qr_sz, qr_sz), Image.Resampling.NEAREST), (qx, qy))

            f_scan = get_font(26, bold=True)
            scan_txt = '扫码即刻登台体验'
            sc_w = draw.textlength(scan_txt, font=f_scan)
            draw.text((qx + (qr_sz - sc_w) / 2, qy + qr_sz + 24), scan_txt, font=f_scan, fill=(250, 246, 238, 255))

    return canvas.convert('RGB')


def encode_video(is_vertical, wav_path, sprites, stages, emblem, qr_img, telemetry, native_climax, out_mp4, out_cover):
    w, h = (1080, 1920) if is_vertical else (1920, 1080)
    label = '9:16 Vertical (1080x1920)' if is_vertical else '16:9 Widescreen (1920x1080)'
    print(f"[*] Encoding V2 {label} ({TOTAL_FRAMES} frames @ {FPS}fps) -> {out_mp4} ...")

    cmd = [
        FFMPEG, '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(FPS), '-i', 'pipe:0',
        '-i', str(wav_path),
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '256k', '-ar', str(SR),
        '-shortest', '-movflags', '+faststart',
        str(out_mp4),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    t0 = time.time()
    cover_frame_idx = int(23.0 * FPS)  # Peak native climax frame with particle wings & pyro

    for f in range(TOTAL_FRAMES):
        frame_rgb = render_single_frame(f, is_vertical, sprites, stages, emblem, qr_img, telemetry, native_climax)
        if f == cover_frame_idx:
            frame_rgb.save(out_cover, quality=95)
        proc.stdin.write(frame_rgb.tobytes())
        if (f + 1) % 180 == 0 or f == TOTAL_FRAMES - 1:
            elapsed = time.time() - t0
            print(f"    [{label}] Frame {f + 1}/{TOTAL_FRAMES} ({(f + 1) / max(1e-3, elapsed):.1f} fps)", flush=True)

    proc.stdin.close()
    err = proc.stderr.read().decode()
    if proc.wait() != 0:
        raise RuntimeError(f"FFmpeg failed for {out_mp4}: {err[-2000:]}")
    print(f"[+] Completed {out_mp4} & cover {out_cover}")


def main():
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    wav_path, telemetry = build_multi_song_audio_and_telemetry()
    sprites, stages, emblem, qr_img = load_sprites_and_stages()
    native_climax = load_native_webgl_climax_frames()

    out_9x16 = OUT_DIR / 'lu_band_original_9x16.mp4'
    cov_9x16 = OUT_DIR / 'lu_band_original_cover_9x16.jpg'
    encode_video(True, wav_path, sprites, stages, emblem, qr_img, telemetry, native_climax, out_9x16, cov_9x16)

    out_16x9 = OUT_DIR / 'lu_band_original_16x9.mp4'
    cov_16x9 = OUT_DIR / 'lu_band_original_cover_16x9.jpg'
    encode_video(False, wav_path, sprites, stages, emblem, qr_img, telemetry, native_climax, out_16x9, cov_16x9)


if __name__ == '__main__':
    main()
