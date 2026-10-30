# 律：中性拟物按钮改造

日期：2026-10-26。Agent：codex。

## 交付范围

直接改造律现有 Lumno 样式系统，没有新增 Button 组件、框架或依赖。运行源码只改两处：

- `css/lu-perceptual-ui.css`：统一材质令牌、五级视觉变体、比例尺寸与状态。
- `js/ui/lu-perceptual-ui.js`：材质按钮使用自身 120ms 垂直按压，避免原弹簧再次缩放图标或文字。

HTML、DOM ID、事件绑定、ARIA、tabindex、角色、原生 disabled 行为及现有 focus-visible 规则保留。没有修改 bot.py、音频、3D 舞台或线上 Pages。

本轮采用用户已明确给定的样式规范；Stitch 生成组件参考表，具体代码与验收由 codex 完成，未委派子代理。Stitch 参考：项目 `2177447274865300042`，画面 `9f66dd0b60b2498d8da8beeb0e20a439`。

## 材质与映射

| 变体 | 现有调用映射 | 静止面 |
| --- | --- | --- |
| primary | 播放、开始录制、持续选中态 | #404859 → #273042，白字 |
| secondary | 普通 `.btn`、上一首、下一首及一般操作 | #FFFFFF → #F4F5F7 |
| tertiary | 停止、重置、返回当前歌曲 | #F3F4F6 → #E7E9EC |
| ghost | 收起、关闭、未启用的随机播放、辅助图标 | 静止透明，悬停浅灰，按下凹槽 |
| text | 荔工作室链接、跳过 | 灰字、细下划线、悬停箭头右移 |

沿用现有 class API，普通按钮默认为 secondary；可用 `.btn-primary`、`.btn-tertiary`、`.btn-ghost`、`.btn-text` 设置视觉变体，以及 `.btn-md`、`.btn-lg` 设置字号。现有调用点自动映射，无须更改调用代码。

所有填充按钮共用一条 box-shadow 配方：顶部高光、底部阴影、透明补位 inset、接触阴影、抬升阴影。全部 inset 均位于按钮本体，并排在外阴影之前。按下仍为三个 inset 加两个外阴影，保留亮色按键底部白线。旧滑动指示元素保留在 DOM，普通按钮组的材质改由实际按钮承载，避免覆盖层与圆角错位。

色彩通过注册的 CSS 色值属性插值；transform 120ms、shadow 140ms、颜色 160ms。按钮本身没有发光或背景模糊。

## 尺寸

唯一材质单位为 `--lu-button-u = --lu-button-label-size / 14`，高度、内边距、圆角、边框、图标、按压位移、全部阴影偏移/模糊/扩散均由该单位计算。

| 项目 | md | lg |
| --- | --- | --- |
| 标签 | 14px / 600 | 16px / 600 |
| 标称高度 | 40px | 45.714px |
| 标准横向内边距 | 18px | 20.571px |
| 圆角 | 10px | 11.429px |
| 图标 | 16px | 18.286px |
| 按压位移 | 1px | 1.143px |
| 静止 lift | 0 4px 10px -3px | 0 4.571px 11.429px -3.429px |

保留项目已有的紧凑图标/分组布局：图标按钮横向内边距为 0；紧凑分组使用较小的单位内边距。342px 宽度下模式组横向内边距为 4u、gap 为 4u，四项保持一行。粗指针设备保留既有至少 44px 的播放器点击区。lg 的 CSS 边框也按单位计算；Chrome 会把实际边框绘制宽度吸附到设备像素。

## 验证

- `node --check js/ui/lu-perceptual-ui.js` 和 `git diff --check` 通过。
- `LU_TEST_BROWSER=chrome LU_TEST_ARTIFACTS=output/tactile-buttons-20261026 node test/lu/menu-mode-regression.test.js`：最终 30/30 通过；覆盖 1440、390、342px 菜单、键盘、四模式切换、抽屉同步、外部关闭与播放栏显隐。
- `node output/tactile-buttons-20261026/verify.mjs`：五变体、md/lg 实际几何、hover/pressed/键盘/disabled/focus、减少动态、强制色彩及两种舞台风格 × 三个宽度共六种布局通过，零 pageerror。
- 深色界面的 ghost 文字另验为中性浅灰，保留对比度。触屏 375/342px 的点击区和遮挡情况见同目录 `additional-validation.json`。
- 已复核桌面、手机、创作抽屉及按下态实景；素材与所有 inset 圆角对齐。

实测 lg：高度 45.7031px，圆角 11.4286px，按下位移 1.14286px，静止 lift 为 0 4.57143px 11.4286px -3.42857px。所有材质状态保留 3 个 inset 槽位。

默认 Playwright Chromium 在本机初始化等待超时，改用已安装的 Chrome 完成真实页面验收；没有把超时记为通过。验收脚本对 disabled 的零位移先误判了浏览器返回的单位矩阵，已校正为等价的零位移再通过。另一次深浅界面色值采样落在 160ms 插值中，追加等待完整过渡后复验。

## 证据与边界

- 预览：http://127.0.0.1:8000/index.html?intro=skip
- 基线源码及初始画面：`output/tactile-buttons-20261026/baseline/`
- 状态实测：`output/tactile-buttons-20261026/validation.json`
- 实景：`desktop-buttons.png`、`cream-375px.png`、`island-1440px.png`、`text.png`、`touch-375px.png`、`touch-drawer-342px.png`。

本地修改完成，未提交或发布。本轮验证使用本机 Chrome 与模拟触屏，未在实体手机或 Safari/Firefox 复验。
