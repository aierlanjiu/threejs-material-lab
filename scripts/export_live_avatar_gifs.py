#!/usr/bin/env python3
"""Export silent, transparent looping GIFs from the LÜ portrait rigs."""

from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "live-avatars"
GIF_OUTPUT = ROOT / "output" / "live-avatar-gifs"
SIZE = 512
DURATION = 13.2
CLIP = 2.2
MOODS = ("calm", "happy", "wink", "curious", "surprise", "sleepy")


def clamp(value: float, low: float = 0, high: float = 1) -> float:
    return max(low, min(high, value))


def smooth(value: float) -> float:
    t = clamp(value)
    return t * t * (3 - 2 * t)


def blink(time: float) -> float:
    distance = abs(time % 3.3 - 0.47)
    return 1 if distance > 0.18 else 0.08 + 0.92 * smooth(distance / 0.18)


def curve(draw: ImageDraw.ImageDraw, box: dict, color: tuple, alpha: float = 1) -> None:
    cx, cy = box["x"] + box["w"] / 2, box["y"] + box["h"] / 2
    points = []
    for step in range(21):
        t = step / 20
        x = (1-t)**2 * (cx - box["w"] * .38) + 2 * (1-t)*t * cx + t*t * (cx + box["w"] * .38)
        y = (1-t)**2 * (cy + box["h"] * .13) + 2 * (1-t)*t * (cy - box["h"] * .34) + t*t * (cy + box["h"] * .12)
        points.append((round(x), round(y)))
    draw.line(points, fill=(*color, round(255 * alpha)), width=max(4, round(box["w"] * .12)), joint="curve")


def brow(draw: ImageDraw.ImageDraw, box: dict, lift: float, tilt: float) -> None:
    cx = box["x"] + box["w"] / 2
    cy = box["y"] - box["h"] * .17 - lift
    points = []
    for step in range(13):
        t = step / 12
        x = (1-t)**2 * (cx - box["w"] * .28) + 2*(1-t)*t*cx + t*t*(cx + box["w"] * .28)
        y = (1-t)**2 * (cy + tilt) + 2*(1-t)*t*(cy - box["h"] * .13) + t*t*(cy - tilt)
        points.append((round(x), round(y)))
    draw.line(points, fill=(73, 59, 59, 255), width=max(3, round(box["w"]*.07)), joint="curve")


def frame(record: dict, layers: dict, time: float) -> Image.Image:
    portrait = layers["base"].copy()
    mood = MOODS[min(5, int(time / CLIP))]
    lid = blink(time)
    overlay = Image.new("RGBA", (SIZE, SIZE))
    painter = ImageDraw.Draw(overlay)
    for side in ("left", "right"):
        box = record["eyes"][side]
        if mood == "happy" or (mood == "wink" and side == "left"):
            curve(painter, box, (41, 37, 43))
        else:
            height = lid
            width = 1.0
            offset_y = 0
            if mood == "curious":
                height *= 1.08 if side == "left" else .78
                offset_y = -2 if side == "left" else 1
            elif mood == "surprise":
                height *= 1.18
                width = 1.035
                offset_y = -3
            elif mood == "sleepy":
                height *= .23
                offset_y = 2
            eye = layers[side]
            ew, eh = max(1, round(box["w"] * width)), max(1, round(box["h"] * height))
            eye = eye.resize((ew, eh), Image.Resampling.BICUBIC)
            x = round(box["x"] + box["w"] / 2 - ew / 2)
            y = round(box["y"] + box["h"] / 2 - eh / 2 + offset_y)
            overlay.alpha_composite(eye, (x, y))
        if mood == "curious":
            brow(painter, box, 6 if side == "left" else 0, 3 if side == "left" else -3)
        elif mood == "surprise":
            brow(painter, box, 11, 0)
    portrait.alpha_composite(overlay)
    sway = math.sin(time * 2 * math.pi / 4.4)
    rotated = portrait.rotate(-sway * .23, Image.Resampling.BICUBIC, fillcolor=(0, 0, 0, 0))
    shifted = Image.new("RGBA", (SIZE, SIZE))
    shifted.paste(rotated, (round(sway * 1.3), round(math.sin(time * 1.45) * 1.4)))
    return shifted


def export(record: dict, fps: int, size: int) -> Path:
    folder = ASSETS / record["id"]
    layers = {name: Image.open(folder / file).convert("RGBA") for name, file in (
        ("base", "base.png"), ("left", "eye-left.png"), ("right", "eye-right.png"))}
    target = GIF_OUTPUT / f'{record["id"]}.gif'
    target.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo",
        "-pixel_format", "rgba", "-video_size", f"{size}x{size}", "-framerate", str(fps),
        "-i", "pipe:0", "-filter_complex",
        "[0:v]split[a][b];[a]palettegen=max_colors=96:reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=dither=none",
        "-loop", "0", str(target),
    ]
    with subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE) as process:
        assert process.stdin is not None
        try:
            for number in range(round(DURATION * fps)):
                image = frame(record, layers, number / fps)
                if size != SIZE:
                    image = image.resize((size, size), Image.Resampling.LANCZOS)
                process.stdin.write(image.tobytes())
            process.stdin.close()
            error = process.stderr.read().decode() if process.stderr else ""
            if process.wait() != 0:
                raise RuntimeError(f"GIF export failed: {record['id']}: {error}")
        except BrokenPipeError as cause:
            error = process.stderr.read().decode() if process.stderr else ""
            raise RuntimeError(f"GIF export stopped: {record['id']}: {error}") from cause
    return target


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", help="Export one group/character for inspection")
    parser.add_argument("--fps", type=int, default=12)
    parser.add_argument("--size", type=int, default=256)
    args = parser.parse_args()
    manifest = json.loads((ASSETS / "manifest.json").read_text(encoding="utf-8"))
    records = [record for record in manifest["characters"] if args.id is None or record["id"] == args.id]
    if not records:
        raise ValueError(f"No character matches {args.id}")
    for record in records:
        result = export(record, args.fps, args.size)
        print(result.relative_to(ROOT), result.stat().st_size)


if __name__ == "__main__":
    main()
