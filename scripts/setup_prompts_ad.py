import os
from pathlib import Path

PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_ad")
PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

PROMPTS = {
    # -------------------------------------------------------------
    # SCHEME A · 荔小卫 (Hoodie Lychee)
    # -------------------------------------------------------------
    "sa_01_front": """3D character design sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", FRONT ORTHOGRAPHIC VIEW (正平视基准视图). 3:2 landscape. Canonical 3D modeling reference sheet. Symmetrical standing pose on clean off-white studio background. The character wears an adorable oversized hoodie cape made of authentic carmine-and-cinnabar red lychee peel with raised polygonal crackle scales. The hoodie drawstrings are two tender green fruit stems. On the apex of the hood is a fresh perky green lychee leaf. The hood frames a plump, juicy, milky-translucent white lychee pulp face with sweet round black eyes, soft blushing cheeks, and a gentle cheerful smile. Chubby white pulp arms peek out of sleeves, wearing tiny cute round boots. Designer vinyl art-toy aesthetic, Pop Mart / Coarse collectible quality, ultra-clean industrial lighting, sharp focus.""",

    "sa_02_side": """3D character design sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", 45-DEGREE SIDE AND THREE-QUARTER VIEW (45度侧景立体透视). 3:2 landscape. 
[STRICT REFERENCE]: Strictly preserve the exact character design, facial features, proportions, materials, and colors from the attached reference image.
Show the 45-degree angle profile: depth and volume of the thick lychee peel hoodie cape, curvature of the chubby translucent white pulp cheeks, drape of the peel fabric with scalloped hem around the body, side profile of tiny boots, and the perky angle of the leaf finial on top. Clean off-white studio background.""",

    "sa_03_back": """3D character design sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", REAR BACK VIEW (背部结构拓扑). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact character design, hoodie shape, materials, and colors from the attached reference image.
Full back orthographic view showing 100% carmine-red lychee peel with tactile polygonal crackle scales covering the entire back of the hoodie. The natural stem and leaf growth point at the apex. Clean scalloped lower hem edge revealing a subtle hint of soft pink inner lining. No front face visible. Clean industrial lighting.""",

    "sa_04_macro": """3D character design sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", CMF MATERIAL & FABRICATION MACRO (材质分件与边缘微距拆解). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact materials, colors, and textures from the attached reference image.
Macro close-up inspection: the embossed, bumpy texture of the carmine-red lychee peel hoodie fabric, the 0.5mm soft-pink silicone inner lining at the rim, the sub-surface scattering translucent juicy texture of the plump white lychee pulp face, and the green stem drawstrings. Visible tactile craft details for collectible toy manufacturing.""",

    "sa_05_action": """3D character design sheet for "LI / 荔 · HOODIE LYCHEE (方案A：果壳连帽卫衣款 · 荔小卫)", SIGNATURE INTERACTION: HOOD ON VS HOOD OFF (招牌动作：兜帽脱戴与变身). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact character design, face, materials, and colors from the attached reference image.
Playful dual display or transform action: On one side, pulling the green stem drawstrings so the hood closes snug, transforming into a complete round lychee fruit; on the other side, pulling the hood back to reveal the full bouncy, rounded white pulp head with leaf antenna, waving happily. Full of charm and warmth.""",

    # -------------------------------------------------------------
    # SCHEME D · 荔小星 (Astro-Lychee)
    # -------------------------------------------------------------
    "sd_01_front": """3D character design sheet for "LI / 荔 · ASTRO-LYCHEE (方案D：复古果壳宇航头盔款 · 荔小星)", FRONT ORTHOGRAPHIC VIEW (正平视基准视图). 3:2 landscape. Canonical 3D modeling reference sheet. Symmetrical standing pose on clean studio background. The character wears a spherical astronaut helmet crafted from genuine carmine-red lychee peel with raised polygonal crackle scales. In the center is a large, crystal-clear spherical bubble visor revealing the adorable, milky-translucent white lychee pulp mascot face inside, with big shiny curious black eyes, rosy cheeks, and happy smile. On top of the helmet is a cute green twig communication antenna with a tiny leaf. Wearing a sleek minimalist white soft space suit with rounded joints and cute astronaut boots. Designer vinyl collectible quality.""",

    "sd_02_side": """3D character design sheet for "LI / 荔 · ASTRO-LYCHEE (方案D：复古果壳宇航头盔款 · 荔小星)", 45-DEGREE SIDE AND THREE-QUARTER VIEW (45度侧景立体透视). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact character design, helmet shape, face, proportions, materials, and colors from the attached reference image.
45-degree angle profile: showing the spherical volume of the lychee shell helmet, curvature of the bubble visor, side view of the white space suit and the compact life-support backpack on its back. Antenna tilted slightly forward. Clean industrial lighting.""",

    "sd_03_back": """3D character design sheet for "LI / 荔 · ASTRO-LYCHEE (方案D：复古果壳宇航头盔款 · 荔小星)", REAR BACK VIEW (背部宇航背包拓扑). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact helmet, space suit, materials, and colors from the attached reference image.
Full back view showing the 100% carmine-red crackle lychee shell covering the rear helmet, the antenna mount at the top, and the compact white life-support backpack with a translucent window showing glowing pink lychee nectar. Rear space suit seamlines and round boots. No front face visible.""",

    "sd_04_macro": """3D character design sheet for "LI / 荔 · ASTRO-LYCHEE (方案D：复古果壳宇航头盔款 · 荔小星)", VISOR SEAL & CMF MACRO (面罩密封圈与果壳微距拆解). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact materials, textures, and colors from the attached reference image.
Macro close-up inspection: the precision rubber gasket seal where the crystal-clear acrylic bubble visor joins the rough, bumpy carmine-red lychee peel helmet, the metallic green antenna mount, and the soft translucent glow of the juicy white pulp face visible through the clear visor. High-end CMF toy engineering details.""",

    "sd_05_action": """3D character design sheet for "LI / 荔 · ASTRO-LYCHEE (方案D：复古果壳宇航头盔款 · 荔小星)", ZERO-GRAVITY SPACE FLOATING (招牌动作：零重力太空漂浮漫游). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact character, helmet, face, suit, and colors from the attached reference image.
Signature action: Floating weightlessly in zero-gravity space in a joyful, playful posture. Reaching one chubby arm forward as if exploring, gentle sparkling stardust reflections on the bubble visor, tiny bubbles floating inside the nectar tank backpack. Whimsical, heartwarming sci-fi art toy showcase."""
}

for name, content in PROMPTS.items():
    file_path = PROMPTS_DIR / f"{name}.txt"
    file_path.write_text(content.strip(), encoding="utf-8")
    print(f"✅ Written {file_path.name}")
