# Project Progress

## Current State

- 『律』主入口为 `index.html`：3D 物理材质与声波工作台、歌词同步、29 位角色实时表情；页面继续提供桌面与移动端操作。
- 『荔』主入口为 `mascot_studio.html`，快捷入口为 `li.html`；『弈律』主入口为 `xiangqi.html`，三者共用当前仓库。
- 角色来源为用户提供的透明头像。运行资产在 `assets/live-avatars/`，实时渲染模块在 `js/avatar/live.js`，29 张独立 GIF 在本地 `output/live-avatar-gifs/`。
- 当前工作树包含本次交付和此前未提交的其他工作；不要用整体重置覆盖用户改动。

## Active Assets

- [律的界面、歌词、镜头与表情修复报告](Reports/2026-09-23-lu-ui-lyrics-camera-expression.md)
- [律的运镜与实时表情修复报告](Reports/2026-09-23-lu-camera-avatar-motion.md)
- [29 角色实时渲染与 GIF 交付报告](Reports/2026-09-23-lu-live-avatars.md)
- [歌词与反重力沙盒近期记录](Reports/progress_full_archive_20260923_pre_live_avatars.md)
- [荔竖屏宣传片报告](Reports/2026-09-18-li-codex-promo.md)
- [完整旧进度无损归档](Reports/progress_full_archive_20260923_pre_live_avatars.md)：归档前 314 行、43,330 字节，SHA-256 为 `c4c5923145684e7a49420567c612d6280c1a727c1e5ce2109a948452e5240227`。

## Recent Results

- Action: 修复律的界面遮挡、歌词模式镜头抖动、逐字进度、实时表情及底部魔方稳态动作；工作台改为可唤出的抽屉并统一苍耳今楷。Validation: 九条曲目 196 句、桌面/手机布局、头像动效、双歌词引擎与几何快速回归通过；逐字时间为行内估计。Report: `Reports/2026-09-23-lu-ui-lyrics-camera-expression.md`。Agent: codex · 2026-09-23。
- Action: 平滑律的自动运镜并接通振幅/运动档位控制，修复角色眼神跟随、呼吸可见度与选中卡片实时预览。Validation: 头像与镜头回归、歌词双引擎、象棋测试及移动触控检查通过。Report: `Reports/2026-09-23-lu-camera-avatar-motion.md`。Agent: codex · 2026-09-23。
- Action: 用 29 位透明角色实时层替换律的 OneWorks 角色链路，保留 3D 排布、音乐表情触发、注视及眨眼，并制作独立透明循环 GIF；旧运行资源隔离在 `/Users/papazed/Downloads/lu-oneworks-quarantine-20260923-075633/`。Validation: 29/29 实时绘制与 GIF 检查通过，桌面和手机页面无错误，歌词与象棋回归通过。Report: `Reports/2026-09-23-lu-live-avatars.md`。Agent: codex · 2026-09-23。
- Action: 精准同步六首曲目的歌词时间轴，并约束反重力沙盒方块的数量与空间。Validation: 动态歌词端到端测试通过；详细原始记录见完整归档。Agent: Antigravity · 2026-09-23。
- Action: 完成荔的 25.2 秒竖屏宣传片与封面。Validation: 帧数、二维码、音轨及画面抽检通过；详见宣传片报告。Agent: codex · 2026-09-18。
- Action: 双旗舰页面与 GitHub Pages 工作流完成上线，律与荔双向入口可用。Validation: 历史上线记录与链接见完整归档。Agent: codex · 2026-09-18。
- Action: 修复荔小星闪烁、角色口腔与面部材质问题。Validation: 历史验收记录见完整归档。Agent: codex · 2026-09-17。

## Next Action Rules

- 关键变更在本页保留 3–5 条简短索引；验证细节写入 `Reports/`。
- 继续工作前核对当前工作树与相关报告，保留未提交改动；需要清理旧资源时先核对备份与隔离路径。
