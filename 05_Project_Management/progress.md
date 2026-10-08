# Project Progress

## Current State

- 『律』主入口为 `index.html`：3D 物理材质与声波工作台、歌词同步、29 位角色实时表情；页面继续提供桌面与移动端操作。
- 『荔』主入口为 `mascot_studio.html`，快捷入口为 `li.html`；『弈律』主入口为 `xiangqi.html`，三者共用当前仓库。
- 角色来源为用户提供的透明头像。运行资产在 `assets/live-avatars/`，实时渲染模块在 `js/avatar/live.js`，29 张独立 GIF 在本地 `output/live-avatar-gifs/`。
- 主视窗与录制修复、剩余的文档／依赖更新和旧 OneWorks 资源清退已同步至 `master` 与 `gh-pages`，Pages 线上入口已更新。

## Active Assets

- [律核单入口四面工作台接手交付报告](Reports/2026-10-08-lu-core-handoff-completion.md)
- [律核关键状态设计稿](Reports/2026-10-08-lu-core-key-states.md)
- [律的控件动效与调律工作台改造报告](Reports/2026-10-08-lu-control-motion-adaptation.md)
- [律的手机沉浸模式全屏修复与推文动效核对报告](Reports/2026-10-08-lu-mobile-immersive.md)
- [律的对决海报界面与桌面超宽屏壁纸报告](Reports/2026-10-08-lu-battle-poster-ui.md)
- [律的 15 秒竖屏动效样片报告](Reports/2026-10-07-lu-vertical-motion-study.md)
- [律的手机减少动效静止路径修复报告](Reports/2026-10-06-lu-mobile-motion-preference.md)
- [律的音乐编排、镜头与表情回归修复报告](Reports/2026-10-02-lu-music-choreography-regression.md)
- [律的机械魔方编排与手机反重力山体修复报告](Reports/2026-10-01-lu-motion-mound-fix.md)
- [律的远端同步与 Pages 发布报告](Reports/2026-10-01-lu-remote-pages-release.md)
- [律的主视窗与视频录制修复报告](Reports/2026-10-01-lu-main-ui-recording.md)
- [律的界面、歌词、镜头与表情修复报告](Reports/2026-09-23-lu-ui-lyrics-camera-expression.md)
- [律的运镜与实时表情修复报告](Reports/2026-09-23-lu-camera-avatar-motion.md)
- [29 角色实时渲染与 GIF 交付报告](Reports/2026-09-23-lu-live-avatars.md)
- [歌词与反重力沙盒近期记录](Reports/progress_full_archive_20260923_pre_live_avatars.md)
- [荔竖屏宣传片报告](Reports/2026-09-18-li-codex-promo.md)
- [完整旧进度无损归档](Reports/progress_full_archive_20260923_pre_live_avatars.md)：归档前 314 行、43,330 字节，SHA-256 为 `c4c5923145684e7a49420567c612d6280c1a727c1e5ce2109a948452e5240227`。

## Recent Results

- Action: AGY 中断后接手律核单入口，将播放、演出、创作、录制控件集中到四面工作台，修复移动布局、非海报入口、录制状态与键盘焦点。Validation: 1440/390/342px 布局、双画幅真实录制、音乐编排与主画面几何回归通过；实体手机待验。Report: `Reports/2026-10-08-lu-core-handoff-completion.md`。Agent: codex · 2026-10-08。
- Action: 将推文的原位状态切换与直接操控迁移到律的播放器、录制按钮、状态胶囊、工作台及检查器，保持对决海报和 WebGL 演出；手机抽屉限制在 35dvh 内并避让歌词。Validation: 双画幅真实录制、342px/1440px 布局、390px 控件及音乐编排回归通过；AGY 3.8 Flash High 方案审阅已参考，本次代码复核超时未取得结论。Report: `Reports/2026-10-08-lu-control-motion-adaptation.md`。Agent: codex · 2026-10-08。
- Action: 修复海报模式覆盖手机沉浸状态的顶部 UI 隐藏和全屏尺寸；支持原生全屏与视口全屏退化，并核对线上动效与推文提示词的实际符合范围。Validation: 390×844 实景、342px 原生／退化全屏及退出回归、1440px 桌面布局通过；实体手机待验。Report: `Reports/2026-10-08-lu-mobile-immersive.md`。Agent: codex · 2026-10-08。
- Action: 用五张既有对决海报统一律的界面语言，并生成对应桌面横幅；桌面 21:9、手机 9:16 按视口切换，歌词与操作控件避让原画。Validation: AGY 3.8 Flash High 只读审查、四种视口实景、双画幅录制与音乐编排回归通过；原生 21:9 录制性能及实体手机待验。Report: `Reports/2026-10-08-lu-battle-poster-ui.md`。Agent: codex · 2026-10-08。
- Action: 基于《游京》手机实景制作 15 秒竖屏动效样片，让同一状态胶囊贯穿播放、节拍、歌词与录制，并交付封面。Validation: 1080×1920、30 fps、450 帧、有声视频与关键画面检查通过；源录制采用 540×960，实体手机及原生高分辨率性能待验。Report: `Reports/2026-10-07-lu-vertical-motion-study.md`。Agent: codex · 2026-10-07。
- Action: 修复手机系统“减少动态效果”会无提示关停机械魔方及关闭歌词模式全部音乐编排的路径；主画面提供可持久保存的一键完整演出入口。Validation: 手机视口复现静止并通过真实点击恢复《游京》的 FOV、运镜和表情；两模式自动化回归通过，实体手机待验。Report: `Reports/2026-10-06-lu-mobile-motion-preference.md`。Agent: codex · 2026-10-06。
- Action: 重新接通机械魔方与关闭模式的音乐节拍动作、乐章 FOV 镜头谱和音乐表情，并为窄镜头预留画幅。Validation: 先复现原版静态镜头，再通过新增回归测试、实际歌曲的手机视口播放、头像测试与几何检查；实体手机未验。Report: `Reports/2026-10-02-lu-music-choreography-regression.md`。Agent: codex · 2026-10-02。
- Action: 恢复机械魔方和关闭歌词模式的可见运动与乐章材质切换；将手机反重力山体加高到 12 层／270 枚，并让旧歌词贴合山脊融入。Validation: 桌面与手机浏览器实景、乐章切换、歌词端到端和现有测试通过；实体手机未验。Report: `Reports/2026-10-01-lu-motion-mound-fix.md`。Agent: codex · 2026-10-01。
- Action: 将律的主视窗与录制修复、4 个文档／依赖更新、441 个旧 OneWorks 文件删除同步至远端与 Pages。Validation: 测试与语法检查通过，Pages 构建成功，线上主页面与录制模块 HTTP 200 且新控件存在。Report: `Reports/2026-10-01-lu-remote-pages-release.md`。Agent: codex · 2026-10-01。
- Action: 修复律的默认歌词显示、竖横屏画幅、录制歌词合成与编辑控件显隐，并按实际容器命名导出文件。Validation: 196 句歌词时钟、桌面/手机布局、双画幅 MP4 视频及有声视频流实测通过；帧率依浏览器。Report: `Reports/2026-10-01-lu-main-ui-recording.md`。Agent: codex · 2026-10-01。
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
