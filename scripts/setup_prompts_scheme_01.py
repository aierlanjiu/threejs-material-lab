import os
from pathlib import Path

PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_ad")
PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

PROMPTS = {
    "s01_01_front": """3D character design sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", FRONT ORTHOGRAPHIC VIEW (正平视基准视图). 3:2 landscape.
[STRICT REFERENCE]: Strictly match the exact character from the attached reference image (NO LEAF HAT, DO NOT ADD ANY HAT).
Symmetrical front orthographic standing pose on clean seamless off-white background. The little traveler stands with its head framed by a half-shell carmine-red lychee peel carapace hood (with natural polygonal crackle bumps) extending down its back. At the top apex of the shell hood is a brown fruit stem with a perky green leaf. The face is a plump, translucent milky-white jade lychee pulp with big sparkling dark eyes, blushing cheeks, and a joyful open smile. Across the chest is a vintage brown leather travel harness with a circular bronze medallion featuring an engraved leaf symbol in the center. The character holds a natural crooked wooden walking stick (with a tiny green leaf sprout) in its left hand. Chubby white pulp feet stand stably. Clean 3D modeling baseline, crisp industrial lighting, sharp toy photography.""",

    "s01_02_side": """3D character design sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", 45-DEGREE SIDE WALKING PERSPECTIVE (45度侧景行进透视). 3:2 landscape.
[STRICT REFERENCE]: Strictly match the exact character from the attached reference image (NO LEAF HAT, DO NOT ADD ANY HAT).
Side three-quarter dynamic walking pose, stepping forward to the right on clean seamless off-white background. The character plants the wooden walking stick forward with one hand, full of wandering adventurer spirit. Clearly shows the rounded depth and thickness of the red lychee shell carapace worn on the back, the rolled canvas bedroll strapped horizontally above the leather backpack, the side leather strap buckles, the small leather pouch with a tiny brass bell, and the forward-tilted happy white pulp face. Beautiful 3D depth, natural stride, balanced center of mass, gentle studio lighting.""",

    "s01_03_back": """3D character design sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", PURE BACK ORTHOGRAPHIC VIEW (正背部结构拓扑). 3:2 landscape.
[STRICT REFERENCE]: Strictly match the exact character from the attached reference image seen directly from behind.
Pure straight back view, orthographic modeling reference on clean seamless off-white background. Shows the full domed curvature of the red lychee peel shell carapace with 100% authentic crackled polygonal scale texture. Securely strapped across the top of the carapace is the rolled traveler's bedroll with two buckled leather fastening straps. The brown fruit stem and vibrant green leaf are anchored at the top apex. Leather shoulder straps wrap down around the shell. Back view of the chubby white pulp legs and feet. Zero perspective distortion, clean industrial blueprint for 3D mold-making and part-splitting.""",

    "s01_04_macro": """3D CMF and assembly macro detail sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", CMF & MECHANICAL JOINTS BREAKDOWN (材质分件与工艺微距拆解). 3:2 landscape.
[STRICT REFERENCE]: Strictly match the exact character from the attached reference image.
Industrial CMF breakdown layout on clean warm off-white background:
On the left: Full-body traveler figure holding walking stick.
On the right: 5 magnified circular macro detail lenses highlighting:
1. Crackle-scale red lychee shell carapace surface texture and interior 0.5mm soft-pink membrane;
2. Genuine brown saddle-stitched leather harness and circular engraved bronze leaf medallion;
3. Milky-translucent white jade lychee pulp skin showing warm subsurface scattering (SSS) and rosy cheek flush;
4. Miniature wooden walking stick with carved grain and fresh green leaf sprout;
5. Rolled canvas bedroll bundle with miniature brass buckles and hanging wind chime bell.
Includes official production color swatches and engineering assembly callouts, ultra-clean product visualization."""
}

for name, content in PROMPTS.items():
    file_path = PROMPTS_DIR / f"{name}.txt"
    file_path.write_text(content.strip(), encoding="utf-8")
    print(f"✅ Written {file_path.name}")
