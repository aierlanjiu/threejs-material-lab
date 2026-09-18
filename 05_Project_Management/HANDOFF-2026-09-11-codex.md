# 『 律 』(LÜ) 交接文档 · 2026-09-11 收工点

> 交接方：大江南（DSH 会话）
> 接收方：Codex
> 仓库：`/Users/papazed/dev/threejs-material-lab`
> HEAD：`1186b80`（今日全部改动**均未提交**，详见第 0 节）

---

## 0. 一句话现状

今天围绕**产品定位校准**做了一系列体验改造：定位从"素材生产工具"校正为**个性化音乐氛围装置**（用户实时互动、录下来分享给朋友）。落地四件事：静息待机态、入场错时、角色默认在场 + 取景修正、自定义图集盲盒。

**代码能用、四条回归全绿、双副本同哈希。但一行都没提交，且有三个待 zedpapa 拍板的决策卡在后面。**

---

## 1. 环境与验证方式（接手第一件事）

### 开发服务（已常驻后台）

```bash
cd /Users/papazed/dev/threejs-material-lab
python3 -m http.server 8099 --bind 127.0.0.1
# 打开 http://127.0.0.1:8099/index.html
```

### 回归套件（4 个，全部通过）

```bash
cd /Users/papazed/dev/threejs-material-lab

node test/lu/idle-rest-state.test.js                       # 静息待机态
node test/lu/arrival-stagger.test.js                       # 入场错时
node test/lu/album-blindbox.test.js                        # 图集盲盒
LU_URL=http://127.0.0.1:8099/ LU_QUICK=1 \
  node test/lu/main-view-geometry.test.js                  # 几何契约 / 穿模
```

⚠️ **两个必须知道的坑**

1. `main-view-geometry.test.js` 源码里默认指向 `127.0.0.1:8091`，**必须显式传 `LU_URL`**，否则 `ERR_CONNECTION_REFUSED`。
2. **不要给 `album-blindbox.test.js` 加 CDP 虚拟时钟。** `createImageBitmap` 在 `Emulation.setVirtualTimePolicy: 'advance'` 下永不 resolve，整个导入流程会静默挂死（该测试初版就是这样超时 300s 且零输出的，原因已写进测试注释）。其余三个测试**必须**用虚拟时钟，因为 headless 下 rAF 被节流到 1–5fps。

### 双副本铁律

`index.html` 与 `threejs_material_lab/index.html` **必须同哈希**。两份都被 git 追踪，改一份忘了同步就等于埋雷。

```bash
cp index.html threejs_material_lab/index.html
diff -q index.html threejs_material_lab/index.html && shasum index.html threejs_material_lab/index.html
```

---

## 2. 未提交状态盘点（需要你决定怎么收口）

```
HEAD = 1186b80，无未推送提交
已修改已追踪：
  M index.html                          今日全部改动都在这里
  M threejs_material_lab/index.html     已同步同哈希
  M 05_Project_Management/progress.md   今日记录
  M .gitignore                          非本会话改动，来源不明
未追踪（大量）：
  test/                                 今日新增 3 个测试（main-view-geometry 更早）
  output/                               截图与取证
  package.json / package-lock.json      playwright 依赖
  xiangqi.html / assets/xiangqi/ / js/ / css/ / server.py / XIANGQI_DESIGN.md
  THIRD_PARTY_NOTICES.md
  05_Project_Management/Reports/*.md    全部报告均未追踪
```

**建议**：把 `test/`、`package.json`、`package-lock.json`、`05_Project_Management/Reports/` 纳入提交（回归与报告是资产）；`output/` 视体积决定是否忽略；象棋相关那批（`xiangqi.html`、`assets/xiangqi/`、`XIANGQI_DESIGN.md`）是既有工作，**不要夹带**进本轮提交。`.gitignore` 的改动来源不明，提交前请先确认。

---

## 3. 今日完成的工作（按时间序，每项都有独立报告）

| # | 事项 | 报告 | 实质 |
| --- | --- | --- | --- |
| 1 | 主画面毛边与穿模修复 | `Reports/2026-09-11-lu-main-view-geometry-fix.md` | **上一会话遗留的收尾**。后处理缓冲补 4× MSAA；建立「主画面几何契约」（格距统一推导）、目标层精确 OBB 避让求解器、渲染层占位兜底 |
| 2 | 静息待机态 | `Reports/2026-09-11-lu-idle-rest-state.md` | 未演奏时装置自主呼吸（原先波形/相机/序幕**全部挂在播放态上**，没音乐就是死的） |
| 3 | 入场错时 | `Reports/2026-09-11-lu-arrival-stagger.md` | 方阵按对角坐标一站站长起来；稀疏内容时角色抢第一拍 |
| 4 | 角色默认在场 + 取景与 FOV | `Reports/2026-09-11-lu-avatar-default-and-frame.md` | 默认改为角色模式；FOV 12–85；取景系数 1.12 → 0.74（主体占屏 35% → 69%） |
| 5 | 自定义图集盲盒 | `Reports/2026-09-11-lu-album-blindbox.md` | 整目录导入照片，每格稳定哈希抽一张 |

**权威实时状态看 `05_Project_Management/progress.md`（已瘦身，123 行）；长内容一律在 `Reports/`，不要在 progress 里堆流水。**

---

## 4. 待决策（卡住后续开发，需要 zedpapa 一句话）

### D1. FOV 滑块要不要同时改变主体大小？★ 最优先

现状：`framingDistance()` 带取景补偿，拖 FOV 时相机距离跟着变，**主体大小基本不变，只变透视感**（实测 FOV 30/12/85 三档相机距离恒定）。

- 若要"FOV 同时改大小"：去掉补偿，滑块语义从"焦段"变成"缩放"。
- 代价：`framingDistance()` 同时服务于阵型切换与取景，去掉补偿会影响换阵时的自动取景，需要拆分两条路径。

### D2. 图集要不要跨会话保留？

现状 `state.imageAlbum` 存的是会话内 Blob/bitmap，**刷新即失**。要保留须落 IndexedDB。另一个选项是只存文件句柄（File System Access API），但兼容性差。

### D3. 抽取策略：有放回 vs 洗牌式？

现状均匀有放回，16 格抽 12 张会出现重复（实测首轮出现 9 种）。洗牌式会"先铺满一轮再重复"，但会把"重新抽取"的语义变成"重新洗牌"。

### D4. 未提交内容怎么收口？

见第 2 节的建议。`test/`、`Reports/`、`package.json` 建议纳入提交；象棋那批不要夹带。

---

## 4b. 分享链路现状（已核实，属于长期待办）

zedpapa 已明确"分享"= 用户把自己这段演奏录下来发给朋友（不是导出预设）。据此核实了现有实现：

**做对的两点（不要动）**
- 录制目标是 `stage.querySelector('canvas')`，**UI 没有被录进去**，出来的是纯画面。
- 录完自动 `a.click()` 触发下载，是一键流程。

**两个已确认的缺口**
1. **`navigator.share` 全项目不存在**（已 grep 确认）。现在只能落盘到下载文件夹，用户要自己再打开微信、找文件、发送。从"心动"到"发出去"中间隔着好几步，每一步都会漏人。
2. **画幅与体积不匹配**：画布按窗口长宽比渲染，桌面是 16:9；朋友在手机上竖屏看，画面缩成中间一条。且 16Mbps × 3 分钟 = 360MB，而微信聊天视频上限约 25MB —— **"愿意分享"和"发得出去"之间隔着一道墙**。

**技术方向（未实施）**：导出走**独立的 9:16 离屏 Canvas 通道**，与实时预览解耦（不要改 stage 画幅，那会把桌面实时预览变成一条窄缝、毁掉在场体验）；码率与时长按"发得出去"重定标（1080×1920 / 30fps / 6Mbps / 45s ≈ 34MB）。

---

## 5. 建议的下一步（我的排序与理由）

按"减少出戏"排序，而不是按好看程度：

| 优先 | 事项 | 为什么 | 体量 |
| --- | --- | --- | --- |
| 1 | **消灭卡顿** | 基线 P95 ≈ 26ms，**已超 60fps 的 16.7ms 预算**。氛围装置里一次卡顿就是出戏；且录制是 `canvas.captureStream(60)` **实时**采集，掉帧会直接写进母带 | 中，需先实测定位 |
| 2 | **沉浸模式仪式化** | `setImmersive()` 已存在（`F` 键 / 右上角按钮），但被当成逃生口。用户需要清晰的"造境 → 在场"两段式，现在两段糊在一起，装置从不宣布"演出开始" | 小中 |
| 3 | 角色从"全方阵群像"提升为主角 | 现在是 16 个同一角色，主语感弱。可考虑"中心单体 + 周边晶体" | 小 |
| 4 | 长时段 session 曲线 | `isChoreographyShow` 目前是匀速轮转（`morphIntervalBeats=16`），20 分钟里用户会学会并脱离。需要"开场震撼 → 中段平稳 → 一次转折 → 缓慢落下" | 中 |
| 5 | 玉牌（薄板翻转）形态 | 几何推导已完成（见第 7 节），但**优先级最低**——它服务于"抚慰节律"，而前三项服务于"不出戏" | 中 |

---

## 6. 结构性技术债（不是 bug，但会持续拖慢开发）

1. **`state` 有 60+ 字段互相耦合**，无人能回答"我按了 A 和 B，画面为什么是这样"。
2. **音乐是实时 FFT 而非谱面**：无法编排"副歌进场时全阵列翻转"，因为副歌何时来只有播到才知道。建议抽 `Material / Form / Program / Content` 四轴，`Score` 作为时间轴一等公民。
3. **`contentMode` 把"内容类型"与"排布方式"混在一起**（`avatarDist`、`imageDist`、`layerMode` 各写一遍）。图集盲盒与角色盲盒目前是**两套独立机制**，要混排必须统一成一条内容源抽象。
4. **无确定性**：`state.time` 由真实时间驱动，同一参数两次录制结果不同——"同款再来一批"物理上不成立。若后续要做可复现导出，需要单一时间源 + 状态指纹。

---

## 7. 已有但未实装的推导：玉牌（薄板）形态

上一轮会话推演过"玉牌翻幕"方案，**结论已算清但一行没写**，需要时可直接用：

- **形态**：`1 × 1 × 0.35` 薄板。⚠️ **不能靠 `scale.z = 0.35` 做薄**——会把倒角半径 0.2 在 Z 向压成 0.07，倒角变椭圆、镜面高光全废。必须重建几何工厂为 `createRoundedPlateGeometry(radius, depth)`，注意 `radius ≤ depth/2`。
- **贴图位置是硬编码的**：`localFrontZ = 0.508 / localBackZ = -0.508` 按厚度 1.0 算的，改厚度后 decal / 内雕 / 徽章层全部失准。
- **45° 抬升有解析解**：`Y_lift(θ) = |sin 2θ| · (√(1+d²) − 1) / 2`，d=0.35 时峰值 **0.0297**（不抬升会与邻块相撞，最小缝隙只有 0.08）。
- **横向不必加宽格距**：d=0.35 的支持函数峰值 0.5270，**小于**现行 `ROTATION_ENVELOPE`（13.5° 时的 1.12 对应值），横向富余很大。
- **真正的卡点**：`scaleCap` / `renderedCap`（包络补偿）会在 180° 翻转中途把牌缩到 61%——必须给翻转通道单独开口。
- **接触阴影要跟着朝向调制**：`updateContactShadows()` 用中心高度算 spread，翻转时会跳；牌侧立时阴影应收窄变淡。

---

## 8. 代码地图（`index.html`，6739 行，行号会随编辑漂移，仅作定位起点）

| 行 | 内容 |
| --- | --- |
| 2125 | `TIER_CONFIGS`（3 档律动参数） |
| 2186 | **主画面几何契约**（空间预算，穿模防护的根） |
| 2210 | `activeGeometry()` 格距推导 + 缓存 |
| 2239 | `framingDistance()` 取景距离（含取景系数，`?framek=` 可覆盖） |
| 2569 | `createRoundedSquircleGeometry()` 几何工厂 |
| 3048 | **自定义图集盲盒**（解码/缓存/稳定抽取） |
| 3068 | `albumPickFor()` 稳定伪随机（⚠️ 取模前必须 `>>> 0`） |
| 3152 | `createTypographyTexture()` |
| 3643 | `commitMatrixRebuild()` 矩阵构建入口（入场时间片、密度判定都在这） |
| 4998 | `updateMasterChoreography()` |
| 5311 | `resolveTargetSeparation()` OBB 避让求解器 |
| 5390 | `animate()` 主渲染循环 |
| 5473 | **13-b 静息待机态**（`idleBreath` 包络） |
| 6689 | `window.luDiagnostics` 只读诊断入口（测试全靠它） |
| 6700 | 初始化启动段（角色预热在这里） |

**只读诊断入口**：`window.luDiagnostics` 暴露 `renderer / composer / camera / scene / matrixGroup / geometry / separation / pitch`，回归测试全部通过它读取真实运行时状态——**新增测试请复用它，不要另开全局**。

---

## 9. 今天踩过、值得记住的坑（都是真实发生过的）

1. **`arrived` 跨两个 `forEach` 作用域** → 主循环第二帧崩，`state.time` 冻在 0.017。教训：**崩溃会让"画面看起来还在跑"，必须给断言配"求解器确实在工作"这类反空转检查**。
2. **入场逻辑一度是死代码**：按 `oldPose` 门控缩放，但重建时 `previous[slotIdx]` 总是有值，旧位姿被整段继承。教训：**"走到新建分支"本身就等价于"这是新单元"**，不要去判断其实永远为真的条件。
3. **`shouldRenderContent` 在材质模式下默认为 `true`**，拿它当"内容优先"条件 → 全场挤在同一时间片、错时彻底失效。教训：判断"内容密度"而不是"这一格有没有内容"。
4. **稳定哈希取模前必须 `>>> 0`**：`h ^= h >>> 16` 会把结果拉回有符号 32 位，负数取模得到负索引 → 部分格子静默无图。
5. **测试断言本身会错**：曾断言"径向距离序 → 时间片序单调"，但对角扫掠本来就不按距离排序。教训：**断言失败先怀疑断言**。
6. **虚拟时钟会让虚拟时间大步跳帧**（实测一帧跨 0.8s），逐帧观察中间态的测试不可靠；主判据应放在**确定性事实**（如"入场时间表"）上。

---

## 10. 交接检查清单

- [ ] 读 `05_Project_Management/progress.md`（123 行，实时状态）
- [ ] 启动 8099 服务，肉眼过一遍默认首屏与 `F` 沉浸模式
- [ ] 跑通 4 个回归（注意 `LU_URL` 与虚拟时钟那两个坑）
- [ ] 确认 `index.html` 与工程副本同哈希
- [ ] 找 zedpapa 定 D1 / D2 / D3
- [ ] 决定未提交内容的收口方式（第 2 节建议）

---

*本文件为交接专用，不替代 `progress.md`（实时索引）与 `Reports/`（长文报告）。*
