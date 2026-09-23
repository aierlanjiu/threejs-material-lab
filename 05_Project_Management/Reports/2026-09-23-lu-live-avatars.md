# 律：29 位角色实时表情与 GIF 替换记录

## 范围

- 用户提供 `/Users/papazed/Downloads/avator/` 中 29 张透明 PNG（海贼王 10、龙珠 10、火影忍者 9），要求参照六段表情动画，完整替换律项目当前 OneWorks 角色内容，并增加实时渲染。
- 当前运行入口为仓库根目录 `index.html`。替换目标包括角色选择界面、实时方块贴图、旧 OneWorks 编辑器、SDK、预设与图集。保留其他材质、音乐、歌词及棋局功能。

## 删除前备份

- 仓库根目录：`/Users/papazed/dev/threejs-material-lab`。
- 删除原因：旧 OneWorks 角色运行资源已由用户指定的新角色资产与实时渲染管线替换。
- 删除目标：`studio/` 中 OneWorks 专用编辑器、桥接、预设、图集和 vendor；`assets/avatars/` 中八款旧角色；仓库历史镜像 `threejs_material_lab/` 的对应 OneWorks 副本。删除前逐项核查引用。
- Git 提交快照：`backup/lu-live-avatars-20260923-075633`，指向替换前 `HEAD`。
- 未提交改动备份：`/Users/papazed/Downloads/lu-oneworks-pre-replace-20260923-075633/worktree.patch`；另有同目录的 `index.html`、`progress.md` 物理副本与 `git-status-short.txt`。
- 删除前 `git status --short` 显示用户已有修改：`index.html`、`05_Project_Management/progress.md`、`js/mascot/studio.js`、`package.json`、`package-lock.json`；另有原本未跟踪的报告、UI 文件和测试素材。上述改动均需保留。

## 实施结果

- 29 张透明单层头像均拆为无眼底图与左右眼层，运行时按六段表情节奏绘制眨眼、欢欣、单眨、好奇、惊讶、困倦与轻摆；音乐状态仍可触发欢欣和单眨，注视跟随与自动眨眼控件继续生效。
- 实时层和清单位于 `assets/live-avatars/`，运行模块位于 `js/avatar/live.js`。单角色图在场景中渲染为 256px 方块贴图；盲盒群星引用多角色时改为约 15fps 节流。静态缩略图按需加载。
- 29 张静音透明循环 GIF 位于 `output/live-avatar-gifs/`，每张 256×256、12fps、约 13.16 秒，单文件 1.8–3.9 MB，总计 89.4 MB；总览图为 `output/live-avatar-gifs/preview-29.jpg`。GIF 属于本地交付，网页使用实时渲染，不加载 GIF 集合。
- 根目录 OneWorks 编辑器、SDK、八角色 SVG 与动画图集已移至 `/Users/papazed/Downloads/lu-oneworks-quarantine-20260923-075633/`；仓库历史副本的旧入口改为跳转当前根页面，旧运行资源、旧 HTML 快照和生成脚本也一并隔离。非 OneWorks 的景观背景与玉石预览保留。当前入口、运行模块及现行 README 中已无 OneWorks 引用。
- Stitch 已调用原 LÜ 项目的设计系统，生成服务返回连接错误；后续由已安装的 AGY 按原有冷静蓝灰设计系统编译 29 角色、三组选择区，实测保持页面原有视觉结构。

## 验证

- 资产脚本确认为 29 位角色成功分离双眼；浏览器逐个加载 29 位并比较时刻 0 与 2.5 秒的画面，29/29 均产生不同帧，无加载失败。
- GIF 核对 29/29：均为 256×256、158 帧、循环播放、透明背景，首帧与中帧不同；总览图目检眼部位置与角色轮廓。
- 桌面 1440×900：切换到火影组显示 9 张卡片与新角色贴图；手机 390×844：切换龙珠组、选择比克、触发欢欣与盲盒群星，页面无运行错误，文档宽度为 390px、无横向溢出。截图位于本地交付预览目录。
- `npm test`：18 项象棋规则及 Wukong AI 检查通过；`node test/test_kinetic_lyrics_e2e.js`：歌词、动态槽位、物理方块、模式切换均通过，0 console errors。
- `git diff --check`、JavaScript 语法检查及 Python 脚本编译均通过。与实施前物理副本逐段比较，`index.html` 变更集中在角色样式、面板与角色运行链路，保留原有未提交的其他修改。

## 已知边界

- 原图均为单层 PNG，因此头发、衣服随整体轻摆，不具备独立骨骼变形；GIF 格式不含声音。第三组第六张头像按素材外观暂标为“金发忍者”。
- 未提交或发布远端；当前结果在本地项目与 `output/` 可直接查看。
