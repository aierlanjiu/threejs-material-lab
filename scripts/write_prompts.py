import os
from pathlib import Path

base_dir = Path("/Users/papazed/dev/threejs-material-lab/design_sheets/prompts_3d_angles")
base_dir.mkdir(parents=True, exist_ok=True)

prompts = {
    # Scheme 01: 壳甲小旅人 · 寄居荔
    "s01_01_front": """3D character design sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", FRONT ORTHOGRAPHIC VIEW (正视图). 3:2 landscape. Neutral upright standing pose facing front. A plump, juicy, translucent milky-white lychee pulp companion. Cute facial features: two glossy obsidian black bead eyes, tiny cheerful mouth, soft pink blushing cheeks. Behind it, a round, textured carmine-red lychee shell acts as a backpack home, opening naturally around the front to frame the character with pale-pink inner rind edges. Natural brown twig and one small green leaf sprout from top of shell. Symmetrical alignment, clean studio lighting, orthographic baseline, industrial toy modeling reference.""",

    "s01_02_side": """3D character design sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", 45-DEGREE SIDE & THREE-QUARTER PERSPECTIVE VIEW (45度侧景透视). 3:2 landscape. Dynamic view showcasing the depth, volume, and ergonomic integration between the plump translucent fruit pulp body and the spherical bumpy carmine-red lychee shell backpack. Clear side silhouette showing shell thickness, natural curving rim, the forward-leaning cute posture, short arms swinging gently, grounded contact shadow. 65mm product photography.""",

    "s01_03_back": """3D character design sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", BACK VIEW (正背视图). 3:2 landscape. Camera directly behind the character, showcasing the complete spherical carmine-red lychee shell surface. Intricate geometric polygonal tubercles (龟裂鳞斑) pattern, rich crimson to coral-pink gradient, top node where the natural brown woody twig and slender emerald-green leaf emerge, stable base and bottom curve. Clean reference for 3D shell topology and UV texture mapping.""",

    "s01_04_macro": """3D character design sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", CMF & JOINT STRUCTURE MACRO VIEW (材质咬合与分件特写). 3:2 landscape. Close-up technical visualization showing the physical rim where the bumpy red lychee shell meets the tender milky-white fruit pulp. Distinct pale-pink inner rind lining, realistic subsurface scattering (SSS) in the translucent waxy pulp, micro-tubercles on the shell exterior. Clean annotations for injection molding, CMF material transitions, and collectible toy engineering.""",

    "s01_05_retracted": """3D character design sheet for "LI / 荔 · HERMIT LYCHEE (方案一：壳甲小旅人)", SIGNATURE TRANSFORM: FULL RETRACTION STATE (招牌交互：完全缩壳状态). 3:2 landscape. Comparison sheet showing the character fully retracted inside the shell! The white pulp body has ducked completely inside the red shell, closing seamlessly into a perfect, intact, plump fresh lychee fruit with stem and leaf on top. Inset comparison shows: 1) Active walking mode with pulp body out, and 2) Sleeping/defense closed lychee fruit mode. Interactive toy design magic, whimsical and lovable.""",

    # Scheme 02: 双开甲翼 · 飞天小灵宠
    "s02_01_front": """3D character design sheet for "LI / 荔 · WINGED LYCHEE SPRITE (方案二：双开甲翼飞天灵宠)", FRONT ORTHOGRAPHIC VIEW (正视图 - 翅翼微收). 3:2 landscape. Symmetrical front view. Plump translucent milky-white lychee fruit pulp fairy body with sweet smiling face, glossy black eyes, pink cheeks. On its back, twin curved carmine-red bumpy lychee peel elytra (wing-cases) peek symmetrically from the sides. Sprouting from the head crest is a slender curved stem with a perky green leaf acting as an aerial antenna. Balanced character proportions, clean modeler reference.""",

    "s02_02_side": """3D character design sheet for "LI / 荔 · WINGED LYCHEE SPRITE (方案二：双开甲翼飞天灵宠)", 45-DEGREE SIDE PROFILE VIEW (侧视图与转轴结构). 3:2 landscape. Side profile showcasing the curved aerodynamic contour of the bumpy red lychee shell wing-cases mounted on the back. Demonstrates the organic pivot hinge mechanism connecting the shell wings to the succulent fruit pulp torso, wing clearance, cute chubby tummy, tiny hovering stance.""",

    "s02_03_back": """3D character design sheet for "LI / 荔 · WINGED LYCHEE SPRITE (方案二：双开甲翼飞天灵宠)", BACK VIEW - CLOSED WINGS (背面闭合状态). 3:2 landscape. Camera facing the back. Two symmetrical curved carmine-red lychee peel wings meet neatly along the center spine line like ladybug elytra. Intricate polygonal bumpy rind relief, rich natural red-pink coloration, clean seam line showing how the two shell halves close into a sleek protective cloak.""",

    "s02_04_flight": """3D character design sheet for "LI / 荔 · WINGED LYCHEE SPRITE (方案二：双开甲翼飞天灵宠)", FULL WING-SPREAD FLIGHT ACTION (双翼展开飞行姿态). 3:2 landscape. Dynamic airborne pose! The two carmine-red bumpy lychee peel wing-cases are lifted and spread open at 45 degrees, revealing smooth pearlescent pale-pink inner wing linings and soft translucent underwings. The chubby white pulp sprite is happily suspended in mid-air with joyful expression, arms out, antenna leaf trailing in the breeze.""",

    "s02_05_macro": """3D character design sheet for "LI / 荔 · WINGED LYCHEE SPRITE (方案二：双开甲翼飞天灵宠)", WING HINGE & CMF MACRO VIEW (翅翼关节与微距材质拆解). 3:2 landscape. Technical close-up illustrating the organic ball-and-socket hinge connecting the shell wings to the pulp back. Macro details of the textured bumpy shell scales, iridescent inner wing reflection, and succulent pulp translucency. Industrial toy production guide.""",

    # Scheme 04: 东方仙童 · 冠冕云肩荔
    "s04_01_front": """3D character design sheet for "LI / 荔 · CELESTIAL LYCHEE SPIRIT (方案四：东方仙童冠冕云肩荔)", FRONT ORTHOGRAPHIC VIEW (正立姿视图). 3:2 landscape. Symmetrical standing pose. An ethereal oriental child spirit crafted from pristine mutton-fat white jade (羊脂白玉果肉). Wearing a sculpted carmine-and-cinnabar lychee rind CORONET (果冠) with miniature twig and leaf finial. Shoulders draped in an ornate carved CLOUD-SHOULDER CAPE (云肩) featuring geometric lychee scales and pale-pink scalloped hem. Serene gentle eyes, pure tranquil smile, museum-grade collectible statuette.""",

    "s04_02_side": """3D character design sheet for "LI / 荔 · CELESTIAL LYCHEE SPIRIT (方案四：东方仙童冠冕云肩荔)", 45-DEGREE THREE-QUARTER VIEW (45度侧景透视). 3:2 landscape. Elegant three-quarter angle displaying the graceful drape of the cloud-shoulder mantle, the height and pitch of the lychee coronet, and the soft, rounded cheekbones of the jade spirit. Refined oriental silhouettes, balanced drapery, warm studio backlighting.""",

    "s04_03_back": """3D character design sheet for "LI / 荔 · CELESTIAL LYCHEE SPIRIT (方案四：东方仙童冠冕云肩荔)", BACK VIEW (背面云肩与后发冠). 3:2 landscape. Symmetrical back view focusing on the four-petal cloud-shoulder cape draped over the back with intricate embossed lychee rind scales, and the rear tie/fastener of the coronet crown. Clean geometric reference for 3D modeling.""",

    "s04_04_seated": """3D character design sheet for "LI / 荔 · CELESTIAL LYCHEE SPIRIT (方案四：东方仙童冠冕云肩荔)", SEATED LOTUS MEDITATION WITH DEW TWIG (盘坐持枝定妆照). 3:2 landscape. Iconic signature pose: The celestial lychee spirit sits peacefully in lotus meditation. In its hands it gently cradles a small fresh green lychee sprig with morning dew drops (like a ruyi scepter). Cloud-shoulder folds softly on the ground, eyes gently curved in blessing and peace. Poetic high-end art toy concept.""",

    "s04_05_macro": """3D character design sheet for "LI / 荔 · CELESTIAL LYCHEE SPIRIT (方案四：东方仙童冠冕云肩荔)", CORONET & CLOUD-SHOULDER CMF MACRO (冠冕与云肩工艺微距特写). 3:2 landscape. Close-up technical macro showing the craftsmanship: carved cinnabar-red lychee peel texture on the coronet, gold-wire inlay along the cloud-shoulder border, and the luminous, waxy translucency of the white nephrite jade face. Luxury collectible CMF specification.""",
}

for name, text in prompts.items():
    p = base_dir / f"{name}.txt"
    p.write_text(text.strip(), encoding="utf-8")
    print(f"Written: {p.name}")
