#!/usr/bin/env python3
"""
Post-processor for Xuemu Quirky UI Elements.
Converts white backgrounds to clean Alpha transparency, detects bounding boxes / grids,
and crops distinct transparent RGBA PNG assets into assets/icons/quirky/ and assets/decorations/quirky/.
"""

import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image

WORKSPACE_ROOT = Path("/Users/papazed/dev/threejs-material-lab")
RAW_DIR = WORKSPACE_ROOT / "assets" / "icons" / "quirky" / "raw"
OUTPUT_DIR = WORKSPACE_ROOT / "assets" / "icons" / "quirky"
DECOR_DIR = WORKSPACE_ROOT / "assets" / "decorations" / "quirky"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DECOR_DIR.mkdir(parents=True, exist_ok=True)

ACTION_NAMES = [
    "action_lock_fruit",   # Row 0, Col 0: closed fruit pod
    "action_bounce",       # Row 0, Col 1: bounce spring
    "action_wave",         # Row 0, Col 2: waving hand
    "action_nod",          # Row 1, Col 0: nod affirmation
    "action_shake",        # Row 1, Col 1: playful shake
    "action_shy",          # Row 1, Col 2: shy blush
    "action_sleepy",       # Row 2, Col 0: sleeping Zzz
    "action_groove",       # Row 2, Col 1: dynamic groove music
    "action_pop_out",      # Row 2, Col 2: pop out of fruit
    "action_astro_float",  # Row 3, Col 0: zero-g float
    "action_astro_boost",  # Row 3, Col 1: jetpack boost
    "action_astro_salute"  # Row 3, Col 2: astronaut salute
]

CONTROL_NAMES = [
    ("btn_send", OUTPUT_DIR / "btn_send.png"),
    ("btn_chat", OUTPUT_DIR / "btn_chat.png"),
    ("btn_mic", OUTPUT_DIR / "btn_mic.png"),
    ("decor_corner", DECOR_DIR / "decor_corner.png"),
    ("decor_stars", DECOR_DIR / "decor_stars.png"),
    ("decor_branch", DECOR_DIR / "decor_branch.png"),
    ("decor_seal", DECOR_DIR / "decor_seal.png")
]

def make_white_transparent(img: Image.Image, threshold: int = 240, softness: int = 20) -> Image.Image:
    """Converts near-white background to transparent with anti-aliasing."""
    rgba = img.convert("RGBA")
    data = np.array(rgba)
    r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]
    
    # Calculate min RGB brightness (background is pure/near white)
    bg_intensity = np.minimum(np.minimum(r, g), b)
    
    # Alpha mask: 0 where brightness >= threshold + softness, 255 where <= threshold
    alpha = np.ones_like(bg_intensity, dtype=np.float32) * 255.0
    high_mask = bg_intensity >= threshold
    fade = np.clip((bg_intensity.astype(np.float32) - threshold) / max(softness, 1), 0.0, 1.0)
    alpha[high_mask] = 255.0 * (1.0 - fade[high_mask])
    
    data[:, :, 3] = alpha.astype(np.uint8)
    return Image.fromarray(data, mode="RGBA")

def trim_transparent(img: Image.Image, padding: int = 12) -> Image.Image:
    """Trims empty transparent borders and adds padding."""
    bbox = img.getbbox()
    if not bbox:
        return img
    cropped = img.crop(bbox)
    w, h = cropped.size
    target_dim = max(w, h) + padding * 2
    canvas = Image.new("RGBA", (target_dim, target_dim), (0, 0, 0, 0))
    offset_x = (target_dim - w) // 2
    offset_y = (target_dim - h) // 2
    canvas.paste(cropped, (offset_x, offset_y), cropped)
    return canvas

def process_actions_sheet(sheet_path: Path):
    if not sheet_path.exists():
        print(f"❌ 找不到动作母图: {sheet_path}")
        return
    
    print(f"🎨 正在切分与透明化动作大图: {sheet_path.name}")
    raw_img = Image.open(sheet_path)
    w, h = raw_img.size
    
    rows, cols = 3, 4
    cell_w = w // cols
    cell_h = h // rows
    
    idx = 0
    for r in range(rows):
        for c in range(cols):
            if idx >= len(ACTION_NAMES):
                break
            name = ACTION_NAMES[idx]
            box = (c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h)
            cell_img = raw_img.crop(box)
            
            # Apply alpha isolation and trim
            alpha_img = make_white_transparent(cell_img, threshold=238, softness=18)
            final_img = trim_transparent(alpha_img, padding=16)
            
            # Resize to standardized crisp size (e.g. 256x256)
            final_img = final_img.resize((256, 256), Image.Resampling.LANCZOS)
            out_file = OUTPUT_DIR / f"{name}.png"
            final_img.save(out_file, "PNG")
            print(f"   ✅ [动作图标] {name} -> {out_file.name} (256x256 RGBA, {out_file.stat().st_size // 1024} KB)")
            idx += 1

def process_controls_sheet(sheet_path: Path):
    if not sheet_path.exists():
        print(f"❌ 找不到控制大图: {sheet_path}")
        return
        
    print(f"🎨 正在切分与透明化控制与点缀大图: {sheet_path.name}")
    raw_img = Image.open(sheet_path)
    w, h = raw_img.size
    
    # 6 items arranged in a 2x3 grid:
    # Row 0: Send (0-w/3), Chat (w/3-2w/3), Mic (2w/3-w)
    # Row 1: Corner brackets (0-w/3), Stars (w/3-2w/3), Branch (2w/3-w)
    regions = {
        "btn_send": (0, 0, w // 3, h // 2),
        "btn_chat": (w // 3, 0, 2 * w // 3, h // 2),
        "btn_mic": (2 * w // 3, 0, w, h // 2),
        "decor_corner": (0, h // 2, w // 3, h),
        "decor_stars": (w // 3, h // 2, 2 * w // 3, h),
        "decor_branch": (2 * w // 3, h // 2, w, h)
    }
    
    for name, out_path in CONTROL_NAMES:
        box = regions.get(name)
        if not box:
            continue
        cell_img = raw_img.crop(box)
        alpha_img = make_white_transparent(cell_img, threshold=238, softness=18)
        final_img = trim_transparent(alpha_img, padding=16)
        
        dim = 256 if "btn" in name else 384
        final_img = final_img.resize((dim, dim), Image.Resampling.LANCZOS)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        final_img.save(out_path, "PNG")
        print(f"   ✅ [UI控件/装饰] {name} -> {out_path.name} ({dim}x{dim} RGBA, {out_path.stat().st_size // 1024} KB)")

def main():
    actions_sheet = RAW_DIR / "quirky_actions_sheet.png"
    controls_sheet = RAW_DIR / "quirky_controls_sheet.png"
    
    if actions_sheet.exists():
        process_actions_sheet(actions_sheet)
    else:
        print(f"⏳ 动作大图尚未落盘: {actions_sheet}")
        
    if controls_sheet.exists():
        process_controls_sheet(controls_sheet)
    else:
        print(f"⏳ 控制大图尚未落盘: {controls_sheet}")

if __name__ == "__main__":
    main()
