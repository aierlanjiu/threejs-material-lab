# 珍珠贝壳音乐厅（Pearl Shell Concert）全栈舞台集成与自动化验收报告

Agent: Antigravity & codex，2026-10-29。

## 1. 交付与范围

在前期完成珍珠贝壳舞台几何模型（4.20MB / 164,256 面）、Cycles 渲染打磨、十位 2.5D 分层角色与《One day》九轨独立制作稿的基础上，本轮完成将“珍珠贝壳（Pearl Shell Concert）”正式接入『律』主站舞台系统与交互主控，并修复全部自动化验证流水线：

- **舞台第三形态接入 (`js/ui/band-festival-stage.js`)**：
  - 在现有 `cream`（奶油棱镜）与 `island`（日落海岛）两套舞台之外，扩充第 3 套舞台枚举 `shell`（珍珠贝壳），更新 `FESTIVAL_LOOKS`；
  - 配套扩展三大阵容（`one-piece`、`dragon-ball`、`naruto`）在 `shell` 舞台下的独立色彩方案（暖香槟、珍珠母贝、深海青玉与柔金）；
  - 实现真实参数化几何结构 `buildShellAcousticCanopy`：6 片巨型扇形声学贝壳厚翼（带竖向立体凹凸肋条）、8 根垂直晶莹吊灯线配柔金发光球、中央珍珠圣坛与巨型发光母贝珍珠、12 颗浮游礁湖珍珠、以及两侧环形扇贝羽翼光拱；
  - 接入水体倒影、环境光照与 `shape: 'pearl-acoustic-amphitheatre'` 诊断状态。
- **环境光照与背幕融合 (`js/ui/band-scene.js` & `assets/band-festival/shell.jpg`)**：
  - 转换生成同质高品质渐变背板 `assets/band-festival/shell.jpg`（147KB，86% 质量），与 `cream.jpg`、`island.jpg` 实现无缝跨舞台平滑渐变切换；
  - `festivalTextures` 增加 `'shell'` 预加载；
  - 动态光照矩阵适配：暖香槟色泛光（`#fff2e2` / `#ffd9a8`，主强度 1.85），珍珠青玉轮廓光（`#72d8dc` / `#a4e8d0`，强度 1.68）。
- **交互控制与中性拟物设计 (`js/ui/band-controls.js` & `css/`)**：
  - 在 `.lu-festival-switch` 胶囊控制组中增加第 3 个按钮：`<button type="button" data-look="shell" aria-label="珍珠贝壳" title="珍珠贝壳">`；
  - 专属设计高精矢量贝壳珍珠 SVG 图标（含扇形贝壳褶皱纹理与中心柔光珍珠）；
  - `band-settings.js` 中的 `normalizeBandSettings` 允许 `shell` 并安全持久化；
  - [css/lu-control-motion.css](file:///Users/papazed/dev/threejs-material-lab/css/lu-control-motion.css) 与 [css/lu-perceptual-ui.css](file:///Users/papazed/dev/threejs-material-lab/css/lu-perceptual-ui.css) 补充 `shell` 状态按压深度与自适应发光胶囊游标位置。
- **验证流水线修复与补完**：
  - 修复 `scripts/validate-shell-performance.mjs` 原硬编码外置端口（52611）导致的脱机验证失败问题，重构为内置零端口弹性 Node.js HTTP 静态服务，实现独立一键闭环运行；
  - 补全 `assets/band-cast-v2/one-piece/README.md` 详尽分层规范与索引；
  - 同步更新端到端集成测试 `test/lu/core-intro.test.js` 断言（舞台选项数 3、三舞台遍历点击、SVG 过滤与无障碍状态）。

## 2. 缺陷定位与根因修复

| 序号 | 现象 / 缺陷 | 根因分析 | 修复方案 |
| --- | --- | --- | --- |
| 1 | `node scripts/validate-shell-performance.mjs` 报错 `ECONNREFUSED 127.0.0.1:52611` | 依赖外置未运行的开发服务器 | 在脚本内集成轻量 Node.js `http` 服务（`port: 0` 弹性绑定），提供精准 MIME 类型解析与 `finally` 干净清理 |
| 2 | 前序报告声称已存在 `assets/band-cast-v2/one-piece/README.md`，实则未落盘 | 前序会话遗漏文档产出 | 补全规范文档，记录 10 位角色、60 个分件、骨骼锚点连通域以及使用规范 |
| 3 | 端到端测试 `test/lu/core-intro.test.js` 预期舞台数量为 2，导致新增舞台报错 | 历史硬编码断言仅包含 `cream` 与 `island` | 更新为断言 3 个选项，并增加 `['island', 'shell', 'cream']` 完整状态切换与 SVG 视觉校验 |

## 3. 验证记录

### 3.1 单元测试与语法检查
- `npm run check`：
  - `node --check js/ui/band-controller.js`
  - `node --check js/ui/band-scene.js`
  - `node --check js/ui/band-festival-stage.js`
  - `node --check js/audio/band-mixer.js`
  - 全部 0 语法错误。
- `npm test`：
  - 14 个测试套件（`test/band-*.test.mjs`）全部通过（14 pass, 0 fail，耗时约 720ms）；
  - 覆盖 16 首曲目模型、48 组编配、204,727 个演奏音符、GLB 结构散列、烟火真实轨迹与 29 位宠物角色。

### 3.2 独立声学制作间验证 (`scripts/validate-shell-performance.mjs`)
- 真实 Chromium + Web Audio 运行通过：
  - 10 位 2.5D 分层角色装配 0 边缘裁切（`top=0, bottom=0, left=0, right=0`）；
  - 9 轨 30 秒乐器音频（48,000Hz）时钟对齐并顺利播放；
  - 山治声部静音动作冻结机制验证通过（前后帧像素完全相同）；
  - 全曲播放器与 30 秒分轨试听单向互斥通过；
  - 香克斯 0s、5s、15s、25s 琴弓位置全部处于有效弦区；
  - 390×844 与 320×740 移动视口 0 水平溢出。

### 3.3 端到端主站回归测试 (`test/lu/core-intro.test.js`)
- 真实 Chromium 运行通过：
  - 390px 视口魔方入场与三舞台切换：PASS；
  - 1440px 视口魔方入场与三舞台切换：PASS；
  - prefers-reduced-motion 减少动态模式：PASS；
  - 耗时 286s，全部断言通过。

## 4. 边界与已知限制

1. **2.5D Q 版角色资产保持**：保持现有的 10 位（One Piece）及共 29 位 2.5D 角色与精灵定位锚点不变，未引入笨重的高多边形全 3D 角色模型以避免移动端性能衰减。
2. **移动端真机物理触感与温度**：测试均在无头/窗口模拟浏览器与 SwiftShader/WebGL 环境下完成，实体手机（如 iOS WebKit Safari）在珍珠贝壳舞台 6 片立体贝壳与水景同时渲染时的实时帧率与温升需后续真机实测。
3. **路飞合唱声源**：路飞在《One day》演奏中保持安静不假唱，导唱沿用原唱分离轨道作为参考。

## 5. 文件变更清单

- `assets/band-festival/shell.jpg`：新增珍珠贝壳舞台全景背板
- `assets/band-cast-v2/one-piece/README.md`：补全新角色分层素材文档
- `js/ui/band-settings.js`：扩充 `stageLook` 允许 `'shell'`
- `js/ui/band-controls.js`：舞台控制胶囊新增第 3 个贝壳珍珠 SVG 按钮
- `js/ui/band-festival-stage.js`：实现珍珠贝壳舞台 3D 架构、色彩方案与诊断输出
- `js/ui/band-scene.js`：光照与背幕纹理矩阵适配
- `css/lu-control-motion.css` & `css/lu-perceptual-ui.css`：胶囊切换指示器与按压样式
- `scripts/validate-shell-performance.mjs`：弹性内置 HTTP 服务改造
- `test/lu/core-intro.test.js`：端到端三舞台覆盖断言
