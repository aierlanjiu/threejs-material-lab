# 『 律 』LÜ — 乐队模式双户外音乐节舞台（奶油棱镜 / 日落海岛）深度视觉对齐报告

**日期**：2026-10-26  
**会话关联**：延续并收口 `codex://threads/01a171ea-aa0f-7730-b8b3-043d2162a158`

---

## 1. 对齐目标与问题根因拆解

通过对前序进度与两版批准概念图（`C 奶油棱镜` 与 `D 日落海岛`）的逐项对比，以及与用户的四项核心对齐确认，定位并彻底消除了以下 4 个核心视觉断层：

1. **A1 · 画面空间与水天交界线（消除底部米色遮罩断层与双地平线冲突）**：
   - **根因**：旧版在 `css/lu-control-motion.css` 中将 `.app` 高度截断为 `calc(100dvh - var(--band-dock-height) - ...)` 并对 `.lu-band-scene` 叠加底部渐变遮罩，同时远景天幕平面将 `cream.jpg` / `island.jpg` 下半幅的静态 2D 水面映射至 `z = -65, y = -56..22`，与 `y = -0.66` 的 3D `Reflector` 水面产生上下两道地平线与动静水面打架。
   - **修复**：
     - 在 [js/ui/band-festival-stage.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-festival-stage.js) 中将远景天幕平面下底精准锚定在 `y = -0.68, z = zHorizon`（桌面 `-25.5`、移动 `-16.5`），仅采样全景图上半幅的天空、云层、远山与海岛礁石（`cream: uv.y ∈ [0.496, 0.992]`、`island: uv.y ∈ [0.546, 0.992]`），彻底剥离 2D 静态水面。
     - 3D `Reflector` 实时水体从同一水天交界线 `z = zHorizon` 无缝向前铺展至屏幕最底端（`z = zHorizon + 100`），叠加环舞台浅滩礁石渐变、岸线波纹泡沫环、菲涅尔反射与节拍驱动的落日金斑。
     - 在 [css/lu-control-motion.css](file:///Users/papazed/dev/threejs-material-lab/css/lu-control-motion.css) 中令 `body.lu-band-mode[data-festival-look] .app` 与 `.stageWrap` 全屏铺满 `100dvh`，移除 `.lu-band-scene` 底部遮罩与移动端顶部毛玻璃横条，使底部播放胶囊直接悬浮在实时 3D 水体浅滩之上。

2. **A2 · 主舞台建筑结构与侧翼陈设（深度还原概念图 C / D 并接入 12 组自包含 GLB 模型）**：
   - **奶油棱镜（`cream`）**：三层海沫玉磨砂玻璃阶梯看台（`MeshPhysicalMaterial`，关闭嵌套 `transmission` 以消除 `Reflector` 渲染时的 `glCopyTexSubImage2D` 越界告警，保留高光清漆与虹彩折射）、后方左右双翼环抱式 5 格香槟金框弧形竖纹棱镜玻璃屏风、每侧 4 盏错落垂挂的暖光玻璃球吊灯、外翼香槟金光环拱门与前景黄铜底座虹彩珍珠球。
   - **日落海岛（`island`）**：暖木镶嵌弧形阶梯剧场、每层阶梯前缘内嵌暖光星点踏步灯（`stepBeaconMat`）、浅海金色沙洲托盘、木鼓底座海滩暖光灯笼，以及具有三维受风弧度（`belly camber`）、木质桅杆、横桁与金色索具的双侧三角风帆。
   - **GLB 3D 资产全量接入**：在 [js/ui/band-concert-props.js](file:///Users/papazed/dev/threejs-material-lab/js/ui/band-concert-props.js) 中加载全部 12 组自包含 GLB 模型（`speaker`, `monitor`, `amp`, `truss`, `lamp`, `bamboo`, `coral`, `crystal`, `grass`, `island`, `lantern`, `quartz`, `bonsai`），剔除廉价低多边形占位几何体。

3. **A3 · 底部播放栏与风格切换器布局（紧凑单行桌面胶囊 & 移动端零重叠 3 行胶囊）**：
   - **桌面端（`1280×720`）**：`#luAppleDock` 收敛为 `86px` 高的奶油暖白毛玻璃悬浮胶囊，将 `.lu-festival-switch`（`奶油棱镜 | 日落海岛`）与曲目信息、播放控制、模式/录制按钮同行内嵌为 `"track transport looks actions"`，底部贯穿流光进度条。
   - **移动端（`<= 760px` 至 `320×680`）**：收敛为 `136px` 高的三行毛玻璃胶囊（`"track track order looks looks looks"` / `"prev play next stop mode record"` / `"timeline..."`），全部可见交互按钮触控热区 `>= 44×44px`、零重叠、零横向溢出。

4. **A4 · 三大动漫主题差异化与音乐律动光效**：
   - **海贼王（`one-piece`）**：海蓝与珊瑚色调 + 高精 3D 珊瑚群（`coral.glb`）+ 航海提灯（`lantern.glb`）+ 海岸迎客松（`bonsai.glb`）+ 黄金航海星盘轨 / 迎风双帆。
   - **龙珠（`dragon-ball`）**：琥珀金与翠玉色调 + 琥珀石英簇（`quartz.glb`）+ 能量水晶（`crystal.glb`）+ 盘旋金龙气旋弧线与 7 颗悬浮发光龙珠球体。
   - **火影忍者（`naruto`）**：雾蓝与朱砂木色调 + 苍松盆景（`bonsai.glb`）+ 翠竹林（`bamboo.glb`）+ 朱红木纹鸟居长廊与垂挂和纸暖光灯笼。
   - 所有发光灯带、吊灯球芯、海滩灯笼与水面高光均随节拍（`beat` / `downbeat`）同步呼吸，并在 `prefers-reduced-motion: reduce` 或特效关闭时保持平静态。

---

## 2. 自动化测试与多断点实机验证结果

| 验证项 | 结果 | 产物 / 证据路径 |
| :--- | :--- | :--- |
| JS 语法检查（`node --check`） | **PASS** | `js/ui/band-festival-stage.js`, `js/ui/band-scene.js`, `js/ui/band-concert-props.js` |
| 5 组 Node 单元与资产预算测试（`node --test`） | **PASS (5/5)** | `band-concert-models`, `band-refinement`, `band-scenography`, `band-stage`, `band-v2` |
| 浏览器 WebGL 60 状态与资源稳定性回归 | **PASS** | [browser-regression.json](file:///Users/papazed/dev/threejs-material-lab/output/festival-align-20261026/browser-regression.json)（`states: 60`, `resourceStableAfter20LookSwitches: true`, `captureSizes: 6`, `disposed: true`） |
| 12 张实机截图（2 风格 × 3 主题 × 桌面/移动） | **PASS (12/12)** | [review.html](file:///Users/papazed/dev/threejs-material-lab/output/festival-align-20261026/review.html) 及 `output/festival-align-20261026/*.png` |
| 4 断点 UI 布局与播放期切换验证（`1280×720`, `390×844`, `342×700`, `320×680`） | **PASS** | [ui-metrics.json](file:///Users/papazed/dev/threejs-material-lab/output/festival-align-20261026/ui-metrics.json)（`undersized: []`, `overlaps: []`, `scrollWidth === clientWidth`, `320×680` 歌单/录制浮层无裁切） |

---

## 3. 未验证范围声明（Honesty Boundary）

- 本次验证在本地 macOS Chromium WebGL 环境下完成；未在真实 iOS / Android 物理手机 GPU 上测试长时间发热降频表现，也未在真实弱网环境下测试首次冷加载耗时。
