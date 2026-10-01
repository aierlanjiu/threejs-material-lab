# 律：工作区变更同步与 Pages 发布

## 发布范围

- 将此前已提交的主视窗、歌词与录制修复，以及本次剩余的 445 个已跟踪文件变更同步至 `master` 和 Pages 发布源 `gh-pages`。后者包含 4 个文档／依赖文件更新，以及 441 个旧 OneWorks `studio/` 文件删除。
- 删除范围、原因、可恢复备份与隔离位置见 [29 位角色替换报告](2026-09-23-lu-live-avatars.md)。当前页面引用的 `studio/alpine-light-background-v1.png` 和玉石预览文件仍保留。
- `.gitignore` 排除的 `output/` 是本地生成产物，不属于本次 Git 工作区变更；线上角色使用 `assets/live-avatars/` 的实时渲染资源。

## 验证

- `npm test`：18 项象棋规则检查与 Wukong AI 检查通过；`node --check js/ui/motion-adapter.js`、`git diff --check` 通过。
- 发布提交 `582b343` 已推送到 `master` 与 `gh-pages`。GitHub Pages 构建 [36834494122](https://github.com/aierlanjiu/threejs-material-lab/actions/runs/36834494122) 成功。
- [线上主页面](https://aierlanjiu.github.io/threejs-material-lab/) 返回 HTTP 200，包含 `recordingPreviewCanvas`、`videoAspectSelect` 和 `recording-compositor.js` 引用；视频合成模块单独返回 HTTP 200，包含 `drawPerformanceFrame`。
- 上述线上检查确认部署了新代码；本次发布后没有重新执行浏览器录屏实测，录屏回归见 [主视窗与视频录制修复报告](2026-10-01-lu-main-ui-recording.md)。

Agent: codex · 2026-10-01
