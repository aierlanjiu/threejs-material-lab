# PR #2：Entire 审查整改

Agent: codex · 2026-10-30

用户确认流程：本地开发完成后使用独立代码检查 agent，创建／更新 PR，再根据 Entire 审查整改。当前修复沿用 PR #2，不创建重复 PR，不自动合并或发布。

## 审查基线与备份

- PR：<https://github.com/aierlanjiu/threejs-material-lab/pull/2>。
- 修复前 HEAD：`d6b5c907cddca40dabde5b45e8ceb743e28c839c`；master：`ff37dd2abd3b869829003d5ea9bf6d06d28f2782`。起始工作区干净。
- Entire 原结论：1条高危未解决、无人批准、落后主干10提交；CI未上报。共3条功能发现、5条维护建议。
- 修改前建立并验证备份分支 `backup/pr2-entire-review-20261030-d6b5c90`，记录 `output/pr2-entire-20261030/backup.json`。未删除旧代码或美术资产。

## 功能修复

1. `band-mixer.js`：保存活动原声 source；释放旧 hybrid/rendered 引擎时为其保留唯一 unity 直通，准备新声部期间继续播放；用户 stop 则清除活动引用，后续配置不复活旧 source。
2. `band-mixer.js`：在委托 hybrid/rendered 之前校验当前歌曲身份；跨曲时终止旧异步准备，清空旧 ready、policy、独立声部和恢复时刻，按原音量播放新曲，避免后台切歌串轨或压低原声。
3. `band-review.js`：分析审查显式使用 `preferHybrid:false`，不再加载缺少 songBindings 的播放编配；播放端默认策略保留。
4. 两项低风险维护：移除已无运行对象的 layerTexture 清理；去掉检查页指向被忽略 output 视频的失效发布链接。完整 Canvas 动作检查和本地导出仍保留。

## 主干冲突

- `progress.md`：保留本分支与主干入场记录，因超过轻量索引大小，无损归档后保留近期记录和有效资产。
- `README.md`：仅空行冲突，保留影片展示入口。
- `lu-cube-intro.css`：保留主干全幅背景与1180ms揭幕参数。
- `core-intro.test.js`：保留本分支魔方几何、按钮等回归，同时适配主干的 effect canvas、背景位置与2D断言。
- 合并后的 `lu-cube-intro.js` 与主干一致；Entire钩子没有冲突或人为改写。

## 验证与独立检查

- 新增真实 `createBandMixer` wrapper 的6项内存音频图测试，修复前6项全失败，修复后全通过；涵盖 hybrid/rendered 清空配置保底、后台跨曲、暂停后配置不复活、准备期间保底、过期异步结果不污染当前曲。
- `npm run check`：28/28；入场特效逻辑：7/7。记录 `output/pr2-entire-20261030/{check,effects}.txt`。
- 独立代码检查 agent 已复核调用链、异步失效与合并语义，额外验证 legacy→hybrid→fallback、重复configure不叠加音路；修复增量无新增阻塞。
- 真实浏览器：We Are与偏爱审查页均载入6张候选卡；两套ASCII／Dither浏览器回归通过，覆盖桌面／移动、三主题、静止和减少动态。候选仍为模型估计，不是人工听辨通过。
- 入场测试发现旧断言按类名排除canvas，会把既有2D颗粒层误计为WebGL；已改查实际上下文并要求唯一非2D画布属于魔方，特效层仍要求全2D。独立检查agent确认未放宽约束；修正后的入场浏览器完整复验退出码0，390／1440及减少动态通过，涵盖入场／跳过／重播。
- 上传浏览器探针未完成：第一次已测到偏爱hybrid有输出，但上传状态等待条件未捕获；第二次控制器冷启动超时，达到同方案两次限制后停止。上传后的持续输出／暂停／跳转和隐藏页自动切歌没有端到端通过声明；真实wrapper音频图6项红→绿是独立证据。
- 线上Entire以PR对应head的实时检查项为准，回读证据保存到 `output/pr2-entire-20261030/`；本报告不替代线上批准。

## 未扩大实施的维护建议

- 历史骨骼素材、脚本、测试：退出运行路径但仍留作可恢复历史，本轮不按机器建议直接批量删除。
- 报告内冻结源码与一次性修补脚本：保留历史证据，暂未做仓库级清理；不影响本轮三项功能缺陷修复。
- 角色大幅动作仍缺部分中间姿态；《One day》原曲主唱与伴奏重组未在本轮实现。
