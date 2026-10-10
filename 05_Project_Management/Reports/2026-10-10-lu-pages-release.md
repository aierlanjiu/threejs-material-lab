# 律：主题图、运镜与反重力更新发布

Agent: codex · 2026-10-10

## 发布范围

- 用户授权：更新后代码上传 Pages。
- 代码提交：`f2d585a6acc4a18d3a361b9c6efe68a2cfb361a7`。
- 23 个文件：三套主题按钮图片、入场水晶与图标同步、机械／反重力控件、运镜／FOV、本机曲库与语言支持、对应测试和修复记录。
- `master` 与 `gh-pages` 已原子同步；未强制推送，未切换或清理工作树。
- 发布地址：[打开律](https://aierlanjiu.github.io/threejs-material-lab/)。
- 构建：[pages build and deployment](https://github.com/aierlanjiu/threejs-material-lab/actions/runs/38051392913)。

## 本次发布检查

- 模块与律测试语法、HTML 本地静态资源引用、PNG 文件格式、差异格式检查通过；新增代码未发现检查规则覆盖的凭据格式。
- `npm test` 通过：18 项象棋规则与悟空 AI；这项检查覆盖共用仓库的基础测试，不作为律的场景功能证明。
- `camera-controls.test.js` 通过：10°～100°、基础 FOV 保持、滚轮 60°→52°、运镜开关、完整旋转、重置、四种动态 FOV 与三主题表情。
- 首次运镜检查在反重力异步预热前检查了机械机位；增加等待实际预热与模式切换后通过。未为此修改生产行为。
- 前阶段的播放、录制及全部控件验证见[反重力与完整要求检查表](2026-10-10-lu-gravity-controls-full-requirements.md)，其结论保留原先的设备与内容限制。
- Pages 构建与部署均成功；Pages API 回读 `status=built`，提交为 `f2d585a6acc4a18d3a361b9c6efe68a2cfb361a7`。
- 线上真实 GPU 浏览器检查通过：主页面、三个 JS 模块、两个 CSS 文件及三张主题 PNG 共九个文件均 HTTP 200，SHA-256 与本机文件完全一致。
- 入场 27 块与三张图片可用，跳过入场后进入主场景；反重力三主题分别 252 块，山体角色与左上图标同步；手动波形／头像排布和 One day 入口存在；左右文字栏已移除。
- 实际原生滚轮使基础 FOV 50°→38°，镜头平滑收敛至约 38.08°；改成 390×844 后基础值仍为 38°，页面宽度与滚动宽度均为 390px。无页面或着色器错误。
- 最初线上脚本假定原生滚轮与无界面浏览器有固定比例，因此等待错误的 44° 超时；实际桌面滚动事件量不同。改为验证实际基础值、方向和镜头收敛后通过，未改生产逻辑。
- 本次发布记录以随后文档提交同步至 `master`；`gh-pages` 发布上述已验证的代码提交。

## Release Gate

| 项目 | 本次证据 |
| --- | --- |
| 审查基线 | `5a3c426` 到本轮工作树；提交 `f2d585a` |
| 工作树与提交 | 23 个已列明的授权文件；提交前后核对 HEAD 与状态，无其他未提交文件 |
| 远端 | 发布前 `origin/master` 与 `origin/gh-pages` 均等于基线；推送两个分支成功 |
| 版本 | 静态站点部署，无版本号或发布标签变更；package／lock 未修改 |
| 发布渠道 | GitHub Pages，现有 `gh-pages` 根目录，legacy 构建 |
| 运行依赖 | 无新增依赖，使用既有 Three.js 与前端模块 |
| 生成资产 | 三张新主题 PNG 已提交，页面引用存在；无需打包生成 dist |
| 交付内容 | 纯静态站点从 Git 分支构建；本机 `output/` 保持忽略 |
| 远端资产与 CI | 构建及部署成功；九个线上文件字节摘要一致，实际浏览器检查通过 |
| 软件包仓库／appcast | 不适用，未发布软件包或更新源 |
| Issue／PR | 不适用，用户要求直接上传既有 Pages |

## 使用范围

完整主题歌曲及 LRC／中文译词位于本机被忽略的 `output/audio/`，未加入公开仓库。这次发布包含曲目入口、导入、浏览器保存和语言切换支持；公开页面需使用本机文件导入。One day 的整首中文译词仍待用户提供原文／LRC。

窄屏验证使用桌面浏览器模拟视口；实体手机未验。本次线上检查不替代前阶段实际歌曲与录制验证，也不声称公开页面已包含本机音频。

## 线上文件摘要

| 文件 | SHA-256 |
| --- | --- |
| index.html | `b4cea2051f1a8538d79ed02d34e9324d18080fff2bcff6fa8f29f2e9005b8f9a` |
| js/ui/kinetic-lyrics.js | `6bdf11d4b6ac7cdbb6a1545a36493165530d3bdf815afcb7653878591d2ce83b` |
| js/ui/lu-cube-intro.js | `49a336c77f41881d4e49c068b3438d0b8218855e9350f193cca4b21cfa34e06a` |
| js/audio/local-theme-library.js | `63f970e34b9cec3013f9b278082b64e48c5c13baaf9b9dcdb3bee90e327a3652` |
| css/lu-cube-intro.css | `b7e9a72d8893bc084723f51c6dfb37fc540bcf59a13a1aba54fdd68451497666` |
| css/lu-control-motion.css | `9816db740f38f1f622d0112f11ba2fa32bd087b5aada2c19f4dcbee9b19ea576` |
| one-piece-straw-compass.png | `d000611435d916a9dad5e28338dd9e30ea7fb6f1d5a849ed561bc1bc60d70cdb` |
| dragon-ball-shenron-cutout.png | `7b68457f0a51f17936503ed2c2d3fb831e7f69bf2407bb4893ad569ff4b127a2` |
| naruto-leaf-chakra.png | `f8c538c307c3a17951faee3dc73a787bd73a420f1bb2786be816d71193e3a3cf` |
