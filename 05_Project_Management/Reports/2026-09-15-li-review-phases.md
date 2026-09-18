# 荔 / LI · 三阶段修订未通过视觉验收

状态：用户与 AGY 明确否决当前视觉结果。Agent：codex。2026-09-15。

当前 `li-mascots.blend`、两套 GLB 与 `output/blender-mcp/*-final.png` 均属于未通过验收的尝试，不作为批准后的造型基线。停止继续运行旧模型的增补脚本；保留源文件与失败对照，未删除资产，未提交或发布。

用户指出的主要缺陷：兜帽开口破碎、领口与手指臃肿、绳体走势生硬；果壳过度软化、眼神呆板；宇航员面罩轮廓失真，臂章、胸盒、软管与推进器缺乏自然或机械装配关系。用户本次审阅优先于此前的技术通过记录。

已执行过的技术检查只证明局部网格闭合、模型可以导出和交互入口能够运行，不能证明参考图保真度。`phase-review-checks.json` 中的零边界边、8 颗螺栓和共用面罩尺寸均不能替代视觉验收。工作室曾通过角色、材质、表情、动作、音乐暂停续播和 390px 布局检查；独立 `review.html` 的最新移动端检查发现横向溢出，未标为通过。证据在 `output/playwright/li-review-phases-qa.log`、`li-review-phases-audio.log`、`li-review-page-qa.log`。

保留入口：

- 当前失败模型：`assets/mascots/blender/li-mascots.blend`。
- 各阶段来源：同目录的 `li-mascots-phase1.blend`、`li-mascots-phase2.blend`、`li-mascots-phase3.blend`。
- 修改前备份：`output/backups/li-before-review-phases-20260915/`，原渲染位于其 `renders/`。
- 工程参考：`design_sheets/ortho_blueprints/`，继续作为造型依据。

重建建议：先以 Image-to-3D 生成一版荔小卫基模，仅检验三视向剪影、头脸包裹关系、握绳姿态和鞋型。通过造型审阅后，再进入 Blender 连续曲面修型、UV/材质与独立机械装配。不承诺生成模型天然具有合格的动画拓扑或开模条件。若无可用生成服务，则先做同一范围的 Blender 连续曲面灰模验证，不恢复旧有碎件增补路线。

实测能力：当前 Blender MCP 含 Rodin 与 Hunyuan3D 入口，但均处于禁用状态。尚未发起任何图生三维或消耗第三方生成额度。已向用户询问可用服务账号，等待选择重建入口。

根因复盘：codex 过早将检查重点转向部件数量、闭合性、渲染和导出，未在整体造型阶段以用户参考进行有效视觉筛选。下一轮的阶段证据应包含无纹理灰模、正侧背轮廓对照与近景，不能再以技术检查结果宣称高保真完成。
