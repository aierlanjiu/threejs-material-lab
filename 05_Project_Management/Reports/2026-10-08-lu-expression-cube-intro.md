# 『律』表情魔方入场与律核接续

Agent: codex · 2026-10-08，视觉修订 2026-10-09

## 工作概述

- 页面打开时只突出一颗由 27 个小 cube 组成的 3×3×3 表情魔方。正面沿用当前角色，其余五面从现有 29 位角色中随机抽取，每个小面随机使用已有的平静、开心、眨眼、好奇、惊讶、困倦表情。大标题和多余说明已从视觉层移除，保留简短点击提示、音效图标和跳过入口。
- 小 cube 外壳直接克隆主舞台的圆角几何，使用当前舞台材质族，表情作为独立物理贴面。最终入场底图按用户修订改为黑色烟熏玻璃空间，手机和桌面分别生成竖屏与超宽屏版本；中心保留给实时 3D 魔方，侧面玻璃和地面构成可见透视。文字、音效按钮与跳过入口使用低噪音的暖浅色系。
- 魔方根部的缓慢旋转、逐层归位和归位高光同时驱动 WebGL 两侧暖光、背景中心光晕与地面反射的位置和强弱，使中心魔方与生成背景拥有统一的光源方向和互动节奏。
- 以八次合法分层旋转生成打乱状态；点击后沿逆序逐层归位。归位瞬间中心亮度抬升，两片烟晶画布从中心向两侧展开；26 个小 cube 带旋转向当前舞台 cube 位姿扩散，中心 cube 留在中央。随后舞台原有歌词、海报、运镜与音乐编排继续使用原来的渲染路径。
- 参考用户提供图像的烟晶玻璃与琥珀内发光质感，重新设计左右轴对称的律核标记。内部改用律自己的 3×3 魔方格面和声波曲线，替换主界面角标、顶部律核接续前和 WebGL 不可用时的单字“律”占位。
- 入场画布在结束时直接移入顶部状态胶囊，成为常驻迷你魔方律核。四面工作台切换时迷你魔方转向相应面；创作面提供重播与入场音效开关。
- 使用独立 Web Audio 音效呈现唤醒、转层、卡扣、归位和展开，音量较低且可持久静音；音效不连接录制音频分析器。首次访问的自动播放限制下，音效从用户点击魔方开始。

## 关键文件

- `js/ui/lu-cube-intro.js`：合法打乱与复原、表情贴图、展开、音效、重播、减少动效及键盘路径。
- `css/lu-cube-intro.css`：烟晶背景、动态光晕与地面反射、中心展开的画布、迷你律核和手机适配。
- `assets/backgrounds/lu-intro-smoke-portrait.png`、`assets/backgrounds/lu-intro-smoke-desktop.png`：用内置 imagegen 生成并保存在仓库的手机与桌面背景。
- `assets/lu-core-emblem.svg`：烟晶外壳、3×3 魔方格面与琥珀声波组成的对称矢量标记。
- `index.html`：单入口工作台的迷你魔方、创作面重播与音效控件、入场层和初始化。
- `test/lu/core-intro.test.js`：入场复原、真实音效节点、同一画布接续、重播/跳过及减少动效回归。其他 `test/lu/` 回归以 `?intro=skip` 直接进入原有工作台，入场由专门测试覆盖。

## 验证与边界

- 手机与桌面实景确认打乱表情魔方、圆角晶体外壳、归位、中心画布展开与小 cube 散开，最后接入当前海报/方阵及迷你律核。手机转场中段另行截图检查，确认舞台从中心露出，散开的 cube 仍覆盖其上。
- 烟晶入场画面与小尺寸律核标记已在浏览器实景检查；转场中段可见新标记接替原单字占位，画布展开后海报与方阵继续显示。
- 1440、390、342px 工作台布局和沉浸模式回归通过；机械魔方与关闭歌词模式的 FOV、镜头和表情回归通过。
- 入场专项浏览器回归覆盖 1440px、390px、减少动效、合法打乱复原、材质与几何复用、音效节点、同一画布接续、重播与中途跳过。
- 真实录制输出 1080×1920 与 1920×1080 MP4，视频尺寸、时长和歌词合成检查通过；入场层与迷你魔方不进入成片。
- 浏览器无头软件渲染比实景明显慢；实体手机的 GPU 帧率和音效触感仍需设备验证。

## 视觉依据

- 参考 Apple 的 [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) 与 [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) 中关于层次与空间连续性的原则，仅借鉴克制的界面密度和有意义的动效，不使用 Apple 图形资产。
- 视觉材质、海贼王对决海报、表情角色与律核功能仍来自本项目既有资产和设计语言。

## 背景生成提示词

工具：内置 `imagegen`。参考图仅用于描述烟晶玻璃和琥珀内发光的材质方向，生成图不包含参考图的具体标记造型。

手机实际提示词：

```text
Use case: stylized-concept. Asset type: portrait 9:16 background plate for a music-driven interactive 3D cube entrance, no foreground object. Create a premium cinematic architectural environment made of very dark smoked optical glass and polished graphite, seen straight on with a deep central vanishing point. Several broad transparent glass planes and bevelled edges recede diagonally from the left and right into a quiet central void. Subtle warm amber light is trapped inside the glass and refracts along the edges, with faint 3-by-3 rhythmic modular reflections that suggest a Rubik cube and a music waveform without depicting either object. Near-black charcoal palette (#080b0e to #17191b), controlled golden highlights, rich contrast, realistic reflections, soft volumetric haze, visible perspective and layered depth. Keep the middle 45% of the frame dark, empty and uncluttered so a live rendered face-covered cube can be composited in front; darker lower third for a small caption. Full-bleed edge-to-edge wallpaper, highly art-directed, no border. Absolutely no cube, no logo, no letters, no text, no people, no character faces, no UI, no star field, no glitter, no generic neon gradient.
```

桌面实际提示词：

```text
Use case: stylized-concept. Asset type: ultra-wide 21:9 desktop background plate for the same music-driven interactive 3D cube entrance as a portrait counterpart. Create an ultra-dark smoked optical glass architectural void viewed straight on, with a deep central vanishing point. Broad translucent graphite glass fins, bevelled transparent panels and polished black floor recede from both left and right edges toward the center; the center 40% must be almost empty and dark to receive a live rendered Rubik cube. Controlled warm amber rays and faint internal caustics travel along side planes and floor, inspired by premium black smoked glass with amber internal illumination. Add extremely subtle repeated modular reflections suggesting a 3-by-3 cube grid and music rhythm, never a literal cube or waveform icon. Near-black charcoal and warm tungsten gold only, high-end photographic material realism, layered depth and perspective, detailed edge refraction, cinematic lighting, no visible horizon line across the central cube. Full bleed wide wallpaper. Absolutely no foreground object, no cube, no logo, no letters, no text, no people, no character faces, no UI, no stars, no generic neon gradient.
```
