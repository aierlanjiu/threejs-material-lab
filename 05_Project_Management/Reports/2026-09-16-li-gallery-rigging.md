# 荔：暖光藏品室与绑定修复

- Agent: codex
- 用户已选择效果图 3，并批准本轮由 Codex 直接实施主题、绑定和验收。
- 状态：2026-09-17 用户要求暂停全身修复；后续仅处理叶片连接、小星消失与小幅手臂动作，见 [本轮范围与实测](2026-09-17-li-leaf-visibility-small-gestures.md)。

## 恢复点

备份：`output/backups/li-gallery-rig-20260916-160256/before.tar`。包含本轮页面、样式、动作源代码、Blender 脚本、两套 GLB、源工程及原进度文档。`git-status.txt` 保存工作区基线，`tracked.patch` 保存原有已跟踪修改。本轮不删除任何磁盘文件。

## 已确认基线

- 两套资产各 21 骨，Arm 是非变形辅助骨，与 UpperArm 重叠但非零长度。
- 卫衣抽绳无独立骨，权重混入手、头和腿。
- 实际动作入口为 js/mascot/hunyuan-mascot.js。
- 移动端舞台 375px，画布 709px，角色被裁切。
- 原工程与 GLB 均包含五组面部表情。
