# 律 · 底部播放器精修

日期：2026-10-14。Agent：codex。

用户要求：突出底部播放键；桌面演出放大；合并顺序／随机播放；恢复录制入口并使用子菜单；参考 Apple Music 的控件层级；播放后自动隐藏底部区域。

## 交付

- 将圆钮展开式胶囊改为默认可见的迷你播放器。桌面中央 64px 象牙白播放／暂停键，左右 44px 上一首／下一首，右侧仅保留随机与录制。
- 手机根据用户反馈从三行 156px 压到 84px：歌曲、48px 主播放键和两个图标入口共用主行，下方保留细进度条；窄于 371px 收起封面，所有按钮仍至少 44px。手机歌词／机械画面底部预留从 174px 降到 102px，录制子菜单上移到播放器上方。
- 点歌曲封面／名称打开曲库，收起重复的歌单、设置与折叠按钮。工作台仍可通过左上角入口访问。
- 顺序／随机为同一按钮的两态，随机时亮起并设置 `aria-pressed`。不再经过单曲循环的第三状态。
- 录制入口展开一个小菜单：16:9、9:16、21:9 与开始录制。录制中保留角落计时／停止入口，调用现有录制引擎。
- 播放就绪且无操作 3 秒后，底部以淡出和向下 8px 位移隐藏；鼠标移动或点画布恢复。菜单、进度拖拽、鼠标停留及键盘焦点期间保持可见。隐藏时使用 `inert` 和 `aria-hidden`。
- 桌面取消顶部预留行及主画面边框，正常乐队预览填满视窗；录制子菜单和录制状态仍按选定画幅取景。机械魔方预留歌词／播放器区域，避免歌词被新栏遮挡。
- 修复 SVG 图标用 `.hidden` 赋值无法可靠改变属性的问题，播放／暂停与随机图标改为显式切换 `hidden` 属性。

本轮修改 `index.html`、`css/lu-control-motion.css`。接手时已有这两份文件及 `css/lu-band.css` 的 Gemini 未提交改动；本轮没有修改 `css/lu-band.css`。

## 设计依据

参考 Apple 官方 [Music MiniPlayer](https://support.apple.com/guide/music/use-music-miniplayer-mus71d7dcfce/mac) 的轻量控制与按需显隐，以及 [Shuffle](https://support.apple.com/guide/music/shuffle-or-repeat-songs-mus2989/mac) 的单按钮开／关状态。Stitch 方向稿用于确认控件层级；实际图标、角色和舞台使用本项目资源。

## 验证

| 检查 | 结果 |
| --- | --- |
| 1440×900 桌面乐队视窗 | 舞台容器 1440×900，播放栏 760×128，主播放键 64×64；演员与舞台边缘完整 |
| 390×844 浏览器视窗 | 精简后播放栏 366×84；主键 48×48，其他按钮至少 44px，无横向溢出 |
| 342×740 浏览器视窗 | 播放栏 318×84；歌曲与六个控件无重叠，录制子菜单完整位于屏内；顺序／随机可切换 |
| 顺序／随机 | 同一按钮开／关，状态和提示正确 |
| 自动隐藏／恢复 | 实际音频时钟推进；无操作后隐藏，鼠标移动和点画布恢复；隐藏具有 `inert` 和 `aria-hidden`。手机精简后再次实际播放并确认隐藏、点画布恢复及暂停 |
| 键盘 | Tab 可唤回并进入播放器，主键聚焦超过 3 秒仍可见，空格可暂停 |
| 录制子菜单 | 三种画幅可选择；打开菜单后不自动隐藏；关闭恢复主视图 |
| 横屏 MP4 | 1920×1080，H.264＋AAC，27.036 秒，音频平均 -13.1 dB，文件可读取 |
| 竖屏 MP4 | 1080×1920，H.264＋AAC，21.951 秒，音频平均 -9.4 dB，文件可读取 |
| 三种演出模式 | 乐队、机械魔方、反重力实际切换及取景检查完成；机械歌词底边 742px，播放器顶边 752px，无重叠 |
| 源码 | 模块 `node --check`、重复 DOM ID 检查和 `git diff --check` 通过；本轮浏览器 error 日志为空 |

实际检查使用 Codex 内置浏览器。未验证实体手机触控或完整可访问性合规；21:9 仅检查菜单选择及取景，没有新增录制样片。录制样片沿用现有成片合成规则，仍包含原有谱面／状态层。

## 资产

全部截图和样片在 `output/lu-player-refinement/`：

- `after-desktop-idle.png`：最终桌面实景。
- `desktop-playing-hidden.png`：实际播放且底部隐藏。
- `mobile-compact-playing-hidden.png`：手机精简后实际播放且底部隐藏。
- `after-mobile-compact.png`、`after-mobile-compact-342.png`、`record-menu-mobile-compact-342.png`：最新精简手机视窗；原三行版本保留在 `after-mobile-idle.png`、`record-menu-mobile.png`。
- `record-menu-desktop.png`：录制子菜单。
- `desktop-mechanical.png`、`desktop-gravity.png`：其他模式。
- `player-recording-landscape.mp4`、`player-recording-portrait.mp4`：有声样片。
- `recorded-landscape-frame.png`、`recorded-portrait-frame.png`：样片首帧。
- `stitch-desktop-direction.png`：层级方向参考，含示意内容，不作为成品截图。

控制器替换前物理副本：`/private/tmp/lu-player-refinement-before-20261014-145957/`，包含当时的三个工作区文件。此副本已包含本轮初步 HTML 接线，并非纯 Gemini 起点快照。

当前仅在本机完成，未提交或发布。
