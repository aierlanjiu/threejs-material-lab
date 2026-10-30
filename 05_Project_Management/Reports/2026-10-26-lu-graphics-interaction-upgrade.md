# 律：图形、角色交互与切换优化

日期：2026-10-26（Asia/Shanghai） · Agent：codex

## 范围与状态

按用户提供的模板实现 Phase 1 → 3 → 4 → 6；分享链接相关的 Phase 5 未实施。沿用已有舞台设计与素材，保留 AGY 已完成的 Phase 2 空间音频。本轮在本地开发，未更新 GitHub Pages；先前发布的 Pages 快照仍见 [发布报告](2026-10-26-lu-current-pages-release.md)。

用户已明确同意“一并维护历史测试，争取全量通过”。历史测试维护包含旧默认模式、初始化等待、控件选择器、歌词数据与录制规则的适配，保留原有行为验证。

## 实现

| 范围 | 最终行为 | 主要文件 |
| --- | --- | --- |
| Phase 1 | rAF 节流阈值由 33ms 改为 8ms；较重的 UI 更新维持约 32ms 一次，拖拽即时更新；投影缓存复用包围盒和向量；DOM 按差异更新，命中框按半像素写入；歌词进度变化小于 .002 时跳过写入 | `js/ui/band-controller.js`、`js/ui/band-member-interactions.js`、`js/ui/band-scene.js` |
| Phase 3 | 地面光环使用带 activity / solo / muted / time 的 ShaderMaterial，并保留 opacity 访问方式；拖拽抬升 .24、倾斜限幅 .16、松手约 .45s 落地阻尼；暂停音乐后动作仍可收敛；铭牌提升到 768×144 | `js/ui/band-scene.js` |
| Phase 4 | 双风格舞台用 550ms 旧帧快照淡出及材质、背景插值过渡；连点从当前合成画面继续；录制包含快照；模式回调仍同步执行，执行后使用 CSS 光学过渡；键盘、减少动态与关闭过渡设置跳过动画 | `js/ui/band-scene.js`、`js/ui/band-festival-stage.js`、`js/ui/lu-perceptual-ui.js`、`css/lu-perceptual-ui.css` |
| Phase 6 | 主入口 importmap 统一到现有同版本 Three.js 地址；独立 HTML 与原绝对模块导入保留；首次有效渲染后空闲串行预热剩余主题角色纹理；后台、停用和销毁暂停调度，缺少 idle API 时使用 1500ms 后备计时器 | `index.html`、`js/ui/band-scene.js` |

补充修复：

- 纯音乐《Overtaken》不再请求不存在的中文歌词文件；增加“不得发出该请求”的回归检查，保留其他九首歌的源摘要校验和双语歌词。
- 减少动态情况下显示的“恢复完整动态”入口避开演出胶囊，恢复真实点击通路。
- 旧测试统一使用 8000 端口；机械魔方专项在初始化完成后显式进入 slot 模式；反重力歌词先等待异步准备；录制前完成模式切换，并断言录制期间的切换保护仍有效。

没有更换音频、角色贴图和模型。DPR 上限 2、角色纹理过滤、模型多材质颜色、歌词正规化、输入方式判断与实际 DOM ID 均保留。

## 验证

全量 `test/lu/*.test.js`：19/19 通过、0 失败、0 跳过，串行执行约 340.6 秒。包含实际音频、歌词、菜单、默认模式、减少动态、布局与短片导出；没有删除失败断言来取得通过。

已通过的专项检查：

- 14/14 乐队 Node 测试；`npm test` 的 18 项象棋规则与 Wukong AI 测试。
- 8 项真实 WebGL 专项：缓存投影与完整诊断一致、重复 DOM 更新为零、光环与高清铭牌、暂停拖拽与空间映射、可打断舞台过渡及录制合成、同步模式回调、空闲串行预热、后备计时器取消。
- 当前 1280px Chrome 播放采样：2.015 秒内 121 个 rAF、121 帧渲染、60 次重型 UI 同步，约 60.06 fps；帧间隔 p95 约 16.8ms。这是本机短时采样，不能代表所有设备或整首歌表现。
- Phase 2 保护文件摘要一致：`band-stage-layout.js`、`band-sample-player.js`、`band-hybrid-audio.js`、`band-mixer.js`、`band-glow.js`。实际 HTML ID 集合无增删；修改模块语法检查及 `git diff --check` 通过。
- 几何检查覆盖三档、七阵型的 70 组稳态组合，每组 60 帧，稳态实体相交为零。21 次换阵过程中仍记录到最大约 .026 世界单位的轻微穿透；既有测试仅记录换阵穿透，本轮没有改动几何引擎或弱化这一测试。
- 实际有声 MP4：1080×1920 和 1920×1080 两画幅导出通过；反重力切换后的录制含视频与音轨，时长约 2.88 秒，切换约 3.4ms。
- 视觉验收：真实 WebGL 60 个舞台状态、20 次风格资源往返、6 种录制尺寸与销毁检查通过；4 项主题切换回归通过。三主题 × 双风格 × 桌面／手机共 12 张画面，加上桌面鼠标独奏、移动端真实 touch 事件独奏及 320px 窄屏，共 15 张截图，页面异常为零、无横向溢出。已人工查看奶油／海岛、桌面／手机、独奏铭牌和 320px 画面。

测试浏览器使用本机 Chrome；临时启动适配脚本仅继承现有代理环境变量，没有更改用户代理配置。8 项历史失败在改动前快照也可复现，证据保存在 `baseline-e2e.log`。

## 复核入口与证据

- 验证目录：`output/band-upgrade-20261026-161545/`。
- 本机截图画廊：[打开验收画廊](http://localhost:8000/output/band-upgrade-20261026-161545/review.html)；原图与状态见 `screens/`、`visual-audit.json`，需要在仓库根目录提供 8000 静态服务。
- 本轮源差异：`implementation-review.patch`，按改动前物理副本比较，包含原本未跟踪或忽略的文件；不混入此前 AGY 的工作树差异。
- 静态检查：`static-validation.json`；Node / AI：`node-tests.log`、`npm-final.log`；完整 E2E：`ui-final-complete.log`。
- 新增专项：`test/band-upgrade.browser.html`、`test/lu/band-upgrade.test.js`。
- 本轮文件摘要：`delivery-source-sha256.json`；完整进度归档核对：`progress-archive.json`。

本机复跑命令（先在仓库根目录启动 `python3 -m http.server 8000 --bind 127.0.0.1`）：

```sh
node --test test/band-*.test.mjs
npm test
LU_TEST_BROWSER=chrome node --import ./output/band-upgrade-20261026-161545/playwright-env.mjs --test --test-timeout=600000 --test-concurrency=1 test/lu/*.test.js
LU_TEST_BROWSER=chrome node --import ./output/band-upgrade-20261026-161545/playwright-env.mjs output/band-upgrade-20261026-161545/visual-audit.mjs
```

## 恢复与边界

- 改动前 Git 快照：`backup/band-upgrade-20261026-161545`，提交 `c954c07f601eb3cf043fe9f3b47b2590f466d90a`；常规工作树与索引保持原位。
- 原始文件副本：验证目录中的 `baseline/`、`baseline-tests/`，摘要与 Git 位置见 `baseline.json`、`baseline-tests.json`。增补的歌词加载模块也已在修改前物理备份。
- 原进度文件超过 20KB，已无损备份至 [完整进度归档](progress_full_archive_20261026_before_graphics_upgrade.md)，21,408 字节，SHA-256 `359e0d1742a99d02c777d0cde3dee1d6b3c4bf1853f628c2197cfa687f9e5699`，回读一致后再整理轻量索引。
- 实体手机、弱网与整首有声录制尚未复验。本轮自动化录制只能证明短片导出与画幅、音轨存在。
- 本轮没有提交、推送或部署新的优化版本；既有线上冷启动加载问题不据此宣称已解决。
