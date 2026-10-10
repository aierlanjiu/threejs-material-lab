# 律：主题图按钮与入场水晶统一

Agent: codex · 2026-10-10

## 交付

- 龙珠入口直接以神龙与四星球为主体，移除通用烟晶 cube 外框。原神龙文件保留，页面使用依据原图生成的透明版本；海贼王重新制作草帽、罗盘与海浪图，火影重新制作护额、忍具、卷轴与查克拉图。三张均为 1024×1024 RGBA，具备真实透明通道。
- 入口图使用完整尺寸，桌面指针移动产生最多约 4.5° 的轻微视差；减少动态效果时关闭视差。工作台分组按钮同步使用缩小版主题图。
- 27 块入场魔方直接复用主场景的圆角几何、水晶预设和 `applySurfaceContent` 贴面着色。六面内容通过相同的表面法线、光照与透射遮罩呈现，移除内部方盒、硬边线和独立平面贴纸，只微调主题透射色与补光。
- 保留随机打乱、逆序归位、散开、重播、跳过以及三段真实魔方旋转音效。切换主题时更新材质采样纹理，修复 GPU 缓存旧表情的路径。
- 移除主视图两侧的海报文字栏与对应 DOM 更新，画面占满可用宽度，同时保留选定的母带画幅。左上角律核入口及备用品牌图标同步使用当前主题图。

## 文件

- 页面、主场景贴面及图标同步：`index.html`
- 入口图与视差样式：`css/lu-cube-intro.css`
- 入场构建、主题纹理与动画：`js/ui/lu-cube-intro.js`
- 回归：`test/lu/core-intro.test.js`
- 素材：`assets/icons/themes/one-piece-straw-compass.png`、`dragon-ball-shenron-cutout.png`、`naruto-leaf-chakra.png`
- 本地截图：`output/playwright/lu-{one-piece,dragon-ball,naruto}-{intro,stage}-{390,1440}.png`

## 验证

- 三主题桌面 1440×900、手机 390×844 入场与主视图实景已检查：透明边缘、正确作品表情、当前主题图标与空出的主视图区域正常。
- 桌面舞台占满 1416px 可用宽度，手机舞台占满 378px 可用宽度；保留 21:9 / 9:16 画幅，侧文字栏数量为零。
- `node test/lu/core-intro.test.js`：390px、1440px、减少动态效果路径通过；包含归位、散开、重播、跳过、键盘焦点、真实录音解码与播放、主题图同步及着色器错误检查。
- `node test/lu/ui-layout.test.js`：1440px、390px、342px 工作台、键盘操作与手机沉浸模式通过。
- 模块及页面内联脚本语法检查、`git diff --check` 通过。
- 实体手机尚未验收。本次完成于本地工作区，未发布。此前音乐接入改动保留在当前工作区。

## 后续：入场对比度与本机播放复核

- 海贼王、龙珠使用实色浅字与深色局部渐变；火影使用深紫墨色标题与浅纸色局部渐变。桌面标题上移，减少和魔方的重叠；原背景图和透明主题图保留。
- 主题名称、轻触提示、跳过与音效按钮增加小面积的主题明暗衬底；选中主题以对应颜色描边。主题图主体仍无通用外框，保留视差。
- 主题名称采用 12px、600 字重；将衬底分别叠在最不利的纯白或纯黑底上计算，未选中文字对比度下限为海贼王 10.60:1、龙珠 10.91:1、火影 8.17:1。该数值只对应名称文字，不代表全页面无障碍认证。
- 已检查三主题 390×844 与 1440×900 的六张实景，无横向溢出；最终截图位于 `output/playwright/lu-{one-piece,dragon-ball,naruto}-contrast-{390,1440}.png`。
- 对比度修改后重新运行 `node test/lu/core-intro.test.js`，390px、1440px 与减少动态效果全部通过；`git diff --check` 通过。
- 本地页面通过选曲操作实际逐首播放九首 MP3：音频上下文运行、播放时钟推进、输出波形非零，九份歌词均加载；验证后暂停。详情见 [音乐接入报告](2026-10-10-lu-anime-theme-music-integration.md)。本次仍为本地版本。

Agent: codex · 2026-10-10

## 图片生成方式与最终提示词

使用 Codex 内置 imagegen；以用户神龙图作为参考。项目内素材保留真实 Alpha，原始生成图保留在 Codex 生成目录。

### 海贼王

Use case: stylized-concept. Asset type: square transparent-background theme selector artwork for a premium anime music visualizer, designed to look excellent at 80px and at 30px. Input image is a MATERIAL AND FINISH REFERENCE ONLY: match its polished emerald-and-gold sculptural richness, crisp silhouette, strong specular highlights, dense but readable craftsmanship; do not copy dragon, orb, arrangement, or colors. Create an original One Piece inspired emblem: an iconic three-dimensional woven straw hat with warm gold brim and red band as the main readable shape, emerging from a deep sea-teal and aged bronze nautical compass rose and one graceful curling ocean wave. The hat must remain instantly recognizable at small sizes. Fine polished blue-green enamel, gold metal inlay and crystal highlights, lavish premium collectible sculpture, dynamic asymmetrical silhouette, centered with generous transparent margins. Distinctive maritime palette: deep sea teal, turquoise, muted bronze, warm straw gold and a small red accent. Absolutely transparent background with real alpha, no black background, no cube frame, no rounded-square badge, no text, no characters, no logo lettering, no watermark.

### 火影

Use case: stylized-concept. Asset type: square transparent-background theme selector artwork for a premium anime music visualizer, designed to read at 80px and 30px. Input image is a MATERIAL AND FINISH REFERENCE ONLY: match its premium sculptural detail, glossy hard surfaces, sharp highlights and strong three-dimensional silhouette; do not copy dragon, orb, arrangement, or emerald/gold palette. Create an original Naruto inspired emblem centered on a dramatic brushed-steel ninja forehead protector plate with the recognizable spiral leaf engraving, tied with deep indigo-violet fabric tails; a single polished dark steel kunai crosses behind it, and a luminous blue-violet chakra spiral curls around the plate. Add subtle rolled parchment edges and ink-brush motion at the base. The forehead protector and leaf engraving must be instantly legible at small button size. Asymmetric kinetic collectible sculpture, cool violet, indigo, electric cyan, pewter steel and parchment ivory, physically rich reflections. Generous transparent margins around silhouette. Real transparent alpha background, no black background, no cube frame, no rounded-square badge, no text, no characters, no watermark.

### 神龙透明版本

Use case: stylized-concept. Asset type: square RGBA theme selector artwork with REAL transparent alpha background, matching the supplied reference extremely closely. Input image is the primary visual reference. Render an emerald green Shenron dragon coiling in exactly this general circular composition around a glowing orange four-star Dragon Ball: golden deerlike horns, red eyes, fine emerald scales, gold belly and ribbons, sharp whiskers and claws, bright gold specular highlights. Preserve its premium dense hand-painted 3D anime collectible finish and character identity. Figure fills most of canvas but has modest transparent margin; all negative space around and inside the dragon coils must be genuinely transparent alpha 0. Do not paint any backdrop, especially no black square or checkerboard. No cube frame, no text, no logo, no watermark.
