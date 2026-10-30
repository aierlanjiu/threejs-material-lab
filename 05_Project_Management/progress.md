# Project Progress

## PR #2 · Entire 审查整改 · 2026-10-30

- Action: 保留当前原声直通、跨曲阻断旧引擎、审查页改读分析候选；合入master并保留双方入场／角色功能，修复四处冲突。Agent: codex。
- Validation: 音频wrapper新增6项先红后绿，Node28/28与特效7/7通过；独立检查agent复核增量无阻塞。审查页／两套特效及入场390／1440／减少动态浏览器通过；上传端到端未完成，线上门禁以PR对应head为准。Agent: codex。
- Report: [修复、复核与审查状态](Reports/2026-10-30-pr2-entire-review-fixes.md)；备份分支`backup/pr2-entire-review-20261030-d6b5c90`，证据`output/pr2-entire-20261030/`。Agent: codex。

## 十人完整角色动作扩展 · 2026-10-30

- Action: 按用户确认的原完整人物形式，十人各新增16整帧，演奏／重拍／休止接入主站与制作间；保留贝壳GLB。Agent: codex。
- Validation: 十人17格、原资源未改、播放／暂停／静音休止、390／320及Node22/22通过；路飞／山治仍缺部分过渡姿态，连续流畅度待观看；音乐未改。Agent: codex。
- Report: [十人动作与验收边界](Reports/2026-10-30-lu-intact-sprite-animation.md)；预览`sprite-animation-review.html`，备份／证据`output/sprite-animation-20261030/`。Agent: codex。

## Entire 智能体版本控制集成 · 2026-10-30

- Action: 卸载家目录误初始化的 Entire 钩子并安全归档临时空 Git 仓库；在『律』主项目（`threejs-material-lab`）中正式启用 Entire 检查点跟踪，挂载 Antigravity, Claude Code, Codex, Cursor, Pi 等智能体集成。Agent: 大江南。
- Validation: `entire status` 与 `entire doctor` 检查全部通过；Codex、Claude Code、Pi 等 8 个智能体钩子均已生成对应配置（`.entire/`、`.codex/`、`.claude/` 等），家目录恢复非 Git 净态。
- Status: 项目级检查点跟踪已激活；代码提交时将自动关联智能体上下文会话并同步至 origin。

## 入场背景 ASCII / Dither · 2026-10-28

- Action: 保留全幅对比与随景字形流动；修正 Dither 仅有微光的问题，冷色／云雾附近的 Bayer 颗粒循环换位，照片和暖色物体保持原位，复用四张量化缓存。
- Validation: Node 7/7、三尺寸通用浏览器与三主题双尺寸 Dither 回归通过；Dither 旧实现先红后绿，纹理双向变化、中央稳定、缓存复用及静止／减少动态停帧均断言；主入场仍待验，保留草稿。
- Report: [实现、适配取舍与验收](Reports/2026-10-28-lu-intro-ascii-dither.md)。Agent: Codex。

## 象棋独立与最新 Pages 发布 · 2026-10-26

- Action: 提交 AGY 最新舞台／音频改动，将象棋 62 份页面、源码、素材、测试及专属文档迁入 [lu-xiangqi](https://github.com/aierlanjiu/lu-xiangqi)，调整律的 package／服务器与可独立运行的乐队测试。
- Backup: 删除前逐文件核对副本并记录 `backup/agy-source-before-xiangqi-split-20261026-211222`（8d82e189）；Pages 原版本恢复引用保留。无关 film 与试片保留在原位。
- Validation: 拆分后律 Node 14/14、E2E 19/19；象棋规则／AI／桌面手机 E2E 通过。Pages 79cf7e6 构建成功、19 文件摘要一致、三条象棋旧址 404；线上实际播放约 60 fps，实体手机未验；收尾新增的两份按钮材质修改留在本地、未纳入发布。
- Report: [拆分与发布记录](Reports/2026-10-26-lu-xiangqi-extraction-and-pages.md)。源码 a18f207；象棋 de1e592。Agent: codex。

## Codex 交付审计与视觉对比度/拍频杂音专项修复 · 2026-10-26

- Action:
  1. 复核 Codex 交付成果（Phase 1/3/4/6）：rAF 与 UI 分频（60fps 渲染 / 30Hz DOM）、投影/包围盒缓存、Retina 768×144 铭牌、拖拽抬升 0.24 + 阻尼落地弹簧、550ms 双舞台无损交叉过渡、串行空闲材质预热；14/14 Node 测试与 19/19 E2E 测试均绿灯。
  2. 修复问题 1（舞台材质、聚光灯与焰火对比度）：降低环境散光过曝（fill 光强由 3.1 降至 1.85，消除泛白过曝），聚光灯主灯光强由 30 提升至 85、halo 投射光圈透明度由 0.24 提至 0.58、体积光束提至 0.45、领奏追光提至 95；重构地面 Shader 交互光环使其高亮自发光（×1.45 + alpha 增强），重置海岛舞台柚木色（`#784c2a` / `#5c361c`）与奶油舞台深玉色阴影（`#385a54`），焰火粒子提升核心白热发光比与炽热拖尾。
  3. 修复问题 2（独奏与主声部拍频杂音）：确认声学拍频诱因，12 平均律 SoundFont 采样与录音母带的模拟微音差（±5~15 cents）高次泛音拍频通过 `band-sample-player.js` 的 8600Hz 温润低通抑制消除；解码器采样率从写死的 22050Hz 对齐系统 `ctx.sampleRate`（44100/48000Hz），消除重采样相位延迟与人声梳状滤波；独奏状态保持 `soloBed` 原曲母带微量衬底，无声部撕裂。
- Validation: 乐队全量 Node 14/14、Chrome E2E 19/19 全部一次通过；Playwright 真实 60.12 FPS 渲染、30Hz UI 节拍；Phase 2 空间音频位置映射（左右声道声像、前后深浅距离衰减与高频空气吸收）全项断言验证通过；4 组实机截图（奶油日景、现场聚光灯/焰火、海岛黄昏、海岛手机端）视觉对比度饱满深邃。
- Status: 本地调试与双问题修复完毕；全套测试绿灯；待用户确认。
- Agent: Antigravity。

## 图形、交互与历史回归维护 · 2026-10-26

- Action: 按模板完成 Phase 1／3／4／6：rAF 与 UI 分频、投影和 DOM 缓存、Shader 光环、拖拽落地、高清铭牌、同步模式过渡、双舞台渐变及串行空闲预热；保留 Phase 2，未实施分享功能。
- Validation: 乐队 Node 14/14、规则／AI、E2E 19/19、WebGL 60 状态与 15 张桌面／手机实景通过；本机播放短采样约 60.06 fps、UI 约 30Hz；空间音频保护文件摘要及既有 DOM ID 一致。
- Status: 本地完成，未更新 Pages；已维护用户批准的历史测试，修复纯音乐多余译词请求及减少动态入口遮挡；实体手机、弱网与整首录制未复验。
- Report: [实现与验收](Reports/2026-10-26-lu-graphics-interaction-upgrade.md)，证据 `output/band-upgrade-20261026-161545/`；改动前快照 `backup/band-upgrade-20261026-161545`。Agent: codex。

## Current State

- 开发流程：本地完成后由独立代码检查agent复核，创建／更新PR并读取Entire审查整改；合并与发布另按用户指令。Agent: codex，2026-10-30。

- 本地／源码：AGY 最新版与象棋独立已完成，律仅保留音乐工作台与荔；源码分支 feat/band-prism-pet-stage，独立象棋仓库 aierlanjiu/lu-xiangqi。
- 线上版本：2026-10-26 Pages 79cf7e6 已构建发布，运行树 891.18 MiB，含 AGY 最新代码、不含象棋；公开文件摘要与实际播放已核对。
- 核心音频沿用此前 16 首全曲原曲优先混音、三主题 48 份独立编配与 382 份音频；点按停独立声部并减弱对应原曲声部，长按保留轻原曲背景。历史交付见 [全曲原曲优先与独立角色混音](Reports/2026-10-16-lu-full-song-hybrid.md)。
- 验收边界：本机短时播放、自动化布局与有声短片已验；逐曲人工校谱、主观音色、实体手机性能、弱网及整首导出尚未在本轮复验。

## Active Assets

- 海贼十人整帧：`assets/band-pet-actions/`；逐人预览`sprite-animation-review.html`，总览`output/sprite-animation-20261030/all-cast-actions.mp4`。Agent: codex。

- 三主题最终陈设入口：`http://127.0.0.1:8765/index.html?intro=skip&band=pianai&concertLook=obsidian`；新增模型与授权：`assets/models/band-scenography/manifest.json`，署名入口沿用 `assets/models/band-concert/credits.html`。普通入口继续使用原方向。
- 单曲舞台：`http://127.0.0.1:8000/index.html?intro=skip&band=bolero`，进入后点击原播放键开始；直接角色交互，无新增指挥面板。Web 十轨与事件在 `output/lu-band-arrangement/bolero-trial/web/`，本轮证据在 `output/playwright/band-direct-pets/`。
- 用户已认可的改编试听：`output/lu-band-arrangement/bolero-trial/bolero-pet-ensemble.mp3`；快速合奏试听 `bolero-full-band-excerpt.mp3`，原 WAV／MIDI／事件保留。后续是否扩展其他曲目由用户决定。
- 『律』主入口 `index.html`；本地预览 `http://127.0.0.1:8000/index.html?intro=skip`，选择「演出 → 乐队」。『荔』为 `mascot_studio.html`／`li.html`；『弈律』为 `xiangqi.html`，共用本仓库。
- 29 位原 pet／头像／乐器：`assets/band-pets/`、`assets/live-avatars/`、`assets/instruments/`。声部匹配按已批准的乐器家族进行，证据不足的演员休止，不重绘角色或伪造谱面。
- 实际声部数据：`output/lu-band-song-parts/`；校正汇总 `corrected-lu-band-mapping.json`，逐曲 `family-classification.json`／`family-bindings.json`。原 AGY 映射保留，实际共 137 段。人工校验入口 `band-review.html`。
- 核心控制：`js/audio/band-conductor.js`、`band-mixer.js`、`band-arrangement.js`、`band-family-bindings.js`；直接角色交互 `js/ui/band-member-interactions.js`。分析与打包入口位于 `scripts/`；音频／权重／分析产物位于忽略目录 `output/`，发布前须明确打包依赖资产。
- 当前验证证据：`output/playwright/band-conductor/`。有效样片为 `verified-landscape.mp4`／`verified-portrait.mp4`，含 H.264 与 AAC；不能以本轮软件 GPU 样片作为流畅度通过证据。

## Next Action Rules

- 关键变更在本页保留 3–5 条简短索引；验证细节写入 `Reports/`。最近详细成果保留 5–8 条，长记录无损归档。
- 继续工作前核对当前工作树与相关报告，保留未提交改动；清理旧资源前按用户规则完成备份与记录。
- 继续保留原 pet；模型估计、人工核验、文件结构通过与硬件性能通过分别表述。正式发布前明确完整音频及分析数据的交付方式。

## Historical Index

- 合入master后的完整进度已无损归档：[归档入口](Reports/progress_full_archive_20261030_before_entire_fixes.md)，SHA-256 `5464a3cd2b2d16ef9138fd34071dd14b5b08c6ba604c89cd59684a48e5e97ac0`；含入场、Entire接入及此前报告索引。Agent: codex。
