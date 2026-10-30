# 律：入场魔方布局回归修复与彩色 SVG 按钮

2026-10-26 · Agent: codex

## 结果与范围

修复上轮通用按钮规则误伤入场魔方的问题。奶油棱镜／日落海岛改为彩色 SVG 图标键，模式切换恢复原有彩色 SVG，焰火音效改为右上角 SVG 开关键。其余按钮继续采用上一轮的五级中性材质。

本轮修改三份代码／测试文件：

- `css/lu-perceptual-ui.css`：把入场场景容器移出普通按钮规则；增加指定图标的尺寸、颜色与位置规则。
- `js/ui/band-controls.js`：静态 SVG、按钮名称与焰火音效状态提示；保留原来的设置保存和切换事件。
- `test/lu/core-intro.test.js`：增加真实尺寸、遮挡、重播、SVG 与开关回归检查，并沿用项目的 Chrome 选择参数。

没有修改 3D 场景、音频、角色、bot.py 或现有 API。未提交、未发布。

## 已证实的根因

`.lu-intro-activate` 是承载魔方画布的方形交互场景，原尺寸随屏幕宽度在 260–430px 之间变化。上一轮将该选择器加入普通按钮的基本材质、primary 以及 lg 映射，使其高度被 `!important` 改为约 45.7px，宽度与画布却仍约 335px。因此出现横向粗按钮、画布越界、主题选择器遮挡魔方。

修复前，新增回归检查真实失败：宽 335.390625px、高 45.703125px，画布不在容器内、主题组与画布重叠、画布中心被遮挡。用户当前内置浏览器也复现了同一现象。

修复通过移除错误的组件归类完成，恢复原入场样式的尺寸、透明背景及展开动画。没有追加更高优先级的固定尺寸补丁。同类检查保留了普通入场音效／跳过按钮的按键样式，主题图片按钮和其他场景容器未纳入普通按钮材质。

## 彩色 SVG 与交互

- 奶油棱镜：奶油色与淡紫棱镜、青色台座；日落海岛：暖色落日、绿色棕榈与蓝色海浪。两个图标使用现有按钮材质，保持 `data-look`、`aria-pressed`、名称和设置持久化。
- 主播放栏的模式键使用现有 24u 彩色 SVG，并通过原有 aria-label／title 说明当前模式；抽屉四种模式继续保留文字和原有彩色 SVG。
- 焰火音效：44u 图标键位于视口右上角，使用焰火与扬声器 SVG；关闭时显示静音斜线，开关不再用 textContent 清除图标。原 `aria-pressed` 与设置行为保留。
- 其他播放、录制、普通操作、焦点及无障碍属性沿用上一轮。粗指针场景保留 44px 点击区。

## 验证

1. 增补的入场几何断言在修复前失败，在修复后通过。
2. `LU_TEST_BROWSER=chrome LU_INTRO_WIDTHS=390,1440 LU_TEST_ARTIFACTS=output/button-layout-fix-20261026 node test/lu/core-intro.test.js` 通过。覆盖首次入场、原归位与展开动画、重播、跳过、减少动态、魔方画布与主题组无重叠，以及两种舞台 SVG 的选择、彩色模式 SVG、右上角焰火键位置／44px 尺寸和开关后 SVG 保留。
3. `LU_TEST_BROWSER=chrome LU_TEST_ARTIFACTS=output/button-layout-fix-20261026 node test/lu/menu-mode-regression.test.js`：1440／390／342px 共 30/30 通过。包括按钮无遮挡、键盘、四种模式、菜单同步及播放栏显隐。
4. `node --check js/ui/band-controls.js`、`node --check test/lu/core-intro.test.js`、`git diff --check` 通过。
5. 已在用户当前内置浏览器经“创作 → 重看表情魔方入场”复验，粗按钮消失，魔方与主题选择器分离。原 127.0.0.1 预览普通刷新仍显示旧脚本文案；切换到等价的 `http://localhost:8000/index.html?intro=skip` 后，当前页面已实际显示新 SVG、右上角焰火键与正确布局。没有修改服务器、清理缓存文件或改写代理。
6. 额外复验用户当前 372×659 视口：入场容器方形、三个 SVG 控件存在，实景见 `intro-current-372px.png`、`stage-current-372px.png`。

证据目录：`output/button-layout-fix-20261026/`。

- 原文件与失败前截图：`baseline/`
- 修复后入场：`intro-390px.png`、`intro-1440px.png`
- 播放栏：`buttons-390px.png`、`buttons-1440px.png`
- 全界面：`stage-390px.png`、`stage-1440px.png`、`menu-342px.png`

本轮使用本机 Chrome、内置浏览器与模拟手机尺寸；实体手机及 Safari／Firefox 未复验。未重新发布 Pages。
