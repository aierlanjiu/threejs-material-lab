### 阅读证明（Source Access & Context Verification）

本次审阅基于只读核对窄范围审阅包（`2026-10-23-lu-dream-concert-review-context`），未修改任何源码、测试、资产或文档：

* **已核对文档与清单**：`REVIEW_REQUEST.md`、`development.md`（v1.0，共 366 行，`sha256: 27007042...`）、`manifest.json`（Git HEAD `a9c42b8c4ce0ee7a6de1d0bf82e96e82d11eadcb`，工作区 business tracked diff 指纹 `7c587270ff63c268...`，29 个受保护 pet `.webp` 哈希，以及 6 张 `reference-screenshots/` 历史参考图）。
* **已读取并核对的具体当前源码事实（6 项核心证据）**：
  1. **窄竖视口判定与 FOV（`source/js/ui/band-scene.js` 第 69、209–212 行）**：`dimensions()` 在非录制态取 `{w: container.clientWidth, h: container.clientHeight}`，录制态取 `{w: captureSize.logicalWidth, h: captureSize.logicalHeight}`；`resize()` 中以 `narrow = w / h < .85` 判定窄竖布局，并将相机垂直视场角设为 `camera.fov = narrow ? 34 : 30`。
  2. **约 33ms 绘制节流与暂停早退（`source/js/ui/band-controller.js` 第 130 行、`source/js/ui/band-study.js` 第 99 行、`source/js/ui/band-scene.js` 第 149–150 行）**：主入口与独立预览页的 `tick(now)` 均通过 `if (... || now - lastDraw < 33) return; lastDraw = now;` 进行约 30fps 节流；同时 `band-scene.js` 的 `update()` 使用包含 `frame.time`、`placementRevision`、`JSON.stringify(settings)` 等拼成的 `updateKey` 做全等短路（`if (updateKey === lastUpdateKey ...) return;`），暂停时 `theatre.update()` 不会被重复调用。
  3. **`setTheme()` 与 `setLayout()` 双向互调及全树清空（`source/js/ui/band-stage.js` 第 22、77–99 行）**：`setTheme(next)` 在 `changed && narrow !== null` 时同步调用 `setLayout(narrow, true)`；而 `setLayout(value, force=false)` 在开头对整个 `root` 执行 `disposeTree(root)`（遍历释放所有子节点的 `geometry`、`material` 及带 `userData.stageBackdrop` 的 `map`），又在末尾第 98 行无条件调用 `setTheme(theme).catch(console.warn)`，且 `decorations()` 仅在 `await textureFor(...)` 异步返回后才执行。
  4. **`effectsMode` 传递断裂与 `fx.intensity` 混淆（`source/js/ui/band-scene.js` 第 152、205 行，`source/js/ui/band-stage.js` 第 100 行，`source/js/audio/band-stage-layout.js` 第 96 行）**：`band-scene.js` 虽持有 `settings.effects`（`'auto' | 'off' | 'preview'`），但第 205 行调用 `theatre.update(frame.time, fx, reduced, lighting, renderer.domElement.height, rows)` 时未传入 `settings.effects`；`band-stage.js` 第 100 行使用 `const amount = reduced ? 0 : fx.intensity` 控制气泡，而在 `effects === 'auto'` 的非高潮段落（如前奏/主歌 `t = 2s`），`stageClimaxAt()` 返回 `fx.intensity === 0`，导致 `band-stage.js` 内部无法区分「`effects=off`」与「`effects=auto` 的平缓段落」。
  5. **窄竖向相机包络裁剪（`source/js/ui/band-scene.js` 第 118–158 行 `fitCamera`）**：当 `narrow === true` 时，`points` 仅收集各角色的左右/上下包围点（`p[0] ± h * .47`、`[0, h + .12]`）、前排 3 人的 `wings` 展开点及单个前缘中心点 `(0, 0, s.front + .3)`；仅在 `else`（`!narrow`）分支才加入舞台两侧边界 `±s.width/2 ± .8` 与半圆弧边界。
  6. **资源所有权、透射缩放与全屏辉光后处理（`source/js/ui/band-scene.js` 第 17、20、214、232 行，`source/js/ui/band-stage.js` 第 40–48、61–67、94、112 行）**：渲染器启用了 `renderer.transmissionResolutionScale = .5`；每帧 `render()` 在 `glowStrength > .002 && !last?.options?.reduced` 时（常态 `glowStrength >= .34`）额外执行 `glow.apply(glowStrength)`；`band-stage.js` 在 `setLayout` 第 94 行还创建了文档未提及的 2 个舞台侧边功放箱（`ampX = side * (narrow ? 6 : 11.7), ampZ = narrow ? -.4 : .5`），并在 `edge()` 第 46–47 行对每个台阶创建了 `edgeGeometry` 与 `edgeGeometry.clone()` 两条 `THREE.Line`。

### 一、审阅结论

**结论：修改后可进入下一阶段（Conditional Pass — 需先修订文档中的 3 项 P0 架构/空间冲突与 4 项 P1 接口/生命周期缺陷，再进入 Stitch 设计方向稿与资产验证阶段）。**

* **总体评估**：`development.md`（v1.0）准确遵守了 D01–D07 的用户授权边界，没有触碰 29 位角色图集、乐器、混音与控制器核心逻辑，且正确识别了约 33ms 渲染节流与 `effectsMode` 参数缺失问题。
* **核心阻碍点**：当前提案在「`band-stage.js` 的 `setLayout/setTheme` 双向调用与 `disposeTree(root)` 暴力释放机制」「窄竖屏 `fitCamera` 的 16.1° 水平视场角裁切」「每帧动态计算屏幕保护区淡出与 `seek` 纯函数确定性的矛盾」以及「r166.1 透射 Pass + `band-glow` 后处理下的 `renderer.info` 统计失真」四个关键点上与现有源码存在直接冲突，若按原文档直接实施会导致**切主题崩溃/二次释放、手机端浮岛完全出画、跳播姿态不一致、性能指标失真**。

### 二、P0 / P1 / P2 问题清单

| 级别 | 编号与问题摘要 | 文档章节 | 源码文件 / 函数 | 触发条件 | 影响（区分已证实证据 vs 推测） | 可执行修订建议 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P0** | **P0-1：`setLayout` / `setTheme` 循环调用与 `disposeTree(root)` 摧毁共享资源池** | 第 3.4 节、第 9.2 节、第 9.3 节 | `js/ui/band-stage.js`：`setTheme()`（L77–84）、`setLayout()`（L85–99）、`disposeTree()`（L22）；`js/ui/band-scene.js`：`configure()`（L116） | 初始化、切换主题（`configure` 中先 `resize()->setLayout` 再 `setTheme`）或横竖屏切换时 | **【已证实证据】**：1) 切换主题时 `setTheme` 发现 `changed && narrow !== null` 会调 `setLayout(narrow, true)`，而 `setLayout` 末尾又调 `setTheme(theme)`，导致单次切主题触发 **2 次全树销毁重建 + 3 次异步贴图请求**；2) 若 `createConcertProps(root, ...)` 将节点挂在 `root` 下，`setLayout` 的 `disposeTree(root)` 会无差别调用子节点的 `geometry.dispose()` 和 `material.dispose()`，直接摧毁 `props` 内部跨主题复用的共享设备 Geometry/Material 及借用的 `lightTexture`；3) `setLayout` 末尾未 `await setTheme`，导致 `decorations()` 在异步微任务后才挂载，首帧缺失装饰 | 1) 将 `props.group` 挂在 `createConcertStage` 独立于 `root` 的专用容器（或从 `disposeTree(root)` 中排除 `props.group`，交由 `props.configure/dispose` 独占管理）；2) 解除 `setTheme` 与 `setLayout` 的互相调用：缓存已加载的背幕贴图，将主题装饰与背幕更新拆为内部纯同步/受控异步函数，切主题只换材质颜色、背幕与主题装饰，**不再因切主题而调用 `setLayout(narrow, true)` 重建整个玻璃阶梯与桁架** |
| **P0** | **P0-2：窄竖向（`w/h < .85`）把浮岛放在舞台两侧会导致手机端 100% 裁切出画，或拉远镜头缩小角色** | 第 3.4 节、第 5.1 节、第 5.3 节、第 7.1–7.2 节 | `js/ui/band-scene.js`：`fitCamera()`（L118–158）、`resize()`（L209–212）；`js/ui/band-stage.js`：`setLayout()`（L91） | 在 `390×844` 或 `342×740` 等 `w/h < .85` 的窄竖视口下浏览或录制 `1080×1920` 视频时 | **【已证实证据】**：`narrow` 模式下 `fitCamera()` 的 `points` 仅包裹角色与前排翼效，不包裹舞台宽度 `±7.2`。在 `390×844`（`aspect=0.462, fov=34°`）下，水平全视场角仅约 `16.1°`；对照 `reference-screenshots/*-390.png` 可见，位于 `x = ±7.33, z = -4.7` 的音箱已紧贴画面最左右边缘，而在 `z = 0` 处水平可视半宽仅约 `±6.7`。若浮岛按「舞台两侧」放在 `|x| > 7.4`，手机端 **100% 位于视锥体外**；若放进 `|x| < 5.5, z ∈ [-3.5, 6.4]`，则与三层台阶上的 9–10 名角色重叠；若将浮岛加入 `fitCamera` 的 `points`，则会迫使 `distance` 增大，直接违反第 7.2 节「不拉远镜头、不缩小角色」的红线 | 在第 7.1/7.2 节明确区分横竖锚点拓扑：**横向（`!narrow`）**浮岛可置于舞台两侧后半区（`x ∈ [±11.5, ±14.8], z ∈ [-5.5, -1.0], y ∈ [1.8, 5.2]`）；**窄竖向（`narrow`）**严禁放舞台外侧，必须改为**后景高空内侧悬浮窗**（`x ∈ [±3.6, ±5.6], z ∈ [-5.6, -4.0], y ∈ [5.8, 9.8]`），位于后排角色头顶（`y ≈ 5.2`）与灯架顶（`y = 13.2`）之间，且严禁将新增装饰坐标塞入 `fitCamera()` 的 `points` |
| **P0** | **P0-3：逐帧屏幕投影冲突淡出与暂停/Seek/离线导出「无状态纯函数确定性」自相矛盾** | 第 7.2 节、第 8 节、第 9.2 节 | `js/ui/band-scene.js`：`update()`（L147–207）；`js/ui/band-controller.js`：`renderPromoFrame()`（L169–193） | 镜头随 `cameraShift/cameraLift` 摆动、手动拖动角色、或执行 `seek(t1 → t2 → t1)` 及 `renderPromoFrame()` 离线跳帧渲染时 | **【已证实证据】**：第 7.2 节提出「用当前 camera 投影检查……冲突时依次移到后景、减小、隐藏可选点缀……连续镜头期间允许平滑淡出」，而第 8 节要求「跳转：相同输入时间、主题、布局和设置应得到相同姿态；不积累 `deltaTime`」。若引入基于帧间状态积分的平滑淡出（fade alpha），则 `t1 → t2 → t1` 跳转及 `renderPromoFrame` 离散帧采样必定因历史路径不同而产生不同画面；若做无状态硬阈值显隐，则会在 `cameraShift = Math.sin(time*.14)*.38` 越过边界时发生高频闪烁 | 删除「逐帧计算全部角色 2D 投影矩形去动态搬移/显隐 3D 浮岛」的运行时设计，改为**「编译期静态安全包络 + 运行时确定性代数让位」**：1) 浮岛与植物的世界坐标锚点在设计阶段即避开全部 5 种队形及手动拖动边界 `limits()`（横向 `|x|≤10.5, z∈[-3.7,8.1]`；窄竖 `|x|≤5.6, z∈[-3.7,6.3]`）；2) 运行时仅根据当前帧确定性的 `lighting.wingPower` 与 `cameraPose?.focusMix` 代数衰减装饰发光强度（无状态纯函数，零闪烁、100% 跳播一致） |
| **P1** | **P1-1：共用设备「精修」与 `band-stage.js` 现有内联设备及 `amp` 功放箱、灯位数量的冲突** | 第 3.3 节、第 5.2 节、第 9.1 节 | `js/ui/band-stage.js`：`truss()`（L49–60）、`speaker()`（L61–64）、`monitor()`（L65–67）、`setLayout()`（L91–98） | 实施 `speaker-stack`、`floor-monitor`、`moving-head`、`truss-detail` 接入 `band-stage.js` 时 | **【已证实证据】**：1) 文档 5.2 写 `speaker-stack` 横/竖上限为 `4 / 2`，`moving-head` 为 `8 / 6`，但源码第 91 行无论横竖均生成 **4 个 `speaker`**（左右各上下 2 个），第 52 行无论横竖均生成 **8 盏灯具**（其中 `i===1,6` 挂 `SpotLight`，`i===0,2,5,7` 挂 `shaft` 光束）；2) 源码第 94 行在舞台两侧台阶上还生成了 **2 个 `amp` 功放箱**（横向 `x=±11.7, z=0.5`；窄竖 `x=±6.0, z=-0.4`），文档第 5.2 节完全遗漏，侧景极易与其穿模；3) `setLayout` 第 98 行对整个 `root` 执行 `batchRods(root)`，会把所有 `geometry.userData.rod === true` 且同材质的圆柱合并为 `InstancedMesh` | 1) 明确设备替换边界：由 `band-concert-props.js` 提供 `buildStageEquipment()` 或直接在 `props` 中接管 `speaker/monitor/amp/moving-head` 的视觉网格，**移除 `band-stage.js` 中旧的 `speaker()`、`monitor()` 及第 94 行 `amp` 的重复 `box()`**，但保留 `band-stage.js` 的 2 盏 `SpotLight`（`lamps`）与 4 道 `shaft`（`beams`）并对齐灯头坐标；2) 统一 `speaker-stack` 计数口径：每侧 1 组双单元音箱塔（共 2 组 = 4 只箱体），窄竖向保持 8 盏或 6 盏灯头时同步调整 `shaft` 索引，不留悬空光束 |
| **P1** | **P1-2：三主题新增装饰与既有「双帆、七星球拱架、鸟居灯笼、14 个气泡、高空礼花」的空间/语义重叠** | 第 3.3 节、第 5.3 节、第 7.1 节 | `js/ui/band-stage.js`：`decorations()`（L68–88）、`makeEffects()`（L89–92）、`update()`（L109）；`js/ui/band-fountains.js`：`setLayout()`（L121–123） | 渲染三主题装饰，尤其在窄竖向（`width=11.3, lift=3.2/3.6`）或高潮期 `bubbles` 与 `airbursts` 同时激活时 | **【已证实证据】**：1) 海贼王提案中的「小型漂浮水滴」与 `band-stage.js` 已有的 14 个半透明虹彩 `bubbles`（位于 `x ≈ ±0.40*s.width, y ∈ [3, 7.5]`）位置与形态完全重复；2) 火影提案中的「微型纸灯」与鸟居两侧已有的大灯笼（`x = ±0.40*width, y = 5.35+lift`）在窄竖屏（`x = ±4.52, y = 8.95`）直接撞车；3) 龙珠提案中的「小型轨道环」在窄竖屏会切割七星球拱架（`x ∈ [-4.86, 4.86], y ∈ [6.1, 11.1]`）；4) 高空礼花 `airbursts` 爆心位于横向 `(±5.8, 10.3, -3.55)`、窄竖 `(±2.7, 8.1, -3.95)`，顶部漂浮物若靠近该区域会被礼花完全淹没或抢戏 | 修订第 5.3 节表格：1) **海贼王**：删去「小型漂浮水滴」（直接复用现有 14 个 `bubbles`），保留礁石浮岛 + 青蓝透光珊瑚/海草 + 岛上暖色航灯；2) **龙珠**：删去悬空「小型轨道环」，保留悬浮岩岛 + 青绿发光草 + 琥珀能量晶簇；3) **火影**：删去悬空「微型纸灯」，改为苔石浮岛上的矮石灯笼 + 发光竹叶/蕨叶，避开上方鸟居悬灯；4) 严禁在 `airbursts` 爆心半径 `3.0` 内放置顶部漂浮物 |
| **P1** | **P1-3：r166.1 透射 Pass 与 `createBandGlow` 后处理导致 `renderer.info.render.calls` 预算失真及多 Pass 成本漏算** | 第 3.4 节、第 10 节 | `js/ui/band-scene.js`：`createBandScene()`（L17–20）、`render()`（L214）、`diagnostics`（L246） | 使用 `transmission > 0` 的材质，或通过 `scene.diagnostics.drawCalls` 验收新增渲染调用预算（`≤32 / ≤18`）时 | **【已证实证据】**：1) `band-scene.js` L214 在 `renderer.render(scene, camera)` 后立即执行 `glow.apply(glowStrength)`；在 Three.js 默认 `renderer.info.autoReset = true` 下，后续内部 Pass 会重置或覆盖 `renderer.info.render`，导致直接读取 `diagnostics.drawCalls` 无法反映包含阴影 Pass、透射背景 Pass 与主渲染 Pass 的真实总提交数；2) **【工程推算】**：每个新增网格若开启 `castShadow = true`，在 `fill` 平行光阴影 Pass + 透射背景 Pass（因舞台玻璃 `transmission: .96` 恒开启）+ 主渲染 Pass 中会被提交 **2–3 次** | 1) 在第 10 节明确：新增侧景浮岛与植物**默认 `castShadow = false`、`transmission = 0`**（改用 `emissive` + 顶点色/边缘 Rim 模拟发光与半透质感，仅主晶体允许最多 1 个共享非透射高光/折射球或极少量静态材质），避免进入透射背景 Pass 与阴影 Pass；2) 性能验收脚本必须统计**单帧完整周期（含 Shadow + Transmission + Main + Glow）的累计 `calls/triangles`**，或对比新增模块挂载前后的 `renderer.info.programs.length`、`memory.geometries`、`memory.textures` 与 GPU 帧耗时 |
| **P1** | **P1-4：`effectsMode` 在 `band-scene.js` → `band-stage.js` → `props` 中的传递与 `updateKey` / 暂停后首次配置刷新问题** | 第 8 节、第 9.2 节 | `js/ui/band-scene.js`：`update()`（L149、205）、`configure()`（L116）；`js/ui/band-stage.js`：`update()`（L100） | 1) 用户在暂停状态下切换 `effects: auto/off/preview` 或切换主题；2) 歌曲处于前奏/主歌（`fx.intensity === 0`）且 `effects === 'auto'` 时 | **【已证实证据】**：1) `band-scene.js` L205 未把 `settings.effects` 传给 `theatre.update`；2) 当 `configure(theme)` 完成并调用 `await theatre.setTheme(theme)` 时，若当前处于暂停状态且 `updateKey` 未变，`theatre.setTheme` 只触发 `onChange: () => { if (active) render(); }`，**不会触发 `theatre.update()`**！若新创建的 `props` 依赖 `update()` 才设置初始变换或应用 `lastLighting`，切主题后暂停画面中的新资产会处于未初始化姿态 | 1) 将 `theatre.update` 签名向后兼容地扩展为 `update(time, fx, reduced=false, lighting=..., viewportHeight=650, rows=[], effectsMode='auto')`；2) 在 `band-stage.js` 中保存 `lastUpdateArgs`，当 `setTheme` 或 `setLayout` 重建/重配 `props` 后，若已有 `lastUpdateArgs` 则立即同步调用一次 `props.update(...)`，保证暂停状态下切主题/切画幅当帧即有正确姿态 |
| **P2** | **P2-1：`setCaptureSize()` 切换横竖录制时的微任务竞态与分辨率像素比** | 第 7.2 节、第 8 节、第 11.1 节 | `js/ui/band-scene.js`：`setCaptureSize()`（L225）、`resize()`（L209）；`js/ui/band-controller.js`：`drawRecording()`（L147–168） | 在桌面端（如 `1440×900`）点击录制或调用 `drawRecording(ctx)` 导出 `1080×1920` 竖版视频的第一帧时 | **【已证实证据】**：`drawRecording(ctx)` 第 150 行同步调用 `scene.setCaptureSize(...)` 触发 `resize() -> theatre.setLayout(narrow)`，紧接着第 151 行立即执行 `ctx.drawImage(scene.canvas, ...)`。由于 `setLayout` 末尾的 `setTheme(theme)` 包含 `await textureFor(...)` 微任务，**画幅翻转后的第 1 帧录制画面会丢失背幕贴图与 `theme-decor`** | 在 `band-stage.js` 中缓存当前主题已解析的 `Texture` 实例（`cachedBackdrop`）；当 `setLayout(narrow)` 因横竖切换触发且 `theme` 未变时，直接同步使用 `cachedBackdrop` 克隆贴图并同步构建 `decorations()` 与 `props.configure()`，实现零微任务延迟的同步切换 |
| **P2** | **P2-2：`test/band-stage.test.mjs` 运行环境为无 DOM 的纯 Node 环境，`band-concert-props.test.mjs` 需避免直接依赖 `document.createElement('canvas')`** | 第 9.1 节、第 11.2 节 | `test/band-stage.test.mjs`、`test/band-pyro-realism.test.mjs`、`js/ui/band-stage.js`（L38 `glowTexture`） | 在 Node 命令行直接运行 `node test/band-concert-props.test.mjs` 时 | **【已证实证据】**：`band-stage.js` 顶层未调用 DOM，但 `createConcertStage()` 内部第 38 行 `glowTexture()` 调用了 `document.createElement('canvas')`；`test/band-stage.test.mjs` 之所以能跑通，是因为它只导入了 `band-stage-layout.js` 等纯逻辑模块，并未导入 `band-stage.js`；`test/band-pyro-realism.test.mjs` 则是通过正则剥离 import + 注入桩对象测试的 | 在第 9.2/11.2 节明确：`band-concert-props.js` 接收外部传入的 `{ lightTexture }`（不在内部直接调 `document.createElement`），或者导出纯函数 `sampleConcertPropsAt(time, lighting, { theme, narrow, effectsMode, reduced })` 供 `test/band-concert-props.test.mjs` 在纯 Node + `THREE` 下直接断言幂等性、暂停/seek 一致性与 `dispose` 计数 |

### 三、对第 14 节 7 个具体审阅问题的逐项核查结论

1. **哪些已确认决策被错误解释，哪些提案悄悄扩大了用户范围？**
   * **总体未越界，但有 2 处隐性范围膨胀需收紧**：
     - 第 6 节提到「如评审后选用 Blender/GLB……SimReady 与其他第三方模型只作为可选选型参考」，第 10 节又提到「确有必要时合图且最长边 ≤1024；可选 ≤512 版本」。鉴于当前仓库完全是零外部 GLB、纯 ES Module + Three.js r166.1 程序化几何架构，应明确**本轮锁定纯程序化 `THREE.Group/Mesh/InstancedMesh` 方案，不引入 `GLTFLoader`、外部 `.glb` 或新增图片纹理资产**，彻底消除异步加载失败与包体膨胀风险。
     - 第 7.2 节与第 9.2 节提议在 `band-scene.js` 每帧计算 `camera, viewport, protectedZones` 并传给 `props.update()` 做动态遮挡避让，这会迫使 `band-scene.js` 耦合 UI DOM 几何查询与复杂的屏幕空间投影计算。改为静态世界坐标安全区锚点后，无需扩大对 `band-scene.js` 的改动范围。
2. **方案与提供的当前源码有哪些具体冲突？（r166.1、30fps 节流、`setTheme/setLayout`、演员取景、录制）**
   * 已在上方 **P0-1、P0-2、P0-3、P1-1、P1-3、P2-1** 中完整定位并给出源码行号证据。
3. **`props` 模块、`effectsMode` 和保护区传递接口是否足够明确？是否存在反向依赖或需要不必要地改控制器？**
   * **完全不需要修改 `band-controller.js` 或 `band-study.js`**。`band-scene.js` 的 `update(frame, { settings, ... })` 已经拿到了包含 `settings.effects` 的完整 `settings` 对象，只需在 `band-scene.js` 第 205 行把 `settings.effects` 传给 `theatre.update(...)` 即可。
   * 原草案让 `props.update()` 接收 `camera, viewport, protectedZones` 存在不必要的反向耦合；应简化为只接收 `{ time, lighting, effectsMode, reduced }`，保护区通过编译期静态世界坐标约束 + `lighting.wingPower` 亮度让位实现。
4. **三主题侧景是否会挤占既有帆幕、七星球拱架、鸟居以及翼效/焰火？哪项最应删减或改造？**
   * **最应删减的 3 项小型点缀**：① 海贼王的「小型漂浮水滴」（与现有 14 个 `bubbles` 完全重叠）；② 火影的悬空「微型纸灯」（与鸟居两侧既有大灯笼重叠，改为浮岛面上的矮石灯笼）；③ 龙珠的悬空「小型轨道环」（在窄竖屏切割七星球拱架弧线）。
   * **最应改造的布局坐标**：窄竖向（`narrow`）下的两座浮岛不能放舞台外侧，必须移入后景高空双侧窗口（`x ∈ [±3.6, ±5.6], y ∈ [5.8, 9.8], z ∈ [-5.6, -4.0]`），并避开 `(±2.7, 8.1, -3.95)` 的高空礼花爆心。
5. **预算和测试是否能发现真实 GPU 成本、透明排序、切换泄漏、暂停/seek 与手机可见性问题？**
   * 原文档的测试矩阵缺少两项关键量化断言：① **手机端可见性断言**（在 `390×844` 视口下，必须断言每座浮岛包围盒中心经 `camera` 投影后的 NDC 坐标满足 `|x_ndc| ≤ 0.92` 且 `y_ndc ∈ [0.15, 0.85]`，防止「模型在场景里但全在屏幕外」假通过）；② **真实多 Pass 成本与零透射约束**（在单测中直接断言新增 `props` 所有材质满足 `transmission === 0 || transmission === undefined` 且 `castShadow === false`，从根源杜绝额外 Shadow/Transmission Pass 开销）。
6. **哪些数值缺少证据，只能保留为提案？哪些需要在设计稿/资产验证阶段先实测？**
   * **仅作为提案、需在阶段 2/3 实测微调的数值**：① 植物与晶体的高度比例（文档提议演员身高的 `0.35–0.65` 倍，即约 `1.0–2.0` 世界单位）；② 横向/窄竖向可见三角面上限（`45,000 / 20,000`，实际上程序化低多边形浮岛+实例化叶片建议控制在 **`≤12,000 / ≤6,000` 三角面** 即可达到精致效果，无需消耗 4.5 万面）；③ 呼吸频率与振幅（建议浮岛上下振幅 `≤ 0.12` 世界单位、角频率 `0.8–1.2 rad/s`，防止眩晕）。
7. **文档是否足以交给实施者？**
   * 补充下方第 4 节的替换接口、坐标表和生命周期规范后，即可直接作为实施规格说明书交付开发，无需改动任何控制器或音频模块。

### 四、可直接采用的替换文字与接口草案

可直接将以下内容替换进 `development.md` 的 **第 5.2、5.3、7.1、7.2、9.2、9.3 节**：

#### 1. 替换第 7.1 / 7.2 节：世界坐标锚点与屏幕保护区硬约束表

```markdown
### 7.1 世界坐标安全锚点窗口（横竖分治，严禁修改 `fitCamera`）

新增资产严禁注入 `band-scene.js` 的 `fitCamera()` 包围点集（保证镜头距离与 29 位角色像素大小 100% 不变）。为确保在 `390×844`（水平 FOV 约 16.1°）与 `1440×900` 下均完整可见且不遮挡演员、既有主题标志与礼花，锚点必须严格落入以下世界坐标窗口：

| 资产类别 | 横向布局（`!narrow`，`width=28`） | 窄竖向布局（`narrow`，`width=14.4`） | 避让依据（已核对源码坐标） |
| --- | --- | --- | --- |
| 主浮岛（左右各 1） | `x: ±[11.6, 13.8]`<br>`y: [2.2, 4.8]`<br>`z: [-4.2, -1.2]` | `x: ±[3.8, 5.4]`<br>`y: [6.0, 8.6]`<br>`z: [-5.5, -4.2]` | 横向置于半圆舞台外缘后侧；窄竖向置于第 3 层后排演员头顶上方（`y>5.2`）、背幕前（`z>-5.8`），保证 `|x_ndc| ≤ 0.88` 画面内可见且避开 `(±2.7, 8.1, -3.95)` 礼花爆心 |
| 岛面发光植物/主晶体 | 相对浮岛顶面 `Δy: [0, +1.65]` | 相对浮岛顶面 `Δy: [0, +1.15]` | 合成高度控制在演员身高（`3.05`）的 `0.35–0.55` 倍，不越过顶部桁架（`y=9.5 / 13.2`） |
| 后景远端小浮石（可选） | `x: ±[9.2, 10.8]`<br>`y: [5.6, 7.2]`<br>`z: [-5.1, -4.4]` | 窄竖向精简档设为 `0` 个（不生成） | 避开海贼双帆（`x≈±6.9`）、龙珠七星球拱架（`x∈[-9.9,9.9]`）、火影鸟居立柱（`x≈±7.6`） |
| 共用音箱塔 `speaker-stack` | `x: ±14.13, y: 1.9 & 3.5, z: -4.3` | `x: ±7.33, y: 1.9 & 3.5, z: -4.7` | 原位替换 `band-stage.js` L91 的 `speaker()` |
| 共用返听与功放 `monitor` / `amp` | `monitor: (±9.9, floor, z)`<br>`amp: (±11.7, floor, 0.5)` | `monitor: (±5.8, floor, 6.55)`<br>`amp: (±6.0, floor, -0.4)` | 原位精修替换 `band-stage.js` L93–94 的 `monitor()` 与侧边功放箱，不额外增加占地 |
```

#### 2. 替换第 9.2 / 9.3 节：模块接口、生命周期与 `band-stage.js` 接入规范

```js
// 1. 新增 js/ui/band-concert-props.js 接口定义
export function createConcertProps(parent, { palettes, lightTexture } = {}) {
  // 内部使用独立 rootGroup 挂载到 parent（不混入 band-stage 的 disposeTree(root) 范围，
  // 或由 band-stage 将 propsGroup 挂在独立于 stageRoot 的容器下）
  return {
    // 幂等配置：仅当 theme / narrow / quality 之一实际变化时重建主题装饰或更新设备矩阵；
    // 共用设备（speaker/monitor/amp/moving-head）几何与材质放入模块级/实例级共享池，切主题不销毁重建。
    configure({ theme = 'one-piece', narrow = false, quality = 'full' } = {}),

    // 无状态纯函数更新：相同输入必须产生完全相同的矩阵与材质参数（满足暂停、seek 与离线导出一致性）。
    // 动画激活判定：const motionActive = !reduced && effectsMode !== 'off';
    // 焦点让位系数：const focusDim = 1 - 0.35 * Math.min(1, Math.max(lighting?.wingPower || 0, lighting?.focusMix || 0));
    update({ time = 0, lighting = {}, effectsMode = 'auto', reduced = false } = {}),

    // 投影可见性与预算诊断（供单测与 Playwright 直接断言）
    projectBounds(camera),
    get diagnostics() {
      return {
        theme, narrow, quality,
        islands: 2,
        equipmentCount,
        decorCount,
        triangles,
        sharedGeometries,
        sharedMaterials,
        transmissiveCount: 0, // 强制 0 高透射，避免触发额外 _renderTransmissionsPass
        shadowCasters: 0,     // 侧景装饰强制 castShadow = false
        lastState             // 记录最近一次 update 的采样姿态摘要，供暂停/seek 测试断言
      };
    },

    // 仅释放本模块独占创建的 Geometry / Material；绝不 dispose 外部传入的 lightTexture
    dispose()
  };
}
```

```js
// 2. js/ui/band-scene.js 第 205 行最小改动（仅扩展最后一参数，无需改动控制器）：
lighting.focusMix = cameraPose?.focusMix || 0;
theatre.update(
  frame.time,
  fx,
  reduced,
  lighting,
  renderer.domElement.height,
  rows,
  settings.effects || 'auto'
);
```

```js
// 3. js/ui/band-stage.js 中修复 setTheme / setLayout 循环与暂停切主题同步刷新的规范写法：
// - 新增 const propsGroup = new THREE.Group(); scene.add(root, propsGroup, effects);
// - 将 createConcertProps(propsGroup, { palettes, lightTexture }) 挂在独立于 root 的 propsGroup 上，
//   防止 setLayout 中的 disposeTree(root) 误删 props 内部共享池。
// - 缓存已加载的 backdropTextures = new Map()；
// - setLayout(value, force = false) 内部同步执行 decorations() 与 props.configure({ theme, narrow, quality })，
//   若 lastUpdateArgs 存在则立即同步调用 props.update(lastUpdateArgs)，消除录制切画幅首帧空白与暂停切主题未刷新问题；
// - setTheme(next) 仅更新色调材质、theme-decor、props.configure({ theme, narrow, quality }) 与背幕贴图，
//   不再反向调用 setLayout(narrow, true) 重建整个阶梯与桁架。
```

### 五、最小可行实施顺序与验收补充

1. **阶段 1（修订文档并落盘审阅记录）**：将上述 P0/P1 修订更新至 `development.md`（升版为 v1.1），确认三主题删减后的点缀清单（海贼王去水滴留航灯、龙珠去轨道环留晶簇、火影去悬空纸灯留石灯笼）及窄竖向高空内侧锚点窗口。
2. **阶段 2（Stitch → AGY 设计方向稿确认）**：在已创建的 Stitch 项目 `12394834085042959558` 中生成海贼王、龙珠、火影三主题的横屏（`1440×900`）与窄竖屏（`390×844`）视觉方向稿，重点标出窄竖向后景高空浮岛窗口与前排翼效/焰火的关系，交用户确认。
3. **阶段 3（独立实现 `js/ui/band-concert-props.js` 与纯 Node 单测 `test/band-concert-props.test.mjs`）**：
   * 在不改动舞台主链路的前提下，先完成 `createConcertProps` 及其确定性采样函数。
   * 单测必须覆盖：① `configure()` 连续同参调用幂等性；② 三主题 × 横竖布局连续切换 20 轮后 `sharedGeometries / sharedMaterials` 数量恒定不增长；③ `t1 → t2 → t1` 跳转姿态与发光参数逐位相等（误差 `< 1e-9`）；④ `effectsMode = 'off'` 与 `reduced = true` 下所有动态位移归零，而 `effectsMode = 'auto'` 且 `fx.intensity = 0`（主歌）时保留基础轻呼吸；⑤ 新增装饰材质 `transmission === 0` 且 `castShadow === false`；⑥ `dispose()` 后不释放外部借用的 `lightTexture`。
4. **阶段 4（接入 `band-stage.js` 与 `band-scene.js`）**：
   * 解耦 `setTheme/setLayout` 的双向重建，挂载独立 `propsGroup`，原位替换旧内联设备（`speaker/monitor/amp/moving-head`），并在 `band-scene.js` 传入 `settings.effects || 'auto'`。
5. **阶段 5（浏览器与录制全矩阵回归 `test/band-concert-props.browser.js`）**：
   * 除文档第 11.1 节列出的检查项外，补充 **3 项强制量化验收**：
     1. **手机端视锥可见性断言**：在 `390×844` 与 `342×740` 下，通过 `props.projectBounds(camera)` 断言左右两座浮岛的 NDC 中心点均满足 `0.35 ≤ |x_ndc| ≤ 0.90` 且 `0.18 ≤ y_ndc ≤ 0.82`。
     2. **角色像素大小零退化断言**：接入前后在 `1440×900` 与 `390×844` 下对比 `window.luBand.diagnostics.camera.distance` 与前排主唱 `members[0].bounds`，确保镜头距离与角色屏幕占比 **100% 不变**。
     3. **首帧横竖切换录制无闪烁断言**：调用 `drawRecording` 连续切换 `1920×1080` 与 `1080×1920`，验证首帧背幕与主题装饰均同步就绪、无空白帧。

### 六、真正仍需用户决定的问题（D01–D07 均已锁定，不重复询问）

目前技术方案与架构边界已完全收敛，**没有阻碍进入下一阶段（Stitch 设计方向稿）的开放性技术问题**。唯一需要你在确认本审阅结论后拍板的流程事项是：

* **是否批准按上述修订（特别是：窄竖屏将浮岛移至后景高空两侧窗口以防手机裁切，并删去与现有气泡/灯笼重复的水滴和悬空小纸灯）更新 `development.md`，并推进到第 12 节的「阶段 2：生成三主题横/竖场景设计方向稿」？**
