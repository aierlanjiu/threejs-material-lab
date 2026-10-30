# 律 LÜ · 9:16 黑金演出宣传片（深度创新版）

2026-10-19 · Agent: Antigravity + Codex

按用户要求，在原有 45 秒实机宣传片与 30 秒黑金版基础上完成深度创新升级，交付 9:16 竖屏成片与独立封面。

## 交付清单

- 成片：[lu-premium-30s-9x16.mp4](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/lu-premium-30s-9x16.mp4)，1080×1920，60fps，1800 帧，30.000 秒；H.264 / AAC 48kHz 双声道；28,589,411 字节。
- 封面：[lu-premium-cover-9x16.jpg](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/lu-premium-cover-9x16.jpg)，1080×1920（源图 [lu-premium-cover.png](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/lu-premium-cover.png)）。
- 模块化渲染器：[render.py](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/render.py) 与视觉特效组件 [wing_helper.py](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/wing_helper.py)。
- 分轨时间与 60fps 包络数据：[audio-timing.json](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/audio-timing.json)。
- 分镜与验证报告：[storyboard.jpg](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/verify/storyboard.jpg)、[validation.json](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/verify/validation.json)、[font-coverage.json](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/verify/font-coverage.json)。

## 核心深度创新与修复

1. **5 路真实分离音轨交互编排（含主唱 Vocals）**：
   - 接入《シルエット》高潮段（45.05s–75.05s）全部 5 路真实分轨（`vocals`、`guitar`、`bass`、`drums`、`piano`），按 182.98 BPM 双拍网格严格对齐。
   - **第 2 幕「点按进退」二级递进分轨静音**：2.92s 第一次点按先静音主唱轨（`主唱轨静音 · 器乐伴奏继续`），3.71s 第二次点按叠加静音鼓组轨（`主唱 + 鼓组静音 · 贝斯吉他律动`），4.56s 鼓点过门处第三次点按恢复 5 轨全开合奏。
   - **第 3 幕「长按独奏」聚光特写**：5.37s–7.77s 锁定乌索普吉他 SOLO（吉他轨增益 +62%，其余四轨平滑压低），配以 360° 金色能量进度环与胶囊状态指示。
2. **真实 WebGL 粒子翼抠像 + 金青双色动态光羽（[wing_helper.py](file:///Users/papazed/dev/threejs-material-lab/output/edit/codex-20261019-lu-premium/wing_helper.py)）**：
   - 从实机 WebGL 录屏 `energy-wing-closeup.mp4` 提取青色粒子翼动态序列，叠加二次贝塞尔金青光羽，严格锚定在角色肩部（`top + h * 0.51`），随 60fps 音频包络呼吸张合。
3. **黑曜石镜面地面实时倒影 + 烟晶半透明声学阶梯**：
   - 为舞台前排角色生成垂直翻转、透视压缩、高斯柔化与纵向渐隐的黑曜石地面倒影，以及随鼓点 RMS 脉冲缩放的脚底全息光环。
   - 将原先遮挡背景的纯黑矩形阶梯升级为半透明烟晶弧形阶梯，并在前缘嵌入 60fps 音频响应 EQ 灯柱。
   - 修正两侧角色水平安全边距（`x=215..865`），彻底消除画面左右边缘裁切问题。

## 验收结果

- **视频规格**：1080×1920，60/1 fps，1800 帧，30.000s，H.264 + AAC 48kHz 双声道。
- **音频响度**：综合响度 `-13.04 LUFS`，真峰值 `-4.70 dBTP`，LRA `2.00 LU`，无削波。
- **字体覆盖**：中文 `Hiragino Sans GB` 与拉丁 `Arial Bold` 全字符集校验通过（`missing_cjk: []`, `missing_latin: []`），`Ü` 与符号显示正常。
- **成片 SHA-256**：`b3b598d4bcc38ab8bb6157c0492a0256cfe9e81630503573a233d2d334b8acc2`。
