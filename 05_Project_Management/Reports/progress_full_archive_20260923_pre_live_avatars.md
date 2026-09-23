# Project Progress

## 律 / LÜ · 2026-09-23 歌词精准同步与 120 块 3D 物理反重力沙盒对齐交付

- Action: 响应用户“1.歌词不同步需要修复 2.物理反重力下面的方块太少 且动作时不应该超出歌词展示方块所在位置 再研究下示例视频仔细对齐下效果”指令：
  1. **歌词时间轴与同步机制彻底重构**：
     - 查出原内置曲库多句合并、与真实伴奏存在 9~14 秒时间偏移的根因；
     - 提取网易云官方 Hi-Res 歌词时间轴，全面重构 `SONG_LYRICS_MAP`（《游京》、《秋意浓》、《烂泥》、《鬼》、《偏爱》、《海鸥》），拆解为单句独立触发，与人声演唱毫秒级吻合；
     - 预设视觉前置量调优为 `-120ms`，为人眼与耳膜提供完美的视听同步舒适区。
  2. **物理反重力沙盒重构与边界约束**：
     - **扩充方块数量至 120 块**：覆盖 12 种真实物理材质与 7 款色调，以 4 层阶梯致密堆积，形成丰富高端的宝石/实体积木槽；
     - **严格走廊约束（Corridor Alignment）**：深度对齐 `@aaayandev` 示例视频设计语言，将物理沙盒横向范围硬性锁定在 `|x| <= 4.15`（与上方歌词宽度完全一致）；
     - 限制升空磁吸与坠落落体轨迹（初速 $|v_x| \le 0.25$），方块垂直起落并砸回正下方槽内；
     - 左右边界增加刚体反弹碰撞（$e = 0.35$），严禁超出歌词展示区域；
     - 低音炮（Kick Drum）冲击波仅注入垂直冲量，在槽内原地共振跳跃，杜绝横向飞散。
- Validation: Playwright 自动化端到端测试全量通过（`node test/test_kinetic_lyrics_e2e.js`），0 Console Errors，歌词时钟推进各节点测试全部 PASS，实机高清截图验证边界与致密堆积。
- Agent: Antigravity · 2026-09-23

## 荔 / LI · 2026-09-18 Codex 竖屏宣传片

- Action: 按用户确认方向交付 25.2 秒、1080×1920 / 30 fps 独立剪辑：缩壳、探头、宇航员、材质快切、音乐摆动与体验二维码；成片位于 `output/edit/codex-20260918/li_codex_9x16.mp4`。另按新指令生成 Imagen 雪沐怪诞封面 `output/edit/codex-20260918/cover-imagen/li-xuemu-cover.png`，角色与文字已目检。
- Validation: 756 帧、完整解码通过、无检出黑帧；七处切点及字幕位置完成视觉检查，成片二维码识别通过。音轨峰值 -2.0 dB，削波样本 0。
- Report: [剪辑范围、产物与验证](Reports/2026-09-18-li-codex-promo.md)。原 AGY 成片、网页与模型保留，未提交或发布。
- Agent: codex · 2026-09-18

## 荔 / LI & 律 / LÜ · 2026-09-18 双旗舰开源发布与 GitHub Pages 上线交付

- Action: 响应用户“把荔开源到github pages上然后更新下我的github主页用荔这个ip和雪沐怪诞配图”指令：
  1. 完成『 荔 』(LI) 暖光藏品伴侣室在 GitHub Pages 上的全量发布部署（含 荔小卫、荔小星、24款工坊大师CMF、118BPM音乐共振舞蹈与雪沐怪诞手绘全套透明UI）；
  2. 排除超 100MB 的 Blender 工程源文件以契合 GitHub 推送限制，确保核心优化 Web 3D GLB 资产正常加载；
  3. 新增 `li.html` 快捷访问入口，打通『 律 』(LÜ) 与 『 荔 』(LI) 页面顶部的双向互通胶囊导航；
  4. 升级仓库根目录 `README.md` 为双旗舰开源主页架构；
  5. 在 GitHub 个人主页（`aierlanjiu/aierlanjiu`）上全面引入 荔 IP 形象与雪沐怪诞配图展陈大图。
- Validation: GitHub Pages 在线部署与主页渲染全链路走查。
- Agent: Antigravity · 2026-09-18

## 荔 / LI · 2026-09-17 叶片连接与小幅动作（codex）

- Action: 按最新范围固定小卫叶根接缝，为小星漂浮/助推加入镜头跟随，月球大跳按用户要求保留离屏与返回，并把双角色手臂统一改为小幅动作；保持原模型与纹理。
- Validation: 700 叶根顶点、20 组姿态接缝间隙为 0；小星五种普通动作保持可见，大跳允许离屏且已验证正常返回；双角色 5,880 帧手臂限幅检查通过。用户已确认小星不再消失。
- Report: [范围与实测](Reports/2026-09-17-li-leaf-visibility-small-gestures.md)；原先全身绑定与穿模修复按用户要求暂停。
- Agent: codex · 2026-09-17

## 荔 / LI · 2026-09-17 荔小星黑屏闪烁根治与双伙伴口腔/牙齿解剖学高精重塑交付

- Action: 响应用户“小星闪黑屏 小卫不闪”、“嘴巴有问题 目前页面还是闪烁黑屏”指令，进行全链路底层根因诊断与修复：
  - **1. 荔小星黑屏闪烁彻底根治（Black Screen Eradication）**：
    - **诊断根因**：
      1. `js/mascot/studio.js` 中 `EffectComposer` 渲染目标配置为 `samples: 4`；
      2. 荔小星（astro）在 `setMaterialVariant` 中，18 个外壳、宇航服、金属接头与靴子网格被错误赋予了 `transmission: 0.13`（透射）；
      3. 在 WebGL2 规范中，严禁从 4x MSAA 多重采样帧缓冲区通过 `gl.copyTexSubImage2D` 拷贝纹理。每帧 18 次非法拷贝导致 macOS ANGLE/Metal 底层报错并使帧缓冲区丢帧返黑；且 `UnrealBloomPass` 采样 4x MSAA 缓冲破坏采样器，而荔小卫仅有 3 个玉石网格未触发致命阈值；
    - **实施修复**：
      1. `studio.js`：将 `target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 })`，彻底消除 WebGL2 后处理渲染流水线的 MSAA 缓冲失效；
      2. `hunyuan-mascot.js`：在 `setMaterialVariant` 中明确限制宇航服材质为致密实体面料/工程构件，强制定向注入 `if (this.morphologyKey === 'astro') { mat.transmission = 0; mat.thickness = 0; }`，杜绝 18 次冗余抓帧开销与闪烁。
  - **2. 荔小星与荔小卫口腔、舌头与牙齿解剖学高精重塑（Mouth & Dental Restoration）**：
    - **诊断根因**：
      1. 荔小卫（hoodie）：`adoptMaterial` 中网格名正则将 `Mouth_Interior` 误并入 `Face_WarmJade` 白玉脸皮材质（`0xffffff` 纯白），导致口腔内腔呈白垩色空洞；
      2. 荔小星（astro）：Blender 最新导出资产 `astro-lychee.glb` 中剔除了 `Sphere.308`（口腔腔体）与 `Sphere.309`（舌苔），仅在 `Face001_1` 保留门牙与空开孔洞，且 UV 对应白边，导致用户视线中呈现出白色獠牙悬空于无底洞的惊悚视效；
    - **实施修复**：
      1. 荔小卫：在 `adoptMaterial` 与 `setMaterialVariant` 中独立分拣 `Mouth_Interior`，赋予 `MeshPhysicalMaterial` 真实温润樱桃果肉色（`#380e14`、粗糙度 0.45、清漆 0.2），受 CMF 切换白名单保护不被覆盖；
      2. 荔小星：在 `HunyuanMascot` 构造器中挂载程序化高精口腔装配体 `Astro_Mouth_Assembly`（父级锁定 `astro.bones.Head`，局部坐标 `[0, 0.524, 0.965]`），包含深樱桃红口腔底（`#380e14`）与微翘浅珊瑚粉小舌头（`#e05a67`）；门牙自然贴合于樱桃腔体与舌苔之上，100% 还原原画徽标 `badge_astro.png` 软萌微笑面容；并在 `update()` 中随 `morphValues.mouth_open` 呼吸与语音同步舒缩。
- Validation: Chrome DevTools MCP（Page 14）实机全量走查通过：
  - 荔小星黑屏闪烁 100% 消失，连续运行 51 FPS 零丢帧；
  - 荔小卫与荔小星两款角色在 6 种 CMF 配方（果壳白玉、暖绒灯芯、朱砂凝玉、全息钛银、光学水晶、曜石黑金）及全部动作（失重漂浮、背包助推、宇航敬礼、月面翻滚、月球大跳）下走查无任何黑屏与穿模；
  - 控制台 WebGL 报错 0；口腔内壁与舌苔在任何材质与动作下均保持樱桃红与珊瑚粉，视觉精致可爱。

## 荔 / LI · 2026-09-16 暖光藏品室与骨骼重绑（按用户要求暂停）

- Action: 用户选择方案 3 并批准直接实施；恢复点已验证，主题与绑定按同一交付范围推进。
- Validation: 修改前 Git 状态与物理快照已保存；不删除原资产。
- Report: [范围、备份与验收](Reports/2026-09-16-li-gallery-rigging.md)。
- Agent: codex · 2026-09-16

## 荔 / LI · 2026-09-16 页面比例重构、手绘按钮全域展陈与摄影棚艺术背景重塑交付

- Action: 响应用户“让codebuddy重新调整页面比例、让手绘按钮展示出来、背景可以在设计设计、现在的ui按钮交互等太小了看不清手绘细节”指令，实施系统性空间拓扑、手绘UI放大与艺术摄影棚背景重塑：
  - **1. 页面比例拓扑重构（Proportions）**：
    - 左侧工作台栏宽由 272px 扩至 `clamp(360px, 24vw, 410px)`，配合 3D 舞台与右侧手记形成 `380px : 1fr : 320px` 黄金三栏比例，消除局促感；
  - **2. 手绘按钮全域展陈体系（Stage Action Dock & Atelier Tabs）**：
    - **舞台手绘快选坞（.stage-action-dock）**：在 3D 舞台正下方常驻悬浮玻璃毛玻璃胶囊坞，动态装载 8 款手绘动作卡片（荔小卫常态、闭合锁果态、荔小星宇航态动态联动），配置 40px 高清手绘图标、怪诞表情微悬停旋转（`scale(1.22) rotate(-5deg)`）与点击弹性回弹（`dock-pulse`），用户视线不离舞台即可直接交互；
    - **工作台直达分段标签（.atelier-tabs）**：顶部新增 `全部展陈`、`形态材质`、`手绘姿态 ✦`、`音乐律动` 4 档分段控制器，点击 `手绘姿态 ✦` 即可零滚动直达完整版放大卡片与表情调节，兼顾全局浏览与专项操作；
  - **3. 摄影棚艺术背景深度重塑（Atelier Backdrop）**：
    - 引入工坊和纸米宣暖底（#f5f1ea）叠加 26px 精工微点阵透气肌理，营造工业草图台格调；
    - 新增模型脚底柔和高斯模糊展台椭圆（`.stage-pedestal`），牢牢托住 3D 伴侣，告别虚空悬浮；
    - 布置四角规矩十字靶标（`+`）与 `SPEC 1.0 · CMF & KINEMATICS ATELIER` 规格代码；
    - 优化鲜果枝条微风摆动（`li-sway-twig`）与星芒闪烁（`decor_stars.png`），配合 CMF 动态环境光晕。
  - **4. 全局 UI 交互尺寸翻倍升级（UI Scale-Up）**：
    - 侧边栏动作卡片（`.action-button`）由 36px 扩至 56px~64px，手绘图标（`.action-glyph`）扩至 40px~44px，笔触与墨线纤毫毕现；
    - 视角切换与摄影棚工具栏升级为 32px~40px 舒适大药丸；
    - 纸飞机发送按钮（44px / 28px 图标）与声音麦克风（42px / 26px 图标）全面放大。
- Validation: Chrome DevTools MCP（Page 17）实机全量走查通过：控制台 0 报错；渲染帧率稳定 52~60 FPS；快选坞点击即刻触发弹跳/挥手等 3D 动力学，形态切换与角色切换（荔小卫/荔小星）双向实时联动，走查截图存档至 `walkthrough.md`。

## 荔 / LI · 2026-09-16 3/4视角稳定锁止、音乐BPM律动舞蹈、钛银/朱砂质感重塑与面部腮红零瑕疵保护交付

- Action: 响应用户“怎么一直在转圈3/4视角、音乐律动有吗、钛银及朱砂质地色泽不好、脸部和帽檐瑕疵包括腮红变成猴屁股”的系统性质感与动效问题，进行全链路重构交付：
  - **1. 视角常态转圈根治（Camera Spin Fix）**：
    - 诊断根因：`CameraDirector` 轨道漫游增益过大（`driftGain: [0.32, 0.14]` 达 26° 剧烈晃动）且在视角切换重置时持续累加已漂移的 yaw 偏角；
    - 重构修复：将漫游增益大幅平滑收敛为 `[0.012, 0.006]`（< 1° 微呼吸感）；新增 `anchorView(direction)` 锁定基准方位角；在 `fitCamera`、预设视角切换与用户拖拽释放时强制刷新锚点，实现 3/4 视角稳定锁止，拖动旋转后自然驻留。
  - **2. 音乐节拍与角色步频全链路律动（Music Rhythm & Dance）**：
    - 打通 `rhythm-engine.js` 与 `hunyuan-mascot.js` 的节拍数据管道（返回 `audioReady` 与 `beatPeriod`）；
    - 在角色骨架枢轴（`this.pivot`）注入音乐动力学：依据实时 118 BPM 节拍实施体积守恒的 Squash & Stretch 弹跳律动（`scale.y` 动态展开至 1.073），结合低频重音触发叶片次级惯性抖动与身体微幅节拍律动，使角色生动摇摆起舞。
  - **3. 面部肤感与天然腮红零瑕疵保护（Face & Cheek Blush Shield）**：
    - 发现关键陷阱：HTML5 2D Canvas `putImageData` 会自动执行预乘 Alpha（若 Alpha=0 则 RGB 被直接抹零为 0），导致原先将蒙版塞入贴图 Alpha 通道时造成身体大面积黑死；
    - 架构创新：独立构建专用 1024×1024 面部保护蒙版贴图 `getFaceMaskTexture`（Alpha 恒定 255 杜绝预乘抹零）；
    - 物理材质降维：通过 `uFaceMaskMap` 在 WebGL Fragment Shader 中实施面部保护，将面部法线无缝混合至几何原生法线（`nonPerturbedNormal`），面部金属度强制归零，粗糙度锁定温润 0.42，彻底消除金属镜面与漆面刻槽对脸蛋的刮花；
    - 帽檐与腮红边界平滑过渡：基于红绿比 `redRatio = Math.min(r0/max(1,g0), r0/max(1,b0))` 在 1.75~2.25 区间进行 `smoothstep` 柔和插值过渡，100% 忠实保留原生原画级手绘婴儿粉嫩腮红，彻底根除“猴屁股”色斑，帽檐无任何锯齿光晕毛刺。
  - **4. 钛银与朱砂奢华 CMF 质感重塑**：
    - **朱砂凝玉（故宫剔红雕漆）**：法线坡度由 8.0 柔化为 2.8，纹理平铺精细化至 [2.5, 2.5]，重构浅浮雕云纹，调色映射为故宫朱砂红（暗部 `#6e0f14`、中间调 `#c91b22`、高光 `#f53b42`），在清漆中融入 24K 金箔微粒，晶莹剔透；
    - **全息钛银（航天缎面钛银）**：法线坡度调优为 1.8，赋予航天级细密缎面拉丝与微量 PVD 物理薄膜干涉彩虹光泽，色调采用高明度雪青银（暗部 `#8695a5`、中间调 `#c8d4df`、高光 `#f8fbfe`），质感冷冽高级且充满科技未来感。
- Validation: Chrome DevTools MCP（Page 17）实机全量走查：控制台 0 错误（`console messages: 0`）；帧率稳定在 48~55 FPS；3/4 视角漂移角锁定在 0.99° 呼吸区间；音乐播放状态下 118 BPM 弹性伸缩稳定跳动；全色系切换（故宫剔红、霁蓝剔彩、原色钛银等）与日常/闭合形态切换均无缝平滑，面部肤质细腻白皙、腮红柔美清澈。

- Action: 响应用户“用xuemu怪诞风free imagen设计背景透明方便剪裁的素材优化UI界面，替换emoji入口/发送按钮/背景点缀，交由codebuddy deepseek 4.1 flash优化界面UI/配色系统/FOV视角律动/肢体动作系统，联动Blender MCP/Codex代码与律项目律动编排”的综合指令：
  - **雪沐怪诞手绘透明UI资产生成与裁切管线**：
    - 基于已登录真实 Chrome CDP 调度 DALL-E / Free-Imagen 批量生成雪沐怪诞线稿图集；
    - 编写 `scripts/process_transparent_icons.py` 自动化切图与泛洪去底流水线，提取 18 张高保真 RGBA 透明 PNG 资产；
    - 研发二阶低 Alpha 噪点清洗算法（`<15` 阈值截断与 RGB 归零），消除柔边羽化带来的宣纸半透方框，实现真正的边缘洁净画布悬浮；
    - **12款动作字形（.action-glyph）**：彻底取缔 DOM 原生 Emoji（🌰/✨/👋/👍/🎈/😳/💤/🎵/🪐/🚀/🫡），替换为定制手绘图标（`action_lock_fruit`, `action_bounce`, `action_wave`, `action_nod`, `action_shake`, `action_shy`, `action_sleepy`, `action_groove`, `action_pop_out`, `action_astro_float`, `action_astro_boost`, `action_astro_salute`）；
    - **3款手绘交互按钮**：纸飞机发送图标（`btn_send.png`）、荔枝手绘对话框切换态（`btn_chat.png`）、手绘复古涟漪麦克风（`btn_mic.png`）；
    - **3款舞台手绘氛围点缀**：拟物直角取景框（`decor_corner.png`）、萌感手绘星星组（`decor_stars.png`）、植物系鲜荔枝果枝（`decor_branch.png`）。
  - **CodeBuddy DeepSeek 4.1 Flash 架构的 4 大核心驱动模块**：
    - `js/mascot/spring.js`：构建解析解（Analytical）质量-弹簧-阻尼动力学方程，支持动态刚度/阻尼系数，内置自适应多步时间子步进（Substepping）与轨迹追踪 `KinematicTrack`；
    - `js/mascot/camera-director.js`：移植『律』(LÜ) 级视听镜头导播系统，提供 `bass`、`dolly`、`sine`、`snap` 四种动态 FOV 模式，支持 Hitchcock 式变焦距离补偿 `framingScale()` 与 3 频不可通约轨道漫游漂移（0.09, 0.021, 0.05 rad/s）；
    - `js/mascot/theme-bus.js`：基于 OKLCH 宽色域感知色彩模型构建主题总线，内置 WCAG 对比度安全守卫（`ratio >= 3.0`），自动向 `:root` 广播 `--theme-accent`, `--theme-glow`, `--theme-wave`, `--theme-pulse` 等响应式变量，支持 24 款 CMF 配色全局联动；
    - `js/mascot/secondary-motion.js`：针对 Hunyuan3D 4K Pro 单一网格模型，研发 GPU 顶点着色器注入方案（`ShaderSpringBinding`），通过提取叶片 73,731 顶点并在顶点阶段注入弹性摆动偏移，实现免重构网格的次级叶片物理，并保留 Blender 多骨骼蒙皮（`BoneSpringBinding`）的无缝回退能力。
  - **交互工作台与样式深度整合**：
    - `mascot_studio.html` & `css/mascot-studio.css`：消除所有原生 Emoji 字符，引入 `.action-glyph`、`.theme-glow` 动态暗角辉光、`.stage-decor` 取景手绘构图，所有卡片激活高亮与波形线条全面响应 CMF 配色总线；
    - `js/mascot/hunyuan-mascot.js` & `js/mascot/studio.js`：打通动作触发时的次级物理冲激（`secondary.impulse()`），将音乐实时 FFT 频段联动注入 CameraDirector，实现伴随音乐的视角呼吸与角色步频共振。
- Validation: Chrome DevTools MCP（Page 15）在线联调与真机走查，控制台保持 0 错误（`consoleErrs: []`）；实时测算帧率稳定在 48~55 FPS；OKLCH 对比度守卫全量通过（对比度 $\ge 3.0$）；叶片次级物理顶点覆盖率达 24.8%（73,731 顶点）；音乐播放状态下 FOV 随低频节拍动态呼吸下潜至 25.8 度，完成整体验收。

## 荔 / LI · 2026-09-16 24款工坊大师配色矩阵、语义区域分色与影棚柔光重构交付

- Action: 响应用户“材质缺乏多样化配色单色缺乏设计感”与“整体照明过头晃眼”指令，全面重构色彩架构与影棚布光：
  - **24款工坊大师配色矩阵（24-Colorway Matrix）**：为 6 大 CMF 材质各定制 4 款设计师配色方案（共 24 组高定配方），杜绝单调单色：
    - *01 果壳白玉*：羊脂温白（#f6efe2）、龙泉粉青（#689d89）、胭脂粉玉（#c27287）、玄青墨玉（#2b3f3e）
    - *02 暖绒灯芯*：复古砖红（#b3452e）、松针墨绿（#2d5c3f）、芥末姜黄（#c4962d）、经典藏蓝（#274472）
    - *03 朱砂凝玉*：故宫剔红（#a81c22）、黛赭金漆（#8c5227）、霁蓝剔彩（#22488a）、玄黑描金（#1f1e21）
    - *04 全息钛银*：原色钛银（#adb5bd）、阳极电光蓝（#2a6cb8）、幻夜曜黑钛（#343a40）、香槟流金钛（#bfa77a）
    - *05 光学水晶*：极地冰蓝（#bdebf0）、琥珀蜜蜡（#f0c77a）、祖母绿晶（#7fd4b0）、幻紫水晶（#c4b0eb）
    - *06 曜石黑金*：帝王玄黑金（#1c1c1f）、雪花银曜（#2b3340）、青金古矿（#192b47）、赤焰火曜（#381619）
  - **4区语义分区保真算法（Semantic-Aware Zoning）**：彻底解决全局染色导致的五官污染与叶片失色问题。重构贴图重映射流水线，通过双色度差分与亮度直方图严格隔离 4 个语义区域：
    1. 眉眼与嘴部微表情（`lum < 0.12`）：锁死高反差原矿深黑与眼球高光；
    2. 面部与双手（`r0/g0/b0`）：永久锁死羊脂温白玉质感，无论身体换成何种浓烈色彩，脸部绝不串色发脏；
    3. 头顶植物叶片与果蒂（`greenDiff`）：针对不同衣身色相自动映射谐调植物系辅色（如暖红配焦糖秋叶、藏蓝配橙暖萌芽、原色配翡翠嫩绿）；
    4. 兜帽与身体躯干（`bodyWeight`）：承载完整的 24 款大师配色渐变与 24K 金箔微粒。
  - **彻底解决刺眼反光·高级专业影棚柔光系统**：
    - IBL 虚拟柔光箱光强自 26~34 大幅下调至 4.5~5.5，彻底消除强光溢出与死白反光；
    - 主光（Key Light）强度自 3.15 收敛至 1.25，补光收至 0.45，轮廓光收至 0.65；
    - 色调映射曝光（`toneMappingExposure`）降至 0.86，后处理 Bloom 阈值收紧至 1.80~2.10，抑制过载辉光；
    - 背景升级为摄影棚中性护眼色 `#e8e4dc`（漫反射暖灰白），配合地面柔和阴影，观感温润细腻、丝滑高级。
  - **交互 UI 联动与状态机更新**：在材质工坊左侧栏新增「工坊大师配色（#cmf-colorways）」胶囊标签栏，切换材质时自动联动更新对应配色彩色圆点与名称，支持实时点击切换、微动效悬停反馈与 `localStorage` 本地状态记忆。
- Validation: Chrome DevTools（Page 15）在线多轮实机走查，控制台保持 0 报错，渲染帧率稳定于 48~55 FPS；全量截屏留存多材质不同配色的实机渲染对比，验证了分区的纯净度与光影的高级舒适度。

## 荔 / LI · 2026-09-16 CodeBuddy DeepSeek 4.1 Flash 材质图形学重构与摄影棚布光交付

- Action: 调用 CodeBuddy `deepseek-v4.1-flash` 进行全链路图形学深度诊断与配方架构，定位并解决原有材质发灰、塑料感重、贴图颜色压死、五官 AO 丢失等核心痛点。
- Action: 重写贴图处理内核，落地 `buildGradedAlbedo(source, spec)` 双色调亮度重映射算法，100% 保留混元原生 4K 贴图的眼睛、面部表情与 AO 骨架；金箔微粒（24K Flecks）通过双频噪声精准限制在中间调漆体，避开眼珠与暗部。
- Action: 构建确定性无缝程序化微表面生成器 `SURFACES`（`jadeRind`, `corduroy`, `cinnabar`, `titanium`, `obsidian`），2 像素中心差分无缝烘焙法线贴图与粗糙/金属/AO（ORM）复合通道贴图。
- Action: 材质物理解算器全量接入高级 PBR 特性：清漆浮雕联动 (`clearcoatFollowsRelief` / `clearcoatNormalMap`)、天鹅绒双向掠射光 (`sheen`)、薄膜干涉彩虹光谱 (`iridescenceThicknessRange`)、体吸收透射衰减 (`attenuationColor/Distance`)、各向异性 (`anisotropy`) 与物理色散 (`dispersion`)。
- Action: 重构摄影棚照明系统（`js/mascot/studio.js`），移除平淡的预设环境光，构建暗穹顶 (`#202329`) + 6 块定制柔光箱/反光板的结构化摄影棚 IBL，PMREM sigma 收至 0.025；配套 CMF 自适应配光表（`CMF_LIGHTING`），实现材质切换时的背景色自适应与光强平滑插值。
- Action: 完成实机色彩与质感校准：黑曜石由塑料灰黑精调为玄黑深矿镜面金边、朱砂雕漆校准为故宫正红剔红漆质感、暖绒灯芯绒精调为复古砖红羊羔绒光泽。
- Validation: Chrome DevTools 现场实机走查，控制台 0 错误，FPS 稳定在 45~55 帧；能力探测 `anisotropy: true, dispersion: true`；6 套材质及日常/闭合/宇航形态高清截屏落盘。

## 荔 / LI · 2026-09-16 材质工坊与不同形态 UI 资产重制（雪沐怪诞手绘 1:1 图生图）

- Action: 编写自动化图生图调度引擎 `scripts/batch_generate_quirky_ui.py`，依托已登录真实 Chrome CDP (9333 端口)，挂载原生 IP/CMF 母本底图执行单线程 1:1 图生图。
- Action: 全量生成 9 套 1:1 无损高保真（1254 × 1254）雪沐怪诞手绘（Xuemu Quirky-Sketch）资产：
  - 形态空间 3 张：萌颜日常态（`badge_hoodie_open.png`）、锁进果实态（`badge_hoodie_closed.png`）、探索宇航态（`badge_astro.png`）；
  - CMF 材质工坊 6 张：01 果壳白玉（`swatch_rind_jade.png`）、02 暖绒灯芯（`swatch_corduroy.png`）、03 朱砂凝玉（`swatch_cinnabar.png`）、04 全息钛银（`swatch_titanium.png`）、05 光学水晶（`swatch_crystal.png`）、06 曜石黑金（`swatch_obsidian.png`）。
- Action: 重构 UI 呈现与前端样式（`css/mascot-studio.css` 与 `js/mascot/studio.js`）：将图标外框升级为拟物暖白宣纸方块底板，`object-fit: contain` 保证手绘线条无损呈现，更新 CMF_PRESETS 指向 `assets/icons/cmf/`，形态与材质高亮状态机无缝联动。
- Validation: Chrome DevTools 实时走查通过，控制台 0 错误；4 组实拍走查图归档至 `walkthrough.md`。

## 荔 / LI · 2026-09-16 材质深度微质感、丝滑锁果形变与『律』级音乐镜头交付

- Action: 深度升级 6 套工业级 CMF 材质，引入程序化 Canvas 法线贴图（粗坑条复古灯芯绒 Wales、剔红雕漆几何鳞斑、全息钛合金纳米拉丝）；精调 PBR 参数（Sheen 1.0、Clearcoat 1.0、Iridescence 0.92、Transmission 0.78、Obsidian 镜面）。
- Action: 构建「锁进果实」与「探出头来」丝滑无缝形变控制器（Morph Transition Engine），基于体积守恒弹性动力学（蓄力下蹲压缩 -> 同轴接棒 -> 落地弹跳缓冲回稳），彻底消除生硬的网格突跳感。
- Action: 基于 Disney 12 原则扩充 14 组丰富自然的弹性物理动作模组（开心跳跳、挥手、点头、摇头、害羞掩面、打瞌睡、害羞掩面、律动踩点、失重漂浮、背包助推等），加入头顶果蒂叶片惯性滞后次级摆动。
- Action: 全套移植『律』(LÜ) 级音乐镜头与声光共振机制（0.09/0.021/0.05 三频不可通约正弦轨道漫游 Arc Drift、Bass/Mid 驱动的 FOV 动态呼吸、主聚光灯与 Bloom 声波脉冲、以及角色随曲目 BPM 自动踩点弹跳律动）。
- Validation: 经 Chrome DevTools 实时验收，FPS 稳定在 50~60 帧，控制台 0 错误；7 组实拍高清走查图落盘，形态切换与音乐联动顺畅无损。

## 荔 / LI · 2026-09-15 视觉验收未通过

- Action: 用户与 AGY 否决当前双角色视觉结果；已停止旧模型的补丁式增补，保留失败模型和修改前备份，重建入口待选。
- Validation: 网格闭合、螺栓数量及工作室交互检查不能代替造型保真度；当前资产不属于已批准基线。独立对照页仍有移动端横向溢出。
- Active Assets: 失败对照 `output/blender-mcp/review.html`；来源 `assets/mascots/blender/li-mascots.blend`；备份 `output/backups/li-before-review-phases-20260915/`。Rodin / Hunyuan3D MCP 入口实测未启用，未提交生成任务。
- Report: [视觉否决、技术验证边界与重建建议](Reports/2026-09-15-li-review-phases.md)。Agent: codex。未提交、未发布。

## 2026-09-11 交接与开发计划（给 Codex）

- Action: 新增 `HANDOFF-2026-09-11-codex.md` —— 环境与验证方式（含两个必踩的坑：`main-view-geometry` 需传 `LU_URL`；盲盒测试禁用虚拟时钟，否则 `createImageBitmap` 静默挂死）、未提交状态盘点与收口建议、今日四项工作索引、待决策 D1–D4、代码地图与锚点行号、今日踩过的 6 个坑、交接检查清单。
- Action: 新增 `DEVELOPMENT-PLAN.md` —— 以"氛围装置"定位与"价值单位是分钟"两条第一性原理重排优先级：**P0 决策债 → P1 消灭出戏（卡顿治理 / 沉浸仪式 / 收尾与曲线）→ P2 结构改造（四轴正交化 / 段落级谱面 / 确定性）→ P3 玉牌形态**，每项带可量化验收指标。
- Validation: 计划内技术事实已逐条核对源码（`navigator.share` 全项目不存在、`isChoreographyShow` 匀速轮转、录制为实时 `captureStream`、像素比 `min(dpr,2)` + 后处理 4×MSAA、16Mbps 与微信 25MB 上限的冲突）。
- Note: 交接文档额外记录分享链路现状——录的是纯 canvas（UI 未入画，做对了）但无 `navigator.share`、且 16:9 画幅与 360MB 体积对竖屏分享不成立。Agent: 大江南 · 2026-09-11

## LÜ 2026-09-11 自定义图集盲盒

- Action: 图像拼贴方式新增第三种「图集盲盒」(`imageDist: 'album'`)——用户整目录/多选导入照片，矩阵每格抽一张。上传拆成"选照片"与"选文件夹"两个入口（`webkitdirectory` 在 Chrome 里强制只选目录，合成一个等于废掉多选照片）。上限 120 张 / 单张解码 1024px，单张损坏只跳过不中断整批。
- Action: 抽取用 `(种子, 格号)` 稳定哈希而**非 `Math.random()`**——重建随时发生（歌词同步、材质微调），随机数会让每次重建换一张，观感是闪烁不是盲盒。纹理走 `createImageBitmap` + 按需缓存，清空图集统一 `dispose()`。
- Validation: 新增 `test/lu/album-blindbox.test.js`（页面内合成 12 张 PNG 塞入 input.files）→ 16/16 格有图、首轮出现 9 种不同图片、重建后逐格排布一致（不闪烁）、换种子排布改变、清空后零残留、错误 0。视觉取证 `output/playwright/album-blindbox.png`。四条回归全绿。
- Report: [依据、踩坑与 FOV 说明](Reports/2026-09-11-lu-album-blindbox.md)。Agent: 大江南 · 2026-09-11
- Pending: 图集不随预设保存（存的是会话内 Blob，刷新需重新导入，跨会话需落 IndexedDB）；抽取为有放回均匀抽取，16 格抽 12 张会有重复；与角色盲盒 (`avatarDist: 'variety'`) 仍是两套独立机制。FOV 是否改为同时改变主体大小仍待确认。未提交、未发布。

## LÜ 2026-09-11 角色默认在场 + 取景与 FOV

- Action: 默认内容模式由"纯材质"改为**角色在场**（`contentMode: 'avatar'`、active 按钮与 `#avatarPanel` 同步），并显式启动预热——角色贴图是启动时建的空画布，需等 `avatar-bridge` 动态 import 后才有内容，否则首屏是空白脸；其余 7 个角色错时预热以填充面板缩略图。主循环原有角色驱动因此自动生效（眨眼/注视/呼吸）。
- Action: 基础 FOV 滑块量程 20–60 → **12–85**，运行时夹取 15–75 → 12–85（两处，与滑块对齐）。
- Action: 取景系数 `1.12` → **`0.74`**，保留 `?framek=` 覆盖入口。该系数是除数关系（距离 ∝ 系数），调小才放大主体；依据是实测线性关系（k=1.45→占高 35%、0.88→58%），方阵偏宽故高度先触边，按占高约 69% 反解。
- Validation: 默认态 `contentMode=avatar`、16/16 单元承载角色、抽检 4/4 贴图已绘制（非空白脸）、FOV 滑块 12/85、页面错误 0。主体占屏（投影 NDC 实测）：桌面 33.1%×**68.8%**（改前 16.2%×35%）、手机 55.2%×68.6% 且无横向溢出。三条回归全绿。
- Report: [依据、实测与遗留](Reports/2026-09-11-lu-avatar-default-and-frame.md)。实拍 `output/playwright/avatar-default-final.png`。Agent: 大江南 · 2026-09-11
- Pending: **FOV 滑块目前只变焦、不重新取景**（三档实测相机距离不变），是否改为"改 FOV 同步重新取景"会改变滑块语义，待确认。取景放大后上下余量变小，若改高层数/大阵型需复测边缘。未提交、未发布。

## LÜ 2026-09-11 入场错时 (Arrival Stagger)

- Action: 入场从"所有单元同一帧从中心长出"（读起来是融化）改为按**对角坐标**分拍的扫掠式到来；每个新建单元带 `userData.arrival` 时间片，到点前不推进位姿也不写可见尺寸，到点后由既有插值长到位。对角键替换径向键（方阵对称导致径向区分度仅 0.125s）。
- Action: **内容优先按密度判断**而非"这一格有没有内容"——`shouldRenderContent` 在材质模式下默认即为 true，直接用它会让错时完全失效。稀疏内容（≤25%，中心单体/巨像拼合/单图）才把承载内容的单元提前半档，让角色成为唯一的主语。
- Validation: 新增 `test/lu/arrival-stagger.test.js` → 对角键序→时间片序单调、7 档跨度 0.780s、无陈旧 ready 残留、入场后避让推动 0 对（求解器确认工作 59/60 帧）、页面错误 0。稀疏模式实测角色严格第一（0.02 vs 0.06）。静息待机态与几何契约回归全绿。
- Report: [两处失效根因、验证与遗留](Reports/2026-09-11-lu-arrival-stagger.md)。Agent: 大江南 · 2026-09-11
- Pending: 本轮未提交、未发布。开发服务常驻 `127.0.0.1:8099` 便于阅览。注意 `main-view-geometry.test.js` 默认指向 8091，跑回归需传 `LU_URL`。

## LÜ 2026-09-11 静息待机态 (Idle Rest State)

- Action: 产品定位校准为「个性化音乐氛围装置」后补齐开局缺口——此前波形/相机/序幕全部挂在播放态上，未演奏时画面完全静止，装置必须先被"操作"才呈现美感。新增 `state.idleBreath` 静息包络（上升≈1.8s、下降≈0.17s）与「13-b 静息待机态」区块：整面等比呼吸缩放 ±2%、深度缓波 + 微倾，均为纯时间驱动，不读音频、不碰节拍相位。
- Action: 静息相位使用 `cellD/cellDiag` 等 1-Lipschitz 坐标而非格坐标（球面/圆环上相邻块用格坐标会反向顶穿预算）；只占一个缩放通道，避免与单块缩放吃两遍余量。删除旧的待机瞬间吸附机位分支，静息走同一条平滑路径并改用更慢振幅。受 `waveMotion` 总开关与 `prefersReducedMotion` 约束。
- Validation: 新增 `test/lu/idle-rest-state.test.js`（CDP 虚拟时钟）→ 待机 600 帧包络峰值 0.997、中心块垂直行程 0.2027；**避让求解器推动 0 对 / 生效帧 0/600**（未触碰位移预算）；播放后 300 帧残留 0.0000；页面错误 0。既有几何回归 `LU_QUICK=1` 相交组仍为 0。390px 与 1440px 均无溢出、0 错误。
- Report: [判断依据、变更与验证](Reports/2026-09-11-lu-idle-rest-state.md)。视觉取样 `output/playwright/idle-rest-visual-qa.js` + `idle-rest-f*.png`。Agent: 大江南 · 2026-09-11
- Pending: 本轮未提交、未发布，等待确认。主页面与工程副本已同步同哈希。

## LÜ 2026-09-11 主画面毛边与穿模修复

- Action: 后处理缓冲启用 4× 多重采样（毛边根因：`EffectComposer` 默认 `samples=0`）；建立「主画面几何契约」统一格距、尺寸上限、旋转包络与波形位移预算，阵型几何改为按格距推导，新增目标层精确 OBB 避让求解器与渲染层占位兜底。
- Validation: 新增 `test/lu/main-view-geometry.test.js`（3 档 × 7 阵型 × 6 波形，3150 帧逐帧精确相交检测）→ 0 组相交、求解器常态零修正；过渡期最深瞬时穿透 0.026；真实播放 180 帧平均 12.6ms、长帧 0。
- Validation: 12 材质、文字/头像/拼图、4×4↔10×10×3、390px 首屏、暂停续播、减少动效全通过，控制台 0 错误。
- Report: [根因、变更与验证](Reports/2026-09-11-lu-main-view-geometry-fix.md)。对照图 `output/playwright/main-view-before-after.png`。Agent: 大江南 · 2026-09-11
- Pending: 过渡期亚像素接触与「脉冲」波形包围盒保守性已记录；本轮未提交或发布，待确认后上传。

## LÜ 2026-09-11 高清角色与工作室联动

- Action: 修复静态伪动画图集、透明叠加及正反头像重影；提升材质样本采样与真实阴影。
- Action: 接通工作室编辑、保存返回、材质恢复和角色文件迁移，明确官网与本地组件边界。
- Validation: 24 组图集各有 47–53 个不同帧，透明且无边界裁切；编辑往返保留角色、材质、色彩，运行错误 0。
- Report: [发布范围与验证记录](Reports/2026-09-11-lu-avatar-release.md)。Agent: codex · 2026-09-11
- Release: `1186b80` 已推送 master / gh-pages；Pages built，线上图集、背景、定义均 HTTP 200，角色工作室可用，运行错误 0。

## LÜ 2026-09-10 风景与细纹理修订

- Action: 接入山湖晨光背景并匹配冷暖布光；按最新反馈收弱粗反射带，保留四类细纹理与柔和光泽。
- Validation: 四材质切换、背景回退、375px 无横向溢出通过；120 帧平均 20ms、最大 21ms，运行错误 0。
- Report: [实现与验证边界](Reports/2026-09-10-lu-fine-materials.md)。未提交或发布。Agent: codex · 2026-09-10

## LÜ 2026-09-10 材质工作室与官方角色

- Action: 合并材质界面，加入实际样本、代表色与灰蓝默认舞台，改善玻璃双面透射及软阴影；接入 OneWorks 官方编辑器与 8 角色图集。
- Validation: 六类材质切换、编辑保存恢复、375px 无溢出通过；混排 120 帧平均 20.001ms、最大 21.7ms，控制台无错误。
- Pending: Imagen 背景尚未生成，等待确认可用生成工具；未提交或发布。
- Report: [实现、验证与限制](Reports/2026-09-10-lu-material-atelier.md)。Agent: codex · 2026-09-10

## LÜ 2026-09-09 光影与内容融合

- Action: codex 直接完成影棚光影、材质族保护、8 款原创 3D 角色、7 种阵型与三级响应；表面内容并入方块材质，内雕启用深度与折射。
- Validation: 真实音频 180 帧平均 20.01ms、最大 22ms；融合角色 120 帧最大 22ms；9 种层级/工艺组合无错误，手机关键控件全部在视口内。
- Report: [升级与验证记录](Reports/2026-09-09-lu-studio-upgrade.md)。保留原象棋工作；头像非官方资产，内雕为屏幕空间折射；本轮未提交或发布。
- Agent: codex · 2026-09-09

## LÜ 2026-09-08 质感与动效复查

- Action: Sol high完成代码审查，AGY Gemini 3.8 Flash high开发可见贴图更新、镜头平滑、减少动效与控件刷新优化；codex补正取景、中频节拍与移动标签。
- Validation: 减少动效FOV波动0度；单头像仅1张画布更新；10×10扩容保持视角；移动五面板无文字溢出。全量重建仍有61.8ms尖峰，未宣称完整消除卡顿。
- Report: [审查、建议与验证记录](Reports/2026-09-08-lu-quality-motion-review.md)。原象棋工作保留；本轮未提交或发布。
- Agent: codex · 2026-09-08

## Current State

- Action: 修复音频暂停续播与歌词时间轴，加入 LRC 多时间戳、文件偏移和手动偏移控制。
- Action: 按已确认的 Stitch 方向完成珍珠灰、石墨色与深钴蓝界面，统一响应式组件，并补强单行检查器导航、紧凑状态与 WCAG 对比度选色。
- Action: 重编 1/2/3 档的速度、幅度、响应、相位、爆发、微停和方阵序列，动画改用真实帧间隔。
- Validation: 390×844、1024×768、1440×900 无页面级溢出；真实音频在 14.27 秒正确切换歌词并重排为 6×2×1，续播、档位速度、180 帧采样及控制台回归通过。
- Agent: codex · 2026-08-26

- Action: 新增独立 `xiangqi.html`“弈律”3D 中国象棋；原 `index.html` 未改，棋盘改为俯视平放，复用 LÜ MeshPhysicalMaterial 与光影。
- Action: 接入 28 张 Imagen 原创角色、2 张原创棋盘材质；支持“律·活体矿物 / 霜铸·史诗奇幻”双主题、玻璃嵌入层、微视差呼吸与四项实时材质调节；已校正顶面立绘朝向，并将原版纯白背景收敛为低亮珍珠灰蓝。
- Action: 完成象棋规则、Wukong/Pikafish 五档 AI、三种模式、音效、存档、FEN/ICCS/JSON 与复盘。
- Validation: 16 项规则、Wukong 与 Chromium 双端全链路通过；Pikafish 8T/512MB 真实搜索，控制台 0 错误/0 警告。详见 `Reports/2026-08-27-lu-xiangqi-delivery.md`。
- Agent: codex · 2026-08-27

- Action: 将雪沐手绘套装重新定位为吃子积分、连吃、将军与终局动画资产，不再承担整页常驻视觉。
- Action: 完成霜廷 V2 红黑主将美术标尺，将写实 AI 头像推进为强调手绘块面、职业轮廓与战损材质的原创 AAA 暗黑奇幻角色。
- Validation: 两张 1254×1254 圆形安全裁切样张已生成并落盘，未覆盖现有棋子；提示词与事件动画职责见 `output/imagegen/20260828-epic-art-direction-v2/art-direction.md`。
- Agent: codex · 2026-08-28

- Action: 完整移除“律材质实验室”象棋套壳，交付“玉衡东方藏品局 / 先锋英雄战术局”两套独立桌面与移动 UI。
- Action: 玉衡采用传统玉石圆棋与雪沐战果动画；先锋采用七兵种程序化 3D 英雄装置和新战术棋盘材质，四项材质调节继续生效。
- Validation: 16 项规则、Wukong 与 Chromium 双端全链路通过；真实吃子积分通过；Pikafish 8T depth 23、11,306,626 nodes；桌面与移动控制台均 0 错误。详见 `Reports/2026-08-28-xiangqi-dual-world-redesign.md`。
- Agent: codex · 2026-08-28

- Action: 根据最新反馈，将第二套从暗黑奇幻人物肖像调整为原创英雄射击式实体棋子，人物不再是强制载体。
- Action: 建立将、士、象、马、车、炮、兵七种功能剪影，完成暖方与冷方两套 3D 阵列样张。
- Validation: 两张 1536×1024 样张已落盘且未覆盖正式资产；设计映射与提示词合同见 `output/imagegen/20260828-hero-shooter-pieces-v1/art-direction.md`。
- Agent: codex · 2026-08-28

- Action: 修复炮吃子与第二步假卡死，敌方棋子中心点击现在直接匹配已选棋子的合法吃子着法；吃子命中区由空心环改为实心交互面。
- Action: 统一棋盘纹理网格与 3D 棋子坐标，绘制边距由独立魔法数改为共享坐标常量，并加入跨度证明接口与浏览器回归。
- Action: 重制先锋 V2 棋盘和红黑 14 枚职业浮雕徽章，正式棋子改为低矮收藏级圆棋，不再使用程序化球体、方块和炮管拼装。
- Validation: 真实点击完成红炮翻山吃黑马，黑方第二步继续落子；16 项规则、Wukong、Pikafish 8T 与桌面/移动端全链路通过，控制台 0 错误。报告见 `Reports/2026-08-28-xiangqi-capture-and-hero-v2.md`。
- Agent: codex · 2026-08-28

- Action: 修复仕士“规则可走但难以点中”，普通合法点由半径 0.18 的小命中面改为半径 0.46 的触控命中面，视觉绿点尺寸保持不变。
- Action: 上一手标注改为青色起点、金色方向轨迹与浮在棋子外的朱红终点环，解决终点标记被棋子遮挡后看似“只能往左”的误导。
- Validation: 新增仕士九宫斜行规则测试与浏览器偏移点击回归；17 项规则、Wukong、Pikafish 8T、桌面与 390px 移动端全链路通过，控制台 0 错误。
- Validation: 本地 `127.0.0.1:8000/xiangqi.html` 返回 HTTP 200，两个用户页面已刷新到修复版。详见 `Reports/2026-08-29-xiangqi-advisor-and-marker-fix.md`。
- Agent: codex · 2026-08-29

- Action: 修复桌面残局中“点仕没有反馈”的误解：无合法着法的棋子现在会区分“会令己方受将”和“被己方棋子/边界阻挡”，不再静默。
- Action: 修复导入残局或重开后复用棋子编号造成的 3D 点击对象残留；渲染层现在同时校验编号、兵种和阵营，避免画面、命中与规则状态错位。
- Validation: 用户原第 22 手局面已恢复；红仕提示“候选位置会让己方将帅受将”，红马真实点击显示 `(7,0)/(7,2)` 两个落点，局面仍有 25 个合法着法。
- Validation: 18 项规则、Wukong、Pikafish 8T depth 23 / 10,053,248 nodes、桌面与移动端全链路通过，控制台 0 错误。详见 `Reports/2026-08-29-xiangqi-desktop-pinned-advisor.md`。Agent: codex · 2026-08-29
