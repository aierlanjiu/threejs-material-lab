# 律：AGY 最新代码、象棋独立与 Pages 更新

日期：2026-10-26 · Agent：codex

## 交付状态

- 律 Pages 已更新：[线上入口](https://aierlanjiu.github.io/threejs-material-lab/)。发布提交 `79cf7e628c6ff0fc4727033b785bbd80725ecfaf`，GitHub Pages 回读 built，[Actions 构建成功](https://github.com/aierlanjiu/threejs-material-lab/actions/runs/40333389811)。
- 最新源码：`a18f2076e1342b60c42a47d1ec5a287912b1c062`，分支 `feat/band-prism-pet-stage`。包含 AGY 的舞台／焰火对比度、采样低通与系统采样率适配，以及此前完成的图形、交互、过渡和预热优化。
- 象棋独立仓库：[aierlanjiu/lu-xiangqi](https://github.com/aierlanjiu/lu-xiangqi)，源码提交 `de1e5921c4cb3401f02adb1c7983a704821ff56e` 已推送并回读；本机 `/Users/papazed/dev/lu-xiangqi`。本轮未启用象棋 Pages。
- 律的当前源码树与 Pages 均已移除象棋页面、代码、样式、AI、图片、权重与专属文档；保留公共 Git 历史与恢复备份。

## 已批准的拆分与备份

用户明确确认：建立独立项目和 GitHub 仓库，迁移全部象棋内容，调整律的测试与说明，验证后发布不含象棋的律。

- 删除前备份分支：`backup/agy-source-before-xiangqi-split-20261026-211222`，提交 `8d82e1893ab001478fb9de7252326c0870ca197d`。
- 目标：`xiangqi.html`、`css/xiangqi.css`、`js/xiangqi/`、`assets/xiangqi/`、`test/xiangqi/`、`XIANGQI_DESIGN.md`、`THIRD_PARTY_NOTICES.md`，以及六份象棋历史报告，共 62 个原文件。
- 先复制到独立项目并核对每个文件的 SHA-256，再将备份、目标和删除原因写入 progress.md 与本报告，然后移除原文件。复制时素材及代码与原文件一致；其后按独立项目需求修改入口、配置与一处命中检测。
- Pages 删除前恢复引用：`backup/pages-before-xiangqi-split-20261026-211222`，提交 `1598eda7fd22ec5875c38374528e1fefb69e0146`。
- 逐文件摘要与状态：`output/agy-source-submit-20261026-211222/xiangqi-extraction-backup.json`、`status-before-removal.txt`。

## 两个项目的边界

律的 package 名改为 lu-material-lab，npm test 改为 14 项乐队回归；乐器家族测试原来依赖被忽略的离线分析，现将 34 份既有分析 JSON 作为未编辑的测试 fixture 随源码保存。Pages 排除测试，不增加运行包负担。保留荔伴侣语音接口，仅修改原服务器的象棋名称和启动地址。

象棋项目有独立 package／lock、根入口、8011 本地服务、设计、许可、历史报告与测试；不再依赖音乐项目的 cube-motion。AI 二进制、图片和 NNUE 原文件保持。代码 GPL 与 NNUE 的非商业限制分别注明，上游条款见 [官方 Networks 说明](https://github.com/official-pikafish/Networks/blob/master/README.md)。

象棋 E2E 发现合法落点刚创建、尚未渲染时的矩阵更新竞态；在射线检测前同步场景和相机矩阵。保留士的斜走、偏移 .30 世界单位的实际点击断言，未删改行为要求。

## 验证

- AGY 最新候选独立导出：14/14 乐队测试、19/19 浏览器测试、60 个 WebGL 状态、20 次资源往返、6 种录制画幅、4 项主题切换与 15 张桌面／手机实景通过。
- 拆分后最终 Git 候选树再次独立导出：npm run check 通过，14/14 乐队测试、19/19 E2E 通过，0 失败、0 跳过；完整浏览器运行约 343 秒。fixture 已进入 Git，最终导出没有再补拷离线分析素材。
- 象棋：18 项规则、Wukong AI、模块语法通过；1440×1000 桌面与 390×844 手机完整 E2E 通过，桌面／手机页面错误均为零。实际 Pikafish 搜索达到 depth 24、10,509,977 nodes，返回 c3c4。
- Pages 运行树 `41d35aec1d588a044e6e653547ceea7c6c9674e8`，891.18 MiB，低于 1 GiB；沿用现有部署排除规则，打包只操作独立 Git 索引，不删除本地离线脚本／素材。
- 线上普通 URL 的 19 个文件 SHA-256 与发布树一致，覆盖本轮变化的运行代码及关键舞台／谱面依赖。象棋页面、样式和 NNUE 三条旧地址均返回 404。
- 全新 Chrome 访问公开 URL，主页面、乐队和混音器就绪；实际播放时间前进、AudioContext 为 running。播放后的两秒采样约 60.06 fps，121 个 rAF、60 次 UI 同步；1280px 与 390px 实景无横向溢出，页面异常为零。
- 源码检查未发现敏感密钥模式或超限新文件。第三方许可及 vendor 文件保留原字节，原有换行／尾空白不做改写；新增业务源码差异检查通过。

自动化只能证明短时播放、实际音轨数据与短片导出，不据此承诺消除全部主观听感杂音；实体手机、弱网和整首录制未复验。

## 本地证据

所有本轮测试日志、独立源码快照、发布索引、Git 回读、19 个公开文件摘要、三条移除证明及线上桌面／手机截图都在 `output/agy-source-submit-20261026-211222/`。象棋截图位于独立项目的 `output/playwright/`。

仍在并行制作的 film/ 实验、根目录试片及无关历史报告没有纳入这次源码或 Pages；既有文件没有被移动或清理。未更改代理配置，浏览器验证只继承现有代理环境。

## 发布边界

收尾时另发现 css/lu-perceptual-ui.css 与 js/ui/lu-perceptual-ui.js 的新增按钮材质工作，分别约 289 行 CSS 与 3 行 JS。本轮源码与 Pages 保持上述已验快照，没有纳入这两份后续未验修改。已保留原文件，并将差异保存为 later-ui-work.patch；收尾提交只更新本报告和进度索引，不修改已发布的运行代码。
