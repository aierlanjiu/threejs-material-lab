import os
from pathlib import Path

PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_ad")
PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

PROMPTS = {
    "sa_01_front": """3D character design sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", FRONT ORTHOGRAPHIC VIEW (正平视基准视图). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve 100% of the character identity, proportions, and features from the attached reference image.
Symmetrical front orthographic standing pose on clean seamless off-white background. The character wears an oversized cocoon-style red lychee peel hoodie covering the head and chubby body, zipped/closed down the middle with a vertical seam. Both small white mitten hands are holding the two tender green fruit stem drawstrings together right in front of the chest. The hood opening frames a plump, tender translucent milky-white lychee pulp face with big dark round eyes with catchlights, rosy blushed cheeks, and a gentle sweet smile. On the feet are round red boots with thick cream-white soles and a circular cream button on the outer side. On the top apex of the hood is a natural brown stem with a fresh green leaf curving to the upper right. Designer art-toy collectible quality, Pop Mart / Coarse aesthetics, clean industrial studio lighting, sharp focus.""",

    "sa_02_side": """3D character design sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", 45-DEGREE SIDE THREE-QUARTER VIEW (45度侧景立体透视). 3:2 landscape.
[STRICT REFERENCE]: Strictly match the exact character from the attached reference image.
Turned 45 degrees to the right in a three-quarter perspective on clean seamless off-white background. Clearly reveals the deep round cocoon silhouette of the red crackle-scale lychee hoodie, the fullness of the chubby white cheek and soft profile, the green stem drawstrings held forward in the cute white mitten hands, the curvature of the back shell, and the red boots with cream soles and round side button. Apex features the brown stem and curved green leaf. Beautiful 3D volume, balanced center of gravity, soft studio lighting, sharp industrial toy photography.""",

    "sa_03_back": """3D character design sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", PURE BACK ORTHOGRAPHIC VIEW (正背部结构拓扑). 3:2 landscape.
[STRICT REFERENCE]: Strictly match the exact character from the attached reference image seen directly from behind.
Pure straight back view, orthographic modeling reference on clean seamless off-white background. Displays 100% full carmine-red polygonal crackle scale texture covering the entire head and body of the cocoon hoodie. A crisp vertical center back mold/seam line runs down the middle. At the top apex, the brown wooden fruit stem is securely anchored, with the vibrant green leaf angled gracefully. Back view of the two red boots with cream-white rubber heels and tread line. Clean industrial topology reference for 3D mold making, uniform studio lighting, zero perspective distortion.""",

    "sa_04_macro": """3D CMF and assembly macro detail sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", CMF & MECHANICAL JOINTS BREAKDOWN (材质分件与工艺微距拆解). 3:2 landscape.
[STRICT REFERENCE]: Strictly match the exact character from the attached reference image.
Industrial CMF breakdown layout on clean warm off-white background:
On the left: The full-body standing character holding drawstrings.
On the right: 5 circular magnified macro callout lenses highlighting:
1. Micro-texture of the red lychee peel hoodie with raised polygonal facets and matte silicone feel;
2. Scalloped hood opening with a 0.5mm smooth soft-pink transition lining framing the face;
3. Soft milky-translucent white jade lychee pulp facial skin with subtle subsurface scattering (SSS) and rosy cheek gradient;
4. The green stem drawstring cords with swollen bud tips held in the white mitten hands;
5. Molded red boots with cream rubber sole lamination and side round rivet button.
Includes official production color swatches (hex codes) and engineering callouts, ultra-clean product visualization.""",

    "sa_05_action": """3D signature interactive transform sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", PULL-STRING TRANSFORM INTERACTION (招牌变身：抽绳收口变身荔枝). 3:2 landscape.
[STRICT REFERENCE]: Strictly match the exact character from the attached reference image. 100% HOOD-ON COCOON HOODIE (NO BARE HEAD, NO HOOD OFF).
Side-by-side interactive toy transformation showcase on clean warm off-white background:
On the left (TIGHTENED STATE · 缩壳完全体): Both little hands pull the green fruit stem drawstrings tight, completely gathering and closing the red lychee hoodie into a snug, seamless, round red lychee fruit sphere with top leaf, resting cutely on red boots.
On the right (RELAXED STATE · 萌脸日常态): The drawstrings relax, the hood opening expands, revealing the adorable smiling white pulp face with big shiny eyes, joyfully waving one little hand while holding the string with the other.
Clear English & Chinese labels: "STATE 1: TIGHTENED LYCHEE FRUIT (完全收口·鲜果态)" vs "STATE 2: RELAXED BUDDY (松开抽绳·萌友态)". 100% hoodie cocoon wrapping throughout, playful transformation, ultra-charming designer art toy presentation."""
}

for name, content in PROMPTS.items():
    file_path = PROMPTS_DIR / f"{name}.txt"
    file_path.write_text(content.strip(), encoding="utf-8")
    print(f"✅ Written {file_path.name}")
