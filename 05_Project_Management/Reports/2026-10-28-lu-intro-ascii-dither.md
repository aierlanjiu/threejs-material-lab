# 律 · 入场背景 ASCII / Dither

- Agent: Codex（实现、验证与提交）；browser_verify（浏览器验证尝试）；架构与四个对抗角度只读审阅。
- Scope: 入场背景图槽位及其三主题、横／竖画幅。前景魔方、标题、主题图按钮与现有开幕动作不参与滤镜。

## 实现

- 新增 `js/effects/effect-settings.js`、`effect-layer.js`、`effect-panel.js`，以及入场接线 `js/ui/lu-intro-effect.js`。
- 设置对象为 `{filter, mask, palette, inkTone, strength, size, spacing}`。两种滤镜各自记忆参数，恢复推荐值只影响当前滤镜；本地保存并同步已打开的入场标签页。
- ASCII 使用真实素材亮度采样、8/92 分位归一化、指定字符集、字体／网格和 HSV 提亮；Dither 使用 4×4 Bayer 与逐通道量化。五套色板和 Original 可切换。
- 图片按需重画，设置变更 72ms 合并，滤镜／色板切换 150ms 淡入；减少动态时直接切换。采样长边约 480px，显示像素比不超过 1.6，任一画布边不超过 2048px。
- 单次采样结果镜像到左右帷幕内的 2D canvas，保留现有开幕变换，未增加 WebGL renderer。图片失败回退原图，同一 URL 下次可重试。
- `intro-effects.html` 是入场背景的独立预览区。桌面图片与 420px 面板并列，窄屏上下排列，面板从不覆盖图片；由入场左下角入口打开。主入场尺寸和前景布局不变。

## 适配取舍

参考提示词的 cover-fit 会改变现有入场的构图，因原背景一直使用 `100% 100%` 拉伸。为优先满足“原位且保持构图”，本槽位与预览显式使用 `fit: 'fill'`，可复用 Layer 默认仍为 cover。原有标题与主题按钮的局部 radial scrim 保留在效果上方。

当前素材是静态图片，所以只实现图像采样路径，不加入无用途的视频逐帧调度。ASCII 推荐参数为默认；可取消启用回到原图。实际观感需要结合本次浏览器截图审阅，实体手机温升／GPU 与其他浏览器不在本次验证范围。

## 审查与修复

- 保留原背景构图，防止原图对比时裁切跳变。
- 原有前景可读性遮罩保留在 Canvas 上方。
- 色板与滤镜枚举使用 own-key 验证，损坏存储中的原型属性名不会进入渲染。
- 临时图片请求失败不缓存失败状态，下次显式换图／重播可重试。

## 验证

- `node --test test/effects/settings.test.mjs`：4/4，通过滤镜独立状态、恢复、重新载入、禁用对比、跨标签无回写、损坏／不可用存储与原型键校验。
- `npm run check`：通过（远端 master 的现有脚本仍为象棋语法、规则与 AI 检查）。
- `node --test test/band-*.test.mjs`：6/6 现有乐队测试通过。
- 新增模块 `node --check` 及 `git diff --check`：通过。
- 浏览器验证脚本：`LU_BASE_URL=http://127.0.0.1:8018 node test/effects/browser.test.js`，覆盖预览 1440/390/342px、实时像素变化、滤镜独立记忆、重置、色板、原图对比、三主题、重载、布局与减少动态。
- 本轮浏览器运行尚未进入页面断言：Chromium 启动被 macOS `bootstrap_check_in ... MachPortRendezvous: Permission denied (1100)` 阻止。属于执行环境限制，不据此判定产品失败，也不宣称视觉验收通过。预览 HTTP 200 已确认，替代浏览器连接仍在尝试。

## 交付边界

提交草稿 PR 至远端 `master`，待视觉验收；不合并、不更新 `gh-pages`。原工作区未提交内容不纳入本 PR。
