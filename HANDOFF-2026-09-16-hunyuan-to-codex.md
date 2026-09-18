# HANDOFF-2026-09-16 · 混元 3D 基模精修与动效接入交付协议

## 一、交接背景与当前状态
1. **前序问题**：上一轮 Blender 纯代码布尔拼装模型因拓扑撕裂、几何多边形失真（锯齿兜帽、香肠手指、扁平宇航面罩）被否决。
2. **当前里程碑**：已通过腾讯混元生3D（Hunyuan 3D Pro）官方 API 生成高保真有机曲面基模并完成 2D 蓝图同屏核验。
   - 方案 A (荔小卫): `assets/mascots/hunyuan3d/scheme_a_hoodie/model_glb.glb` (33MB)
   - 方案 D (荔小星): `assets/mascots/hunyuan3d/scheme_d_astro/model_glb.glb` (36MB)
   - OBJ/MTL/高精贴图解压源: `assets/mascots/hunyuan3d/{scheme}/obj/`
3. **本次交接任务**：由 **Codex** 接手，将单一静态网格（Monolithic Mesh）升级为具备**分件材质、衣服印记（Decals）、表情系统（Shape Keys）与动画动作骨架（Rigging）**的工业交互级 GLB 模型，无缝对接前端 `mascot_studio.html`。

---

## 二、四大专项实施要求与工程规范

### 1. 衣服印记与细节拆件 (Insignia & Mesh Decoupling)
混元生成的模型目前为整张烘焙漫反射贴图，需在 Blender 中拆解部件并叠加高清印记：
- **方案 A · 荔小卫 (Hoodie)**:
  - **面部与兜帽分离**：将内部面庞 `Face` 与外部兜帽 `Hood_Shell` 分离为独立网格或材质槽，面庞赋予羊脂白玉 SSS（次表面散射），兜帽赋予织物/果壳 PBR。
  - **抽绳与手臂**：将胸前握绳手部分离，抽绳增加微凹导轨或独立管线，避免与胸口完全焊死。
  - **衣服口袋与标识印记**：在卫衣前胸与下摆增加清晰的贴花（Decal）或高精局部 UV（“LI” 品牌标、口袋压线）。
- **方案 D · 荔小星 (Astro)**:
  - **气泡面罩彻底解耦**：将外凸透明面罩 `Visor` 提取为独立单层网格，命名为 `Visor`。前端 Three.js 将自动赋予 `MeshPhysicalMaterial`（透射率 `transmission=1.0`, 折射率 `ior=1.08`, 粗糙度 `roughness=0.012`）。
  - **密封圈与机械螺栓**：提取 `Seal_Ring`（鲜艳橙色密封圈）与 8 颗六角螺栓，保留金属质感。
  - **高清印记（Decals）**：
    - 胸前控制盒：贴上高清晰度“橙色土星徽标（Saturn Insignia）”。
    - 宇航服双臂：左右肩臂章贴上高精“LI / 荔”红色矩形机能标。
    - 后背背包：双金属推进喷口 `Thruster.L/R` 分离，内凹发光芯槽保留。
  - **悬浮全息 HUD 环**：保留或挂载独立半透明环形网格 `HUD_Ring`，位于面罩外侧 0.05 处。

---

## 二、表情系统 (Expression & Lip Sync via Shape Keys)
前端 Three.js 已实现表情逻辑与音频口型驱动，模型需导出标准 **Morph Targets (Shape Keys)**：
在面部网格（`Face` 或整体网格的面部顶点组）中添加以下形变目标（形变量 0.0 ~ 1.0）：
1. `blink`：双眼皮下沉闭合（眨眼自然缓动）。
2. `smile`：嘴角向上微凹并拉宽，呈现治愈笑容（对应 `happy` 表情）。
3. `curious`：左眼微微睁大、右眼略抬，配合头部微倾（对应 `curious` 表情）。
4. `shy`：眼睛轻度下垂并伴随脸颊微红（对应 `shy` 表情）。
5. `mouth_open`：上下嘴唇开合（**核心**：由前端麦克风音量与语音 TTS 振幅 `audio` 实时线性驱动，振幅越大嘴巴张得越大）。

> **规范**：导出 GLB 时勾选 `Include -> Shape Keys`，顶点数保持严格一致。

---

## 三、骨骼绑定与动作模组 (Armature & Actions)
为适配前端 `js/mascot/blender-lychee.js` 的动态交互，建立轻量直观的骨骼架构：

### A. 骨骼命名体系 (Hierarchy)
```text
Root
└── Spine
    ├── Body (躯干 / 太空服)
    │   ├── Clavicle.L ── UpperArm.L ── LowerArm.L ── Hand.L (握绳/挥手)
    │   ├── Clavicle.R ── UpperArm.R ── LowerArm.R ── Hand.R (敬礼/操作)
    │   ├── Thigh.L ── Calf.L ── Foot.L
    │   └── Thigh.R ── Calf.R ── Foot.R
    └── Head (头部)
        ├── Eye.L / Eye.R (或者通过 Shape Keys 驱动)
        └── Leaf_Antenna (顶端果梗与叶片微动)
```

### B. 动作模组覆盖 (Action Modes)
前端支持以下两种驱动机制（二选一均可，优先推荐模式 1）：
- **模式 1 (代码实时骨骼解算，高交互性)**：
  - 骨骼保留在导出的 GLB 节点树中；
  - 前端 `blender-lychee.js` 直接通过四元数与欧拉角插值驱动 `Head`（点头/摇头/好奇歪头）、`Hand.L`（挥手）、`Hand.R`（敬礼）、`Root`（呼吸闲置与音乐低音律动跳跃）。
- **模式 2 (烘焙 NLA 动画片段，兼顾离线表现)**：
  - 在 Blender 内制作并导出以下 Action 片段：
    - `idle`：0~3秒循环自然呼吸与轻微浮动。
    - `wave`：左手抬起左右挥动 2 次。
    - `salute`：右手抬至头盔眉梢行宇航敬礼。
    - `retract`：果壳收缩/头部微缩保护形态。

---

## 四、交付文件落盘与验收标准

### A. 交付文件路径
完成精修与绑定后的 GLB 文件，覆盖写入现有前端加载路径：
- 方案 A: `assets/mascots/blender/hoodie-lychee.glb`
- 方案 B: `assets/mascots/blender/astro-lychee.glb`
- 对应的工程源文件保存在: `assets/mascots/blender/li-mascots.blend`

### B. 验收核验流程
1. **形态验收**：打开 `http://127.0.0.1:8000/hunyuan_review.html`，确认新模型在保持混元 3D 饱满有机曲面的同时，印记与透明面罩分件清晰锐利。
2. **交互验收**：打开 `http://127.0.0.1:8000/mascot_studio.html`：
   - 点击外观 CMF：材质贴图与颜色正常切换。
   - 点击动作（挥挥手、向你敬礼、缩进果壳）：骨骼正常驱动，无撕裂拉扯穿模。
   - 点击表情（开心、好奇、害羞）：Shape Keys 正常平滑过渡。
   - 播放音乐与开启麦克风：伙伴随音乐律动起伏，嘴唇随语音波动开合。
