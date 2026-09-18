# 荔 / LI · Blender MCP 形体与细节重建

Agent: codex · 2026-09-15

## 当前交付

- [模型与工程参考对照页](../../output/blender-mcp/review.html)，含双角色正面、90° 侧面、背面，以及兜帽口、手臂、鞋子三张近景。
- [可编辑 Blender 主文件](../../assets/mascots/blender/li-mascots.blend)。六张工程参考图已打包进文件；默认选中荔小卫，保留荔小星与独立部件层级。
- [荔小卫 GLB](../../assets/mascots/blender/hoodie-lychee.glb)、[荔小星 GLB](../../assets/mascots/blender/astro-lychee.glb)，由 Blender 导出并实际接入 `mascot_studio.html`。
- 本地工作室：`http://127.0.0.1:8000/mascot_studio.html`。对照页：`http://127.0.0.1:8000/output/blender-mcp/review.html`。

## 建模依据与具体修订

唯一尺寸基准沿用 `design_sheets/ortho_blueprints/` 六张正交与分件图。新模型没有导入旧 Three.js 原型的几何。

| 部位 | 本轮实现 |
| --- | --- |
| 兜帽 | 上窄下宽的圆顶外形、下移的脸部开口；连续红色边沿衬底和起伏奶白内衬，补齐开口边缘暗缝 |
| 果壳 | 连续球面 Voronoi 网格、宽颗粒顶部和细星状纹路；衣身采用更密的颗粒，保留局部色差 |
| 手臂 | 弯曲袖子、内收手势、袖口与手掌衔接、拇指和绿色抽绳果实；手掌向抽绳靠拢 |
| 鞋子 | 连续曲面鞋帮与鞋头、圆弧鞋底、短靴筒、奶白脚踝和侧面扣；宇航靴与膝部密封圈重叠连接 |
| 面部 | 减薄眼球突出量、独立眼白与眼睛高光、果肉顶点色腮红、小卫弧形微笑与小星开口笑 |
| 枝叶 | 有厚度和弯曲的叶片、主脉与侧脉、枝柄和萼片；调整叶片朝向以兼顾正侧视图 |
| 宇航部件 | 独立玻璃面罩、金属密封圈、耳机、背包、双喷口、胸前模块、肩带与软管 |

荔小卫的最终 Blender 世界坐标量测：头宽 **2.2394**、头高 **1.7157**，宽高比 **1.305**；工程图量取值约 **513 / 393 = 1.305**。身体宽度 **1.7733**，为头宽的 **79.19%**，工程图约 **80.31%**。这是宏观尺寸量测，尚未做逐像素轮廓误差统计。数据见 [proportions.json](../../output/blender-mcp/proportions.json)。

## 实际 MCP 链路

本机 Blender 5.1.2；上游 `blender-mcp==1.9.1`。通过 Python MCP SDK 的 stdio ClientSession 调用真实的 `get_scene_info` 与 `execute_blender_code`，再由 Blender 插件在主线程执行建模、渲染与导出。当前会话没有直接暴露 Blender 工具命名空间，因此用本地 MCP 客户端完成调用。

- 执行入口：`scripts/blender/mcp_client.py`；建模与分轮校准脚本位于同目录。
- Blender 插件安装在用户 Blender 5.1 的 scripts/addons 目录，监听本机 9876；遥测关闭。
- Blender 偏好备份：`output/blender-mcp/config-backup/userpref-before-mcp.blend`。
- 连接与执行证据：`output/blender-mcp/connection.log`、`build-v2.log`、`calibration.log`、`export-calibrated.log`、`master-ready.log`。
- 原工作室脚本备份：`output/backups/li-before-ortho-20260915/studio-before-blender.js`；前期 AGY 基线与正交调整备份仍保留。

## 运行与验证

- 实时几何由新增 `js/mascot/blender-lychee.js` 加载 GLB；头部、身体、眼睛、嘴、手臂分件与现有 UI、表情、动作、音频分析连接。
- 导出保留原始可编辑主文件，单独制作交付副本，合并同材质静态部件与眼睛光学层；只导出当前场景，防止重复场景进入 GLB。
- 小卫 **76,984** 三角面、**26** Mesh，GLB 约 **2.44 MB**；小星 **76,955** 三角面、**35** Mesh，GLB 约 **2.23 MB**。以 [manifest.json](../../assets/mascots/blender/manifest.json) 为准。
- 柔化阴影切换为 PCF，消除 VSM 对接收阴影部件的额外绘制。小星实测由 124 次降为约 **91 次**；透明面罩重新调整正反面、透射率与反射，恢复眼睛和嘴的清晰度。
- 双角色、六个材质按钮、八次表情切换、十一种动作触发、三种正交视图和分件加载合同通过浏览器验证。
- 本地对话完成实际提交与回复；`test/intent_bridge.test.js` 四组断言通过。AGY 桥接 `/status` 返回 running，`agy_available=true`。
- 10 秒本地测试 WAV 实际加载、播放、暂停及续播通过；音频能量峰值 **0.896**，模型起伏幅度 **0.0349**。验证的是本地文件链路，未重新验证六首远程曲目的可用性。
- 桌面 1440×1000、移动 390×844 检查，无页面水平溢出；脚本语法检查通过。浏览器验证记录在 `output/playwright/li-blender-verified.log`、`li-blender-audio-qa.log`。

## 明确的剩余差异

宏观比例和指定部件已经修订，形象仍需视觉审阅。果壳的局部颗粒分布、微观纹理、果肉透光，以及衣服与手部的有机形态仍与原图存在差别；不宣称逐像素或雕塑级完全复刻。

浏览器采用 PBR 近似，效果与 Cycles 次表面散射不同。绒材质仍为粗糙度与 sheen 近似，没有逐根毛发。当前缩壳动作为头部回缩，未实现抽绳牵引的布料闭合模拟；表情仍由部件形变驱动。声音互动控制表情，完整语音识别对话没有在本轮实现或验收；本次未验证 AGY 文本生成端到端回复。采样帧率约 48–50 FPS，未宣称满足稳定 60 FPS。

本轮仅本地修改，未提交、未推送、未发布。原项目与 AGY 接口文件保持在工作区，可继续迭代主文件并重新导出。
