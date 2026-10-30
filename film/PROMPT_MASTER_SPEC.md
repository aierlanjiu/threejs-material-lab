# 『 律 LÜ 』乐队模式 · 项目专属提示词母版（Prompt Master Spec v2.0）

本文件结合 `/Users/papazed/dev/threejs-material-lab` 项目的真实代码架构（Three.js 物理材质舞台、双美学主题、三套 IP 乐手精灵、直接角色触控交互、实时空间声相引擎与烟火光翼系统），将提示词重构为三套可直接复用的版本：

1. **【版本 A】30 秒商业动态短片（Motion Film Director Prompt）** —— 适用于端到端生成/渲染产品宣传片（含精确到秒的四幕分镜、运镜、物理交互与 EBU R128 音频母带规范）。
2. **【版本 B】AI 视频生成模型专用（Sora / Veo / Runway / Kling 精炼长镜头提示词）** —— 适用于文生视频/图生视频大模型。
3. **【版本 C】代码与交互实现 Agent 指令（Coding Agent Prompt）** —— 适用于驱动代码 Agent 维护或扩展 Three.js 舞台与触控声学交互。

---

## 【版本 A】30 秒商业动态短片导演提示词（Motion Film Director Prompt）

```markdown
# Role & Objective
你是一位兼具 Apple 级工业设计审美、Teenage Engineering 精密声学玩具质感与 Three.js 物理渲染功底的商业短片导演兼全栈视效工程师。
请为 WebGL 3D 交互式音乐沙盘项目 **『 律 LÜ 』· 乐队模式（Band Mode）** 制作并渲染一部 **30.000 秒（1920×1080 @ 30fps，严格 900 帧）** 的旗舰级产品宣传短片 `video.mp4`。

# 1. 项目核心特征与真实资产绑定（Project DNA）
1. **双舞台美学（Dual Festival Stages，`js/ui/band-festival-stage.js`）**
   - **『奶油棱镜』（Cream Prism，默认白昼/晨曦）**：四级波浪圆弧环形剧场阶梯（暖白磨砂面 `#FAF6EE` + 青碧玉玻璃立面 `#2D9A8C` + 阶梯下沿青色呼吸灯带 `#8FE8DE`），后方耸立对称黄铜弧形玻璃幕墙与悬垂珍珠球灯，周围环绕碧玉海湾（`#4AAFA4`）与重峦叠嶂的晨光远山（`assets/band-festival/cream.jpg`）。
   - **『日落海岛』（Sunset Island，黄昏/盛典）**：暖柚木甲板阶梯（`#C89B62`）与浅海金沙环礁（`#D7B47A`），两侧扬起双桅奶油白巨型三角风帆与木质桅杆，背景为赤金晚霞、落日烈阳与海岛剪影（`assets/band-festival/island.jpg`）。
   - **两侧微缩景观翼台**：左右对称配置迎客松盆景、青蓝珊瑚礁、暖光露营提灯、落地监听音箱与前缘返听音箱。
2. **三大动漫天团与 4 帧手绘乐手精灵（`js/avatar/instrument-manifest.js` & `assets/band-pets/`）**
   - 支持 **海贼王（10人）**、**龙珠（10人）**、**火影忍者（9人）** 三套阵容。短片主视角采用海贼王 10 人乐团（1024×320 WebP 精灵表，单帧 256×320）：
     - 前排（Tier 0）：山治（海蓝爵士鼓 `#709cac`）、索隆（三弦脊贝斯 `#748e65`）、路飞（草帽麦克风 `#db775d`）、娜美（航海手风琴 `#d5a15c`）、乔巴（鹿角木琴 `#d18a9e`）。
     - 后排（Tier 1/2）：罗宾（花瓣竖琴 `#9a7aa9`）、乌索普（弹弓吉他 `#b58b62`）、艾斯（焰红萨克斯 `#d77953`）、罗（刻度电子键盘 `#638f91`）、香克斯（酒红大提琴 `#af6971`）。
   - **4 帧驱动法则**：Frame 0 为休止/呼吸待机，Frame 1 & 2 为 120 BPM 律动交替演奏，Frame 3 为重拍高潮（Accent Pose），脚下实时渲染乐器代表色声波光环与甲板倒影。
3. **无面板「角色直触」三大核心交互（`js/ui/band-member-interactions.js`）**
   - 摒弃繁琐调音台面板，100% 依靠角色透明命中层直接操控：
     - **点按（Tap）→ 休止/归队**：角色声部立即静默、身体下沉半透、弹出「休止 4小节」胶囊倒计时，到期自动量化归队。
     - **长按 350ms（Hold）→ 临时独奏锁定（Solo）**：全场环境光压暗，95 lux 体积聚光灯柱垂直锁定该角色，其余声部退居背景（-12dB），松手即恢复合奏。
     - **拖拽 >10px（Drag & Drop）→ 实时空间声相与远近场重混音（`js/audio/band-stage-layout.js`）**：拖动角色跨越舞台 X/Z 坐标时，实时驱动 Web Audio 等功率声相（`X / 9.2 -> Pan [-0.85, +0.85]`）与纵深远近场滤波（后排 `Z < 4` 自动切入 `3.2kHz LPF` 温润远场，前排 `Z > 6` 自动切入 `+3.5dB High-Shelf` 清脆近场），松手触发二阶欠阻尼弹簧落地与四重同心圆冲击波。
4. **高潮视觉奇观（Climax Visuals）**
   - **流光能量光翼（`js/ui/band-energy-wings.js`）**：副歌开启时，前排乐手背后展开 6 羽对称三次贝塞尔流光粒子光翼（青白高光核心 + 呼吸摆动）。
   - **前缘八联喷泉与高空双联礼花（`js/ui/band-fountains.js`）**：沿舞台前缘弧线排布 8 座冷烟火喷泉（按中心向外错峰喷发，遵循白炽→暖金→赤铜→余烬物理冷却曲线），配合高空 2 枚斐波那契球形垂柳礼花升空炸裂。

# 2. 四幕式 30 秒分镜脚本（120 BPM · 0.50s/拍 · 2.00s/小节）

- **Act 1 · 晨曦微距与一指唤醒（0.0s – 6.0s | Frames 0–179）**
  - `0.0s – 0.5s`：镜头特写『奶油棱镜』右翼碧玉阶梯与乔巴（木琴）、艾斯（萨克斯）的静止姿态，画面中央悬浮磨砂暗金胶囊「▶ 唤醒剧场」。
  - `0.50s`：白色触控光标精准点按胶囊，金色声波涟漪扩散，清脆木琴与竖琴泛音率先响起；10 位乐手由前向后依次唤醒律动，镜头平滑拉出（Dolly Out）展现整座海上环形剧场全景。
- **Act 2 · 指尖即指挥棒：休止、独奏与空间拖拽（6.0s – 14.0s | Frames 180–419）**
  - `6.0s – 7.4s`（点按休止）：镜头微推左翼，光标轻点山治（海蓝爵士鼓），鼓组音频瞬间抽离，山治进入半透呼吸待机，头顶浮现 `山治 · 休止 4小节`。
  - `7.4s – 9.5s`（长按独奏）：光标移至索隆（三弦脊贝斯）并长按锁定，全场压暗，一道 95 lux 香槟色体积聚光束从天而降笼罩索隆，头顶浮现 `索隆 · 三弦脊贝斯 | 独奏锁定 · 95 lux 聚光`，浑厚放克贝斯 Solo 贯穿全场。
  - `9.5s – 12.0s`（跨舞台空间拖拽）：光标按住位于左后方（`X = -4.5, Z = +1.2`）的主唱路飞，斜向跨越舞台拖拽至右前方（`X = +4.5, Z = +6.4`）。拖拽途中路飞悬浮抬升 `+0.32`、身体随惯性微倾，头顶 HUD 实时跳动：`空间声相 Pan -0.85 → +0.85 · 抬升 +0.24` 及 `LPF 3.2kHz 远场深处 → Hi-Shelf +3.5dB 近场通透`，人声主旋律在左右声道与远近场之间丝滑游走。
  - `12.0s – 14.0s`（弹簧落地与鼓组归队）：松手瞬间路飞以二阶欠阻尼弹簧曲线落定甲板，脚下炸开四重金色同心圆声波；山治 4 小节休止期满，爵士鼓组踩准重拍满血归队。
- **Act 3 · 双舞台昼夜幻变与焰火光翼盛典（14.0s – 23.0s | Frames 420–689）**
  - `14.00s – 14.55s`（550ms 双舞台幻变）：伴随过门军鼓滚奏与金光扫掠，舞台在 550ms 内从『奶油棱镜』丝滑叠化至『日落海岛』，双桅白帆扬起，10 位乐手由「圆弧阵型（Arc）」平滑走位重组为「三层阶梯阵型（Terrace）」。
  - `17.5s – 23.0s`（副歌爆发 · 光翼与礼花齐射）：17.5s 副歌重拍落下，路飞、索隆、娜美、艾斯、香克斯背后同时展开泰瑞尔式青白流光能量光翼；舞台前缘 8 座喷泉冷烟火由内向外依次喷涌至 4 米高空，17.65s 与 18.25s 左右两枚高空彗星礼花弹呼啸升空，炸开漫天金色垂柳星雨并与海面倒影交相辉映。
- **Act 4 · 桌面音乐沙盘终局揭示与品牌定格（23.0s – 30.0s | Frames 690–899）**
  - `23.0s – 26.5s`（沙盘拉远揭示）：镜头缓步拉远（Pull-back Reveal），展现整座日落海岛剧场坐落于深空灰阳极氧化铝机身与香槟金 64 刻度精密表圈环绕的「桌面声学沙盘」之中，左上与右上浮现硬件遥测铭牌：`『律』LÜ · 桌面音乐沙盘 | DESKTOP ACOUSTIC SANDBOX` 与 `120.0 BPM · 48kHz STEREO | PANORAMIC SPATIAL ENGINE`。
  - `26.5s – 30.0s`（余韵定格）：伴随香克斯酒红大提琴与罗宾花瓣竖琴的温暖尾奏，画面上方浮现核心发光立方体徽章（`assets/lu-core-emblem.png`）与磨砂黑金品牌卡：
    - 主标题：**『 律 』 · 乐队模式**
    - 副标题：**把一整座海上音乐节，装进你的桌面沙盘**

# 3. 交付物硬性技术指标
- **输出路径**：`/Users/papazed/dev/threejs-material-lab/video.mp4`
- **视频规格**：`1920×1080`，`30.00 fps`，严格 `900 帧`（`30.0000 秒`），`H.264 (libx264, CRF 16, yuv420p)`，严禁出现黑帧、绿屏、UI 遮挡残影或字体裁切。
- **音频规格**：`48kHz Stereo AAC`，实测综合响度 **-14.0 ± 0.5 LUFS**，真峰值 **≤ -1.0 dBTP**，画面动作与声学变化（休止、Solo 压暗、声相拖拽、烟火齐射）必须达到帧级同步。
```

---

## 【版本 B】AI 视频生成模型专用提示词（Sora / Veo / Runway 中英双语版）

如果你需要将提示词直接粘贴到 **OpenAI Sora、Google Veo、Runway Gen-3 或可灵（Kling）** 等视频生成工具中生成概念视觉短片，请直接使用以下高密度视觉描述：

### 中文版（适用于可灵 Kling / 即梦 / 智谱清影）

> **提示词**：  
> 一部极具 Apple 与 Teenage Engineering 精密工业美学质感的 3D 交互式桌面音乐沙盘商业短片。画面中央是一座悬浮于碧玉海湾之上的四层波浪形奶油白与青玉玻璃环形剧场舞台，后方耸立着黄铜弧形玻璃幕墙与悬垂珍珠球灯，远方是晨光薄雾笼罩的群山。舞台上站立着 10 位 2.5D 手绘动漫乐手（主唱、贝斯、爵士鼓、手风琴、木琴、竖琴、吉他、萨克斯、电子琴、大提琴），每位乐手脚下环绕着随 120 BPM 音乐律动扩散的彩色声波光环。  
> 镜头从右侧阶梯微距特写平滑拉出至全景；随后一枚半透明触控光标轻点左侧鼓手使其安静休止，接着长按前排绿发贝斯手，全场灯光瞬间压暗，一束 95 lux 暖金色体积聚光灯垂直照亮贝斯手独奏；随后光标按住中央红衣草帽主唱，从左后方斜向拖拽至右前方，主唱悬浮微倾，脚下泛起空间声相轨迹并在落地瞬间炸开四重金色同心圆涟漪。  
> 紧接着舞台在金光扫掠中瞬时幻变为黄昏日落海岛剧场——柚木甲板、浅海金沙环礁与两侧高耸的双桅白色帆船，漫天晚霞倒映海面；高潮瞬间，乐手背后展开青白流光粒子羽翼，舞台前缘八座冷烟火喷泉与高空双联金色垂柳礼花同时升空绽放。最后镜头缓缓拉远，揭示整座海上音乐节坐落在一台深空灰阳极氧化铝与香槟金 64 刻度表圈环绕的桌面音乐沙盘中，浮现发光立方体徽章与「『 律 』· 乐队模式 —— 把一整座海上音乐节，装进你的桌面沙盘」字样。电影级 ACES Filmic 色调映射，微距浅景深，PBR 物理玻璃折射与柔和全局光照，4K 60fps 质感。

### 英文版（适用于 Sora / Google Veo / Runway Gen-3）

> **Prompt**:  
> A flagship commercial product film for "LÜ · Band Mode", blending Apple industrial design with Teenage Engineering tactile acoustic hardware aesthetics. In the center of an emerald-turquoise lagoon floats a four-tiered wavy amphitheatre concert stage crafted from warm cream matte stone (`#FAF6EE`), translucent jade-teal glass risers (`#2D9A8C`), and glowing cyan under-step LED strips, backed by symmetrical curved brass-and-glass screens with suspended pearl globe lanterns against misty golden-hour mountains. Ten charming 2.5D hand-drawn anime band musicians (vocals, bass, drums, accordion, marimba, harp, guitar, saxophone, synth, cello) perform at 120 BPM on the tiers, each surrounded by pulsing colored acoustic foot-rings and floor reflections.  
> **Camera & Action**: Starting from a macro close-up on the right jade steps, a tactile cursor taps to awaken the ensemble as the camera dollies out. Next, the cursor taps the left-wing drummer to mute him into a dimmed resting state, then long-presses the front-left bassist—dimming the stage and locking a dramatic 95-lux volumetric champagne spotlight beam onto his bass solo. The cursor then grabs the straw-hat lead vocalist from the back-left tier and drags him diagonally to the front-right deck; he levitates with a subtle inertia tilt and lands with a spring bounce that radiates four concentric golden shockwaves.  
> **Climax & Reveal**: In a 550ms golden horizon sweep, the entire stage morphs into "Sunset Island"—a warm teakwood deck on a golden sandbar flanked by twin towering white sailboat hulls against a blazing sunset sky. As the chorus drops, luminous cyan-white Tyrael-style energy wings unfurl behind the frontline musicians, while eight front-rim pyrotechnic spark fountains and two high-altitude spherical golden willow fireworks erupt in unison. Finally, the camera pulls back to reveal the entire island festival housed inside a dark anodized-aluminum desktop acoustic sandbox ringed by 64 champagne-gold telemetry ticks, closing on a glowing amber crystal cube emblem and the title "『 律 』 · 乐队模式". Cinematic ACES Filmic tone mapping, PBR glass transmission, shallow depth of field, 1080p 30fps.

---

## 【版本 C】代码与交互实现 Agent 专用提示词（Coding Agent Prompt）

当你需要让代码 Agent 在本仓库中修改或扩展『律』乐队模式时，可直接使用以下零歧义工程提示词：

```markdown
请在 `/Users/papazed/dev/threejs-material-lab` 仓库中维护或扩展 **『 律 LÜ 』乐队模式（Band Mode）**。请严格遵守以下架构契约与视觉/声学规范：

1. **核心模块职责边界**：
   - `js/ui/band-scene.js`：主 Three.js 场景调度器（固定舞台机位 `FOV 30°`, `camPos = (0, 23.08, 42.11)`, `target = (0, 4.30, -0.06)`, `viewOffset Y = +33px`），负责 10 位乐手 Billboard 精灵面片、脚下双层声波环、水面涟漪及拖拽弹簧物理（刚度 `k=180`，阻尼 `c=18`）。
   - `js/ui/band-festival-stage.js`：负责『奶油棱镜』（`cream`）与『日落海岛』（`island`）双舞台的 PBR 几何构建、镜像天空背景 Shader（`uSpan = 0.60` 无缝镜像折叠）、水面渐变 Shader 与微缩盆景/珊瑚/音箱道具。
   - `js/ui/band-member-interactions.js`：无常驻面板的透明 `<button>` 命中层（最小 `44×44px`），严格区分三种手势：**短按抬起（Toggle 休止 4 小节）**、**按住 350ms（临时 Solo 聚光）**、**移动 >10px（取消 Solo 并启动跨舞台 X/Z 拖拽）**。
   - `js/audio/band-stage-layout.js`：负责将乐手的 3D 舞台坐标 `(x, y, z)` 实时映射为声学参数：
     - `stereoPan = clamp(x / 9.2, -0.85, +0.85)`
     - `depthRatio = clamp((8 - z) / 10, 0, 1)`（控制远近场 LPF / High-Shelf EQ 与干湿混响比）
     - `presenceDb = clamp((y - 0.35) * 1.6, 0, 2.4)`（高阶梯高频空气感补偿）
   - `js/ui/band-energy-wings.js` & `js/ui/band-fountains.js`：负责高潮段（Chorus）的 6 羽三次贝塞尔流光粒子光翼、前缘 8 座冷烟火喷泉及高空 2 枚斐波那契球形礼花。

2. **性能与渲染铁律**：
   - 保持 `SRGBColorSpace` 与 `ACESFilmicToneMapping`，`pixelRatio <= 2`。
   - 严禁在 `requestAnimationFrame` 循环中新建 `Material`、`Geometry` 或 `Texture`；舞台切换（`rebuild`）时必须完整释放旧 GPU 资源。
   - 所有沙盒/无头离线渲染脚本（`film/render_film_standalone.py`）不得依赖外网 CDN，确保 100% 本地资产闭环可复现。
```
