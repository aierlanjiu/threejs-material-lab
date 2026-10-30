# 律：现成模型选型与本地集成

日期：2026-10-23。Agent：codex。

## 交付状态与授权

用户明确要求「找到可以使用的模型而不是重新开发，找到后开始集成」，随后确认「来源不限，以律的风格和性能为准」。本轮已找到、下载并在乐队舞台接入 9 个现成 GLB；29 位主角及其原有乐器图集保持不变。当前完成本地集成与本报告列明的检查，未提交或发布，未进行实体手机性能验收。

此前 [v1.0 开发文档](2026-10-23-lu-dream-concert-development.md) 与 [Gemini 审阅及 codex 复核](2026-10-23-lu-dream-concert-gemini4-review.md) 保留为决策过程证据；本轮用户确认使「现成模型适配接入」取代其中的程序化资产制作建议。未新建角色、音轨、交互玩法或页面设计。

## 已采用的模型

| 用途 | 原模型 / 作者 | 来源 | 授权 | 文件字节数 / 原模型三角面 |
| --- | --- | --- | --- | --- |
| 两侧浮岛 | Floating Island / J-Toastie | [原页](https://poly.pizza/m/HnfcEtSmUC) | CC BY 3.0 | 12,864 / 134 |
| 海贼王珊瑚 | Coral / Poly by Google | [原页](https://poly.pizza/m/4KUXdtDdgHR) | CC BY 3.0 | 312,996 / 817 |
| 龙珠晶石 | Crystal Rock / Cheryl Fong | [原页](https://poly.pizza/m/blzFYMl93Rf) | CC BY 3.0 | 8,736 / 71 |
| 火影竹叶 | crops_bambooStageB / Kenney | [Nature Kit](https://kenney.nl/assets/nature-kit) | CC0 | 40,144 / 564 |
| 岛面叶簇 | grass_leafs / Kenney | [Nature Kit](https://kenney.nl/assets/nature-kit) | CC0 | 4,608 / 36 |
| 共用音箱 | Speaker / Kenney | [Furniture Kit](https://kenney.nl/assets/furniture-kit) | CC0 | 15,744 / 228 |
| 共用返听 | Floor Monitor / Peter Simcoe | [原页](https://poly.pizza/m/2827m06VfIA) | CC BY 3.0 | 142,124 / 1,740 |
| 共用功放 | Guitar Amp / Poly by Google | [原页](https://poly.pizza/m/3FiWjHDj0Zf) | CC BY 3.0 | 178,200 / 1,450 |
| 共用灯头 | Motorised Spotlight / iPoly3D | [原页](https://poly.pizza/m/BLq0yBWHce) | CC0 | 42,448 / 1,070 |

总计 **757,864 字节，约 740KiB**。原始 GLB 字节保持原样；来源、下载信息、SHA-256、作者及适配说明位于 [模型清单](../../assets/models/band-concert/manifest.json)。这批模型来自 Kenney 与 Poly Pizza，不是 NVIDIA SimReady。另检查了 Quaternius 的一款竹杆候选，但没有加入运行资产。

GLB 均为 2.0、自包含资源，无必需扩展或额外几何/纹理解码器。Kenney 包内 `License.txt` 已随选中资产保留。CC BY 3.0 模型按原页链接明确作者、作品、许可证及改动说明，见 [模型署名页](../../assets/models/band-concert/credits.html)；主入口免责声明与独立预览均提供入口。授权条件依据 [Creative Commons 官方说明](https://creativecommons.org/licenses/by/3.0/)，第三方模型独立适用其许可证，不受本项目非商业说明额外限制。

## 集成方式与文件边界

- 新增 `js/ui/band-concert-props.js`：加载本地模型、统一比例与原点、按原材质合并模型零件，并把重复设备做成实例化绘制；共享几何跨主题与画幅复用。新增节点独立于舞台 `disposeTree(root)`，实例缓冲在重配/释放时单独 dispose，原模型资源由本场景 bundle 一次性释放。
- 新增 `js/ui/band-concert-motion.js`：仅采样歌曲时间与既有灯光状态；浮动不超过 0.065 世界单位，缓慢转向不超过 0.035 rad。暂停、seek、off、reduced 不依赖历史帧，也不新增 RAF 或音频分析。
- 修改 `band-stage.js`：以现成模型替换原视觉设备，保持 4 只箱体、2 个返听、2 个功放、8 个灯头；沿用原灯源与光束。模型缺失时对应设备保留原有几何作为降级路径，不重复叠加。配置后重放当前 props 状态，保证暂停切主题/画幅也有正确姿态。
- 修改 `band-scene.js`：初始化加载模型，向舞台显式传递 `settings.effects`；新增完整帧调用统计及侧景完整包围范围诊断。没有改变演员取景点集、角色参数、命中逻辑、混音或控制器。
- 新增 `test/band-concert-models.test.mjs`；新增模型目录及授权文件；在 `index.html`、`band-study.html`、`DISCLAIMER.md` 增加署名入口/授权说明。

浮岛横屏锚点为 `x=±11.65, y=3.75, z=-4.55`，宽 2.8；窄竖屏为 `x=±4.45, y=7.45, z=-4.75`，宽 1.75。三主题分别使用珊瑚、晶石与竹叶/叶簇，沿用原帆幕、七星球拱架、鸟居和灯笼。这些参数是当前已检查配置，不是任意角色参数、拖动位置或镜头下都安全的保证。

## 验证结果

1. **文件与回归检查通过**：9 个原始模型的摘要、自包含 GLB、授权字段和总包体检查通过；确定性 motion 的 seek、quiet auto、off、reduced、位移/转向边界通过；既有 `band-stage.test.mjs`、`band-pyro-realism.test.mjs` 与本轮修改模块的语法检查通过；`git diff --check` 通过。29 个 pet 摘要与审阅前清单一致。
2. **浏览器矩阵通过**：三主题 × `1440×900 / 390×844 / 342×740` × 五队形，共 45 状态；全部 9 个模型成功加载，设备数量正确，两座浮岛及其植物的完整包围范围处于近远裁剪与视锥范围内。使用主控制器的 `safeTop=130 / safeBottom=85`。
3. **同条件基线对照通过**：从本轮前备份构建仅加计量的旧版本，逐项对照 45 状态。相机参数、每位角色投影包围范围完全相等，未通过缩小角色或拉远镜头容纳布景。
4. **状态与生命周期检查通过**：暂停状态下切主题/画幅、`t1→t2→t1`、off/reduced 稳定状态，以及 20 轮三主题/横竖切换后，再增加 5 组往返，props 共享资源保持 104、主题材质池稳定在 48，没有持续增加。
5. **完整帧成本已比较**：包含主渲染、原有透射背景、阴影与辉光绘制的调用数，在相同 45 状态中较旧版本减少 **14–74 次/帧**；最终整帧调用数为 195–269。现成模型模块可见几何为 16,476–17,826 三角面；完整帧三角面提交量增加约 25,428–33,580。调用数下降不等于 GPU 耗时或实体手机帧率已通过。
6. **主入口现场复验**：在 `390×844` 的主入口加载《偏爱》，实际播放到计时推进与歌词出现；跳到约 1:01 的真实粒子翼高潮后暂停，前排翼效/焰火存在，浮岛处于后景且未挡住角色、歌词和播放器。独立舞台与同源横竖 capture 画面也已检查。

持久证据位于 `output/playwright/concert-models/`：`models-results.json`、`baseline-results.json`、`comparison.json`、`qa.html`、三主题横竖 PNG。`models-first-pass.json` 仅为优化前记录，最终数据以 `models-results.json` 为准。主入口现场画面另见本轮浏览器工具回执。

## 尚未验证与运行入口

- 实体 iPhone/Android 帧率、GPU 时间、温升、长时间运行与弱网故障注入未验证；没有将 CPU 提交耗时称作 GPU 帧耗时。
- 本轮检查了录制使用的横竖尺寸切换与逐帧画布输出，未重新导出整首带声音 MP4。
- 45 状态采样使用固定演示时间与默认角色参数；实际主入口只对海贼王主题《偏爱》的播放/高潮做了现场补验，不能外推为所有曲目和用户自由拖动配置均通过。
- 本地预览：`http://127.0.0.1:8765/index.html?intro=skip&band=pianai`。验收页：`http://127.0.0.1:8765/output/playwright/concert-models/qa.html`。8765 使用禁止缓存的临时本地预览服务，避免旧模块缓存干扰；没有改用户代理配置。
- 改动前备份：`output/concert-model-integration-20261023/baseline/`，包含原文件、Git diff 和状态。未删除本地文件，未改 `bot.py`，未提交/发布。

Agent：codex。
