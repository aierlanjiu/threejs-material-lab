import os
from pathlib import Path

PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_cmf")
PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

PROMPTS = {
    "cmf_hermit_amber_leather": """3D CMF material design sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", AMBER NECTAR & VEG-TAN LEATHER ADVENTURER EDITION (复古探险者版 · 琥珀蜜蜡与植鞣牛皮). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact character design, half-shell carapace backpack, proportions, walking stick, chest straps, bronze leaf medallion, and facial features from the attached reference image.
Material transformation: The pulp body of the little traveler is sculpted from warm golden-honey Baltic amber (天然金珀/蜜蜡) with crystal-clear warmth and gentle microscopic gold leaf flecks floating within. The backpack harness and straps are crafted from genuine Italian vegetable-tanned saddle leather (复古植鞣原色牛皮) in rich cognac brown with visible waxed linen saddle stitching and antique brass buckle hardware. The lychee half-shell backpack is finished in earthy matte terracotta red ceramic (天然红陶粗砂质感) with raised crackle scales. The little walking stick is carved from seasoned wild walnut wood with a fresh dew-dropped emerald green leaf at its tip. A tiny antique brass wind chime bell hangs gently from the leather pack. Nostalgic outdoor expedition art toy aesthetic, warm golden-hour workshop lighting, tactile artisan craftsmanship.""",

    "cmf_hermit_jade_bronze": """3D CMF material design sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", IMPERIAL JADE & ARCHAIC BRONZE EDITION (东方玉魄版 · 羊脂白玉与战国错金青铜). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact character design, half-shell carapace backpack, proportions, walking stick, chest straps, leaf medallion, and facial features from the attached reference image.
Material transformation: The little traveler's pulp body is sculpted from pure Hetian mutton-fat white jade (极品和田羊脂白玉) with an oily, silky soft luster and subtle warm subsurface glow. The lychee shell carapace backpack is cast in authentic Warring States archaic bronze (战国青铜) with an exquisite mottled verdigris green patina, inlaid with intricate 24K pure gold wire patterns (错金工艺) across the polygonal lychee scales. The chest medallion and the walking stick finial are carved from vivid imperial emerald jade (老坑玻璃种帝王绿翡翠). The travel straps are braided from auspicious cinnabar vermilion silk cords (朱砂红丝绫绳) with hand-hammered gold ring clasps. Chinese museum masterpiece collectible toy, ancient bronze antiquity meets precious oriental jade, dignified regal atmosphere, dramatic museum gallery lighting."""
}

for name, content in PROMPTS.items():
    file_path = PROMPTS_DIR / f"{name}.txt"
    file_path.write_text(content.strip(), encoding="utf-8")
    print(f"✅ Written {file_path.name}")
