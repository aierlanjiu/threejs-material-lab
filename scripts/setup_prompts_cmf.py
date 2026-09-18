import os
from pathlib import Path

PROMPTS_DIR = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_cmf")
PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

PROMPTS = {
    "cmf_a_wool_corduroy": """3D CMF material design sheet for "LI / 荔 · HOODIE LYCHEE (荔小卫)", AUTUMN/WINTER CORDUROY & WOOL FELT EDITION (治愈秋冬版 · 软糯羊毛毡与灯芯绒). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact character design, hoodie shape, face, proportions, and features from the attached reference image.
Material transformation: The lychee peel hoodie is crafted from warm vintage brick-red ribbed corduroy fabric (粗坑条复古砖红灯芯绒) with soft tactile wales, trimmed with cozy fluffy white sherpa fleece along the inner scalloped hem. The drawstrings are braided green wool yarn with needle-felted stem tips. The apex of the hood has a cute needle-felted green leaf. The face and hands are made of soft, dense needle-felted white merino wool (细腻针刺羊毛毡) with a gentle fuzzy wool halo, rosy felt-dyed blushing cheeks, and shiny black bead eyes. Cozy, tactile, artisan handcrafted textile collectible toy photography, warm inviting studio lighting.""",

    "cmf_a_cinnabar_jade": """3D CMF material design sheet for "LI / 荔 · HOODIE LYCHEE (荔小卫)", IMPERIAL CINNABAR & MUTTON-FAT JADE EDITION (东方典藏版 · 剔红雕漆与和田羊脂白玉). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact character design, hoodie shape, face, proportions, and features from the attached reference image.
Material transformation: The lychee peel hoodie is sculpted in traditional Chinese imperial carved red lacquer (剔红 / 雕漆 Cinnabar Lacquer) in deep cinnabar vermilion, featuring intricate relief-carved geometric lychee scales with delicate hand-painted 24K gold foil line inlay along the scalloped hem. The face and body are carved from flawless mutton-fat white nephrite jade (特级和田羊脂白玉) with soft greasy warm luster and natural translucent subsurface scattering, accompanied by dark polished obsidian bead eyes. Miniature green jade leaf finial on top. Museum-grade luxury art collectible, Chinese master royal craftsmanship, dramatic gallery spotlighting, pure cultural elegance.""",

    "cmf_d_holographic_titanium": """3D CMF material design sheet for "LI / 荔 · ASTRO-LYCHEE (荔小星)", AEROSPACE TITANIUM & HOLOGRAPHIC VISOR EDITION (航天极客版 · 钛金属与全息彩虹面罩). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact character design, helmet shape, face, suit, and features from the attached reference image.
Material transformation: The spherical helmet is finished in textured matte dark terracotta-red meteorite composite with raised crackle scales. The spherical bubble visor features a premium vacuum-sputtered holographic rainbow dichroic coating (全息彩虹真空镀膜), gleaming with iridescent violet, turquoise, and golden reflections as ambient light hits. The space suit is made of matte brushed aerospace titanium-gray fabric with anodized dark gunmetal joint rings and precision CNC metal accents. Green titanium-alloy leaf antenna on the helmet. The juicy translucent white lychee pulp face shines cheerfully through the rainbow visor. High-end futuristic aerospace art toy aesthetic.""",

    "cmf_d_optic_crystal": """3D CMF material design sheet for "LI / 荔 · ASTRO-LYCHEE (荔小星)", OPTIC CRYSTAL & LUMINESCENT NECTAR EDITION (极光晶石版 · 光学高透水晶与荧光甘露). 3:2 landscape.
[STRICT REFERENCE]: Strictly preserve the exact character design, helmet shape, face, suit, and features from the attached reference image.
Material transformation: The spherical helmet is sculpted from optical-grade pure lead crystal with precision faceted crackle scales producing brilliant rainbow caustics and prismatic refractions. The crystal-clear bubble visor reveals the translucent milky-white pulp face. The space suit is crafted from pure white microcrystalline ceramic (纯白微晶陶瓷) with a high-gloss glazed enamel finish and red silicone gasket seals. The backpack life-support tank is made of double-walled vacuum glass filled with glowing luminescent pink lychee nectar with floating effervescent micro-bubbles that radiate a gentle magical glow. Ultra-luxury designer crystal art toy masterpiece, dazzling light dispersion."""
}

for name, content in PROMPTS.items():
    file_path = PROMPTS_DIR / f"{name}.txt"
    file_path.write_text(content.strip(), encoding="utf-8")
    print(f"✅ Written {file_path.name}")
