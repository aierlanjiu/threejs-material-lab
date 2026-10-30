# 四模式彩色 SVG 与菜单死循环修复

日期：2026-10-14（Asia/Shanghai）。Agent：codex，负责设计、实现、回归与提交。用户本轮明确要求由 codex 自行设计，不使用 AGY。

## 交付

- 纯享：青绿耳机与金色声波；机械魔方：黄／橙红／青蓝三阶立方体；反重力：紫粉悬浮球、青蓝悬浮环和上升箭头；乐队：金橙鼓身与交叉青绿鼓槌。
- 全部为手绘路径构成的内联 SVG，32×32 viewBox；底栏显示 24px，最窄屏 22px，抽屉 22px。不用图片下载、字体图标或外部依赖，桌面与手机共用相同造型。
- 四状态仍在同一个底栏按钮中轮换，并与抽屉、实际歌词／舞台引擎同步；新访问默认乐队，保留用户已有有效模式选择。

## 根因与修复

1. `0f71c4d` 在 `reveal()` 中无条件删除 `body` 的 `apple-dock-hidden`。`body.class` 的 MutationObserver 在工作台打开时调用 `reveal()`；即使类名不存在，删除操作仍产生新的属性变更记录，造成微任务循环，阻断绘制和输入响应。
2. `edc71e0` 修改了胶囊布局、层级与点击绑定，却保留上述循环。原 AGY 菜单测试实际挂起／取消，旧记录的交互通过结论已在 progress.md 更正。
3. 修复仅在该类名实际存在时删除，保留真实播放时的隐藏和唤回。
4. 手机底栏原等宽侧列容不下右侧按钮组，按钮会覆盖停止按钮。改为给右侧分区按实际内容分配宽度，窄屏压缩辅助按钮，并优先保留歌名；菜单的四模式固定同一行，顶部标签保持单行。

## 文件

- `index.html`：四套彩色 SVG（底栏、抽屉共八处）、菜单循环修复。
- `css/lu-control-motion.css`：SVG 尺寸与颜色继承隔离，窄屏播放器和菜单分区。
- `test/lu/menu-mode-regression.test.js`：真实输入与事件循环回归，支持 `LU_TEST_BASE_URL`、`LU_TEST_BROWSER` 和可选截图目录。
- `05_Project_Management/progress.md`、本报告：当前状态与验收修正。

## 验证

- `LU_TEST_BROWSER=chrome LU_TEST_ARTIFACTS=output/menu-mode-fix node test/lu/menu-mode-regression.test.js`：1440×900、390×900、342×900；菜单连续开关、两帧绘制、class 变更有界、Enter／Escape、四模式引擎／文字／颜色同步、抽屉反向同步、外点击收起、所有底栏按钮中心可命中、实际播放三秒隐藏及鼠标唤回。
- 隔离读取 `git show edc71e0:index.html`，通过浏览器路由替换主 HTML，不改工作区。页面初始化完成后，真实菜单点击在 8000ms 超时，证明旧版本无法通过新增回归。
- `npm test`：18 项象棋规则与悟空 AI 通过；`node test/band-stage.test.mjs`、`node test/band-timeline.test.mjs` 通过。
- 八处 SVG XML 解析、主模块／回归脚本 `node --check` 与 `git diff --check` 通过。
- 本机带 GPU 的实际页面可点击展开；30 项回归在本机 Chrome 完成。默认缓存的 Chromium headless shell 初始化等待曾超时，不将其记录为通过。

## 证据与边界

- 图标预览：`output/menu-mode-fix/color-icons.png`，可编辑预览页 `icons-preview.html`。
- 实际菜单：`output/menu-mode-fix/menu-1440px.png`、`menu-390px.png`、`menu-342px.png`。截图等一次性资产按现有规则忽略，不加入发布仓库。
- 发布沿用现有 GitHub Pages 的 `gh-pages` 根目录来源，按用户授权完成提交、推送和线上交互验收；最终部署状态见本次回复与 GitHub Actions。
- 未做实体手机操作或完整音视频导出回归；本轮无相关录制代码变更。
