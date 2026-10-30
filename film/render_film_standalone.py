#!/usr/bin/env python3
"""
Master 1080p@30fps 3D Commercial Film Renderer for 『 律 』 Band Mode.
Renders all 900 frames (30.000s) using authentic 3D stage plates, 4-frame WebP character sprites,
analytical 3D-to-2D perspective camera choreography, Tyrael-style particle energy wings,
8 stage pyrotechnic fountains + 2 spherical high-altitude airburst fireworks,
550ms Cream Prism -> Sunset Island dual-stage metamorphosis crossfade,
and Teenage Engineering / Apple desktop sandbox reveal & brand lockup.
"""

import json
import math
import subprocess
import time
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TARGET_MP4 = ROOT / 'video.mp4'
BACKUP_MP4 = ROOT / 'output/film/video.mp4'
AUDIO_PATH = ROOT / 'output/film/film_master_final.m4a'
KEYFRAMES_DIR = ROOT / 'output/film/keyframes_verify'

W, H = 1920, 1080
FPS = 30.0
TOTAL_FRAMES = 900

# Base reference camera parameters for the 1280x720 (and 1920x1080) Three.js stage plate
BASE_W, BASE_H = 1280, 720
SCALE_1080 = 1.5  # 1920 / 1280 == 1080 / 720 == 1.5
CAM_POS = np.array([0.0, 23.084, 42.112], dtype=np.float32)
CAM_TGT = np.array([0.0, 4.303, -0.058], dtype=np.float32)
CAM_FWD = (CAM_TGT - CAM_POS) / np.linalg.norm(CAM_TGT - CAM_POS)
CAM_RIGHT = np.array([1.0, 0.0, 0.0], dtype=np.float32)
CAM_UP = np.cross(CAM_RIGHT, CAM_FWD)
TAN_HALF = math.tan(math.radians(15.0))
ASPECT = BASE_W / BASE_H
VOY = 33.0


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, float(x)))


def smoothstep(e0, e1, x):
    t = clamp((x - e0) / max(1e-6, (e1 - e0)), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def cubic_ease_out(t):
    x = clamp(t, 0.0, 1.0)
    return 1.0 - (1.0 - x) ** 3


def lerp(a, b, t):
    return a + (b - a) * t


def hex_to_bgr(h):
    h = h.lstrip('#')
    return (int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16))


def hex_to_rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def proj_3d_to_1080p(X, Y, Z):
    """Projects 3D world coordinates (X, Y, Z) onto the 1920x1080 base stage canvas."""
    rx, ry, rz = X - CAM_POS[0], Y - CAM_POS[1], Z - CAM_POS[2]
    cx = rx * CAM_RIGHT[0] + ry * CAM_RIGHT[1] + rz * CAM_RIGHT[2]
    cy = rx * CAM_UP[0] + ry * CAM_UP[1] + rz * CAM_UP[2]
    cz = rx * CAM_FWD[0] + ry * CAM_FWD[1] + rz * CAM_FWD[2]
    nx = cx / (cz * TAN_HALF * ASPECT)
    ny = cy / (cz * TAN_HALF) + 2.0 * (VOY / BASE_H)
    px = (nx * 0.5 + 0.5) * W
    py = (-ny * 0.5 + 0.5) * H
    return px, py, cz


def stage_height_at(x, z):
    r = math.hypot(x, z - (-4.8))
    if z < -4.8 or r > 14.0:
        return 0.0
    radii = [14.0, 10.4, 6.8, 3.2]
    level = sum(1 for rad in radii[1:] if r <= rad)
    return 0.35 + level * 0.72


# Roster & 3D layouts from js/audio/band-parts.js and js/audio/band-stage-layout.js
ROSTER = [
    {'id': 'luffy',   'name': '路飞',   'instrument': '草帽麦克风',   'tech': 'voice',   'accent': '#db775d'},
    {'id': 'zoro',    'name': '索隆',   'instrument': '三弦脊贝斯',   'tech': 'pluck',   'accent': '#748e65'},
    {'id': 'nami',    'name': '娜美',   'instrument': '航海手风琴',   'tech': 'keys',    'accent': '#d5a15c'},
    {'id': 'sanji',   'name': '山治',   'instrument': '海蓝爵士鼓',   'tech': 'strike',  'accent': '#709cac'},
    {'id': 'chopper', 'name': '乔巴',   'instrument': '鹿角木琴',     'tech': 'strike',  'accent': '#d18a9e'},
    {'id': 'robin',   'name': '罗宾',   'instrument': '花瓣竖琴',     'tech': 'sustain', 'accent': '#9a7aa9'},
    {'id': 'usopp',   'name': '乌索普', 'instrument': '弹弓吉他',     'tech': 'pluck',   'accent': '#b58b62'},
    {'id': 'ace',     'name': '艾斯',   'instrument': '焰红萨克斯',   'tech': 'wind',    'accent': '#d77953'},
    {'id': 'law',     'name': '罗',     'instrument': '刻度电子键盘', 'tech': 'keys',    'accent': '#638f91'},
    {'id': 'shanks',  'name': '香克斯', 'instrument': '酒红大提琴',   'tech': 'sustain', 'accent': '#af6971'},
]

ARC_SLOTS = [
    [0.0, 0.35, 8.0],
    [-4.0, 0.35, 7.3589473],
    [4.0, 0.35, 7.3589473],
    [-8.0, 0.35, 5.1919968],
    [8.0, 0.35, 5.1919968],
    [-6.5, 1.07, 1.2794737],
    [-3.25, 1.07, 3.4853787],
    [0.0, 1.07, 4.1000000],
    [3.25, 1.07, 3.4853787],
    [6.5, 1.07, 1.2794737],
]

TERRACE_SLOTS = [
    [0.0, 0.35, 7.6],
    [-4.8, 0.35, 6.88],
    [4.8, 0.35, 6.88],
    [-4.8, 1.07, 3.082],
    [0.0, 1.07, 3.85],
    [4.8, 1.07, 3.082],
    [-4.275, 1.79, -1.1058323],
    [-1.425, 1.79, 0.6673462],
    [1.425, 1.79, 0.6673462],
    [4.275, 1.79, -1.1058323],
]

FOUNTAIN_SLOTS = [
    [-12.0, 0.44, 2.2911],
    [-8.8,  0.44, 5.9685],
    [-5.8,  0.44, 7.8221],
    [-2.7,  0.44, 8.8172],
    [2.7,   0.44, 8.8172],
    [5.8,   0.44, 7.8221],
    [8.8,   0.44, 5.9685],
    [12.0,  0.44, 2.2911],
]


def load_clean_stage_plates():
    """Builds or loads the 1920x1080 clean 3D stage plates for Cream Prism and Sunset Island."""
    c_path = Path('/tmp/perfect_stage_cream_v6.png')
    i_path = Path('/tmp/perfect_stage_island_v6.png')
    c_720 = cv2.imread(str(c_path), cv2.IMREAD_COLOR)
    i_720 = cv2.imread(str(i_path), cv2.IMREAD_COLOR)
    # Upscale to 1920x1080 with LANCZOS4 + subtle unsharp mask for crisp Retina edges
    c_1080 = cv2.resize(c_720, (W, H), interpolation=cv2.INTER_LANCZOS4)
    i_1080 = cv2.resize(i_720, (W, H), interpolation=cv2.INTER_LANCZOS4)
    for img in (c_1080, i_1080):
        blur = cv2.GaussianBlur(img, (0, 0), 1.4)
        cv2.addWeighted(img, 1.18, blur, -0.18, 0, dst=img)
    return c_1080, i_1080


def load_pet_sprites():
    """Loads all 10 One Piece 4-frame WebP sprites (each 1024x320 -> 4 frames of 256x320 BGRA)."""
    sprites = {}
    for role in ROSTER:
        p = ROOT / f"assets/band-pets/one-piece/{role['id']}.webp"
        im = Image.open(p).convert('RGBA')
        arr = np.array(im)
        # Convert RGBA to BGRA for fast OpenCV blending
        bgra = cv2.cvtColor(arr, cv2.COLOR_RGBA2BGRA)
        frames = [bgra[:, i * 256:(i + 1) * 256, :].copy() for i in range(4)]
        sprites[role['id']] = frames
    return sprites


def prebuild_wing_template(size=360):
    """Pre-renders the Tyrael-style multi-plume cyan/white energy wing template (BGRA float32)."""
    PLUMES = [
        [[.180, .395], [.38, .39], [.37, .66], [.44, .83], [.51, 1.00], [.65, 1.20], [.86, .75]],
        [[.180, .395], [.36, .41], [.42, .64], [.56, .73], [.70, .82],  [.73, .76],  [.81, .87]],
        [[.180, .395], [.39, .40], [.45, .57], [.61, .63], [.77, .69],  [.75, .50],  [.88, .57]],
        [[.180, .395], [.39, .36], [.45, .48], [.61, .50], [.77, .52],  [.77, .36],  [.90, .43]],
        [[.180, .395], [.37, .37], [.41, .41], [.55, .40], [.69, .39],  [.62, .26],  [.79, .29]],
        [[.180, .395], [.36, .35], [.40, .25], [.56, .28], [.72, .31],  [.71, .17],  [.86, .22]],
    ]
    def cubic(pts, t):
        q = 1.0 - t
        return [
            q**3 * pts[0][a] + 3 * q**2 * t * pts[1][a] + 3 * q * t**2 * pts[2][a] + t**3 * pts[3][a]
            for a in (0, 1)
        ]
    def plume_pt(pts, t):
        p = cubic(pts[:4], t * 2.0) if t < 0.5 else cubic(pts[3:], t * 2.0 - 1.0)
        p[0] = 0.18 + (p[0] - 0.18) * 0.68
        if p[1] > 0.395:
            p[1] = 0.395 + (p[1] - 0.395) * 0.53
        return p

    canvas = np.zeros((size, size, 3), dtype=np.float32)  # BGR additive
    cx = size // 2
    foot_y = int(size * 0.88)
    scale = size * 0.52

    for side in (-1, 1):
        for s_idx, plume in enumerate(PLUMES):
            pts = []
            for k in range(65):
                t = k / 64.0
                px, py = plume_pt(plume, t)
                sx = int(cx + side * px * scale)
                sy = int(foot_y - py * scale)
                pts.append((sx, sy, t))
            for k in range(len(pts) - 1):
                x0, y0, t0 = pts[k]
                x1, y1, _ = pts[k + 1]
                fade = (1.0 - t0) ** 0.75
                # Outer cyan glow
                cv2.line(canvas, (x0, y0), (x1, y1), (255 * fade * 0.45, 195 * fade * 0.45, 35 * fade * 0.45), int(max(2, 14 * (1 - t0 * 0.7))), lineType=cv2.LINE_AA)
                # Inner white-cyan core
                cv2.line(canvas, (x0, y0), (x1, y1), (255 * fade * 0.95, 250 * fade * 0.95, 215 * fade * 0.95), int(max(1, 5 * (1 - t0 * 0.7))), lineType=cv2.LINE_AA)

    canvas = cv2.GaussianBlur(canvas, (0, 0), 3.2)
    return np.clip(canvas, 0, 255)


def blend_bgra(dst, src_bgra, x_tl, y_tl, opacity=1.0, tint_bgr=None):
    """Alpha-blends src_bgra onto dst (HxWx3 uint8) at top-left (x_tl, y_tl)."""
    sh, sw = src_bgra.shape[:2]
    x0, y0 = max(0, x_tl), max(0, y_tl)
    x1, y1 = min(W, x_tl + sw), min(H, y_tl + sh)
    if x0 >= x1 or y0 >= y1:
        return
    sx0, sy0 = x0 - x_tl, y0 - y_tl
    sx1, sy1 = sx0 + (x1 - x0), sy0 + (y1 - y0)

    sub_src = src_bgra[sy0:sy1, sx0:sx1]
    alpha = (sub_src[:, :, 3:4].astype(np.float32) / 255.0) * opacity
    if np.max(alpha) < 0.005:
        return
    rgb = sub_src[:, :, :3].astype(np.float32)
    if tint_bgr is not None:
        rgb = rgb * np.array(tint_bgr, dtype=np.float32)[None, None, :]
    roi = dst[y0:y1, x0:x1].astype(np.float32)
    dst[y0:y1, x0:x1] = np.clip(roi * (1.0 - alpha) + rgb * alpha, 0, 255).astype(np.uint8)


def add_glow_patch(dst, src_bgr_float, x_tl, y_tl, power=1.0):
    """Additively blends a float32 BGR glow patch onto dst at (x_tl, y_tl)."""
    if power <= 0.005:
        return
    sh, sw = src_bgr_float.shape[:2]
    x0, y0 = max(0, x_tl), max(0, y_tl)
    x1, y1 = min(W, x_tl + sw), min(H, y_tl + sh)
    if x0 >= x1 or y0 >= y1:
        return
    sx0, sy0 = x0 - x_tl, y0 - y_tl
    sx1, sy1 = sx0 + (x1 - x0), sy0 + (y1 - y0)
    roi = dst[y0:y1, x0:x1].astype(np.float32)
    dst[y0:y1, x0:x1] = np.clip(roi + src_bgr_float[sy0:sy1, sx0:sx1] * power, 0, 255).astype(np.uint8)


class FountainPyroSystem:
    """Exact port of js/ui/band-fountains.js (8 stage fountains + 2 high-altitude spherical airbursts)."""
    def __init__(self):
        rng = np.random.default_rng(42)
        self.jets = []
        for i in range(8):
            n = 180
            speed = 27.5 + rng.random(n) * 5.7
            life = (speed + 12.4 / 2.8) / 12.4
            phase = rng.random(n) * life
            core = (np.arange(n) % 5) < 3
            theta = rng.random(n) * math.pi * 2.0
            spread = np.where(core, 0.045 + rng.random(n) * 0.10, 0.45 + rng.random(n) * 0.75)
            thresh = rng.random(n)
            rank = abs(i - 3.5) // 1
            self.jets.append({
                'slot': FOUNTAIN_SLOTS[i],
                'speed': speed, 'life': life, 'phase': phase,
                'theta': theta, 'spread': spread, 'thresh': thresh, 'rank': rank
            })

        self.airbursts = []
        for i in range(2):
            n = 340
            idx = np.arange(n)
            y = 1.0 - 2.0 * (idx + 0.5) / n
            phi = idx * math.pi * (3.0 - math.sqrt(5.0)) + i * 0.37
            ring = np.sqrt(np.maximum(0.0, 1.0 - y * y))
            inner = (idx % 5) == 0
            rad = np.where(inner, 1.6 + rng.random(n) * 0.6, 4.3 + rng.random(n) * 2.4)
            dx = np.cos(phi) * ring * rad
            dy = y * rad
            dz = np.sin(phi) * ring * rad
            delay = rng.random(n) * 0.035
            life = np.where(inner, 2.3, 4.25)
            willow = np.where(inner, 0.48, 0.78)
            pos_3d = [(-5.8 if i == 0 else 5.8), 10.3, -3.55]
            self.airbursts.append({
                'pos': pos_3d, 'dx': dx, 'dy': dy, 'dz': dz,
                'delay': delay, 'life': life, 'willow': willow
            })

    @staticmethod
    def cooling_bgr(life_frac):
        """White-hot -> Gold -> Copper -> Ember cooling curve in BGR (0..255)."""
        lf = np.clip(life_frac, 0.0, 1.0)
        r = np.interp(lf, [0.0, 0.18, 0.60, 0.85, 1.0], [255, 255, 255, 240, 45])
        g = np.interp(lf, [0.0, 0.18, 0.60, 0.85, 1.0], [255, 255, 224, 97,  6])
        b = np.interp(lf, [0.0, 0.18, 0.60, 0.85, 1.0], [255, 255, 107, 30,  2])
        return np.stack([b, g, r], axis=-1)

    def render(self, canvas, t):
        # Climax window: 17.5s to 22.8s
        if t < 17.5 or t > 23.0:
            return
        age_climax = t - 17.5
        dur = 4.2
        terminal = 12.4 / 2.8

        overlay = np.zeros_like(canvas, dtype=np.float32)

        # 1. Render 8 Stage Fountains
        for jet in self.jets:
            rank = jet['rank']
            if age_climax < rank * 0.09 or age_climax > dur + 1.8:
                continue
            env = smoothstep(rank * 0.09, rank * 0.09 + 0.18, age_climax) * (1.0 - smoothstep(dur, dur + 1.4, age_climax))
            if env <= 0.02:
                continue
            bx, by, bz = jet['slot']
            # Nozzle base warm glow
            npx, npy, _ = proj_3d_to_1080p(bx, by + 0.15, bz)
            cv2.circle(overlay, (int(npx), int(npy)), 18, (80 * env, 180 * env, 255 * env), -1, lineType=cv2.LINE_AA)

            p_age = np.mod(t - jet['phase'], jet['life'])
            drag = 1.0 - np.exp(-p_age * 2.8)
            py_local = (jet['speed'] + terminal) / 2.8 * drag - terminal * p_age
            crown = np.clip((p_age - 0.40) / 0.55, 0.0, 1.0) * (1.0 - np.exp(-np.maximum(0.0, p_age - 0.40) * 1.5))
            pr = 0.025 + jet['spread'] * (0.24 * drag + 1.35 * crown)
            px_3d = bx + np.cos(jet['theta']) * pr
            py_3d = by + py_local * 0.55  # scaled for crisp stage framing
            pz_3d = bz + np.sin(jet['theta']) * pr

            alive = (py_local > 0.02) & (p_age < jet['life']) & (jet['thresh'] <= env)
            if not np.any(alive):
                continue
            lf = p_age[alive] / jet['life'][alive]
            cols = self.cooling_bgr(lf) * ((1.0 - lf) ** 0.45)[:, None] * env

            # Previous position for velocity streak
            p_age0 = np.maximum(0.0, p_age[alive] - 0.032)
            drag0 = 1.0 - np.exp(-p_age0 * 2.8)
            py0_local = (jet['speed'][alive] + terminal) / 2.8 * drag0 - terminal * p_age0
            py0_3d = by + py0_local * 0.55

            for k, idx_a in enumerate(np.where(alive)[0]):
                sx1, sy1, _ = proj_3d_to_1080p(px_3d[idx_a], py_3d[idx_a], pz_3d[idx_a])
                sx0, sy0, _ = proj_3d_to_1080p(px_3d[idx_a], py0_3d[k], pz_3d[idx_a])
                c = tuple(float(v) for v in cols[k])
                cv2.line(overlay, (int(sx0), int(sy0)), (int(sx1), int(sy1)), c, 2, lineType=cv2.LINE_AA)
                cv2.circle(overlay, (int(sx1), int(sy1)), 2, c, -1, lineType=cv2.LINE_AA)

        # 2. Render High-Altitude Spherical Airbursts (bursts at 17.65s, 18.25s, 19.35s, 19.95s)
        burst_cues = [(0, 17.65), (1, 18.25), (0, 19.40), (1, 20.00)]
        for b_idx, b_start in burst_cues:
            burst = self.airbursts[b_idx]
            bx, by, bz = burst['pos']
            b_age = t - b_start
            # Rising comet trail (-0.35s to 0.05s)
            if -0.35 <= b_age <= 0.06:
                rise = clamp((b_age + 0.35) / 0.35, 0.0, 1.0)
                cy_3d = 2.7 + (by - 2.7) * (1.0 - (1.0 - rise) ** 1.45)
                cy0_3d = 2.7 + (by - 2.7) * (1.0 - (1.0 - max(0.0, rise - 0.14)) ** 1.45)
                sx1, sy1, _ = proj_3d_to_1080p(bx, cy_3d, bz)
                sx0, sy0, _ = proj_3d_to_1080p(bx, cy0_3d, bz)
                cv2.line(overlay, (int(sx0), int(sy0)), (int(sx1), int(sy1)), (180, 235, 255), 4, lineType=cv2.LINE_AA)
                cv2.circle(overlay, (int(sx1), int(sy1)), 7, (230, 250, 255), -1, lineType=cv2.LINE_AA)

            # Detonation core flash (0.0s to 0.16s)
            if 0.0 <= b_age <= 0.16:
                flash_p = 1.0 - b_age / 0.16
                sx, sy, _ = proj_3d_to_1080p(bx, by, bz)
                cv2.circle(overlay, (int(sx), int(sy)), int(18 + b_age * 240), (200 * flash_p, 240 * flash_p, 255 * flash_p), -1, lineType=cv2.LINE_AA)

            # Spherical expanding willow shell (0.0s to 3.4s)
            if 0.0 <= b_age <= 3.4:
                pa = b_age - burst['delay']
                alive = (pa > 0.0) & (pa < burst['life'])
                if np.any(alive):
                    pa_a = pa[alive]
                    spread = 1.0 - np.exp(-pa_a * 4.2)
                    wx = bx + burst['dx'][alive] * spread * 1.25
                    wy = by + burst['dy'][alive] * spread * 1.15 - burst['willow'][alive] * (pa_a ** 2) * 1.1
                    wz = bz + burst['dz'][alive] * spread * 1.25

                    pa0 = np.maximum(0.0, pa_a - 0.045)
                    spread0 = 1.0 - np.exp(-pa0 * 4.2)
                    wx0 = bx + burst['dx'][alive] * spread0 * 1.25
                    wy0 = by + burst['dy'][alive] * spread0 * 1.15 - burst['willow'][alive] * (pa0 ** 2) * 1.1
                    wz0 = bz + burst['dz'][alive] * spread0 * 1.25

                    lf = pa_a / burst['life'][alive]
                    fade = ((1.0 - lf) ** 0.65)
                    cols = self.cooling_bgr(lf) * fade[:, None]

                    for k in range(len(pa_a)):
                        if wy[k] < 0.2:
                            continue
                        sx1, sy1, _ = proj_3d_to_1080p(wx[k], wy[k], wz[k])
                        sx0, sy0, _ = proj_3d_to_1080p(wx0[k], wy0[k], wz0[k])
                        c = tuple(float(v) for v in cols[k])
                        cv2.line(overlay, (int(sx0), int(sy0)), (int(sx1), int(sy1)), c, 2, lineType=cv2.LINE_AA)
                        cv2.circle(overlay, (int(sx1), int(sy1)), 2, c, -1, lineType=cv2.LINE_AA)

        # Soft bloom on pyrotechnics + water reflection at bottom
        bloom = cv2.GaussianBlur(overlay, (0, 0), 6.0)
        total_pyro = overlay + bloom * 0.65
        canvas[:] = np.clip(canvas.astype(np.float32) + total_pyro, 0, 255).astype(np.uint8)


def load_pil_font(size, bold=False):
    candidates = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/System/Library/Fonts/Supplemental/Songti.ttc',
        '/System/Library/Fonts/HelveticaNeue.ttc',
    ]
    for c in candidates:
        if Path(c).exists():
            try:
                return ImageFont.truetype(c, size, index=1 if bold else 0)
            except Exception:
                return ImageFont.truetype(c, size)
    return ImageFont.load_default()


FONT_28_B = load_pil_font(28, bold=True)
FONT_22_B = load_pil_font(22, bold=True)
FONT_20_M = load_pil_font(20, bold=False)
FONT_16_M = load_pil_font(16, bold=False)
FONT_64_B = load_pil_font(64, bold=True)
FONT_26_M = load_pil_font(26, bold=False)


def draw_pil_pill(canvas_bgr, cx, cy, title_text, sub_text=None, border_rgb=(255, 210, 138), alpha=1.0):
    """Draws a crisp Retina dark-glass pill with Chinese typography at (cx, cy) on canvas_bgr."""
    if alpha <= 0.01:
        return
    w = 340 if sub_text else 250
    h = 68 if sub_text else 48
    x0 = int(clamp(cx - w // 2, 30, W - w - 30))
    y0 = int(clamp(cy - h // 2, 30, H - h - 30))

    pil_patch = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(pil_patch)
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=h // 2, fill=(12, 18, 26, int(218 * alpha)), outline=(*border_rgb, int(225 * alpha)), width=2)
    if sub_text:
        draw.text((w // 2, 22), title_text, font=FONT_20_M, fill=(255, 214, 145, int(255 * alpha)), anchor='mm')
        draw.text((w // 2, 47), sub_text, font=FONT_16_M, fill=(215, 230, 242, int(230 * alpha)), anchor='mm')
    else:
        draw.text((w // 2, h // 2), title_text, font=FONT_20_M, fill=(245, 236, 222, int(255 * alpha)), anchor='mm')

    bgra = cv2.cvtColor(np.array(pil_patch), cv2.COLOR_RGBA2BGRA)
    blend_bgra(canvas_bgr, bgra, x0, y0, opacity=1.0)


def draw_play_capsule(canvas_bgr, cx, cy, alpha=1.0, scale=1.0):
    if alpha <= 0.01:
        return
    w, h = int(230 * scale), int(72 * scale)
    x0, y0 = int(cx - w // 2), int(cy - h // 2)
    pil_patch = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(pil_patch)
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=h // 2, fill=(16, 26, 36, int(195 * alpha)), outline=(255, 210, 138, int(225 * alpha)), width=2)
    # Play triangle
    tx = int(w * 0.25)
    ty = h // 2
    r = int(12 * scale)
    draw.polygon([(tx - r // 2, ty - r), (tx + r, ty), (tx - r // 2, ty + r)], fill=(255, 210, 138, int(255 * alpha)))
    draw.text((int(w * 0.60), h // 2), '唤醒剧场', font=FONT_22_B, fill=(245, 236, 222, int(255 * alpha)), anchor='mm')
    bgra = cv2.cvtColor(np.array(pil_patch), cv2.COLOR_RGBA2BGRA)
    blend_bgra(canvas_bgr, bgra, x0, y0, opacity=1.0)


def draw_cursor(canvas_bgr, x, y, scale=1.0, active=False, alpha=1.0):
    if alpha <= 0.01:
        return
    r_inner = int((15 if active else 13) * scale)
    r_outer = int((25 if active else 20) * scale)
    pad = r_outer + 8
    sz = pad * 2
    pil_patch = Image.new('RGBA', (sz, sz), (0, 0, 0, 0))
    draw = ImageDraw.Draw(pil_patch)
    c_in = (255, 210, 138, int(245 * alpha)) if active else (255, 255, 255, int(238 * alpha))
    c_out = (255, 230, 175, int(205 * alpha)) if active else (255, 255, 255, int(145 * alpha))
    draw.ellipse((pad - r_outer, pad - r_outer, pad + r_outer, pad + r_outer), outline=c_out, width=3)
    draw.ellipse((pad - r_inner, pad - r_inner, pad + r_inner, pad + r_inner), fill=c_in)
    bgra = cv2.cvtColor(np.array(pil_patch), cv2.COLOR_RGBA2BGRA)
    blend_bgra(canvas_bgr, bgra, int(x - pad), int(y - pad), opacity=1.0)


def draw_sandbox_workstation_bezel(canvas_bgr, reveal_progress, t):
    """Draws the Teenage Engineering / Apple desktop sandbox aluminum chassis, champagne-gold bezel, 64 telemetry ticks & floating crystal cube when camera pulls back in Act 4."""
    if reveal_progress <= 0.01:
        return
    # As reveal_progress goes 0 -> 1, the entire stage scales down slightly inside the desktop workstation frame
    # We draw the precision champagne-gold telemetry tick ring around the lagoon and corner hardware indicators
    overlay = canvas_bgr.copy()
    cx, cy = W // 2, int(H * 0.56)
    rx, ry = int(830 * (1.0 - 0.14 * reveal_progress)), int(345 * (1.0 - 0.14 * reveal_progress))

    # 64 precision Teenage Engineering style ticks around the outer lagoon perimeter
    for i in range(64):
        ang = (i / 64.0) * math.pi * 2.0
        if math.sin(ang) < -0.15:
            continue  # behind stage backdrop
        is_major = (i % 4 == 0)
        r_in = 1.03
        r_out = 1.075 if is_major else 1.052
        x0 = int(cx + math.cos(ang) * rx * r_in)
        y0 = int(cy + math.sin(ang) * ry * r_in)
        x1 = int(cx + math.cos(ang) * rx * r_out)
        y1 = int(cy + math.sin(ang) * ry * r_out)
        col = (138, 210, 255) if is_major else (120, 175, 215)
        cv2.line(overlay, (x0, y0), (x1, y1), col, 2 if is_major else 1, lineType=cv2.LINE_AA)

    # Outer champagne-gold bezel arc
    pts_arc = []
    for i in range(121):
        ang = -0.12 * math.pi + (i / 120.0) * (1.24 * math.pi)
        pts_arc.append([int(cx + math.cos(ang) * rx * 1.02), int(cy + math.sin(ang) * ry * 1.02)])
    cv2.polylines(overlay, [np.array(pts_arc, dtype=np.int32)], False, (114, 173, 216), 3, lineType=cv2.LINE_AA)

    cv2.addWeighted(overlay, reveal_progress * 0.78, canvas_bgr, 1.0 - reveal_progress * 0.78, 0, dst=canvas_bgr)

    # Top-left & Top-right Teenage Engineering / Apple hardware telemetry badges
    draw_pil_pill(canvas_bgr, 240, 64, '『律』LÜ · 桌面音乐沙盘', 'DESKTOP ACOUSTIC SANDBOX', (216, 173, 114), alpha=reveal_progress * 0.92)
    draw_pil_pill(canvas_bgr, W - 240, 64, '120.0 BPM · 48kHz STEREO', 'PANORAMIC SPATIAL ENGINE', (216, 173, 114), alpha=reveal_progress * 0.92)


def draw_brand_lockup(canvas_bgr, emblem_bgra, alpha, t):
    if alpha <= 0.01:
        return
    # Subtle cinematic vignette & upper-middle glassmorphic brand lockup card
    overlay = canvas_bgr.copy()
    cv2.rectangle(overlay, (0, 0), (W, H), (10, 14, 20), -1)
    cv2.addWeighted(overlay, alpha * 0.32, canvas_bgr, 1.0 - alpha * 0.32, 0, dst=canvas_bgr)

    card_w, card_h = 760, 250
    cx, cy = W // 2, int(H * 0.24)
    x0, y0 = cx - card_w // 2, cy - card_h // 2

    pil_card = Image.new('RGBA', (card_w, card_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(pil_card)
    draw.rounded_rectangle((2, 2, card_w - 3, card_h - 3), radius=32, fill=(10, 16, 24, int(212 * alpha)), outline=(255, 210, 138, int(210 * alpha)), width=2)

    # Title & Subtitle
    draw.text((card_w // 2 + 44, 92), '『 律 』 ·  乐队模式', font=FONT_64_B, fill=(248, 240, 225, int(255 * alpha)), anchor='mm')
    draw.text((card_w // 2 + 44, 172), '把一整座海上音乐节，装进你的桌面沙盘', font=FONT_26_M, fill=(255, 212, 142, int(240 * alpha)), anchor='mm')

    card_bgra = cv2.cvtColor(np.array(pil_card), cv2.COLOR_RGBA2BGRA)
    blend_bgra(canvas_bgr, card_bgra, x0, y0, opacity=1.0)

    # Draw emblem icon on the left side of the lockup card
    if emblem_bgra is not None:
        eh, ew = 108, 108
        em_resized = cv2.resize(emblem_bgra, (ew, eh), interpolation=cv2.INTER_AREA)
        blend_bgra(canvas_bgr, em_resized, x0 + 54, cy - eh // 2 - 6, opacity=alpha)


class FilmDirector:
    def __init__(self):
        self.cream_plate, self.island_plate = load_clean_stage_plates()
        self.sprites = load_pet_sprites()
        self.wing_template = prebuild_wing_template(360)
        self.pyro = FountainPyroSystem()

        emblem_path = ROOT / 'assets/lu-core-emblem.png'
        if emblem_path.exists():
            em_rgba = np.array(Image.open(emblem_path).convert('RGBA'))
            self.emblem_bgra = cv2.cvtColor(em_rgba, cv2.COLOR_RGBA2BGRA)
        else:
            self.emblem_bgra = None

    def render_stage_state(self, t, look='cream'):
        """Renders the complete 1920x1080 3D stage at song clock `t` (before camera zoom/pan crop)."""
        canvas = (self.island_plate if look == 'island' else self.cream_plate).copy()
        is_island = (look == 'island')

        # Beat pulse (120 BPM -> 0.50s per beat)
        beat_prog = (t % 0.5) / 0.5
        beat_idx = int(t // 0.5)
        beat_pulse = math.exp(-beat_prog * 7.5) if t >= 0.5 else 0.0
        downbeat = beat_pulse if (beat_idx % 4 == 0) else 0.0

        # Formation morph: 'arc' (0..14s) -> 'terrace' (14.0..16.2s)
        form_mix = smoothstep(14.0, 16.2, t)

        # Solo / Mute / Drag states
        sanji_mute = smoothstep(6.0, 6.22, t) * (1.0 - smoothstep(12.2, 12.6, t)) if t >= 6.0 else 0.0
        zoro_solo = smoothstep(7.4, 7.72, t) * (1.0 - smoothstep(9.18, 9.5, t)) if (7.4 <= t < 9.5) else 0.0

        # Climax wings state (17.5s - 22.5s)
        wing_power = 0.0
        if 17.5 <= t <= 22.5:
            ca = t - 17.5
            wing_power = smoothstep(0.0, 0.38, ca) * (1.0 - smoothstep(3.8, 4.8, ca))

        # Global stage bed dimming during Zoro solo
        if zoro_solo > 0.01:
            dim = 1.0 - zoro_solo * 0.42
            canvas = (canvas.astype(np.float32) * dim).astype(np.uint8)

        # Compute 3D positions & depth-sort all 10 band members (back-to-front by Z)
        member_states = []
        for i, role in enumerate(ROSTER):
            short_id = role['id']
            a_pos = ARC_SLOTS[i]
            t_pos = TERRACE_SLOTS[i]
            gx = lerp(a_pos[0], t_pos[0], form_mix)
            gz = lerp(a_pos[2], t_pos[2], form_mix)

            lift = 0.0
            tilt_deg = 0.0
            landing_pulse = 0.0

            # Luffy spatial drag choreography in Act 2
            if short_id == 'luffy':
                if 7.5 <= t < 9.5:
                    tp = smoothstep(7.5, 9.4, t)
                    gx = lerp(0.0, -4.5, tp)
                    gz = lerp(8.0, 1.2, tp)
                elif 9.5 <= t < 12.0:
                    td = smoothstep(9.5, 12.0, t)
                    gx = lerp(-4.5, 4.5, td)
                    gz = lerp(1.2, 6.4, td)
                    lift = smoothstep(9.5, 9.75, t) * 0.32
                    tilt_deg = -10.5 * math.sin(td * math.pi)
                elif 12.0 <= t < 14.0:
                    tm = smoothstep(13.2, 14.0, t)
                    gx = lerp(4.5, a_pos[0], tm)
                    gz = lerp(6.4, a_pos[2], tm)
                    land_age = t - 12.0
                    if land_age < 1.25:
                        landing_pulse = math.exp(-land_age * 6.5) * math.cos(land_age * 24.0)

            gy = stage_height_at(gx, gz) + 0.045
            mute = sanji_mute if short_id == 'sanji' else 0.0
            is_solo = (short_id == 'zoro' and zoro_solo > 0.01)

            # Activity envelope
            if t < 0.5:
                activity = 0.0
            elif t < 6.0:
                wake_delay = 0.5 + (i % 5) * 0.18
                activity = clamp((t - wake_delay) * 2.5, 0.0, 1.0) * (0.72 + 0.22 * math.sin(t * 4.5 + i))
            elif 17.5 <= t < 22.5:
                activity = 0.96
            else:
                activity = 0.78 + 0.18 * math.sin(t * 3.8 + i * 0.9)
            if mute > 0.5:
                activity = 0.0

            px, py, cz = proj_3d_to_1080p(gx, gy + lift + landing_pulse * 0.08 - mute * 0.12, gz)
            _, py_top, _ = proj_3d_to_1080p(gx, gy + lift + 3.355 * (1.0 + (zoro_solo * 0.08 if is_solo else 0.0)), gz)
            foot_px, foot_py, _ = proj_3d_to_1080p(gx, gy, gz)

            member_states.append({
                'index': i, 'role': role, 'id': short_id,
                'gx': gx, 'gy': gy, 'gz': gz, 'cz': cz,
                'px': px, 'py': py, 'py_top': py_top,
                'foot_px': foot_px, 'foot_py': foot_py,
                'lift': lift, 'tilt_deg': tilt_deg, 'landing_pulse': landing_pulse,
                'mute': mute, 'activity': activity, 'is_solo': is_solo
            })

        # Sort back-to-front (smaller Z is further back)
        member_states.sort(key=lambda m: m['gz'])

        # Draw each member (shadow, acoustic ring, reflection, energy wings, animated sprite)
        for m in member_states:
            fx, fy = int(m['foot_px']), int(m['foot_py'])
            char_h = max(48, int(abs(m['py'] - m['py_top']) * (1.0 - 0.04 * m['landing_pulse'])))
            char_w = int(char_h * 0.80 * (1.0 + 0.04 * m['landing_pulse']))
            accent_bgr = hex_to_bgr(m['role']['accent'])

            # 1. Ground shadow & acoustic foot ring
            ring_rx = int(char_w * 0.54 * (1.0 + 0.08 * beat_pulse + (0.22 if m['is_solo'] else 0.0)))
            ring_ry = int(ring_rx * 0.34)
            ring_overlay = canvas.copy()
            cv2.ellipse(ring_overlay, (fx, fy + 4), (int(ring_rx * 0.95), int(ring_ry * 0.95)), 0, 0, 360, (12, 18, 28), -1, lineType=cv2.LINE_AA)
            cv2.addWeighted(ring_overlay, 0.38 * (1.0 - m['mute'] * 0.5), canvas, 1.0 - 0.38 * (1.0 - m['mute'] * 0.5), 0, dst=canvas)

            ring_col = (140, 148, 155) if m['mute'] > 0.5 else accent_bgr
            ring_alpha = 0.85 if m['is_solo'] else (0.22 if m['mute'] > 0.5 else 0.42 + 0.18 * beat_pulse)
            ring_layer = canvas.copy()
            cv2.ellipse(ring_layer, (fx, fy + 2), (ring_rx, ring_ry), 0, 0, 360, ring_col, 3 if m['is_solo'] else 2, lineType=cv2.LINE_AA)
            if m['activity'] > 0.2 and m['mute'] < 0.5:
                phase_r = (t * 1.6) % 1.0
                r2_x = int(ring_rx * (0.75 + 0.45 * phase_r))
                r2_y = int(ring_ry * (0.75 + 0.45 * phase_r))
                cv2.ellipse(ring_layer, (fx, fy + 2), (r2_x, r2_y), 0, 0, 360, ring_col, 1, lineType=cv2.LINE_AA)
            cv2.addWeighted(ring_layer, ring_alpha, canvas, 1.0 - ring_alpha, 0, dst=canvas)

            # 2. Landing shockwave concentric rings (at t = 12.0s for Luffy)
            if m['id'] == 'luffy' and 12.0 <= t <= 13.1:
                la = t - 12.0
                for r_idx in range(4):
                    ra = la - r_idx * 0.09
                    if 0.0 < ra < 0.85:
                        rp = (1.0 - ra / 0.85) ** 1.4
                        srx = int(ring_rx * (1.0 + ra * 3.2))
                        sry = int(ring_ry * (1.0 + ra * 3.2))
                        shock_layer = canvas.copy()
                        cv2.ellipse(shock_layer, (fx, fy + 2), (srx, sry), 0, 0, 360, (138, 214, 255), 3, lineType=cv2.LINE_AA)
                        cv2.addWeighted(shock_layer, rp * 0.75, canvas, 1.0 - rp * 0.75, 0, dst=canvas)

            # 3. Select 4-frame sprite animation frame
            if m['mute'] > 0.5 or m['activity'] < 0.12:
                frame_idx = 0
            elif beat_pulse > 0.62 and (m['index'] % 2 == beat_idx % 2):
                frame_idx = 3
            else:
                phase = int(t * (120.0 / 60.0) * 2.8 + m['index'] * 0.45)
                frame_idx = 1 if (phase % 2 == 0) else 2

            sprite_bgra = self.sprites[m['id']][frame_idx]

            # Secondary rhythm bob & sway
            bob_y = int(math.sin(t * math.pi * 4.0 + m['index']) * 4.5 * m['activity'])
            sway_deg = math.sin(t * math.pi * 2.0 + m['index'] * 0.7) * 2.2 * m['activity'] + m['tilt_deg']

            # Resize sprite
            sp_resized = cv2.resize(sprite_bgra, (char_w, char_h), interpolation=cv2.INTER_AREA)
            if abs(sway_deg) > 0.3:
                M_rot = cv2.getRotationMatrix2D((char_w / 2.0, char_h * 0.85), sway_deg, 1.0)
                sp_resized = cv2.warpAffine(sp_resized, M_rot, (char_w, char_h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

            # 4. Subtle floor reflection beneath feet
            refl_h = max(12, int(char_h * 0.28))
            refl_img = cv2.resize(cv2.flip(sp_resized, 0), (char_w, refl_h), interpolation=cv2.INTER_AREA)
            # Fade reflection vertically
            v_fade = np.linspace(0.22, 0.0, refl_h, dtype=np.float32)[:, None]
            refl_img[:, :, 3] = (refl_img[:, :, 3].astype(np.float32) * v_fade).astype(np.uint8)
            blend_bgra(canvas, refl_img, int(m['px'] - char_w // 2), int(m['py'] - 6), opacity=1.0 - m['mute'] * 0.7)

            # 5. Climax Energy Wings behind front-line members (Luffy, Zoro, Nami, Ace, Shanks)
            if wing_power > 0.01 and m['id'] in ('luffy', 'zoro', 'nami', 'ace', 'shanks') and m['mute'] < 0.5:
                w_sz = int(char_h * 1.85)
                w_patch = cv2.resize(self.wing_template, (w_sz, w_sz), interpolation=cv2.INTER_LINEAR)
                add_glow_patch(canvas, w_patch, int(m['px'] - w_sz // 2), int(m['py'] + bob_y - int(w_sz * 0.82)), power=wing_power * (1.15 if m['id'] == 'luffy' else 0.78))

            # 6. Main character sprite
            tint = None
            opacity = 1.0
            if m['mute'] > 0.05:
                opacity = lerp(1.0, 0.45, m['mute'])
                tint = (0.68, 0.65, 0.62)
            elif zoro_solo > 0.05 and not m['is_solo']:
                opacity = lerp(1.0, 0.75, zoro_solo)
                tint = (0.72, 0.68, 0.65)

            blend_bgra(canvas, sp_resized, int(m['px'] - char_w // 2), int(m['py'] + bob_y - int(char_h * 0.94)), opacity=opacity, tint_bgr=tint)

            # 7. Volumetric 95-lux spotlight beam during Zoro Solo (7.4s - 9.5s)
            if m['is_solo'] and zoro_solo > 0.02:
                spot_layer = np.zeros_like(canvas, dtype=np.float32)
                top_x, top_y = int(m['px'] - 45), 0
                bot_x, bot_y = int(m['px']), int(m['py'] + 12)
                beam_poly = np.array([
                    [top_x - 24, top_y], [top_x + 24, top_y],
                    [bot_x + int(char_w * 0.68), bot_y], [bot_x - int(char_w * 0.68), bot_y]
                ], dtype=np.int32)
                cv2.fillPoly(spot_layer, [beam_poly], (155, 220, 255), lineType=cv2.LINE_AA)
                spot_layer = cv2.GaussianBlur(spot_layer, (0, 0), 22.0)
                canvas[:] = np.clip(canvas.astype(np.float32) + spot_layer * (0.42 * zoro_solo), 0, 255).astype(np.uint8)

        # 8. Render Climax Stage Fountains & Sky Airburst Fireworks (17.5s - 23.0s)
        self.pyro.render(canvas, t)

        # Build lookup of projected screen positions for 2D tactile cursor & HUD overlays
        proj_map = {m['id']: m for m in member_states}
        return canvas, proj_map

    def apply_camera_crop(self, canvas, proj_map, t):
        """Applies smooth cinematic camera zoom & pan in 1080p space and transforms member screen coords."""
        # Define camera crop window (cx, cy, zoom) across the 4 acts
        if t < 0.5:
            # Act 1 Hook (0.0 - 0.5s): Close-up on right jade steps, Chopper (Marimba) & Ace (Saxophone)
            p = smoothstep(0.0, 0.5, t)
            cx = lerp(1180.0, 1120.0, p)
            cy = lerp(650.0, 635.0, p)
            zoom = lerp(1.52, 1.45, p)
        elif t < 6.0:
            # Act 1 Dolly Out (0.5 - 6.0s): Sweeping across ensemble to establish full amphitheatre
            p = smoothstep(0.5, 5.8, t)
            cx = lerp(1120.0, 960.0, p)
            cy = lerp(635.0, 540.0, p)
            zoom = lerp(1.45, 1.04, p)
        elif t < 7.4:
            # Act 2.1 (6.0 - 7.4s): Focus on Left Wing (Sanji Drums & Zoro Bass)
            p = smoothstep(6.0, 6.7, t)
            cx = lerp(960.0, 740.0, p)
            cy = lerp(540.0, 590.0, p)
            zoom = lerp(1.04, 1.24, p)
        elif t < 9.5:
            # Act 2.2 (7.4 - 9.5s): Lock-on Solo push into Zoro (Bass)
            p = smoothstep(7.4, 8.1, t)
            cx = lerp(740.0, 765.0, p)
            cy = lerp(590.0, 615.0, p)
            zoom = lerp(1.24, 1.36, p)
        elif t < 14.0:
            # Act 2.3 (9.5 - 14.0s): Pull back to interactive sandbox view as Luffy is dragged across stage
            p = smoothstep(9.5, 11.0, t)
            cx = lerp(765.0, 960.0, p)
            cy = lerp(615.0, 545.0, p)
            zoom = lerp(1.36, 1.03, p)
        elif t < 17.5:
            # Act 3.1 (14.0 - 17.5s): Snare roll buildup & formation morph
            p = smoothstep(14.0, 17.5, t)
            cx = lerp(960.0, 935.0, p)
            cy = lerp(545.0, 535.0, p)
            zoom = lerp(1.03, 1.00, p)
        elif t < 23.0:
            # Act 3.2 (17.5 - 23.0s): Grand Climax wide panorama glide
            p = smoothstep(17.5, 23.0, t)
            cx = lerp(935.0, 985.0, p)
            cy = lerp(535.0, 540.0, p)
            zoom = 1.00
        else:
            # Act 4 (23.0 - 30.0s): Desktop Sandbox Pull-back Reveal
            p = smoothstep(23.0, 26.8, t)
            cx = lerp(985.0, 960.0, p)
            cy = lerp(540.0, 540.0, p)
            zoom = lerp(1.00, 0.90, p)

        if abs(zoom - 1.0) < 0.003 and abs(cx - 960.0) < 1.0 and abs(cy - 540.0) < 1.0:
            return canvas, proj_map

        if zoom >= 1.0:
            vw = W / zoom
            vh = H / zoom
            x0 = clamp(cx - vw / 2.0, 0.0, W - vw)
            y0 = clamp(cy - vh / 2.0, 0.0, H - vh)
            M = np.array([
                [zoom, 0.0, -x0 * zoom],
                [0.0, zoom, -y0 * zoom]
            ], dtype=np.float32)
            out = cv2.warpAffine(canvas, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            new_map = {}
            for k, m in proj_map.items():
                nm = dict(m)
                nm['screen_x'] = (m['px'] - x0) * zoom
                nm['screen_y'] = (m['py'] - abs(m['py'] - m['py_top']) * 0.48 - y0) * zoom
                nm['foot_sx'] = (m['foot_px'] - x0) * zoom
                nm['foot_sy'] = (m['foot_py'] - y0) * zoom
                new_map[k] = nm
            return out, new_map
        else:
            # Pull-back reveal (zoom < 1.0): frame the stage inside the dark anodized aluminum desktop chassis!
            bg = np.full((H, W, 3), (24, 18, 12), dtype=np.uint8)
            # Subtle radial studio glow on desktop surface
            M = np.array([
                [zoom, 0.0, (W - W * zoom) * 0.5],
                [0.0, zoom, (H - H * zoom) * 0.58]
            ], dtype=np.float32)
            out = cv2.warpAffine(canvas, M, (W, H), dst=bg, flags=cv2.INTER_AREA, borderMode=cv2.BORDER_TRANSPARENT)
            new_map = {}
            for k, m in proj_map.items():
                nm = dict(m)
                nm['screen_x'] = m['px'] * zoom + (W - W * zoom) * 0.5
                nm['screen_y'] = (m['py'] - abs(m['py'] - m['py_top']) * 0.48) * zoom + (H - H * zoom) * 0.58
                new_map[k] = nm
            return out, new_map

    def render_frame(self, frame_idx):
        t = frame_idx / FPS

        # 550ms Dual-Stage Metamorphosis Crossfade (14.00s - 14.55s)
        if 14.0 <= t <= 14.55:
            mix = cubic_ease_out((t - 14.0) / 0.55)
            c_stage, _ = self.render_stage_state(t, 'cream')
            i_stage, proj_map = self.render_stage_state(t, 'island')
            stage = cv2.addWeighted(i_stage, mix, c_stage, 1.0 - mix, 0)
            # Subtle golden horizon sweep flash at midpoint
            flash_a = math.sin(mix * math.pi) * 0.18
            if flash_a > 0.01:
                gold = np.full_like(stage, (138, 210, 255), dtype=np.uint8)
                cv2.addWeighted(stage, 1.0 - flash_a, gold, flash_a, 0, dst=stage)
        else:
            look = 'island' if t >= 14.0 else 'cream'
            stage, proj_map = self.render_stage_state(t, look)

        # Populate default screen_x / screen_y before camera crop
        for k, m in proj_map.items():
            m['screen_x'] = m['px']
            m['screen_y'] = m['py'] - abs(m['py'] - m['py_top']) * 0.48
            m['foot_sx'] = m['foot_px']
            m['foot_sy'] = m['foot_py']

        frame, proj_map = self.apply_camera_crop(stage, proj_map, t)

        # --- 2D Retina Tactile & HUD Overlays ---
        # Act 1: Play Capsule & Finger Awakening (0.0 - 1.25s)
        if t < 1.25:
            cap_x, cap_y = 960, 580
            if t < 0.85:
                cap_a = 1.0 - smoothstep(0.50, 0.82, t)
                cap_s = 1.0 if t < 0.5 else 1.0 + smoothstep(0.5, 0.8, t) * 0.18
                draw_play_capsule(frame, cap_x, cap_y, alpha=cap_a, scale=cap_s)
            tc = smoothstep(0.05, 0.50, t)
            fade_c = 1.0 - smoothstep(0.85, 1.20, t)
            cur_x = lerp(780.0, cap_x, tc)
            cur_y = lerp(860.0, cap_y, tc)
            c_scale = 0.80 if (0.46 <= t <= 0.62) else 1.0
            draw_cursor(frame, cur_x, cur_y, scale=c_scale, active=(0.48 <= t <= 0.65), alpha=fade_c)
            if t >= 0.50:
                rp = (t - 0.50) / 0.68
                if rp < 1.0:
                    inv = 1.0 - rp
                    rip = frame.copy()
                    cv2.circle(rip, (cap_x, cap_y), int(30 + rp * 115), (138, 210, 255), max(1, int(3 * inv)), lineType=cv2.LINE_AA)
                    cv2.addWeighted(rip, inv * 0.85, frame, 1.0 - inv * 0.85, 0, dst=frame)

        # Act 2.1: Tap Sanji (Drums) to Rest (5.6 - 7.35s)
        if 5.6 <= t < 7.4 and 'sanji' in proj_map:
            sanji = proj_map['sanji']
            sx, sy = sanji['screen_x'], sanji['screen_y']
            tt = smoothstep(5.6, 6.0, t)
            cur_x = lerp(960.0, sx, tt)
            cur_y = lerp(560.0, sy, tt)
            press = 0.78 if (5.95 <= t <= 6.18) else 1.0
            draw_cursor(frame, cur_x, cur_y, scale=press, active=(5.95 <= t <= 6.20))
            if t >= 6.0:
                rp = (t - 6.0) / 0.55
                if rp < 1.0:
                    inv = 1.0 - rp
                    rip = frame.copy()
                    cv2.circle(rip, (int(sx), int(sy)), int(18 + rp * 85), (205, 185, 145), max(1, int(3 * inv)), lineType=cv2.LINE_AA)
                    cv2.addWeighted(rip, inv * 0.85, frame, 1.0 - inv * 0.85, 0, dst=frame)
                ba = smoothstep(6.0, 6.2, t) * (1.0 - smoothstep(7.0, 7.35, t))
                draw_pil_pill(frame, sx, sy - 115, '山治 · 休止 4小节', None, (130, 175, 195), alpha=ba)

        # Act 2.2: Long-Press Zoro (Bass) for 95 lux Solo (7.35 - 9.5s)
        if 7.35 <= t < 9.5 and 'zoro' in proj_map:
            zoro = proj_map['zoro']
            sanji = proj_map.get('sanji', zoro)
            zx, zy = zoro['screen_x'], zoro['screen_y']
            tm = smoothstep(7.35, 7.65, t)
            cur_x = lerp(sanji['screen_x'], zx, tm)
            cur_y = lerp(sanji['screen_y'], zy, tm)
            holding = (7.65 <= t <= 9.35)
            draw_cursor(frame, cur_x, cur_y, scale=0.82 if holding else 1.0, active=holding)
            if t >= 7.55:
                sp = smoothstep(7.55, 7.85, t) * (1.0 - smoothstep(9.2, 9.5, t))
                draw_pil_pill(frame, zx, zy - 125, '索隆 · 三弦脊贝斯', '独奏锁定 · 95 lux 聚光', (255, 210, 138), alpha=sp)

        # Act 2.3: Drag Luffy Across Stage + Spatial Panning HUD (9.5 - 13.2s)
        if 9.5 <= t < 13.2 and 'luffy' in proj_map:
            luffy = proj_map['luffy']
            lx, ly = luffy['screen_x'], luffy['screen_y']
            if t < 12.0:
                td = smoothstep(9.5, 12.0, t)
                draw_cursor(frame, lx, ly + 12, scale=0.80, active=True)
                pan_val = -0.85 + 1.70 * td
                pan_str = f"{pan_val:+.2f}"
                eq_str = 'LPF 3.2kHz · 远场深处' if td < 0.35 else ('Hi-Shelf +3.5dB · 近场通透' if td > 0.65 else '过渡均衡 · 舞台中轴')
                draw_pil_pill(frame, lx, ly - 130, f'空间声相 Pan {pan_str} · 抬升 +0.24', eq_str, (255, 210, 138), alpha=1.0)
            else:
                la = t - 12.0
                fc = 1.0 - smoothstep(0.0, 0.45, la)
                draw_cursor(frame, lx, ly, scale=1.05, active=False, alpha=fc)
                if la < 1.0:
                    ha = 1.0 - smoothstep(0.5, 1.0, la)
                    draw_pil_pill(frame, lx, ly - 130, '空间声相 Pan +0.85 · 弹簧落地', 'Hi-Shelf +3.5dB · 近场通透', (255, 210, 138), alpha=ha)

        # Act 4: Desktop Sandbox Workstation Bezel (23.0 - 30.0s) & Brand Lockup (26.5 - 30.0s)
        if t >= 23.0:
            rev_p = smoothstep(23.0, 26.5, t)
            draw_sandbox_workstation_bezel(frame, rev_p, t)
        if t >= 26.5:
            brand_a = smoothstep(26.5, 27.4, t)
            draw_brand_lockup(frame, self.emblem_bgra, brand_a, t)

        return frame


def measure_final_video(mp4_path):
    probe_cmd = [
        'ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames,duration:format=duration',
        '-of', 'json', str(mp4_path)
    ]
    res = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
    probe_data = json.loads(res.stdout)
    stream = probe_data['streams'][0]
    fmt = probe_data['format']

    ebur_cmd = [
        'ffmpeg', '-nostats', '-i', str(mp4_path),
        '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'
    ]
    ebur_res = subprocess.run(ebur_cmd, capture_output=True, text=True)
    lufs, true_peak = None, None
    lines = ebur_res.stderr.splitlines()
    for i, line in enumerate(lines):
        if 'Integrated loudness:' in line and i + 1 < len(lines):
            lufs = float(lines[i + 1].split('I:')[1].replace('LUFS', '').strip())
        if 'True peak:' in line and i + 1 < len(lines):
            true_peak = float(lines[i + 1].split('Peak:')[1].replace('dBFS', '').replace('dBTP', '').strip())

    return {
        'path': str(mp4_path),
        'width': int(stream['width']),
        'height': int(stream['height']),
        'frames': int(stream['nb_read_frames']),
        'duration': float(fmt['duration']),
        'lufs': lufs,
        'true_peak': true_peak,
    }


def main():
    print("============================================================")
    print("[*] Starting Pure-Local 1080p@30fps Master Render: 『 律 』 Band Mode")
    print(f"    Resolution: {W}x{H} @ {FPS} fps ({TOTAL_FRAMES} frames = 30.000s)")
    print(f"    Output:     {TARGET_MP4}")
    print("============================================================")

    if not AUDIO_PATH.exists():
        subprocess.run(['/opt/homebrew/bin/python3.14', str(ROOT / 'film/save_final_audio.py')], check=True)

    KEYFRAMES_DIR.mkdir(parents=True, exist_ok=True)
    director = FilmDirector()

    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-f', 'rawvideo',
        '-vcodec', 'rawvideo',
        '-pix_fmt', 'bgr24',
        '-s', f'{W}x{H}',
        '-r', str(FPS),
        '-i', '-',
        '-i', str(AUDIO_PATH),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '16',
        '-c:a', 'copy',
        '-frames:v', str(TOTAL_FRAMES),
        str(TARGET_MP4)
    ]

    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    t0 = time.time()

    audit_times = {0.2, 0.6, 3.0, 6.2, 8.2, 10.8, 12.2, 14.3, 18.0, 19.5, 25.0, 28.5}
    audit_frames = {int(round(ts * FPS)): ts for ts in audit_times}

    for f in range(TOTAL_FRAMES):
        frame_bgr = director.render_frame(f)
        proc.stdin.write(frame_bgr.tobytes())

        if f in audit_frames:
            ts = audit_frames[f]
            cv2.imwrite(str(KEYFRAMES_DIR / f'frame_{f:04d}_{ts:04.1f}s.png'), frame_bgr)

        if (f + 1) % 90 == 0 or f == TOTAL_FRAMES - 1:
            el = time.time() - t0
            fps_cur = (f + 1) / max(1e-3, el)
            eta = (TOTAL_FRAMES - (f + 1)) / max(1e-3, fps_cur)
            print(f" -> Frame {f+1:3d}/{TOTAL_FRAMES} ({(f+1)/FPS:5.2f}s) | {fps_cur:5.1f} fps | ETA: {eta:4.1f}s")

    proc.stdin.close()
    stderr_bytes = proc.stderr.read()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {stderr_bytes.decode('utf-8', errors='replace')[:600]}")

    BACKUP_MP4.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['cp', str(TARGET_MP4), str(BACKUP_MP4)], check=True)

    metrics = measure_final_video(TARGET_MP4)
    print("============================================================")
    print("                FINAL MASTER VIDEO VERIFICATION             ")
    print("============================================================")
    print(f" File Path:           {metrics['path']}")
    print(f" Resolution:          {metrics['width']} x {metrics['height']}")
    print(f" Total Frames:        {metrics['frames']} (Expected: {TOTAL_FRAMES})")
    print(f" Duration:            {metrics['duration']:.4f} s (Expected: 30.000s)")
    print(f" Integrated Loudness: {metrics['lufs']:.2f} LUFS (Spec: -14.0 +- 0.5)")
    print(f" True Peak:           {metrics['true_peak']:.2f} dBTP (Spec: <= -1.0 dBTP)")
    print("============================================================")


if __name__ == '__main__':
    main()
